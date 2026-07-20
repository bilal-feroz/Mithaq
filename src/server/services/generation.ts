/**
 * Generation service — the MITHAQ authorization gateway.
 *
 * Flow: approved decision → mint single-use signed token → gateway validates
 * the token (signature, expiry, bindings, CURRENT policy status), consumes it
 * atomically, and only then calls the voice provider. The provider API key
 * never leaves this server; the external provider does not validate the
 * MITHAQ token — MITHAQ does, and then calls the provider.
 */
import { hashScript, opaqueId, sha256Hex } from "@/domain/hash";
import type { DecisionTokenRecord, GeneratedAsset } from "@/domain/types";
import { getStore } from "@/server/data";
import { getEnv } from "@/server/env";
import { getVoiceProvider } from "@/server/providers/voice";
import {
  buildClaims,
  findBindingMismatch,
  mintDecisionToken,
  redactToken,
  verifyDecisionToken,
} from "@/server/tokens";

export class GenerationDeniedError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GenerationDeniedError";
  }
}

export type GenerationSuccess = {
  asset: GeneratedAsset;
  token: DecisionTokenRecord;
  redactedToken: string;
};

export async function generateAssetForRequest(
  requestId: string,
  actor: { profileId: string; organizationId: string },
): Promise<GenerationSuccess> {
  const store = getStore();
  const env = getEnv();
  const provider = getVoiceProvider();

  const request = await store.getRequest(requestId);
  if (!request)
    throw new GenerationDeniedError("REQUEST_NOT_FOUND", "Request not found.");
  if (request.organizationId !== actor.organizationId) {
    throw new GenerationDeniedError(
      "NOT_AUTHORIZED",
      "This request belongs to a different organization.",
    );
  }

  const existing = await store.getAssetForRequest(requestId);
  if (existing) {
    throw new GenerationDeniedError(
      "ALREADY_GENERATED",
      "An asset has already been generated for this request.",
    );
  }

  const decision = await store.getLatestDecisionForRequest(requestId);
  if (!decision || decision.outcome !== "approved") {
    // A token is never minted for a blocked (or missing) decision.
    throw new GenerationDeniedError(
      "DECISION_NOT_APPROVED",
      "The latest decision for this request is not an approval. Re-run the evaluation.",
    );
  }

  const nowIso = new Date().toISOString();
  const nowEpochSeconds = Math.floor(Date.parse(nowIso) / 1000);

  const claims = buildClaims({
    decisionId: decision.id,
    requestId: request.id,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    voiceId: request.voiceId,
    organizationId: request.organizationId,
    scriptHash: request.scriptHash,
    provider: provider.name,
    model: provider.model,
    nowEpochSeconds,
  });
  const token = mintDecisionToken(claims, env.decisionTokenSecret);

  const record: DecisionTokenRecord = {
    jti: claims.jti,
    decisionId: decision.id,
    requestId: request.id,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    status: "minted",
    mintedAt: nowIso,
    consumedAt: null,
    rejectedReason: null,
  };
  await store.insertTokenRecord(record);
  await store.appendAuditEvent({
    aggregateType: "decision_token",
    aggregateId: claims.jti,
    eventType: "token.minted",
    actorId: actor.profileId,
    payload: {
      jti: claims.jti,
      decisionId: decision.id,
      requestId: request.id,
      policyVersion: decision.policyVersion,
      provider: provider.name,
      model: provider.model,
      expiresAt: claims.expiresAt,
      maximumUses: 1,
    },
    createdAt: nowIso,
  });

  return redeemDecisionToken(token, actor.profileId);
}

/**
 * The gateway. Accepts ONLY a MITHAQ decision token; everything needed to
 * generate is re-derived and re-verified from persisted records.
 * Exported for direct testing of the token lifecycle.
 */
