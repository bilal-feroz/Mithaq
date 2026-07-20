/**
 * LocalStore — the in-process demo backend.
 *
 * Node's single-threaded execution makes each synchronous mutation atomic;
 * every "check-and-set" operation below completes without interleaving, which
 * is what the single-use token consumption and usage increments rely on.
 * State lives on globalThis so route handlers, server components and server
 * actions share one instance per server process.
 */
import type {
  AmendmentRequest,
  AuditEvent,
  ConsentPolicy,
  DecisionTokenRecord,
  GeneratedAsset,
  GenerationRequest,
  Organization,
  Profile,
  RequestStatus,
  StoredDecision,
  VoiceProfile,
} from "@/domain/types";
import { computeEventHash, computePayloadHash } from "@/domain/audit";
import { opaqueId } from "@/domain/hash";
import type {
  AuditEventInput,
  DataStore,
  TokenConsumeResult,
  VoiceWithPolicy,
} from "./types";
import { buildSeedState, type SeedState } from "./seed";

type LocalState = SeedState & {
  assetBytes: Map<string, Buffer>;
};

export class LocalStore implements DataStore {
  private state: LocalState;

  constructor() {
    this.state = { ...buildSeedState(), assetBytes: new Map() };
  }

  async reset(): Promise<void> {
    this.state = { ...buildSeedState(), assetBytes: new Map() };
  }

  // ── identity ─────────────────────────────────────────────────────────

  async getProfile(id: string): Promise<Profile | null> {
    return this.state.profiles.find((profile) => profile.id === id) ?? null;
  }

  async getOrganization(id: string): Promise<Organization | null> {
    return this.state.organizations.find((org) => org.id === id) ?? null;
  }

  async getOrganizationForProfile(
    profileId: string,
  ): Promise<Organization | null> {
    const membership = this.state.organizationMembers.find(
      (member) => member.profileId === profileId,
    );
    if (!membership) return null;
    return this.getOrganization(membership.organizationId);
  }

  async getVoice(id: string): Promise<VoiceProfile | null> {
    return this.state.voiceProfiles.find((voice) => voice.id === id) ?? null;
  }

  async listVoicesWithPolicies(): Promise<VoiceWithPolicy[]> {
    const result: VoiceWithPolicy[] = [];
    for (const voice of this.state.voiceProfiles) {
      result.push({
        voice,
        owner: await this.getProfile(voice.ownerId),
        latestPolicy: await this.getLatestPolicyForVoice(voice.id),
      });
    }
    return result;
  }

  // ── consent policies ─────────────────────────────────────────────────

  async getPolicy(id: string): Promise<ConsentPolicy | null> {
    return (
      this.state.consentPolicies.find((policy) => policy.id === id) ?? null
    );
  }

  async getLatestPolicyForVoice(
    voiceId: string,
  ): Promise<ConsentPolicy | null> {
    const versions = await this.listPolicyVersionsForVoice(voiceId);
    return versions.at(-1) ?? null;
  }

  async listPolicyVersionsForVoice(voiceId: string): Promise<ConsentPolicy[]> {
    return this.state.consentPolicies
      .filter((policy) => policy.voiceId === voiceId)
      .sort((a, b) => a.version - b.version);
  }

  async insertPolicy(policy: ConsentPolicy): Promise<void> {
    this.state.consentPolicies.push(structuredClone(policy));
  }

  async createPolicyVersion(
    newPolicy: ConsentPolicy,
    supersededPolicyId: string,
    updatedAt: string,
  ): Promise<void> {
    const superseded = this.state.consentPolicies.find(
      (policy) => policy.id === supersededPolicyId,
    );
    if (!superseded) {
      throw new Error(`Policy to supersede not found: ${supersededPolicyId}`);
    }
    if (superseded.status !== "active") {
      throw new Error(
        `Only an active policy can be superseded (found ${superseded.status})`,
      );
    }
    // Synchronous block: both writes land together or not at all.
    superseded.status = "superseded";
    superseded.updatedAt = updatedAt;
    this.state.consentPolicies.push(structuredClone(newPolicy));
  }

  async incrementPolicyUsage(
    policyId: string,
    grantId: string | null,
    updatedAt: string,
  ): Promise<ConsentPolicy> {
    const policy = this.state.consentPolicies.find(
      (entry) => entry.id === policyId,
    );
    if (!policy) throw new Error(`Policy not found: ${policyId}`);
    if (grantId) {
      const grant = policy.grants.find((entry) => entry.id === grantId);
      if (!grant) throw new Error(`Grant not found: ${grantId}`);
      if (grant.assetsUsed >= grant.maximumAssets) {
        throw new Error("Grant allowance exhausted");
      }
      grant.assetsUsed += 1;
    } else {
      if (policy.assetsUsed >= policy.maximumAssets) {
        throw new Error("Policy allowance exhausted");
      }
      policy.assetsUsed += 1;
    }
    policy.updatedAt = updatedAt;
    return structuredClone(policy);
  }

