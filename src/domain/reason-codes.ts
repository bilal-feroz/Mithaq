/**
 * Stable reason codes emitted by the deterministic policy engine.
 * These are part of the product contract: persisted with decisions, shown in
 * the UI, referenced by amendments and by the public verifier. Never rename.
 */
export const REASON_CODES = [
  "POLICY_NOT_ACTIVE",
  "POLICY_SUPERSEDED",
  "POLICY_REVOKED",
  "POLICY_EXPIRED",
  "POLICY_NOT_YET_ACTIVE",
  "VOICE_MISMATCH",
  "ORGANIZATION_NOT_AUTHORIZED",
  "PURPOSE_NOT_ALLOWED",
  "PLATFORM_NOT_ALLOWED",
  "LANGUAGE_NOT_ALLOWED",
  "TERRITORY_NOT_ALLOWED",
  "PUBLICATION_DATE_OUTSIDE_VALIDITY",
  "PAID_ADVERTISING_PROHIBITED",
  "PROHIBITED_TOPIC",
  "USAGE_LIMIT_REACHED",
  "MISSING_REQUIRED_FIELD",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

/**
 * Polished human-readable messages for each reason code.
 * The engine emits precise per-clause explanations; these are the short
 * headline labels used by the UI.
 */
export const REASON_CODE_MESSAGES: Record<ReasonCode, string> = {
  POLICY_NOT_ACTIVE: "The consent policy is not active",
  POLICY_SUPERSEDED: "This policy version has been superseded",
  POLICY_REVOKED: "The owner revoked this consent policy",
  POLICY_EXPIRED: "The consent policy has expired",
  POLICY_NOT_YET_ACTIVE: "The consent policy is not yet in effect",
  VOICE_MISMATCH: "The requested voice is not covered by this policy",
  ORGANIZATION_NOT_AUTHORIZED: "This organization is not authorized",
  PURPOSE_NOT_ALLOWED: "This purpose is not permitted",
  PLATFORM_NOT_ALLOWED: "This platform is not permitted",
  LANGUAGE_NOT_ALLOWED: "This language is not permitted",
  TERRITORY_NOT_ALLOWED: "This territory is not permitted",
  PUBLICATION_DATE_OUTSIDE_VALIDITY:
    "Publication date falls outside the consent window",
  PAID_ADVERTISING_PROHIBITED: "Paid advertising is prohibited",
  PROHIBITED_TOPIC: "The content touches a prohibited topic",
  USAGE_LIMIT_REACHED: "The authorized usage allowance is exhausted",
  MISSING_REQUIRED_FIELD: "The request is missing required information",
};
