/**
 * SupabaseStore — Postgres-backed DataStore, selected automatically when
 * NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are configured.
 *
 * Runs exclusively on the server with the service-role key (never shipped to
 * a browser). Atomic operations delegate to the SQL functions defined in
 * supabase/migrations/0001_init.sql. RLS protects direct client access; this
 * server is the sole writer of decisions, tokens and assets.
 *
 * The demo/E2E path runs on LocalStore; this adapter targets real
 * deployments and is exercised only when Supabase credentials exist.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

const ASSET_BUCKET = "mithaq-assets";

type Row = Record<string, unknown>;

const iso = (value: unknown): string =>
  value ? new Date(value as string).toISOString() : "";
const isoOrNull = (value: unknown): string | null =>
  value ? new Date(value as string).toISOString() : null;

export class SupabaseStore implements DataStore {
  private client: SupabaseClient;

  constructor(config: { url: string; serviceRoleKey: string }) {
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async one<T>(
    query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
    map: (row: Row) => T,
  ): Promise<T | null> {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data) return null;
    return map(data as Row);
  }

  private async many<T>(
    query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
    map: (row: Row) => T,
  ): Promise<T[]> {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data as Row[]) ?? []).map(map);
  }

  // ── row mappers ──────────────────────────────────────────────────────

  private mapProfile = (r: Row): Profile => ({
    id: r.id as string,
    displayName: r.display_name as string,
    role: r.role as Profile["role"],
    title: (r.title as string) ?? "",
  });

  private mapOrganization = (r: Row): Organization => ({
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
  });

  private mapVoice = (r: Row): VoiceProfile => ({
    id: r.id as string,
    ownerId: r.owner_id as string,
    displayName: r.display_name as string,
    providerVoiceId: (r.provider_voice_id as string) ?? null,
    description: (r.description as string) ?? "",
    createdAt: iso(r.created_at),
  });

  private mapPolicy = (r: Row): ConsentPolicy => ({
    id: r.id as string,
    version: r.version as number,
    ownerId: r.owner_id as string,
    voiceId: r.voice_id as string,
    status: r.status as ConsentPolicy["status"],
    authorizedOrganizationIds:
      (r.authorized_organization_ids as string[]) ?? [],
    allowedPurposes:
      (r.allowed_purposes as ConsentPolicy["allowedPurposes"]) ?? [],
    allowedPlatforms:
      (r.allowed_platforms as ConsentPolicy["allowedPlatforms"]) ?? [],
    allowedLanguages:
      (r.allowed_languages as ConsentPolicy["allowedLanguages"]) ?? [],
    allowedTerritories: (r.allowed_territories as string[]) ?? [],
    paidAdvertising: r.paid_advertising as ConsentPolicy["paidAdvertising"],
    editingAllowed: Boolean(r.editing_allowed),
    maximumAssets: r.maximum_assets as number,
    assetsUsed: r.assets_used as number,
    validFrom: iso(r.valid_from),
    validUntil: iso(r.valid_until),
    prohibitedTopics: (r.prohibited_topics as string[]) ?? [],
    grants: (r.grants as ConsentPolicy["grants"]) ?? [],
    sourceConsentText: (r.source_consent_text as string) ?? "",
    sourceConsentLanguage:
      (r.source_consent_language as ConsentPolicy["sourceConsentLanguage"]) ??
      "en",
    ownerApprovedAt: isoOrNull(r.owner_approved_at),
    supersedesPolicyId: (r.supersedes_policy_id as string) ?? null,
    revokedAt: isoOrNull(r.revoked_at),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });

  private mapRequest = (r: Row): GenerationRequest => ({
    id: r.id as string,
    requesterId: r.requester_id as string,
    organizationId: r.organization_id as string,
    voiceId: r.voice_id as string,
    script: r.script as string,
    scriptHash: r.script_hash as string,
    campaignName: r.campaign_name as string,
    purpose: r.purpose as GenerationRequest["purpose"],
    platform: r.platform as GenerationRequest["platform"],
    language: r.language as GenerationRequest["language"],
    placement: r.placement as GenerationRequest["placement"],
    territory: r.territory as string,
    publicationDate: iso(r.publication_date),
    topicTags: (r.topic_tags as string[]) ?? [],
    status: r.status as GenerationRequest["status"],
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });

  private mapToken = (r: Row): DecisionTokenRecord => ({
    jti: r.jti as string,
    decisionId: r.decision_id as string,
    requestId: r.request_id as string,
    policyId: r.policy_id as string,
    policyVersion: r.policy_version as number,
    status: r.status as DecisionTokenRecord["status"],
    mintedAt: iso(r.minted_at),
    consumedAt: isoOrNull(r.consumed_at),
    rejectedReason: (r.rejected_reason as string) ?? null,
  });

  private mapAmendment = (r: Row): AmendmentRequest => ({
    id: r.id as string,
    policyId: r.policy_id as string,
    policyVersion: r.policy_version as number,
    requestId: r.request_id as string,
    decisionId: r.decision_id as string,
    organizationId: r.organization_id as string,
    voiceId: r.voice_id as string,
    requestedById: r.requested_by_id as string,
    failedClauseCodes: (r.failed_clause_codes as string[]) ?? [],
    originalClause: (r.original_clause as string) ?? "",
    proposal: r.proposal as AmendmentRequest["proposal"],
    status: r.status as AmendmentRequest["status"],
    ownerDecisionAt: isoOrNull(r.owner_decision_at),
    ownerDecisionNote: (r.owner_decision_note as string) ?? null,
    resultingPolicyId: (r.resulting_policy_id as string) ?? null,
    resultingPolicyVersion: (r.resulting_policy_version as number) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  });

  private mapAsset = (r: Row): GeneratedAsset => ({
    id: r.id as string,
    verificationId: r.verification_id as string,
    decisionId: r.decision_id as string,
    requestId: r.request_id as string,
    policyId: r.policy_id as string,
    policyVersion: r.policy_version as number,
    voiceId: r.voice_id as string,
    organizationId: r.organization_id as string,
    storagePath: r.storage_path as string,
    sha256: r.sha256 as string,
    mimeType: r.mime_type as string,
    byteLength: Number(r.byte_length),
    provider: r.provider as string,
    providerAssetId: (r.provider_asset_id as string) ?? null,
    createdAt: iso(r.created_at),
  });

  private mapAudit = (r: Row): AuditEvent => ({
    id: r.id as string,
    aggregateType: r.aggregate_type as string,
    aggregateId: r.aggregate_id as string,
    eventType: r.event_type as string,
    actorId: (r.actor_id as string) ?? null,
    payload: r.payload,
    payloadHash: r.payload_hash as string,
    previousEventHash: (r.previous_event_hash as string) ?? null,
    currentEventHash: r.current_event_hash as string,
    createdAt: iso(r.created_at),
  });

  // ── identity ─────────────────────────────────────────────────────────

  async getProfile(id: string) {
    return this.one(
      this.client.from("profiles").select("*").eq("id", id).maybeSingle(),
      this.mapProfile,
    );
  }

  async getOrganization(id: string) {
    return this.one(
      this.client.from("organizations").select("*").eq("id", id).maybeSingle(),
      this.mapOrganization,
    );
  }

  async getOrganizationForProfile(profileId: string) {
    const membership = await this.one(
      this.client
        .from("organization_members")
        .select("organization_id")
        .eq("profile_id", profileId)
        .limit(1)
        .maybeSingle(),
      (r) => r.organization_id as string,
    );
    return membership ? this.getOrganization(membership) : null;
  }

  async getVoice(id: string) {
    return this.one(
      this.client.from("voice_profiles").select("*").eq("id", id).maybeSingle(),
      this.mapVoice,
    );
  }

  async listVoicesWithPolicies(): Promise<VoiceWithPolicy[]> {
    const voices = await this.many(
      this.client.from("voice_profiles").select("*"),
      this.mapVoice,
    );
    return Promise.all(
      voices.map(async (voice) => ({
        voice,
        owner: await this.getProfile(voice.ownerId),
        latestPolicy: await this.getLatestPolicyForVoice(voice.id),
      })),
    );
  }

  // ── consent policies ─────────────────────────────────────────────────

  async getPolicy(id: string) {
    return this.one(
      this.client
        .from("consent_policies")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      this.mapPolicy,
    );
  }

  async getLatestPolicyForVoice(voiceId: string) {
    return this.one(
      this.client
        .from("consent_policies")
        .select("*")
        .eq("voice_id", voiceId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.mapPolicy,
    );
  }

  async listPolicyVersionsForVoice(voiceId: string) {
    return this.many(
      this.client
        .from("consent_policies")
        .select("*")
        .eq("voice_id", voiceId)
        .order("version", { ascending: true }),
      this.mapPolicy,
    );
  }

  async insertPolicy(policy: ConsentPolicy) {
    const { error } = await this.client
      .from("consent_policies")
      .insert(this.policyToRow(policy));
    if (error) throw new Error(error.message);
  }

  private policyToRow(policy: ConsentPolicy): Row {
    return {
      id: policy.id,
      version: policy.version,
      owner_id: policy.ownerId,
      voice_id: policy.voiceId,
      status: policy.status,
      authorized_organization_ids: policy.authorizedOrganizationIds,
      allowed_purposes: policy.allowedPurposes,
      allowed_platforms: policy.allowedPlatforms,
      allowed_languages: policy.allowedLanguages,
      allowed_territories: policy.allowedTerritories,
      paid_advertising: policy.paidAdvertising,
      editing_allowed: policy.editingAllowed,
      maximum_assets: policy.maximumAssets,
      assets_used: policy.assetsUsed,
      valid_from: policy.validFrom,
      valid_until: policy.validUntil,
      prohibited_topics: policy.prohibitedTopics,
      grants: policy.grants,
      source_consent_text: policy.sourceConsentText,
      source_consent_language: policy.sourceConsentLanguage,
      owner_approved_at: policy.ownerApprovedAt,
      supersedes_policy_id: policy.supersedesPolicyId,
      revoked_at: policy.revokedAt,
      created_at: policy.createdAt,
      updated_at: policy.updatedAt,
    };
  }

  async createPolicyVersion(
    newPolicy: ConsentPolicy,
    supersededPolicyId: string,
  ) {
    const { error } = await this.client.rpc("create_policy_version", {
      p_superseded_id: supersededPolicyId,
      p_new_policy: newPolicy,
    });
    if (error) throw new Error(error.message);
  }

  async incrementPolicyUsage(
    policyId: string,
    grantId: string | null,
    updatedAt: string,
  ) {
    const { error } = await this.client.rpc("increment_policy_usage", {
      p_policy_id: policyId,
      p_grant_id: grantId,
      p_updated_at: updatedAt,
    });
    if (error) throw new Error(error.message);
    const policy = await this.getPolicy(policyId);
    if (!policy) throw new Error(`Policy not found: ${policyId}`);
    return policy;
  }

  async revokePolicy(policyId: string, revokedAt: string) {
    const { error } = await this.client
      .from("consent_policies")
      .update({
        status: "revoked",
        revoked_at: revokedAt,
        updated_at: revokedAt,
      })
      .eq("id", policyId)
      .neq("status", "revoked");
    if (error) throw new Error(error.message);
    const policy = await this.getPolicy(policyId);
    if (!policy) throw new Error(`Policy not found: ${policyId}`);
    return policy;
  }

  // ── generation requests ──────────────────────────────────────────────

  async insertRequest(request: GenerationRequest) {
    const { error } = await this.client.from("generation_requests").insert({
      id: request.id,
      requester_id: request.requesterId,
      organization_id: request.organizationId,
      voice_id: request.voiceId,
      script: request.script,
      script_hash: request.scriptHash,
      campaign_name: request.campaignName,
      purpose: request.purpose,
      platform: request.platform,
      language: request.language,
      placement: request.placement,
      territory: request.territory,
      publication_date: request.publicationDate,
      topic_tags: request.topicTags,
      status: request.status,
      created_at: request.createdAt,
      updated_at: request.updatedAt,
    });
    if (error) throw new Error(error.message);
  }

  async getRequest(id: string) {
    return this.one(
      this.client
        .from("generation_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      this.mapRequest,
    );
  }

  async updateRequestStatus(
    id: string,
    status: RequestStatus,
    updatedAt: string,
  ) {
    const { error } = await this.client
      .from("generation_requests")
      .update({ status, updated_at: updatedAt })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listRequestsForOrganization(organizationId: string) {
    return this.many(
      this.client
        .from("generation_requests")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      this.mapRequest,
    );
  }

  async listRequestsForOwner(ownerId: string) {
    const voices = await this.many(
      this.client.from("voice_profiles").select("id").eq("owner_id", ownerId),
      (r) => r.id as string,
    );
    if (voices.length === 0) return [];
    return this.many(
      this.client
        .from("generation_requests")
        .select("*")
        .in("voice_id", voices)
        .order("created_at", { ascending: false }),
      this.mapRequest,
    );
  }

  // ── decisions ────────────────────────────────────────────────────────

  async insertDecision(decision: StoredDecision) {
    const { error } = await this.client.from("policy_decisions").insert({
      id: decision.id,
      request_id: decision.requestId,
      policy_id: decision.policyId,
      policy_version: decision.policyVersion,
      outcome: decision.outcome,
      matched_grant_id: decision.matchedGrantId,
      evaluated_at: decision.evaluatedAt,
      created_at: decision.createdAt,
    });
    if (error) throw new Error(error.message);
    const rows = decision.clauses.map((clause, position) => ({
      decision_id: decision.id,
      position,
      clause: clause.clause,
      status: clause.status,
      code: clause.code,
      expected: clause.expected ?? null,
      received: clause.received ?? null,
      explanation: clause.explanation,
      suggested_remedy: clause.suggestedRemedy ?? null,
    }));
    const { error: clauseError } = await this.client
      .from("decision_clause_results")
      .insert(rows);
    if (clauseError) throw new Error(clauseError.message);
  }

  private async attachClauses(decision: Row): Promise<StoredDecision> {
    const clauses = await this.many(
      this.client
        .from("decision_clause_results")
        .select("*")
        .eq("decision_id", decision.id as string)
        .order("position", { ascending: true }),
      (r) => ({
        clause: r.clause as string,
        status: r.status as "passed" | "failed",
        code: r.code as string,
        ...(r.expected !== null ? { expected: r.expected } : {}),
        ...(r.received !== null ? { received: r.received } : {}),
        explanation: r.explanation as string,
        ...(r.suggested_remedy
          ? { suggestedRemedy: r.suggested_remedy as string }
          : {}),
      }),
    );
    return {
      id: decision.id as string,
      outcome: decision.outcome as "approved" | "blocked",
      policyId: decision.policy_id as string,
      policyVersion: decision.policy_version as number,
      requestId: decision.request_id as string,
      evaluatedAt: iso(decision.evaluated_at),
      matchedGrantId: (decision.matched_grant_id as string) ?? null,
      clauses,
      createdAt: iso(decision.created_at),
    };
  }

  async getDecision(id: string) {
    const row = await this.one(
      this.client
        .from("policy_decisions")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      (r) => r,
    );
    return row ? this.attachClauses(row) : null;
  }

  async getLatestDecisionForRequest(requestId: string) {
    const row = await this.one(
      this.client
        .from("policy_decisions")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (r) => r,
    );
    return row ? this.attachClauses(row) : null;
  }

  async listDecisionsForRequest(requestId: string) {
    const rows = await this.many(
      this.client
        .from("policy_decisions")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
      (r) => r,
    );
    return Promise.all(rows.map((row) => this.attachClauses(row)));
  }

  // ── decision tokens ──────────────────────────────────────────────────

  async insertTokenRecord(record: DecisionTokenRecord) {
    const { error } = await this.client.from("decision_tokens").insert({
      jti: record.jti,
      decision_id: record.decisionId,
      request_id: record.requestId,
      policy_id: record.policyId,
      policy_version: record.policyVersion,
      status: record.status,
      minted_at: record.mintedAt,
      consumed_at: record.consumedAt,
      rejected_reason: record.rejectedReason,
    });
    if (error) throw new Error(error.message);
  }

  async getTokenRecord(jti: string) {
    return this.one(
      this.client
        .from("decision_tokens")
        .select("*")
        .eq("jti", jti)
        .maybeSingle(),
      this.mapToken,
    );
  }

  async consumeToken(
    jti: string,
    consumedAt: string,
  ): Promise<TokenConsumeResult> {
    const { data, error } = await this.client.rpc("consume_decision_token", {
      p_jti: jti,
      p_consumed_at: consumedAt,
    });
    if (error) throw new Error(error.message);
    const result = (Array.isArray(data) ? data[0] : data) as {
      ok: boolean;
      reason: string | null;
    };
    const record = await this.getTokenRecord(jti);
    if (result.ok && record) return { ok: true, record };
    return { ok: false, reason: result.reason ?? "TOKEN_UNKNOWN", record };
  }

  async markTokenRejected(jti: string, reason: string) {
    const { error } = await this.client
      .from("decision_tokens")
      .update({ status: "rejected", rejected_reason: reason })
      .eq("jti", jti)
      .eq("status", "minted");
    if (error) throw new Error(error.message);
  }

  async listTokensForRequest(requestId: string) {
    return this.many(
      this.client
        .from("decision_tokens")
        .select("*")
        .eq("request_id", requestId)
        .order("minted_at", { ascending: true }),
      this.mapToken,
    );
  }

  // ── amendments ───────────────────────────────────────────────────────

  async insertAmendment(amendment: AmendmentRequest) {
    const { error } = await this.client
      .from("amendment_requests")
      .insert(this.amendmentToRow(amendment));
    if (error) throw new Error(error.message);
  }

  private amendmentToRow(a: AmendmentRequest): Row {
    return {
      id: a.id,
      policy_id: a.policyId,
      policy_version: a.policyVersion,
      request_id: a.requestId,
      decision_id: a.decisionId,
      organization_id: a.organizationId,
      voice_id: a.voiceId,
      requested_by_id: a.requestedById,
      failed_clause_codes: a.failedClauseCodes,
      original_clause: a.originalClause,
      proposal: a.proposal,
      status: a.status,
      owner_decision_at: a.ownerDecisionAt,
      owner_decision_note: a.ownerDecisionNote,
      resulting_policy_id: a.resultingPolicyId,
      resulting_policy_version: a.resultingPolicyVersion,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    };
  }

  async updateAmendment(amendment: AmendmentRequest) {
    const { error } = await this.client
      .from("amendment_requests")
      .update(this.amendmentToRow(amendment))
      .eq("id", amendment.id);
    if (error) throw new Error(error.message);
  }

  async getAmendment(id: string) {
    return this.one(
      this.client
        .from("amendment_requests")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      this.mapAmendment,
    );
  }

  async listAmendmentsForOwner(ownerId: string) {
    const voices = await this.many(
      this.client.from("voice_profiles").select("id").eq("owner_id", ownerId),
      (r) => r.id as string,
    );
    if (voices.length === 0) return [];
    return this.many(
      this.client
        .from("amendment_requests")
        .select("*")
        .in("voice_id", voices)
        .order("created_at", { ascending: false }),
      this.mapAmendment,
    );
  }

  async listAmendmentsForOrganization(organizationId: string) {
    return this.many(
      this.client
        .from("amendment_requests")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      this.mapAmendment,
    );
  }

  async getPendingAmendmentForRequest(requestId: string) {
    return this.one(
      this.client
        .from("amendment_requests")
        .select("*")
        .eq("request_id", requestId)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle(),
      this.mapAmendment,
    );
  }

  async listAmendmentsForRequest(requestId: string) {
    return this.many(
      this.client
        .from("amendment_requests")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true }),
      this.mapAmendment,
    );
  }

  // ── generated assets ─────────────────────────────────────────────────

  async insertAsset(asset: GeneratedAsset, bytes: Buffer) {
    const storagePath = `${asset.id}`;
    const { error: uploadError } = await this.client.storage
      .from(ASSET_BUCKET)
      .upload(storagePath, bytes, {
        contentType: asset.mimeType,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { error } = await this.client.from("generated_assets").insert({
      id: asset.id,
      verification_id: asset.verificationId,
      decision_id: asset.decisionId,
      request_id: asset.requestId,
      policy_id: asset.policyId,
      policy_version: asset.policyVersion,
      voice_id: asset.voiceId,
      organization_id: asset.organizationId,
      storage_path: storagePath,
      sha256: asset.sha256,
      mime_type: asset.mimeType,
      byte_length: asset.byteLength,
      provider: asset.provider,
      provider_asset_id: asset.providerAssetId,
      created_at: asset.createdAt,
    });
    if (error) throw new Error(error.message);
  }

  async getAsset(id: string) {
    return this.one(
      this.client
        .from("generated_assets")
        .select("*")
        .eq("id", id)
        .maybeSingle(),
      this.mapAsset,
    );
  }

  async getAssetByVerificationId(verificationId: string) {
    return this.one(
      this.client
        .from("generated_assets")
        .select("*")
        .eq("verification_id", verificationId)
        .maybeSingle(),
      this.mapAsset,
    );
  }

  async getAssetBytes(id: string) {
    const asset = await this.getAsset(id);
    if (!asset) return null;
    const { data, error } = await this.client.storage
      .from(ASSET_BUCKET)
      .download(asset.storagePath);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }

  async getAssetForRequest(requestId: string) {
    return this.one(
      this.client
        .from("generated_assets")
        .select("*")
        .eq("request_id", requestId)
        .maybeSingle(),
      this.mapAsset,
    );
  }

  async listAssetsForOrganization(organizationId: string) {
    return this.many(
      this.client
        .from("generated_assets")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      this.mapAsset,
    );
  }

  async listAssetsForOwner(ownerId: string) {
    const voices = await this.many(
      this.client.from("voice_profiles").select("id").eq("owner_id", ownerId),
      (r) => r.id as string,
    );
    if (voices.length === 0) return [];
    return this.many(
      this.client
        .from("generated_assets")
        .select("*")
        .in("voice_id", voices)
        .order("created_at", { ascending: false }),
      this.mapAsset,
    );
  }

  // ── audit chain ──────────────────────────────────────────────────────

  async appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    // Compare-and-retry against the chain head; the partial unique index on
    // previous_event_hash guarantees a linear chain under concurrency.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const head = await this.one(
        this.client
          .from("audit_events")
          .select("current_event_hash")
          .order("seq", { ascending: false })
          .limit(1)
          .maybeSingle(),
        (r) => r.current_event_hash as string,
      );
      const event: AuditEvent = {
        id: `audit-${opaqueId(8)}`,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        actorId: input.actorId,
        payload: input.payload,
        payloadHash: computePayloadHash(input.payload),
        previousEventHash: head,
        currentEventHash: computeEventHash(input.payload, head),
        createdAt: input.createdAt,
      };
      const { error } = await this.client.from("audit_events").insert({
        id: event.id,
        aggregate_type: event.aggregateType,
        aggregate_id: event.aggregateId,
        event_type: event.eventType,
        actor_id: event.actorId,
        payload: event.payload,
        payload_hash: event.payloadHash,
        previous_event_hash: event.previousEventHash,
        current_event_hash: event.currentEventHash,
        created_at: event.createdAt,
      });
      if (!error) return event;
      if (!error.message.includes("audit_events_prev_unique")) {
        throw new Error(error.message);
      }
      // Chain head moved — retry with the new head.
    }
    throw new Error("Audit chain contention: could not append event");
  }

  async listAuditEvents(limit?: number) {
    const rows = await this.many(
      this.client
        .from("audit_events")
        .select("*")
        .order("seq", { ascending: true }),
      this.mapAudit,
    );
    if (limit && limit > 0) return rows.slice(-limit);
    return rows;
  }

  async listAuditEventsForAggregate(
    aggregateType: string,
    aggregateId: string,
  ) {
    return this.many(
      this.client
        .from("audit_events")
        .select("*")
        .eq("aggregate_type", aggregateType)
        .eq("aggregate_id", aggregateId)
        .order("seq", { ascending: true }),
      this.mapAudit,
    );
  }

  // ── demo lifecycle ───────────────────────────────────────────────────

  async reset(): Promise<void> {
    throw new Error(
      "reset() is a demo-mode operation; the Supabase backend is reset via migrations/seed.sql.",
    );
  }
}
