/**
 * Amendment service — the agentic remedy loop.
 *
 * The agent DRAFTS a narrowly scoped proposal from the failed clauses.
 * The OWNER grants authority. The DETERMINISTIC ENGINE re-evaluates.
 * At no point does drafted text change what the engine enforces — approval
 * creates a new, versioned policy and the engine reads only that.
 */
import { opaqueId } from "@/domain/hash";
import type {
  AmendmentRequest,
  ConsentPolicy,
  PolicyGrant,
} from "@/domain/types";
import { getStore } from "@/server/data";
import { reevaluateRequest, type EvaluationOutcome } from "./evaluation";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  website: "website",
  other: "other-platform",
};

function formatDate(iso: string): string {
  return new Date(Date.parse(iso)).toISOString().slice(0, 10);
}

export async function draftAmendmentForRequest(
  requestId: string,
  actor: { profileId: string; organizationId: string },
): Promise<AmendmentRequest> {
  const store = getStore();

  const pending = await store.getPendingAmendmentForRequest(requestId);
  if (pending) return pending;

  const request = await store.getRequest(requestId);
  if (!request) throw new Error("Request not found.");
  if (request.organizationId !== actor.organizationId) {
    throw new Error("This request belongs to a different organization.");
  }
  const decision = await store.getLatestDecisionForRequest(requestId);
  if (!decision || decision.outcome !== "blocked") {
    throw new Error(
      "Only a blocked request can produce an amendment proposal.",
    );
  }
  const policy = await store.getPolicy(decision.policyId);
  if (!policy) throw new Error("The evaluated policy no longer exists.");

  const failedClauses = decision.clauses.filter(
    (clause) => clause.status === "failed",
  );
  const failedCodes = failedClauses.map((clause) => clause.code);
  const amendable = failedCodes.every((code) =>
    ["PAID_ADVERTISING_PROHIBITED", "USAGE_LIMIT_REACHED"].includes(code),
  );
  if (!amendable) {
    throw new Error(
      "Amendment drafting currently supports paid-placement and usage-allowance scopes. Adjust the request for other failed conditions.",
    );
  }

  const platformLabel = PLATFORM_LABELS[request.platform] ?? request.platform;
  const now = new Date().toISOString();
  const amendment: AmendmentRequest = {
    id: `amend-${opaqueId(8)}`,
    policyId: policy.id,
    policyVersion: policy.version,
    requestId: request.id,
    decisionId: decision.id,
    organizationId: request.organizationId,
    voiceId: request.voiceId,
    requestedById: actor.profileId,
    failedClauseCodes: failedCodes,
    originalClause: failedClauses
      .map((clause) => `${clause.clause}: ${clause.explanation}`)
      .join(" "),
    proposal: {
      kind: "scoped_paid_placement",
      campaignName: request.campaignName,
      platform: request.platform,
      placement: "paid",
      additionalAssets: 1,
      validUntil: policy.validUntil,
      rationale:
        `This request is blocked because paid advertising is prohibited under policy version ${policy.version}. ` +
        `It would pass as an organic post, or you can grant a narrowly scoped exception: one paid ${platformLabel} placement ` +
        `for the ${request.campaignName} campaign until ${formatDate(policy.validUntil)}. ` +
        `The exception carries its own single-use allowance and changes nothing else — languages, territories, topics and every other term stay exactly as you approved them.`,
    },
    status: "pending",
    ownerDecisionAt: null,
    ownerDecisionNote: null,
    resultingPolicyId: null,
    resultingPolicyVersion: null,
    createdAt: now,
    updatedAt: now,
  };

  await store.insertAmendment(amendment);
  await store.appendAuditEvent({
    aggregateType: "amendment_request",
    aggregateId: amendment.id,
    eventType: "amendment.requested",
    actorId: actor.profileId,
    payload: {
      amendmentId: amendment.id,
      requestId: request.id,
      policyId: policy.id,
      policyVersion: policy.version,
      failedCodes,
      proposal: {
        campaignName: amendment.proposal.campaignName,
        platform: amendment.proposal.platform,
        placement: amendment.proposal.placement,
        additionalAssets: amendment.proposal.additionalAssets,
        validUntil: amendment.proposal.validUntil,
      },
    },
    createdAt: now,
  });

  return amendment;
}

export type AmendmentDecisionResult = {
  amendment: AmendmentRequest;
  newPolicy: ConsentPolicy | null;
  rerun: EvaluationOutcome | null;
};

