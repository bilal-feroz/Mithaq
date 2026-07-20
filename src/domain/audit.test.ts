import { describe, expect, it } from "vitest";
import { canonicalJson } from "./canonical-json";
import {
  computeEventHash,
  computePayloadHash,
  verifyAuditChain,
} from "./audit";
import type { AuditEvent } from "./types";

describe("canonicalJson", () => {
  it("is independent of key insertion order at every depth", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } })).toBe(
      canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 }),
    );
  });

  it("preserves array order", () => {
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it("omits undefined object values", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

function buildChain(payloads: unknown[]): AuditEvent[] {
  const events: AuditEvent[] = [];
  let previous: string | null = null;
  payloads.forEach((payload, index) => {
    const currentEventHash = computeEventHash(payload, previous);
    events.push({
      id: `event-${index}`,
      aggregateType: "consent_policy",
      aggregateId: "policy-1",
      eventType: "test.event",
      actorId: null,
      payload,
      payloadHash: computePayloadHash(payload),
      previousEventHash: previous,
      currentEventHash,
      createdAt: "2026-07-20T12:00:00.000Z",
    });
    previous = currentEventHash;
  });
  return events;
}

describe("audit chain", () => {
  it("verifies an intact chain", () => {
    const chain = buildChain([{ n: 1 }, { n: 2 }, { n: 3 }]);
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(true);
    expect(result.checkedEvents).toBe(3);
  });

  it("detects a tampered payload anywhere in history", () => {
    const chain = buildChain([{ n: 1 }, { n: 2 }, { n: 3 }]);
    chain[1]!.payload = { n: 99 };
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.firstBrokenAt?.index).toBe(1);
  });

  it("detects a re-linked (spliced) chain", () => {
    const chain = buildChain([{ n: 1 }, { n: 2 }, { n: 3 }]);
    chain[2]!.previousEventHash = chain[0]!.currentEventHash;
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
    expect(result.firstBrokenAt?.index).toBe(2);
  });

  it("detects a recomputed-but-inconsistent event hash", () => {
    const chain = buildChain([{ n: 1 }, { n: 2 }]);
    chain[1]!.currentEventHash = "0".repeat(64);
    const result = verifyAuditChain(chain);
    expect(result.valid).toBe(false);
  });

  it("an empty chain is trivially valid", () => {
    expect(verifyAuditChain([]).valid).toBe(true);
  });
});
