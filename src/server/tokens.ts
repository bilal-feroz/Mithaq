/**
 * Signed decision tokens.
 *
 * A token is minted ONLY for an approved decision, is bound to the exact
 * request context (request, policy version, voice, organization, script hash,
 * provider, model), expires after ~60 seconds and is single-use: its jti is
 * stored at mint time and consumed atomically before generation.
 *
 * Format: mtqdt.v1.<base64url(claims JSON)>.<base64url(HMAC-SHA256)>
 *
 * Architecture note: MITHAQ validates the MITHAQ authorization token and then
 * calls the provider. The external provider does not validate the MITHAQ
 * token — the trust boundary is MITHAQ's own generation gateway, which is the
 * only holder of the provider API key.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { decisionTokenClaimsSchema } from "@/domain/schemas";
import type { DecisionTokenClaims } from "@/domain/types";
import { opaqueId } from "@/domain/hash";

export const TOKEN_PREFIX = "mtqdt.v1";
export const TOKEN_TTL_SECONDS = 60;

export function buildClaims(input: {
  decisionId: string;
  requestId: string;
  policyId: string;
  policyVersion: number;
  voiceId: string;
  organizationId: string;
  scriptHash: string;
  provider: string;
  model: string;
  nowEpochSeconds: number;
}): DecisionTokenClaims {
  return {
    jti: opaqueId(18),
    decisionId: input.decisionId,
    requestId: input.requestId,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    voiceId: input.voiceId,
    organizationId: input.organizationId,
    scriptHash: input.scriptHash,
    provider: input.provider,
    model: input.model,
    issuedAt: input.nowEpochSeconds,
    expiresAt: input.nowEpochSeconds + TOKEN_TTL_SECONDS,
    maximumUses: 1,
  };
}

function sign(payloadB64: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${TOKEN_PREFIX}.${payloadB64}`).digest();
}

export function mintDecisionToken(claims: DecisionTokenClaims, secret: string): string {
  const payloadB64 = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = sign(payloadB64, secret).toString("base64url");
  return `${TOKEN_PREFIX}.${payloadB64}.${signature}`;
}

export type TokenVerification =
  | { ok: true; claims: DecisionTokenClaims }
  | { ok: false; reason: TokenRejectionReason };

export type TokenRejectionReason =
  | "TOKEN_MALFORMED"
  | "TOKEN_SIGNATURE_INVALID"
  | "TOKEN_CLAIMS_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_NOT_YET_VALID";

/**
 * Verify format, signature and temporal validity. Binding to the request
 * context and single-use consumption happen in the generation gateway with
 * the persisted records.
 */
export function verifyDecisionToken(
  token: string,
  secret: string,
  nowEpochSeconds: number,
): TokenVerification {
  const parts = token.split(".");
  if (parts.length !== 4 || `${parts[0]}.${parts[1]}` !== TOKEN_PREFIX) {
    return { ok: false, reason: "TOKEN_MALFORMED" };
  }
  const payloadB64 = parts[2]!;
  const signatureB64 = parts[3]!;

  const expected = sign(payloadB64, secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(signatureB64, "base64url");
  } catch {
    return { ok: false, reason: "TOKEN_MALFORMED" };
  }
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: "TOKEN_SIGNATURE_INVALID" };
  }

  let claims: DecisionTokenClaims;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    claims = decisionTokenClaimsSchema.parse(parsed);
  } catch (error) {
    void (error as z.ZodError);
    return { ok: false, reason: "TOKEN_CLAIMS_INVALID" };
  }

  if (nowEpochSeconds > claims.expiresAt) {
    return { ok: false, reason: "TOKEN_EXPIRED" };
  }
  // Small negative skew tolerance; a token "from the future" is rejected.
  if (claims.issuedAt > nowEpochSeconds + 5) {
    return { ok: false, reason: "TOKEN_NOT_YET_VALID" };
  }
  return { ok: true, claims };
}

export type BindingContext = {
  decisionId: string;
  requestId: string;
  policyId: string;
  policyVersion: number;
  voiceId: string;
  organizationId: string;
  scriptHash: string;
  provider: string;
  model: string;
};

/** Returns null when every claim matches, otherwise a stable mismatch reason. */
export function findBindingMismatch(
  claims: DecisionTokenClaims,
  context: BindingContext,
): string | null {
  if (claims.decisionId !== context.decisionId) return "TOKEN_DECISION_MISMATCH";
  if (claims.requestId !== context.requestId) return "TOKEN_REQUEST_MISMATCH";
  if (claims.policyId !== context.policyId) return "TOKEN_POLICY_MISMATCH";
  if (claims.policyVersion !== context.policyVersion) {
    return "TOKEN_POLICY_VERSION_MISMATCH";
  }
  if (claims.voiceId !== context.voiceId) return "TOKEN_VOICE_MISMATCH";
  if (claims.organizationId !== context.organizationId) {
    return "TOKEN_ORGANIZATION_MISMATCH";
  }
  if (claims.scriptHash !== context.scriptHash) return "TOKEN_SCRIPT_HASH_MISMATCH";
  if (claims.provider !== context.provider) return "TOKEN_PROVIDER_MISMATCH";
  if (claims.model !== context.model) return "TOKEN_MODEL_MISMATCH";
  return null;
}

/** For UI display and logs: never expose or log a complete token. */
export function redactToken(token: string): string {
  return `${token.slice(0, 18)}…${token.slice(-6)}`;
}