export async function decideAmendment(
  amendmentId: string,
  verdict: "approved" | "rejected",
  note: string | null,
  actor: { profileId: string },
): Promise<AmendmentDecisionResult> {
  const store = getStore();
  const amendment = await store.getAmendment(amendmentId);
  if (!amendment) throw new Error("Amendment not found.");
  if (amendment.status !== "pending") {
    throw new Error(`This amendment was already ${amendment.status}.`);
  }
  const voice = await store.getVoice(amendment.voiceId);
  if (!voice || voice.ownerId !== actor.profileId) {
    throw new Error("Only the voice owner can decide this amendment.");
  }

  const now = new Date().toISOString();

  if (verdict === "rejected") {
    const updated: AmendmentRequest = {
      ...amendment,
      status: "rejected",
      ownerDecisionAt: now,
      ownerDecisionNote: note,
      updatedAt: now,
    };
    await store.updateAmendment(updated);
    await store.appendAuditEvent({
      aggregateType: "amendment_request",
      aggregateId: amendment.id,
      eventType: "amendment.rejected",
      actorId: actor.profileId,
      payload: { amendmentId: amendment.id, note },
      createdAt: now,
    });
    return { amendment: updated, newPolicy: null, rerun: null };
  }

  // Approval → new policy VERSION. The old version is preserved untouched
  // (only its status flips to superseded); the approved change is applied as
  // a scoped grant on the copy.
  const policy = await store.getPolicy(amendment.policyId);
  if (!policy) throw new Error("The amended policy no longer exists.");
  const latest = await store.getLatestPolicyForVoice(amendment.voiceId);
  if (!latest || latest.id !== policy.id || latest.status !== "active") {
    throw new Error(
      "The policy version this amendment targets is no longer the active version. Ask the requester to resubmit.",
    );
  }

  const grant: PolicyGrant = {
    id: `grant-${opaqueId(6)}`,
    label: `One paid ${PLATFORM_LABELS[amendment.proposal.platform] ?? amendment.proposal.platform} placement — ${amendment.proposal.campaignName}`,
    campaignName: amendment.proposal.campaignName,
    platform: amendment.proposal.platform,
    placement: "paid",
    maximumAssets: amendment.proposal.additionalAssets,
    assetsUsed: 0,
    validUntil: amendment.proposal.validUntil,
    sourceAmendmentId: amendment.id,
  };

  const baseId = policy.id.replace(/-v\d+$/, "");
  const newPolicy: ConsentPolicy = {
    ...structuredClone(policy),
    id: `${baseId}-v${policy.version + 1}`,
    version: policy.version + 1,
    status: "active",
    grants: [...policy.grants.map((g) => structuredClone(g)), grant],
    supersedesPolicyId: policy.id,
    ownerApprovedAt: now,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await store.createPolicyVersion(newPolicy, policy.id, now);

  const updated: AmendmentRequest = {
    ...amendment,
    status: "approved",
    ownerDecisionAt: now,
    ownerDecisionNote: note,
    resultingPolicyId: newPolicy.id,
    resultingPolicyVersion: newPolicy.version,
    updatedAt: now,
  };
  await store.updateAmendment(updated);

  await store.appendAuditEvent({
    aggregateType: "consent_policy",
    aggregateId: newPolicy.id,
    eventType: "policy.version_created",
    actorId: actor.profileId,
    payload: {
      policyId: newPolicy.id,
      version: newPolicy.version,
      supersedesPolicyId: policy.id,
      sourceAmendmentId: amendment.id,
      grant: {
        id: grant.id,
        label: grant.label,
        campaignName: grant.campaignName,
        platform: grant.platform,
        maximumAssets: grant.maximumAssets,
        validUntil: grant.validUntil,
      },
    },
    createdAt: now,
  });
  await store.appendAuditEvent({
    aggregateType: "consent_policy",
    aggregateId: policy.id,
    eventType: "policy.superseded",
    actorId: actor.profileId,
    payload: { policyId: policy.id, supersededByPolicyId: newPolicy.id },
    createdAt: now,
  });
  await store.appendAuditEvent({
    aggregateType: "amendment_request",
    aggregateId: amendment.id,
    eventType: "amendment.approved",
    actorId: actor.profileId,
    payload: {
      amendmentId: amendment.id,
      resultingPolicyId: newPolicy.id,
      resultingPolicyVersion: newPolicy.version,
      note,
    },
    createdAt: now,
  });

  // Automatic rerun of the originating blocked request against the new version.
  const rerun = await reevaluateRequest(amendment.requestId, actor.profileId);

  return { amendment: updated, newPolicy, rerun };
}
