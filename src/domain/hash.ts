import { createHash, randomBytes } from "node:crypto";
import { normalizeScript } from "./normalize";

/** SHA-256 hex digest of a UTF-8 string or raw bytes. */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** SHA-256 of the normalized script text. This is the hash bound into tokens. */
export function hashScript(script: string): string {
  return sha256Hex(normalizeScript(script));
}

/** Opaque, URL-safe identifier (default 16 bytes → 22 chars base64url). */
export function opaqueId(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