  async revokePolicy(
    policyId: string,
    revokedAt: string,
  ): Promise<ConsentPolicy> {
    const policy = this.state.consentPolicies.find(
      (entry) => entry.id === policyId,
    );
    if (!policy) throw new Error(`Policy not found: ${policyId}`);
    if (policy.status === "revoked") return structuredClone(policy);
    policy.status = "revoked";
    policy.revokedAt = revokedAt;
    policy.updatedAt = revokedAt;
    return structuredClone(policy);
  }

  // ── generation requests ──────────────────────────────────────────────

  async insertRequest(request: GenerationRequest): Promise<void> {
    this.state.generationRequests.push(structuredClone(request));
  }

  async getRequest(id: string): Promise<GenerationRequest | null> {
    const found = this.state.generationRequests.find(
      (request) => request.id === id,
    );
    return found ? structuredClone(found) : null;
  }

  async updateRequestStatus(
    id: string,
    status: RequestStatus,
    updatedAt: string,
  ): Promise<void> {
    const request = this.state.generationRequests.find(
      (entry) => entry.id === id,
    );
    if (!request) throw new Error(`Request not found: ${id}`);
    request.status = status;
    request.updatedAt = updatedAt;
  }

  async listRequestsForOrganization(
    organizationId: string,
  ): Promise<GenerationRequest[]> {
    return this.state.generationRequests
      .filter((request) => request.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => structuredClone(request));
  }

