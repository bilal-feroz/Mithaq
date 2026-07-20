/**
 * Application-level tamper-evident audit chain.
 *
 * Each event hashes its canonical payload, then chains:
 *   currentEventHash = SHA256(canonicalPayload + previousEventHash)
 *
 * This makes the recorded history tamper-evident WITHIN THE APPLICATION AUDIT
 * MODEL: rewriting any historical payload breaks every subsequent link.
 * It is not "immutable" and we never claim it is — an operator with database
 * access could rebuild the chain; the model exists to make silent, partial
 * edits detectable.
 */
import { canonicalJson } from "./canonical-json";
import { sha256Hex } from "./hash";
import type { AuditEvent } from "./types";

export function computePayloadHash(payload: unknown): string {
  return sha256Hex(canonicalJson(payload));
}

export function computeEventHash(
  payload: unknown,
  previousEventHash: string | null,
): string {
  return sha256Hex(canonicalJson(payload) + (previousEventHash ?? ""));
}

export type AuditChainVerification = {
  valid: boolean;
  checkedEvents: number;
  /** Index (0-based, chain order) and id of the first broken event, if any. */
  firstBrokenAt: { index: number; eventId: string; reason: string } | null;
};

/**
 * Verify an ordered chain of audit events (oldest first).
 * Checks payload hashes, link hashes and previous-hash continuity.
 */
export function verifyAuditChain(events: AuditEvent[]): AuditChainVerification {
  let previousHash: string | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.previousEventHash !== previousHash) {
      return {
        valid: false,
        checkedEvents: index + 1,
        firstBrokenAt: {
          index,
          eventId: event.id,
          reason: "previousEventHash does not match the preceding event",
        },
      };
    }
    if (computePayloadHash(event.payload) !== event.payloadHash) {
      return {
        valid: false,
        checkedEvents: index + 1,
        firstBrokenAt: {
          index,
          eventId: event.id,
          reason: "payloadHash does not match the recorded payload",
        },
      };
    }
    if (
      computeEventHash(event.payload, previousHash) !== event.currentEventHash
    ) {
      return {
        valid: false,
        checkedEvents: index + 1,
        firstBrokenAt: {
          index,
          eventId: event.id,
          reason: "currentEventHash does not match payload + previous hash",
        },
      };
    }
    previousHash = event.currentEventHash;
  }
  return { valid: true, checkedEvents: events.length, firstBrokenAt: null };
}
