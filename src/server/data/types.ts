/**
 * Data-access layer contract. Implemented by:
 *  - LocalStore  — in-process demo store (default, zero-config)
 *  - SupabaseStore — Postgres-backed store when Supabase credentials exist
 *
 * All mutating operations that must be atomic are expressed as single store
 * methods so each backend can guarantee atomicity its own way (synchronous
 * mutation in-process; SQL transactions / RPC in Postgres).
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

export type AuditEventInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  actorId: string | null;
  payload: unknown;
  createdAt: string;
};

export type TokenConsumeResult =
  | { ok: true; record: DecisionTokenRecord }
  | { ok: false; reason: string; record: DecisionTokenRecord | null };

export type VoiceWithPolicy = {
  voice: VoiceProfile;
  owner: Profile | null;
  latestPolicy: ConsentPolicy | null;
};

export interface DataStore {
  // ── identity ─────────────────────────────────────────────────────────
  getProfile(id: string): Promise<Profile | null>;
  getOrganization(id: string): Promise<Organization | null>;
  getOrganizationForProfile(profileId: string): Promise<Organization | null>;
  getVoice(id: string): Promise<VoiceProfile | null>;
  listVoicesWithPolicies(): Promise<VoiceWithPolicy[]>;

  // ── consent policies ─────────────────────────────────────────────────
  getPolicy(id: string): Promise<ConsentPolicy | null>;
  getLatestPolicyForVoice(voiceId: string): Promise<ConsentPolicy | null>;
  listPolicyVersionsForVoice(voiceId: string): Promise<ConsentPolicy[]>;
  insertPolicy(policy: ConsentPolicy): Promise<void>;
  /** Atomic: insert the new version and mark the superseded one in one step. */
  createPolicyVersion(
    newPolicy: ConsentPolicy,
    supersededPolicyId: string,
    updatedAt: string,
  ): Promise<void>;
  /**
   * Atomic usage increment with headroom check.
   * grantId null → base allowance; otherwise that grant's allowance.
   * Throws when the allowance is already exhausted.
   */
  incrementPolicyUsage(
    policyId: string,
    grantId: string | null,
    updatedAt: string,
  ): Promise<ConsentPolicy>;
  revokePolicy(policyId: string, revokedAt: string): Promise<ConsentPolicy>;

  // ── generation requests ──────────────────────────────────────────────
  insertRequest(request: GenerationRequest): Promise<void>;
  getRequest(id: string): Promise<GenerationRequest | null>;
  updateRequestStatus(
    id: string,
    status: RequestStatus,
    updatedAt: string,
  ): Promise<void>;
  listRequestsForOrganization(
    organizationId: string,
  ): Promise<GenerationRequest[]>;
  listRequestsForOwner(ownerId: string): Promise<GenerationRequest[]>;

  // ── decisions ────────────────────────────────────────────────────────
  insertDecision(decision: StoredDecision): Promise<void>;
  getDecision(id: string): Promise<StoredDecision | null>;
  getLatestDecisionForRequest(
    requestId: string,
  ): Promise<StoredDecision | null>;
  listDecisionsForRequest(requestId: string): Promise<StoredDecision[]>;

  // ── decision tokens ──────────────────────────────────────────────────
  insertTokenRecord(record: DecisionTokenRecord): Promise<void>;
  getTokenRecord(jti: string): Promise<DecisionTokenRecord | null>;
  /** Atomic single-use consumption; succeeds only from status "minted". */
  consumeToken(jti: string, consumedAt: string): Promise<TokenConsumeResult>;
  markTokenRejected(jti: string, reason: string): Promise<void>;
  listTokensForRequest(requestId: string): Promise<DecisionTokenRecord[]>;

  // ── amendments ───────────────────────────────────────────────────────
  insertAmendment(amendment: AmendmentRequest): Promise<void>;
  updateAmendment(amendment: AmendmentRequest): Promise<void>;
  getAmendment(id: string): Promise<AmendmentRequest | null>;
  listAmendmentsForOwner(ownerId: string): Promise<AmendmentRequest[]>;
  listAmendmentsForOrganization(
    organizationId: string,
  ): Promise<AmendmentRequest[]>;
  getPendingAmendmentForRequest(
    requestId: string,
  ): Promise<AmendmentRequest | null>;
  listAmendmentsForRequest(requestId: string): Promise<AmendmentRequest[]>;

  // ── generated assets ─────────────────────────────────────────────────
  insertAsset(asset: GeneratedAsset, bytes: Buffer): Promise<void>;
  getAsset(id: string): Promise<GeneratedAsset | null>;
  getAssetByVerificationId(
    verificationId: string,
  ): Promise<GeneratedAsset | null>;
  getAssetBytes(id: string): Promise<Buffer | null>;
  getAssetForRequest(requestId: string): Promise<GeneratedAsset | null>;
  listAssetsForOrganization(organizationId: string): Promise<GeneratedAsset[]>;
  listAssetsForOwner(ownerId: string): Promise<GeneratedAsset[]>;

  // ── audit chain ──────────────────────────────────────────────────────
  /** Computes payload/chain hashes and appends atomically. */
  appendAuditEvent(input: AuditEventInput): Promise<AuditEvent>;
  listAuditEvents(limit?: number): Promise<AuditEvent[]>;
  listAuditEventsForAggregate(
    aggregateType: string,
    aggregateId: string,
  ): Promise<AuditEvent[]>;

  // ── demo lifecycle ───────────────────────────────────────────────────
  reset(): Promise<void>;
}