  async listRequestsForOwner(ownerId: string): Promise<GenerationRequest[]> {
    const voiceIds = this.state.voiceProfiles
      .filter((voice) => voice.ownerId === ownerId)
      .map((voice) => voice.id);
    return this.state.generationRequests
      .filter((request) => voiceIds.includes(request.voiceId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => structuredClone(request));
  }

  // ── decisions ────────────────────────────────────────────────────────

  async insertDecision(decision: StoredDecision): Promise<void> {
    this.state.policyDecisions.push(structuredClone(decision));
  }

  async getDecision(id: string): Promise<StoredDecision | null> {
    const found = this.state.policyDecisions.find(
      (decision) => decision.id === id,
    );
    return found ? structuredClone(found) : null;
  }

  async getLatestDecisionForRequest(
    requestId: string,
  ): Promise<StoredDecision | null> {
    const all = await this.listDecisionsForRequest(requestId);
    return all.at(-1) ?? null;
  }

  async listDecisionsForRequest(requestId: string): Promise<StoredDecision[]> {
    return this.state.policyDecisions
      .filter((decision) => decision.requestId === requestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((decision) => structuredClone(decision));
  }

  // ── decision tokens ──────────────────────────────────────────────────

  async insertTokenRecord(record: DecisionTokenRecord): Promise<void> {
    this.state.decisionTokens.push(structuredClone(record));
  }

  async getTokenRecord(jti: string): Promise<DecisionTokenRecord | null> {
    const found = this.state.decisionTokens.find((token) => token.jti === jti);
    return found ? structuredClone(found) : null;
  }

  async consumeToken(
    jti: string,
    consumedAt: string,
  ): Promise<TokenConsumeResult> {
    const record = this.state.decisionTokens.find((token) => token.jti === jti);
    if (!record) {
      return { ok: false, reason: "TOKEN_UNKNOWN", record: null };
    }
    if (record.status !== "minted") {
      // Replay or already-invalidated token.
      return {
        ok: false,
        reason:
          record.status === "consumed" ? "TOKEN_REPLAYED" : "TOKEN_INVALIDATED",
        record: structuredClone(record),
      };
    }
    record.status = "consumed";
    record.consumedAt = consumedAt;
    return { ok: true, record: structuredClone(record) };
  }

  async markTokenRejected(jti: string, reason: string): Promise<void> {
    const record = this.state.decisionTokens.find((token) => token.jti === jti);
    if (!record) return;
    if (record.status === "minted") {
      record.status = "rejected";
      record.rejectedReason = reason;
    }
  }

  async listTokensForRequest(
    requestId: string,
  ): Promise<DecisionTokenRecord[]> {
    return this.state.decisionTokens
      .filter((token) => token.requestId === requestId)
      .sort((a, b) => a.mintedAt.localeCompare(b.mintedAt))
      .map((token) => structuredClone(token));
  }

  // ── amendments ───────────────────────────────────────────────────────

  async insertAmendment(amendment: AmendmentRequest): Promise<void> {
    this.state.amendmentRequests.push(structuredClone(amendment));
  }

  async updateAmendment(amendment: AmendmentRequest): Promise<void> {
    const index = this.state.amendmentRequests.findIndex(
      (entry) => entry.id === amendment.id,
    );
    if (index === -1) throw new Error(`Amendment not found: ${amendment.id}`);
    this.state.amendmentRequests[index] = structuredClone(amendment);
  }

  async getAmendment(id: string): Promise<AmendmentRequest | null> {
    const found = this.state.amendmentRequests.find((entry) => entry.id === id);
    return found ? structuredClone(found) : null;
  }

  async listAmendmentsForOwner(ownerId: string): Promise<AmendmentRequest[]> {
    const voiceIds = this.state.voiceProfiles
      .filter((voice) => voice.ownerId === ownerId)
      .map((voice) => voice.id);
    return this.state.amendmentRequests
      .filter((amendment) => voiceIds.includes(amendment.voiceId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((amendment) => structuredClone(amendment));
  }

  async listAmendmentsForOrganization(
    organizationId: string,
  ): Promise<AmendmentRequest[]> {
    return this.state.amendmentRequests
      .filter((amendment) => amendment.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((amendment) => structuredClone(amendment));
  }

  async getPendingAmendmentForRequest(
    requestId: string,
  ): Promise<AmendmentRequest | null> {
    const found = this.state.amendmentRequests.find(
      (amendment) =>
        amendment.requestId === requestId && amendment.status === "pending",
    );
    return found ? structuredClone(found) : null;
  }

  async listAmendmentsForRequest(
    requestId: string,
  ): Promise<AmendmentRequest[]> {
    return this.state.amendmentRequests
      .filter((amendment) => amendment.requestId === requestId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((amendment) => structuredClone(amendment));
  }

  // ── generated assets ─────────────────────────────────────────────────

  async insertAsset(asset: GeneratedAsset, bytes: Buffer): Promise<void> {
    this.state.generatedAssets.push(structuredClone(asset));
    this.state.assetBytes.set(asset.id, Buffer.from(bytes));
  }

  async getAsset(id: string): Promise<GeneratedAsset | null> {
    const found = this.state.generatedAssets.find((asset) => asset.id === id);
    return found ? structuredClone(found) : null;
  }

  async getAssetByVerificationId(
    verificationId: string,
  ): Promise<GeneratedAsset | null> {
    const found = this.state.generatedAssets.find(
      (asset) => asset.verificationId === verificationId,
    );
    return found ? structuredClone(found) : null;
  }

  async getAssetBytes(id: string): Promise<Buffer | null> {
    return this.state.assetBytes.get(id) ?? null;
  }

  async getAssetForRequest(requestId: string): Promise<GeneratedAsset | null> {
    const found = this.state.generatedAssets.find(
      (asset) => asset.requestId === requestId,
    );
    return found ? structuredClone(found) : null;
  }

  async listAssetsForOrganization(
    organizationId: string,
  ): Promise<GeneratedAsset[]> {
    return this.state.generatedAssets
      .filter((asset) => asset.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((asset) => structuredClone(asset));
  }

  async listAssetsForOwner(ownerId: string): Promise<GeneratedAsset[]> {
    const voiceIds = this.state.voiceProfiles
      .filter((voice) => voice.ownerId === ownerId)
      .map((voice) => voice.id);
    return this.state.generatedAssets
      .filter((asset) => voiceIds.includes(asset.voiceId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((asset) => structuredClone(asset));
  }

  // ── audit chain ──────────────────────────────────────────────────────

  async appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    // Synchronous read-compute-append: the chain head cannot move underneath us.
    const previous = this.state.auditEvents.at(-1) ?? null;
    const previousEventHash = previous?.currentEventHash ?? null;
    const event: AuditEvent = {
      id: `audit-${opaqueId(8)}`,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      actorId: input.actorId,
      payload: structuredClone(input.payload),
      payloadHash: computePayloadHash(input.payload),
      previousEventHash,
      currentEventHash: computeEventHash(input.payload, previousEventHash),
      createdAt: input.createdAt,
    };
    this.state.auditEvents.push(event);
    return structuredClone(event);
  }

  async listAuditEvents(limit?: number): Promise<AuditEvent[]> {
    const events = this.state.auditEvents.map((event) =>
      structuredClone(event),
    );
    if (limit && limit > 0) return events.slice(-limit);
    return events;
  }

  async listAuditEventsForAggregate(
    aggregateType: string,
    aggregateId: string,
  ): Promise<AuditEvent[]> {
    return this.state.auditEvents
      .filter(
        (event) =>
          event.aggregateType === aggregateType &&
          event.aggregateId === aggregateId,
      )
      .map((event) => structuredClone(event));
  }
}
