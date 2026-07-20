import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./engine";
import {
  buildCompliantRequest,
  buildDemoPolicyV1,
  DEMO_CAMPAIGN_NAME,
  DEMO_IDS,
  FIXED_NOW,
  INJECTION_SCRIPT,
} from "./fixtures";
import { hashScript } from "./hash";
import type { ConsentPolicy, PolicyGrant } from "./types";

function failedCodes(decision: ReturnType<typeof evaluatePolicy>): string[] {
  return decision.clauses
    .filter((clause) => clause.status === "failed")
    .map((clause) => clause.code);
}

function buildGrant(overrides: Partial<PolicyGrant> = {}): PolicyGrant {
  return {
    id: "grant-demo-1",
    label: "One paid Instagram placement — MITHAQ Demo Campaign",
    campaignName: DEMO_CAMPAIGN_NAME,
    platform: "instagram",
    placement: "paid",
    maximumAssets: 1,
    assetsUsed: 0,
    validUntil: "2026-07-30T23:59:59.000Z",
    sourceAmendmentId: "amendment-demo-1",
    ...overrides,
  };
}

function buildPolicyV2WithGrant(grant: PolicyGrant = buildGrant()): ConsentPolicy {
  const v1 = buildDemoPolicyV1();
  return {
    ...v1,
    id: "policy-awaiz-v2",
    version: 2,
    supersedesPolicyId: v1.id,
    grants: [grant],
  };
}

describe("policy engine — approvals", () => {
  it("approves the compliant organic Arabic Instagram request", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest(),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("approved");
    expect(decision.clauses.every((clause) => clause.status === "passed")).toBe(true);
    expect(decision.policyVersion).toBe(1);
    expect(decision.matchedGrantId).toBeNull();
  });

  it("is deny-by-default: any failed clause blocks the whole request", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ platform: "tiktok" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
  });
});

describe("policy engine — clause failures", () => {
  it("blocks an unauthorized organization", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ organizationId: "org-unknown" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toContain("ORGANIZATION_NOT_AUTHORIZED");
  });

  it("blocks a disallowed purpose", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ purpose: "entertainment" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("PURPOSE_NOT_ALLOWED");
  });

  it("blocks a disallowed platform", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ platform: "tiktok" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("PLATFORM_NOT_ALLOWED");
  });

  it("blocks a disallowed language", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ language: "ur" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("LANGUAGE_NOT_ALLOWED");
  });

  it("blocks a disallowed territory (case-insensitively normalized)", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ territory: "us" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("TERRITORY_NOT_ALLOWED");
  });

  it("accepts an allowed territory in any case", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ territory: " ae " }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("approved");
  });

  it("blocks paid placement when paid advertising is prohibited", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ placement: "paid" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toEqual(["PAID_ADVERTISING_PROHIBITED"]);
    const clause = decision.clauses.find((c) => c.code === "PAID_ADVERTISING_PROHIBITED");
    expect(clause?.suggestedRemedy).toMatch(/organic/i);
  });

  it("blocks a prohibited topic even when everything else is permitted", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ topicTags: ["Politics"] }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toEqual(["PROHIBITED_TOPIC"]);
    const clause = decision.clauses.find((c) => c.code === "PROHIBITED_TOPIC");
    expect(clause?.explanation).toMatch(/explicit prohibitions override/i);
  });

  it("blocks when the base usage allowance is exhausted", () => {
    const policy = { ...buildDemoPolicyV1(), assetsUsed: 1 };
    const decision = evaluatePolicy({
      policy,
      request: buildCompliantRequest(),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toEqual(["USAGE_LIMIT_REACHED"]);
  });

  it("blocks a request with missing required fields", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ script: "", scriptHash: "" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("MISSING_REQUIRED_FIELD");
  });

  it("blocks a voice mismatch", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ voiceId: "voice-other" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("VOICE_MISMATCH");
  });

  it("blocks a publication date outside the consent window", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ publicationDate: "2026-08-15T09:00:00.000Z" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("PUBLICATION_DATE_OUTSIDE_VALIDITY");
  });
});

describe("policy engine — policy lifecycle states", () => {
  it("blocks a draft policy", () => {
    const policy = { ...buildDemoPolicyV1(), status: "draft" as const };
    const decision = evaluatePolicy({
      policy,
      request: buildCompliantRequest(),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("POLICY_NOT_ACTIVE");
  });

  it("blocks a superseded policy for new requests", () => {
    const policy = { ...buildDemoPolicyV1(), status: "superseded" as const };
    const decision = evaluatePolicy({
      policy,
      request: buildCompliantRequest(),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("POLICY_SUPERSEDED");
  });

  it("blocks a revoked policy", () => {
    const policy = {
      ...buildDemoPolicyV1(),
      status: "revoked" as const,
      revokedAt: FIXED_NOW,
    };
    const decision = evaluatePolicy({
      policy,
      request: buildCompliantRequest(),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toContain("POLICY_REVOKED");
  });

  it("blocks an expired policy by status", () => {
    const policy = { ...buildDemoPolicyV1(), status: "expired" as const };
    const decision = evaluatePolicy({
      policy,
      request: buildCompliantRequest(),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("POLICY_EXPIRED");
  });

  it("blocks an 'active' policy evaluated after its validUntil (defense in depth)", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest(),
      evaluatedAt: "2026-08-02T00:00:00.000Z",
    });
    expect(failedCodes(decision)).toContain("POLICY_EXPIRED");
  });

  it("blocks requests before validFrom", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ publicationDate: "2026-07-05T00:00:00.000Z" }),
      evaluatedAt: "2026-06-20T00:00:00.000Z",
    });
    expect(failedCodes(decision)).toContain("POLICY_NOT_YET_ACTIVE");
  });
});