export async function redeemDecisionToken(
  token: string,
  actorProfileId: string,
): Promise<GenerationSuccess> {
  const store = getStore();
  const env = getEnv();
  const provider = getVoiceProvider();
  const nowIso = new Date().toISOString();
  const nowEpochSeconds = Math.floor(Date.parse(nowIso) / 1000);

  const deny = async (jti: string | null, code: string, message: string) => {
    if (jti) {
      await store.markTokenRejected(jti, code);
      await store.appendAuditEvent({
        aggregateType: "decision_token",
        aggregateId: jti,
        eventType: "token.rejected",
        actorId: actorProfileId,
        payload: { jti, reason: code },
        createdAt: new Date().toISOString(),
      });
    }
    return new GenerationDeniedError(code, message);
  };

  // 1. Signature + temporal validity. Never log or expose the full token.
  const verification = verifyDecisionToken(
    token,
    env.decisionTokenSecret,
    nowEpochSeconds,
  );
  if (!verification.ok) {
    throw await deny(
      null,
      verification.reason,
      "The authorization token is invalid or expired.",
    );
  }
  const claims = verification.claims;

  // 2. Binding to persisted records: the token authorizes exactly one
  //    (decision, request, policy version, voice, organization, script,
  //    provider, model) tuple.
  const decision = await store.getDecision(claims.decisionId);
  const request = await store.getRequest(claims.requestId);
  if (!decision || !request || decision.outcome !== "approved") {
    throw await deny(
      claims.jti,
      "TOKEN_DECISION_MISMATCH",
      "The token does not match an approved decision.",
    );
  }
  const mismatch = findBindingMismatch(claims, {
    decisionId: decision.id,
    requestId: request.id,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    voiceId: request.voiceId,
    organizationId: request.organizationId,
    scriptHash: hashScript(request.script),
    provider: provider.name,
    model: provider.model,
  });
  if (mismatch) {
    throw await deny(
      claims.jti,
      mismatch,
      "The token is not bound to this exact request.",
    );
  }

  // 3. CURRENT policy status recheck: a token minted before a revocation is
  //    rejected here, unused.
  const currentPolicy = await store.getLatestPolicyForVoice(claims.voiceId);
  if (!currentPolicy || currentPolicy.id !== claims.policyId) {
    throw await deny(
      claims.jti,
      "POLICY_SUPERSEDED",
      "A newer policy version exists. Re-run the evaluation.",
    );
  }
  if (currentPolicy.status === "revoked") {
    throw await deny(
      claims.jti,
      "POLICY_REVOKED",
      "The owner revoked this consent policy after the token was issued.",
    );
  }
  if (currentPolicy.status !== "active") {
    throw await deny(
      claims.jti,
      "POLICY_NOT_ACTIVE",
      `The consent policy is ${currentPolicy.status}.`,
    );
  }
  if (Date.parse(currentPolicy.validUntil) < Date.parse(nowIso)) {
    throw await deny(
      claims.jti,
      "POLICY_EXPIRED",
      "The consent policy has expired.",
    );
  }
  const grant = decision.matchedGrantId
    ? currentPolicy.grants.find((entry) => entry.id === decision.matchedGrantId)
    : null;
  if (decision.matchedGrantId && !grant) {
    throw await deny(
      claims.jti,
      "GRANT_NOT_FOUND",
      "The amendment grant backing this decision no longer exists.",
    );
  }
  if (grant && grant.assetsUsed >= grant.maximumAssets) {
    throw await deny(
      claims.jti,
      "USAGE_LIMIT_REACHED",
      "The amendment grant allowance is exhausted.",
    );
  }
  if (!grant && currentPolicy.assetsUsed >= currentPolicy.maximumAssets) {
    throw await deny(
      claims.jti,
      "USAGE_LIMIT_REACHED",
      "The authorized usage allowance is exhausted.",
    );
  }

  // 4. Atomic single-use consumption — replay attempts fail here.
  const consumption = await store.consumeToken(claims.jti, nowIso);
  if (!consumption.ok) {
    await store.appendAuditEvent({
      aggregateType: "decision_token",
      aggregateId: claims.jti,
      eventType: "token.rejected",
      actorId: actorProfileId,
      payload: { jti: claims.jti, reason: consumption.reason },
      createdAt: new Date().toISOString(),
    });
    throw new GenerationDeniedError(
      consumption.reason,
      "This authorization token has already been used.",
    );
  }

  await store.updateRequestStatus(request.id, "generating", nowIso);

  // 5. Provider call — the only place the provider is ever invoked.
  let generated: {
    audioBuffer: Buffer;
    mimeType: string;
    providerAssetId?: string;
  };
  try {
    generated = await provider.generate({
      voiceId: request.voiceId,
      script: request.script,
      language: request.language,
      model: claims.model,
    });
  } catch (error) {
    await store.updateRequestStatus(
      request.id,
      "failed",
      new Date().toISOString(),
    );
    await store.appendAuditEvent({
      aggregateType: "generation_request",
      aggregateId: request.id,
      eventType: "generation.failed",
      actorId: actorProfileId,
      payload: {
        requestId: request.id,
        provider: provider.name,
        error: String(error).slice(0, 300),
      },
      createdAt: new Date().toISOString(),
    });
    throw new GenerationDeniedError(
      "PROVIDER_ERROR",
      "The voice provider failed to generate audio.",
    );
  }

  // 6. Register the asset: hash, store, bind to decision + policy version,
  //    increment usage atomically, chain audit events.
  const completedAt = new Date().toISOString();
  const asset: GeneratedAsset = {
    id: `asset-${opaqueId(8)}`,
    verificationId: opaqueId(12),
    decisionId: decision.id,
    requestId: request.id,
    policyId: decision.policyId,
    policyVersion: decision.policyVersion,
    voiceId: request.voiceId,
    organizationId: request.organizationId,
    storagePath: `assets/${claims.jti}`,
    sha256: sha256Hex(generated.audioBuffer),
    mimeType: generated.mimeType,
    byteLength: generated.audioBuffer.byteLength,
    provider: provider.name,
    providerAssetId: generated.providerAssetId ?? null,
    createdAt: completedAt,
  };
  await store.insertAsset(asset, generated.audioBuffer);
  await store.incrementPolicyUsage(
    decision.policyId,
    decision.matchedGrantId,
    completedAt,
  );
  await store.updateRequestStatus(request.id, "generated", completedAt);

  await store.appendAuditEvent({
    aggregateType: "decision_token",
    aggregateId: claims.jti,
    eventType: "token.consumed",
    actorId: actorProfileId,
    payload: {
      jti: claims.jti,
      decisionId: decision.id,
      requestId: request.id,
    },
    createdAt: completedAt,
  });
  await store.appendAuditEvent({
    aggregateType: "generated_asset",
    aggregateId: asset.id,
    eventType: "asset.generated",
    actorId: actorProfileId,
    payload: {
      assetId: asset.id,
      verificationId: asset.verificationId,
      requestId: request.id,
      decisionId: decision.id,
      policyId: asset.policyId,
      policyVersion: asset.policyVersion,
      sha256: asset.sha256,
      byteLength: asset.byteLength,
      mimeType: asset.mimeType,
      provider: asset.provider,
      usedGrantId: decision.matchedGrantId,
    },
    createdAt: completedAt,
  });

  const finalRecord = await store.getTokenRecord(claims.jti);
  return {
    asset,
    token: finalRecord ?? {
      jti: claims.jti,
      decisionId: decision.id,
      requestId: request.id,
      policyId: decision.policyId,
      policyVersion: decision.policyVersion,
      status: "consumed",
      mintedAt: nowIso,
      consumedAt: completedAt,
      rejectedReason: null,
    },
    redactedToken: redactToken(token),
  };
}
