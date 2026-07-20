/**
 * Integration tests for the full authorization pipeline against the local
 * store: evaluation → amendment → versioning → token → generation → asset →
 * verification → revocation → audit chain.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_CAMPAIGN_NAME,
  DEMO_IDS,
  DEMO_SCRIPT_AR,
  INJECTION_SCRIPT,
} from "@/domain/fixtures";
import { hashScript, sha256Hex } from "@/domain/hash";
import { verifyAuditChain } from "@/domain/audit";
import type { GenerationRequestInput } from "@/domain/schemas";
import { getStore } from "@/server/data";
import { getEnv } from "@/server/env";
import { reevaluateRequest, submitGenerationRequest } from "./evaluation";
import { draftAmendmentForRequest, decideAmendment } from "./amendment";
import { generateAssetForRequest, redeemDecisionToken } from "./generation";
import { revokePolicy } from "./consent";
import { compareUploadedFile, getPublicVerification } from "./verification";
import { buildClaims, mintDecisionToken } from "@/server/tokens";

const requesterActor = {
  profileId: DEMO_IDS.requester,
  organizationId: DEMO_IDS.organization,
};
const ownerActor = { profileId: DEMO_IDS.owner };

function baseInput(
  overrides: Partial<GenerationRequestInput> = {},
): GenerationRequestInput {
  return {
    voiceId: DEMO_IDS.voice,
    script: DEMO_SCRIPT_AR,
    campaignName: DEMO_CAMPAIGN_NAME,
    purpose: "brand_promotion",
    platform: "instagram",
    language: "ar",
    placement: "organic",
    territory: "AE",
    publicationDate: "2026-07-25T09:00:00.000Z",
    topicTags: ["technology"],
    ...overrides,
  };
}

beforeEach(async () => {
  await getStore().reset();
});

describe("evaluation service", () => {
  it("approves the compliant organic request", async () => {
    const outcome = await submitGenerationRequest(baseInput(), requesterActor);
    expect(outcome.decision.outcome).toBe("approved");
    expect(outcome.request.status).toBe("approved");
    expect(outcome.policy.version).toBe(1);
  });

  it("blocks the paid request with PAID_ADVERTISING_PROHIBITED", async () => {
    const outcome = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    expect(outcome.decision.outcome).toBe("blocked");
    const failed = outcome.decision.clauses.filter(
      (c) => c.status === "failed",
    );
    expect(failed.map((c) => c.code)).toEqual(["PAID_ADVERTISING_PROHIBITED"]);
  });

  it("prompt injection in the script does not alter the decision", async () => {
    const outcome = await submitGenerationRequest(
      baseInput({ placement: "paid", script: INJECTION_SCRIPT }),
      requesterActor,
    );
    expect(outcome.decision.outcome).toBe("blocked");
    expect(
      outcome.decision.clauses
        .filter((c) => c.status === "failed")
        .map((c) => c.code),
    ).toEqual(["PAID_ADVERTISING_PROHIBITED"]);
  });
});

describe("amendment → version 2 → automatic rerun", () => {
  it("runs the full loop and preserves history", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    expect(blocked.decision.outcome).toBe("blocked");

    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    expect(amendment.status).toBe("pending");
    expect(amendment.proposal.kind).toBe("scoped_paid_placement");
    expect(amendment.proposal.additionalAssets).toBe(1);
    expect(amendment.proposal.campaignName).toBe(DEMO_CAMPAIGN_NAME);

    const result = await decideAmendment(
      amendment.id,
      "approved",
      null,
      ownerActor,
    );
    expect(result.newPolicy?.version).toBe(2);
    expect(result.newPolicy?.supersedesPolicyId).toBe(DEMO_IDS.policyV1);
    expect(result.newPolicy?.grants).toHaveLength(1);
    expect(result.rerun?.decision.outcome).toBe("approved");
    expect(result.rerun?.decision.policyVersion).toBe(2);
    expect(result.rerun?.decision.matchedGrantId).toBe(
      result.newPolicy?.grants[0]?.id,
    );

    // History preserved: v1 still exists, superseded, unmutated terms.
    const store = getStore();
    const v1 = await store.getPolicy(DEMO_IDS.policyV1);
    expect(v1?.status).toBe("superseded");
    expect(v1?.paidAdvertising).toBe("prohibited");
    expect(v1?.grants).toHaveLength(0);

    // Both decisions for the request remain on record.
    const decisions = await store.listDecisionsForRequest(blocked.request.id);
    expect(decisions.map((d) => d.outcome)).toEqual(["blocked", "approved"]);
  });

  it("only the voice owner can decide an amendment", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    await expect(
      decideAmendment(amendment.id, "approved", null, {
        profileId: DEMO_IDS.requester,
      }),
    ).rejects.toThrow(/voice owner/i);
  });

  it("re-drafting returns the existing pending amendment", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const first = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    const second = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    expect(second.id).toBe(first.id);
  });

  it("repeating the same amendment decision is idempotent", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    const first = await decideAmendment(
      amendment.id,
      "approved",
      "Scoped demo approval",
      ownerActor,
    );
    const repeated = await decideAmendment(
      amendment.id,
      "approved",
      "Scoped demo approval",
      ownerActor,
    );

    expect(repeated.newPolicy?.id).toBe(first.newPolicy?.id);
    expect(repeated.rerun?.decision.id).toBe(first.rerun?.decision.id);
    expect(
      await getStore().listPolicyVersionsForVoice(DEMO_IDS.voice),
    ).toHaveLength(2);
    expect(
      await getStore().listDecisionsForRequest(blocked.request.id),
    ).toHaveLength(2);
  });
});

describe("token → generation → asset", () => {
  async function approvedPaidRequest() {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    await decideAmendment(amendment.id, "approved", null, ownerActor);
    return blocked.request.id;
  }

  it("generates a playable asset, hashes it, and consumes the token", async () => {
    const requestId = await approvedPaidRequest();
    const result = await generateAssetForRequest(requestId, requesterActor);

    expect(result.token.status).toBe("consumed");
    expect(result.token.consumedAt).not.toBeNull();
    expect(result.asset.policyVersion).toBe(2);
    expect(result.asset.mimeType).toBe("audio/wav");
    expect(result.redactedToken).toContain("…");

    const store = getStore();
    const bytes = await store.getAssetBytes(result.asset.id);
    expect(bytes).not.toBeNull();
    expect(sha256Hex(bytes!)).toBe(result.asset.sha256);
    // Real playable WAV header
    expect(bytes!.subarray(0, 4).toString("ascii")).toBe("RIFF");

    // Grant pool consumed, base pool untouched.
    const policy = await store.getLatestPolicyForVoice(DEMO_IDS.voice);
    expect(policy?.grants[0]?.assetsUsed).toBe(1);
    expect(policy?.assetsUsed).toBe(0);
  });

  it("refuses to mint for a blocked decision", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    await expect(
      generateAssetForRequest(blocked.request.id, requesterActor),
    ).rejects.toMatchObject({ code: "DECISION_NOT_APPROVED" });
  });

  it("rejects a replayed token", async () => {
    const requestId = await approvedPaidRequest();
    await generateAssetForRequest(requestId, requesterActor);
    const store = getStore();
    const tokens = await store.listTokensForRequest(requestId);
    expect(tokens).toHaveLength(1);
    const replay = await store.consumeToken(
      tokens[0]!.jti,
      new Date().toISOString(),
    );
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe("TOKEN_REPLAYED");
  });

  it("rejects a second generation for the same request", async () => {
    const requestId = await approvedPaidRequest();
    await generateAssetForRequest(requestId, requesterActor);
    await expect(
      generateAssetForRequest(requestId, requesterActor),
    ).rejects.toMatchObject({ code: "ALREADY_GENERATED" });
  });

  it("finalizes concurrent redemptions without duplicate assets or usage drift", async () => {
    const outcome = await submitGenerationRequest(baseInput(), requesterActor);
    const attempts = await Promise.allSettled([
      generateAssetForRequest(outcome.request.id, requesterActor),
      generateAssetForRequest(outcome.request.id, requesterActor),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = attempts.find(
      (attempt): attempt is PromiseRejectedResult =>
        attempt.status === "rejected",
    );
    expect(rejected?.reason).toMatchObject({ code: "ALREADY_GENERATED" });

    const store = getStore();
    expect(await store.listAssetsForOwner(DEMO_IDS.owner)).toHaveLength(1);
    expect((await store.getPolicy(DEMO_IDS.policyV1))?.assetsUsed).toBe(1);
    expect((await store.getRequest(outcome.request.id))?.status).toBe(
      "generated",
    );
  });

  it("rejects an unused token after the policy is revoked", async () => {
    const outcome = await submitGenerationRequest(baseInput(), requesterActor);
    expect(outcome.decision.outcome).toBe("approved");
    const store = getStore();
    const env = getEnv();

    // Mint a token by hand (as the gateway would), then revoke before redeeming.
    const now = Math.floor(Date.now() / 1000);
    const claims = buildClaims({
      decisionId: outcome.decision.id,
      requestId: outcome.request.id,
      policyId: outcome.decision.policyId,
      policyVersion: outcome.decision.policyVersion,
      voiceId: DEMO_IDS.voice,
      organizationId: DEMO_IDS.organization,
      scriptHash: outcome.request.scriptHash,
      provider: "mock",
      model: "mithaq-demo-voice-1",
      nowEpochSeconds: now,
    });
    const token = mintDecisionToken(claims, env.decisionTokenSecret);
    await store.insertTokenRecord({
      jti: claims.jti,
      decisionId: claims.decisionId,
      requestId: claims.requestId,
      policyId: claims.policyId,
      policyVersion: claims.policyVersion,
      status: "minted",
      mintedAt: new Date().toISOString(),
      consumedAt: null,
      rejectedReason: null,
    });

    await revokePolicy(outcome.decision.policyId, ownerActor);

    await expect(
      redeemDecisionToken(token, DEMO_IDS.requester),
    ).rejects.toMatchObject({ code: "POLICY_REVOKED" });
    const record = await store.getTokenRecord(claims.jti);
    expect(record?.status).toBe("rejected");
    expect(record?.rejectedReason).toBe("POLICY_REVOKED");
  });

  it("rejects a token whose script hash no longer matches the request", async () => {
    const outcome = await submitGenerationRequest(baseInput(), requesterActor);
    const env = getEnv();
    const store = getStore();
    const now = Math.floor(Date.now() / 1000);
    const claims = buildClaims({
      decisionId: outcome.decision.id,
      requestId: outcome.request.id,
      policyId: outcome.decision.policyId,
      policyVersion: outcome.decision.policyVersion,
      voiceId: DEMO_IDS.voice,
      organizationId: DEMO_IDS.organization,
      scriptHash: hashScript("a script that was never approved"),
      provider: "mock",
      model: "mithaq-demo-voice-1",
      nowEpochSeconds: now,
    });
    const token = mintDecisionToken(claims, env.decisionTokenSecret);
    await store.insertTokenRecord({
      jti: claims.jti,
      decisionId: claims.decisionId,
      requestId: claims.requestId,
      policyId: claims.policyId,
      policyVersion: claims.policyVersion,
      status: "minted",
      mintedAt: new Date().toISOString(),
      consumedAt: null,
      rejectedReason: null,
    });
    await expect(
      redeemDecisionToken(token, DEMO_IDS.requester),
    ).rejects.toMatchObject({ code: "TOKEN_SCRIPT_HASH_MISMATCH" });
  });
});

describe("revocation and verification", () => {
  it("revocation blocks future requests immediately but preserves history", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    const decided = await decideAmendment(
      amendment.id,
      "approved",
      null,
      ownerActor,
    );
    await generateAssetForRequest(blocked.request.id, requesterActor);

    const firstRevocation = await revokePolicy(
      decided.newPolicy!.id,
      ownerActor,
    );
    const repeatedRevocation = await revokePolicy(
      decided.newPolicy!.id,
      ownerActor,
    );
    expect(repeatedRevocation.revokedAt).toBe(firstRevocation.revokedAt);

    const rerun = await reevaluateRequest(
      blocked.request.id,
      DEMO_IDS.requester,
    );
    expect(rerun.decision.outcome).toBe("blocked");
    expect(
      rerun.decision.clauses
        .filter((c) => c.status === "failed")
        .map((c) => c.code),
    ).toContain("POLICY_REVOKED");

    // Historical decisions unchanged.
    const store = getStore();
    const decisions = await store.listDecisionsForRequest(blocked.request.id);
    expect(decisions.map((d) => d.outcome)).toEqual([
      "blocked",
      "approved",
      "blocked",
    ]);

    // The asset record remains visible.
    const asset = await store.getAssetForRequest(blocked.request.id);
    expect(asset).not.toBeNull();

    // The public verifier reflects historical approval + current revocation.
    const verification = await getPublicVerification(asset!.verificationId);
    expect(verification?.status).toBe("revoked");
    expect(verification?.policyVersionUsed).toBe(2);
    expect(verification?.statusDetail).toMatch(
      /approved under policy version 2/i,
    );
    expect(verification?.statusDetail).toMatch(/revoked/i);
    expect(
      (await store.listAuditEvents()).filter(
        (event) => event.eventType === "policy.revoked",
      ),
    ).toHaveLength(1);
  });

  it("hash-compares uploaded files: exact and modified", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    await decideAmendment(amendment.id, "approved", null, ownerActor);
    const generated = await generateAssetForRequest(
      blocked.request.id,
      requesterActor,
    );

    const store = getStore();
    const original = await store.getAssetBytes(generated.asset.id);
    const exact = await compareUploadedFile(
      generated.asset.verificationId,
      original!,
    );
    expect(exact?.match).toBe("exact");

    const tampered = Buffer.from(original!);
    tampered[100] = (tampered[100]! + 1) % 256;
    const modified = await compareUploadedFile(
      generated.asset.verificationId,
      tampered,
    );
    expect(modified?.match).toBe("modified");
  });
});

describe("audit chain", () => {
  it("the chain over a full demo flow verifies, and tampering breaks it", async () => {
    const blocked = await submitGenerationRequest(
      baseInput({ placement: "paid" }),
      requesterActor,
    );
    const amendment = await draftAmendmentForRequest(
      blocked.request.id,
      requesterActor,
    );
    const decided = await decideAmendment(
      amendment.id,
      "approved",
      null,
      ownerActor,
    );
    await generateAssetForRequest(blocked.request.id, requesterActor);
    await revokePolicy(decided.newPolicy!.id, ownerActor);

    const store = getStore();
    const events = await store.listAuditEvents();
    expect(events.length).toBeGreaterThan(10);
    expect(verifyAuditChain(events).valid).toBe(true);

    const tampered = structuredClone(events);
    (tampered[4]!.payload as Record<string, unknown>).outcome = "approved";
    const verdict = verifyAuditChain(tampered);
    expect(verdict.valid).toBe(false);
    expect(verdict.firstBrokenAt?.index).toBe(4);
  });

  it("reset restores the exact seeded baseline", async () => {
    const outcome = await submitGenerationRequest(baseInput(), requesterActor);
    await generateAssetForRequest(outcome.request.id, requesterActor);
    await getStore().reset();

    const store = getStore();
    const versions = await store.listPolicyVersionsForVoice(DEMO_IDS.voice);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({
      id: DEMO_IDS.policyV1,
      version: 1,
      status: "active",
      assetsUsed: 0,
      grants: [],
      revokedAt: null,
    });
    expect(
      await store.listRequestsForOrganization(DEMO_IDS.organization),
    ).toHaveLength(0);
    expect(
      await store.listAmendmentsForOrganization(DEMO_IDS.organization),
    ).toHaveLength(0);
    expect(await store.listAssetsForOwner(DEMO_IDS.owner)).toHaveLength(0);
    const audit = await store.listAuditEvents();
    expect(audit).toHaveLength(3);
    expect(verifyAuditChain(audit).valid).toBe(true);
  });
});
