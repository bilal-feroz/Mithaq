import { describe, expect, it } from "vitest";
import {
  buildClaims,
  findBindingMismatch,
  mintDecisionToken,
  redactToken,
  TOKEN_TTL_SECONDS,
  verifyDecisionToken,
} from "./tokens";
import { hashScript } from "@/domain/hash";

const SECRET = "test-secret-with-plenty-of-entropy-0123456789";
const NOW = 1_784_000_000; // fixed epoch seconds

function claimsFixture() {
  return buildClaims({
    decisionId: "dec-1",
    requestId: "req-1",
    policyId: "policy-umar-v1",
    policyVersion: 1,
    voiceId: "voice-umar-demo",
    organizationId: "org-kanban",
    scriptHash: hashScript("hello world script"),
    provider: "mock",
    model: "mithaq-demo-voice-1",
    nowEpochSeconds: NOW,
  });
}

describe("decision tokens", () => {
  it("mints and verifies a valid token", () => {
    const claims = claimsFixture();
    const token = mintDecisionToken(claims, SECRET);
    const verification = verifyDecisionToken(token, SECRET, NOW + 5);
    expect(verification.ok).toBe(true);
    if (verification.ok) {
      expect(verification.claims.jti).toBe(claims.jti);
      expect(verification.claims.maximumUses).toBe(1);
      expect(verification.claims.expiresAt - verification.claims.issuedAt).toBe(
        TOKEN_TTL_SECONDS,
      );
    }
  });

  it("rejects an expired token (~60s TTL)", () => {
    const token = mintDecisionToken(claimsFixture(), SECRET);
    const verification = verifyDecisionToken(
      token,
      SECRET,
      NOW + TOKEN_TTL_SECONDS + 1,
    );
    expect(verification).toEqual({ ok: false, reason: "TOKEN_EXPIRED" });
  });

  it("rejects a payload tampered after signing", () => {
    const claims = claimsFixture();
    const token = mintDecisionToken(claims, SECRET);
    const parts = token.split(".");
    const payload = JSON.parse(
      Buffer.from(parts[2]!, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    payload.policyVersion = 99; // attempt to bind to a different policy version
    parts[2] = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    const verification = verifyDecisionToken(parts.join("."), SECRET, NOW + 5);
    expect(verification).toEqual({
      ok: false,
      reason: "TOKEN_SIGNATURE_INVALID",
    });
  });

  it("rejects a token signed with a different secret", () => {
    const token = mintDecisionToken(
      claimsFixture(),
      "another-secret-another-secret-123456",
    );
    const verification = verifyDecisionToken(token, SECRET, NOW + 5);
    expect(verification).toEqual({
      ok: false,
      reason: "TOKEN_SIGNATURE_INVALID",
    });
  });

  it("rejects malformed tokens", () => {
    expect(verifyDecisionToken("not-a-token", SECRET, NOW).ok).toBe(false);
    expect(verifyDecisionToken("mtqdt.v1.only-two-parts", SECRET, NOW).ok).toBe(
      false,
    );
  });

  it("detects every binding mismatch", () => {
    const claims = claimsFixture();
    const context = {
      decisionId: "dec-1",
      requestId: "req-1",
      policyId: "policy-umar-v1",
      policyVersion: 1,
      voiceId: "voice-umar-demo",
      organizationId: "org-kanban",
      scriptHash: hashScript("hello world script"),
      provider: "mock",
      model: "mithaq-demo-voice-1",
    };
    expect(findBindingMismatch(claims, context)).toBeNull();
    expect(
      findBindingMismatch(claims, { ...context, decisionId: "dec-2" }),
    ).toBe("TOKEN_DECISION_MISMATCH");
    expect(
      findBindingMismatch(claims, { ...context, requestId: "req-2" }),
    ).toBe("TOKEN_REQUEST_MISMATCH");
    expect(
      findBindingMismatch(claims, { ...context, policyId: "policy-other" }),
    ).toBe("TOKEN_POLICY_MISMATCH");
    expect(findBindingMismatch(claims, { ...context, policyVersion: 2 })).toBe(
      "TOKEN_POLICY_VERSION_MISMATCH",
    );
    expect(
      findBindingMismatch(claims, {
        ...context,
        scriptHash: hashScript("a different script"),
      }),
    ).toBe("TOKEN_SCRIPT_HASH_MISMATCH");
    expect(
      findBindingMismatch(claims, { ...context, organizationId: "org-else" }),
    ).toBe("TOKEN_ORGANIZATION_MISMATCH");
    expect(
      findBindingMismatch(claims, { ...context, voiceId: "voice-else" }),
    ).toBe("TOKEN_VOICE_MISMATCH");
    expect(
      findBindingMismatch(claims, { ...context, provider: "elevenlabs" }),
    ).toBe("TOKEN_PROVIDER_MISMATCH");
    expect(
      findBindingMismatch(claims, { ...context, model: "different-model" }),
    ).toBe("TOKEN_MODEL_MISMATCH");
  });

  it("redacts tokens for display", () => {
    const token = mintDecisionToken(claimsFixture(), SECRET);
    const redacted = redactToken(token);
    expect(redacted.length).toBeLessThan(30);
    expect(token).toContain(redacted.slice(0, 10));
    expect(redacted).not.toBe(token);
  });
});
