import type { ExtractionResult } from "@/domain/schemas";
import type { Language } from "@/domain/types";

/**
 * Provider-independent consent-term extraction.
 *
 * An adapter (LLM or deterministic) reads a natural-language consent
 * statement and returns a STRUCTURED DRAFT plus everything it could not
 * establish: missing fields, ambiguities, confidence notes and targeted
 * clarification questions.
 *
 * Contract: an adapter must never invent permission. Anything not clearly
 * stated stays absent and is surfaced for owner review. The draft has no
 * authority — the deterministic policy engine only ever sees terms the owner
 * explicitly reviewed and approved.
 */
export interface ConsentExtractionAdapter {
  name: string;
  extract(input: {
    consentText: string;
    language: Language;
  }): Promise<ExtractionResult>;
}