describe("policy engine — prompt injection defense", () => {
  it("ignores instructions embedded in the script: paid stays blocked", () => {
    const decision = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({
        script: INJECTION_SCRIPT,
        placement: "paid",
      }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toEqual(["PAID_ADVERTISING_PROHIBITED"]);
  });

  it("script content changes nothing for an otherwise compliant request", () => {
    const withInjection = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ script: INJECTION_SCRIPT }),
      evaluatedAt: FIXED_NOW,
    });
    expect(withInjection.outcome).toBe("approved");
    // …because authorization never reads the script. The injection text is
    // inert data; only structured request fields are evaluated.
  });
});

describe("policy engine — amendment grants (narrow exceptions)", () => {
  it("approves a paid request matching an owner-approved grant", () => {
    const decision = evaluatePolicy({
      policy: buildPolicyV2WithGrant(),
      request: buildCompliantRequest({ placement: "paid" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("approved");
    expect(decision.matchedGrantId).toBe("grant-demo-1");
    const placement = decision.clauses.find((c) => c.clause === "Placement");
    expect(placement?.explanation).toMatch(/amendment grant/i);
  });

  it("keeps blocking a paid request for a different campaign", () => {
    const decision = evaluatePolicy({
      policy: buildPolicyV2WithGrant(),
      request: buildCompliantRequest({
        placement: "paid",
        campaignName: "Some Other Campaign",
      }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toEqual(["PAID_ADVERTISING_PROHIBITED"]);
  });

  it("keeps blocking a paid request on a platform outside the grant", () => {
    const decision = evaluatePolicy({
      policy: buildPolicyV2WithGrant(),
      request: buildCompliantRequest({ placement: "paid", platform: "youtube" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toEqual(["PAID_ADVERTISING_PROHIBITED"]);
  });

  it("reports USAGE_LIMIT_REACHED when the grant allowance is exhausted", () => {
    const decision = evaluatePolicy({
      policy: buildPolicyV2WithGrant(buildGrant({ assetsUsed: 1 })),
      request: buildCompliantRequest({ placement: "paid" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toEqual(["USAGE_LIMIT_REACHED"]);
  });

  it("a grant never bypasses prohibited topics (prohibitions stay dominant)", () => {
    const decision = evaluatePolicy({
      policy: buildPolicyV2WithGrant(),
      request: buildCompliantRequest({
        placement: "paid",
        topicTags: ["politics"],
      }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toEqual(["PROHIBITED_TOPIC"]);
  });

  it("ignores an expired grant", () => {
    const decision = evaluatePolicy({
      policy: buildPolicyV2WithGrant(
        buildGrant({ validUntil: "2026-07-10T00:00:00.000Z" }),
      ),
      request: buildCompliantRequest({ placement: "paid" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(failedCodes(decision)).toContain("PAID_ADVERTISING_PROHIBITED");
  });

  it("blocks everything on a revoked v2 policy, grant or not", () => {
    const policy = {
      ...buildPolicyV2WithGrant(),
      status: "revoked" as const,
      revokedAt: FIXED_NOW,
    };
    const decision = evaluatePolicy({
      policy,
      request: buildCompliantRequest({ placement: "paid" }),
      evaluatedAt: FIXED_NOW,
    });
    expect(decision.outcome).toBe("blocked");
    expect(failedCodes(decision)).toContain("POLICY_REVOKED");
  });
});

describe("policy engine — determinism", () => {
  it("produces byte-identical output for identical input", () => {
    const input = {
      policy: buildDemoPolicyV1(),
      request: buildCompliantRequest({ placement: "paid" as const }),
      evaluatedAt: FIXED_NOW,
    };
    const first = evaluatePolicy(input);
    const second = evaluatePolicy(input);
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
  });

  it("depends only on its inputs, not on wall-clock time", () => {
    const request = buildCompliantRequest();
    const a = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request,
      evaluatedAt: FIXED_NOW,
    });
    const b = evaluatePolicy({
      policy: buildDemoPolicyV1(),
      request,
      evaluatedAt: FIXED_NOW,
    });
    expect(a).toEqual(b);
  });
});

describe("script hashing", () => {
  it("hash is stable across CRLF/whitespace noise", () => {
    expect(hashScript("Hello\r\nWorld  ")).toEqual(hashScript("Hello\nWorld"));
  });

  it("hash changes when the spoken text changes", () => {
    expect(hashScript("Hello world")).not.toEqual(hashScript("Hello worlds"));
  });

  it("request fixtures carry the hash of their script", () => {
    const request = buildCompliantRequest({ script: "A brand new script for the demo." });
    expect(request.scriptHash).toEqual(hashScript("A brand new script for the demo."));
  });
});
