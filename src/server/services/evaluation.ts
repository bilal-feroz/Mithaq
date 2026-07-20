/**
 * Generation-request evaluation service.
 *
 * Persists the request, runs the DETERMINISTIC engine (the only authority),
 * persists the decision with its clause results and writes audit events.
 */
import { evaluatePolicy } from "@/domain/engine";
import { hashScript, opaqueId } from "@/domain/hash";
import {
  generationRequestInputSchema,
  type GenerationRequestInput,
} from "@/domain/schemas";
import { normalizeScript } from "@/domain/normalize";
import type {
  ConsentPolicy,
  GenerationRequest,
  StoredDecision,
} from "@/domain/types";
import { getStore } from "@/server/data";

export type EvaluationOutcome = {
  request: GenerationRequest;
  decision: StoredDecision;
  policy: ConsentPolicy;
};

export async function submitGenerationRequest(
  rawInput: GenerationRequestInput,
  actor: { profileId: string; organizationId: string },
): Promise<EvaluationOutcome> {
  const store = getStore();
  const input = generationRequestInputSchema.parse(rawInput);
  const now = new Date().toISOString();

  const policy = await store.getLatestPolicyForVoice(input.voiceId);
  if (!policy) {
    throw new Error(
      "No consent policy exists for this voice. The owner must create one in the Consent Studio first.",
    );
  }

  const script = normalizeScript(input.script);
  const request: GenerationRequest = {
    id: `req-${opaqueId(8)}`,
    requesterId: actor.profileId,
    organizationId: actor.organizationId,
    voiceId: input.voiceId,
    script,
    scriptHash: hashScript(script),
    campaignName: input.campaignName,
    purpose: input.purpose,
    platform: input.platform,
    language: input.language,
    placement: input.placement,
    territory: input.territory,
    publicationDate: input.publicationDate,
    topicTags: input.topicTags,
    status: "evaluating",
    createdAt: now,
    updatedAt: now,
  };

  await store.insertRequest(request);
  await store.appendAuditEvent({
    aggregateType: "generation_request",
    aggregateId: request.id,
    eventType: "request.submitted",
    actorId: actor.profileId,
    payload: {
      requestId: request.id,
      voiceId: request.voiceId,
      organizationId: request.organizationId,
      platform: request.platform,
      language: request.language,
      placement: request.placement,
      territory: request.territory,
      campaignName: request.campaignName,
      scriptHash: request.scriptHash,
    },
    createdAt: now,
  });

  return evaluateAndPersist(request, policy, actor.profileId);
}

/**
 * Re-evaluate an existing request against the CURRENT latest policy version.
 * Used for the automatic rerun after an amendment approval and for the
 * retry-after-revocation demonstration. Historical decisions are preserved;
 * each rerun appends a new decision.
 */
export async function reevaluateRequest(
  requestId: string,
  actorProfileId: string | null,
): Promise<EvaluationOutcome> {
  const store = getStore();
  const request = await store.getRequest(requestId);
  if (!request) throw new Error(`Request not found: ${requestId}`);
  const policy = await store.getLatestPolicyForVoice(request.voiceId);
  if (!policy) throw new Error("No consent policy exists for this voice.");
  return evaluateAndPersist(request, policy, actorProfileId);
}

async function evaluateAndPersist(
  request: GenerationRequest,
  policy: ConsentPolicy,
  actorProfileId: string | null,
): Promise<EvaluationOutcome> {
  const store = getStore();
  const evaluatedAt = new Date().toISOString();

  const decision = evaluatePolicy({ policy, request, evaluatedAt });
  const stored: StoredDecision = {
    ...decision,
    id: `dec-${opaqueId(8)}`,
    createdAt: evaluatedAt,
  };
  await store.insertDecision(stored);

  const failedCodes = stored.clauses
    .filter((clause) => clause.status === "failed")
    .map((clause) => clause.code);

  await store.appendAuditEvent({
    aggregateType: "policy_decision",
    aggregateId: stored.id,
    eventType:
      stored.outcome === "approved" ? "decision.approved" : "decision.blocked",
    actorId: actorProfileId,
    payload: {
      decisionId: stored.id,
      requestId: request.id,
      policyId: policy.id,
      policyVersion: policy.version,
      outcome: stored.outcome,
      clausesPassed: stored.clauses.filter((c) => c.status === "passed").length,
      clausesFailed: failedCodes.length,
      failedCodes,
      matchedGrantId: stored.matchedGrantId,
    },
    createdAt: evaluatedAt,
  });

  const nextStatus = stored.outcome === "approved" ? "approved" : "blocked";
  await store.updateRequestStatus(request.id, nextStatus, evaluatedAt);

  return {
    request: { ...request, status: nextStatus, updatedAt: evaluatedAt },
    decision: stored,
    policy,
  };
}
