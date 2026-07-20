/**
 * MITHAQ Gate — core domain types.
 *
 * These types are the single source of truth for the deterministic policy
 * engine. Everything here is pure data: no I/O, no framework imports.
 */

export const PLATFORMS = [
  "instagram",
  "youtube",
  "tiktok",
  "x",
  "linkedin",
  "website",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const LANGUAGES = ["ar", "en", "ur", "other"] as const;
export type Language = (typeof LANGUAGES)[number];

export const PLACEMENTS = ["organic", "paid"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PURPOSES = [
  "brand_promotion",
  "education",
  "internal_training",
  "entertainment",
  "public_service",
  "other",
] as const;
export type Purpose = (typeof PURPOSES)[number];

export const POLICY_STATUSES = [
  "draft",
  "active",
  "superseded",
  "revoked",
  "expired",
] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const REQUEST_STATUSES = [
  "draft",
  "evaluating",
  "blocked",
  "approved",
  "generating",
  "generated",
  "failed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * A narrowly scoped permission created by an owner-approved amendment.
 * A grant is an explicit, owner-authorized exception that can satisfy exactly
 * one rule (paid placement) for exactly one campaign/platform, with its own
 * asset budget and expiry. Grants never widen topics, purposes, languages,
 * territories or organizations.
 */
export type PolicyGrant = {
  id: string;
  /** Human-readable summary, e.g. "One paid Instagram placement — MITHAQ Demo Campaign". */
  label: string;
  campaignName: string;
  platform: Platform;
  placement: "paid";
  maximumAssets: number;
  assetsUsed: number;
  /** ISO timestamp; the grant cannot authorize past this instant. */
  validUntil: string;
  sourceAmendmentId: string;
};

export type ConsentPolicy = {
  id: string;
  version: number;

  ownerId: string;
  voiceId: string;

  status: PolicyStatus;

  authorizedOrganizationIds: string[];

  allowedPurposes: Purpose[];
  allowedPlatforms: Platform[];
  allowedLanguages: Language[];
  /** Normalized uppercase territory codes, e.g. "AE", "SA". */
  allowedTerritories: string[];

  paidAdvertising: "allowed" | "prohibited";
  editingAllowed: boolean;

  maximumAssets: number;
  assetsUsed: number;

  validFrom: string;
  validUntil: string;

  /** Normalized lowercase topic slugs, e.g. "politics". Explicit prohibitions override permissions. */
  prohibitedTopics: string[];

  /** Owner-approved scoped exceptions created by amendments. */
  grants: PolicyGrant[];

  sourceConsentText: string;
  /** Language the consent statement was given in. */
  sourceConsentLanguage: Language;
  ownerApprovedAt: string | null;

  supersedesPolicyId: string | null;
  revokedAt: string | null;

  createdAt: string;
  updatedAt: string;
};

export type GenerationRequest = {
  id: string;

  requesterId: string;
  organizationId: string;
  voiceId: string;

  script: string;
  /** SHA-256 hex of the normalized script (see normalizeScript). */
  scriptHash: string;

  campaignName: string;
  purpose: Purpose;
  platform: Platform;
  language: Language;
  placement: Placement;
  /** Normalized uppercase territory code. */
  territory: string;
  publicationDate: string;
  /** Normalized lowercase topic slugs, chosen explicitly by the requester. */
  topicTags: string[];

  status: RequestStatus;

  createdAt: string;
  updatedAt: string;
};

export type ClauseStatus = "passed" | "failed";

export type ClauseResult = {
  /** Human-readable clause name, e.g. "Paid advertising". */
  clause: string;
  status: ClauseStatus;
  /** Stable rule code; equals the reason code when the clause fails. */
  code: string;

  expected?: unknown;
  received?: unknown;

  explanation: string;
  suggestedRemedy?: string;
};

export type PolicyDecision = {
  outcome: "approved" | "blocked";

  policyId: string;
  policyVersion: number;
  requestId: string;

  evaluatedAt: string;

  clauses: ClauseResult[];

  /** When a paid placement was authorized by a scoped grant, its id; else null. */
  matchedGrantId: string | null;
};

/** A persisted decision with identity and audit context. */
export type StoredDecision = PolicyDecision & {
  id: string;
  createdAt: string;
};

export type AmendmentProposal = {
  kind: "scoped_paid_placement";
  campaignName: string;
  platform: Platform;
  placement: "paid";
  additionalAssets: number;
  validUntil: string;
  /** Agent-drafted explanation of why this narrow scope is needed. */
  rationale: string;
};

export type AmendmentStatus = "pending" | "approved" | "rejected";

export type AmendmentRequest = {
  id: string;

  /** The policy version that produced the block. */
  policyId: string;
  policyVersion: number;
  /** The originating blocked generation request. */
  requestId: string;
  decisionId: string;

  organizationId: string;
  voiceId: string;
  requestedById: string;

  /** Original failed clause codes, e.g. ["PAID_ADVERTISING_PROHIBITED"]. */
  failedClauseCodes: string[];
  /** Human summary of the failed clause(s). */
  originalClause: string;

  proposal: AmendmentProposal;

  status: AmendmentStatus;
  ownerDecisionAt: string | null;
  ownerDecisionNote: string | null;

  resultingPolicyId: string | null;
  resultingPolicyVersion: number | null;

  createdAt: string;
  updatedAt: string;
};

export type DecisionTokenClaims = {
  jti: string;

  decisionId: string;
  requestId: string;

  policyId: string;
  policyVersion: number;

  voiceId: string;
  organizationId: string;

  scriptHash: string;

  provider: string;
  model: string;

  /** Unix epoch seconds. */
  issuedAt: number;
  /** Unix epoch seconds. */
  expiresAt: number;

  maximumUses: 1;
};

export type DecisionTokenRecord = {
  jti: string;
  decisionId: string;
  requestId: string;
  policyId: string;
  policyVersion: number;
  status: "minted" | "consumed" | "rejected" | "expired";
  mintedAt: string;
  consumedAt: string | null;
  rejectedReason: string | null;
};

export type GeneratedAsset = {
  id: string;
  verificationId: string;

  decisionId: string;
  requestId: string;

  policyId: string;
  policyVersion: number;

  voiceId: string;
  organizationId: string;

  storagePath: string;

  sha256: string;
  mimeType: string;
  byteLength: number;

  provider: string;
  providerAssetId: string | null;

  createdAt: string;
};

export type AuditEvent = {
  id: string;

  aggregateType: string;
  aggregateId: string;

  eventType: string;
  actorId: string | null;

  payload: unknown;

  payloadHash: string;
  previousEventHash: string | null;
  currentEventHash: string;

  createdAt: string;
};

export type Profile = {
  id: string;
  displayName: string;
  role: "owner" | "requester";
  title: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type VoiceProfile = {
  id: string;
  ownerId: string;
  displayName: string;
  /** External provider voice id, when a real provider is configured. */
  providerVoiceId: string | null;
  description: string;
  createdAt: string;
};
