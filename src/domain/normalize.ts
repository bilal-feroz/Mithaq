/**
 * Deterministic normalization helpers.
 *
 * Script normalization contract (documented + tested):
 *  1. Unicode NFC normalization — canonically equivalent sequences hash equally.
 *  2. Newlines unified to "\n" (CRLF and lone CR become LF).
 *  3. Trailing whitespace stripped from each line (spaces, tabs, no-break
 *     spaces — invisible bytes must not change the script hash).
 *  4. Leading/trailing blank space of the whole script trimmed.
 *
 * Interior spacing and casing are preserved: they are part of the spoken text.
 * Normalization exists so that byte-level noise cannot mint a "different"
 * script; it must never alter what would be spoken.
 */
export function normalizeScript(script: string): string {
  return script
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+$/g, ""))
    .join("\n")
    .trim();
}

/** Territory codes compare as trimmed uppercase, e.g. " ae " → "AE". */
export function normalizeTerritory(territory: string): string {
  return territory.trim().toUpperCase();
}

/** Topic tags compare as trimmed, whitespace-collapsed lowercase slugs. */
export function normalizeTopicTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Campaign names compare case-insensitively with collapsed whitespace. */
export function normalizeCampaignName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
