/**
 * Deterministic fallback extractor — used when no AI key is configured.
 *
 * A transparent rule-based parser tuned for the seeded demo statement and
 * similar plain-English grants. It follows the same contract as the LLM
 * adapters: it never invents permission, and everything it cannot establish
 * is reported as missing or ambiguous for the owner to resolve.
 */
import { extractionResultSchema, type ExtractionResult } from "@/domain/schemas";
import type { Language, Platform, Purpose } from "@/domain/types";
import type { ConsentExtractionAdapter } from "./types";

export class MockExtractionAdapter implements ConsentExtractionAdapter {
  name = "mock";

  async extract(input: {
    consentText: string;
    language: Language;
  }): Promise<ExtractionResult> {
    const text = input.consentText.toLowerCase();

    const organizations: string[] = [];
    if (/kanban\s+studios/.test(text)) organizations.push("Kanban Studios");
    // Generic pattern: "<Proper Name> may use my ... voice"
    if (organizations.length === 0) {
      const match = input.consentText.match(
        /(?:^|\.\s+)?([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3})\s+may\s+use\s+my/,
      );
      if (match?.[1] && !/^i\b/i.test(match[1])) organizations.push(match[1].trim());
    }

    const purposes: Purpose[] = [];
    if (/promot|promotion|marketing|brand/.test(text)) purposes.push("brand_promotion");
    if (/educat/.test(text)) purposes.push("education");
    if (/internal\s+training/.test(text)) purposes.push("internal_training");
    if (/entertain/.test(text)) purposes.push("entertainment");
    if (/public[-\s]service/.test(text)) purposes.push("public_service");

    const platforms: Platform[] = [];
    if (/instagram/.test(text)) platforms.push("instagram");
    if (/youtube/.test(text)) platforms.push("youtube");
    if (/tiktok/.test(text)) platforms.push("tiktok");
    if (/\btwitter\b|\bx\b(?!\w)/.test(text)) platforms.push("x");
    if (/linkedin/.test(text)) platforms.push("linkedin");
    if (/\bwebsite\b/.test(text)) platforms.push("website");

    const languages: ("ar" | "en" | "ur")[] = [];
    if (/arabic|العربية/.test(text)) languages.push("ar");
    if (/english/.test(text)) languages.push("en");
    if (/urdu/.test(text)) languages.push("ur");

    const territories: string[] = [];
    if (/\buae\b|united arab emirates|emirates/.test(text)) territories.push("AE");
    if (/saudi/.test(text)) territories.push("SA");
    if (/kuwait/.test(text)) territories.push("KW");
    if (/qatar/.test(text)) territories.push("QA");

    let paidAdvertising: "allowed" | "prohibited" | null = null;
    if (
      /unpaid/.test(text) ||
      /paid advertising[^.]*prohibit/.test(text) ||
      /no paid/.test(text)
    ) {
      paidAdvertising = "prohibited";
    } else if (/paid advertising[^.]*(allow|permit)/.test(text)) {
      paidAdvertising = "allowed";
    }

    let maximumAssets: number | null = null;
    if (/\bone\b|\b1\b/.test(text)) maximumAssets = 1;
    else if (/\btwo\b|\b2\b/.test(text)) maximumAssets = 2;
    else if (/\bthree\b|\b3\b/.test(text)) maximumAssets = 3;

    let validUntil: string | null = null;
    const untilMatch = input.consentText.match(
      /until\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/,
    );
    if (untilMatch?.[1]) {
      const parsed = Date.parse(`${untilMatch[1].replace(",", "")} 23:59:59 UTC`);
      if (!Number.isNaN(parsed)) validUntil = new Date(parsed).toISOString();
    }

    const prohibitedTopics: string[] = [];
    if (/politic/.test(text)) prohibitedTopics.push("politics");
    if (/religio/.test(text)) prohibitedTopics.push("religion");
    if (/gambling/.test(text)) prohibitedTopics.push("gambling");

    const missingFields: string[] = [];
    if (organizations.length === 0) missingFields.push("authorizedOrganizations");
    if (purposes.length === 0) missingFields.push("allowedPurposes");
    if (platforms.length === 0) missingFields.push("allowedPlatforms");
    if (languages.length === 0) missingFields.push("allowedLanguages");
    if (territories.length === 0) missingFields.push("allowedTerritories");
    if (validUntil === null) missingFields.push("validUntil");
    if (maximumAssets === null) missingFields.push("maximumAssets");

    const ambiguousFields: { field: string; note: string }[] = [];
    if (paidAdvertising === null) {
      ambiguousFields.push({
        field: "paidAdvertising",
        note: "The statement does not clearly allow or prohibit paid advertising. Deny-by-default applies until the owner decides.",
      });
    }
    ambiguousFields.push({
      field: "editingAllowed",
      note: "The statement does not address whether the audio may be edited (trims, level adjustments). Deny-by-default applies until the owner decides.",
    });

    const clarificationQuestions: string[] = [];
    if (territories.length === 0) {
      clarificationQuestions.push(
        "Which territories may this promotion run in (for example UAE, Saudi Arabia)?",
      );
    }
    clarificationQuestions.push(
      "May the generated audio be lightly edited — trims and level adjustments — before publication?",
    );

    const result: ExtractionResult = {
      draft: {
        authorizedOrganizationNames: organizations,
        allowedPurposes: [...new Set(purposes)],
        allowedPlatforms: [...new Set(platforms)],
        allowedLanguages: [...new Set(languages)],
        allowedTerritories: territories,
        paidAdvertising,
        maximumAssets,
        validUntil,
        prohibitedTopics,
      },
      missingFields,
      ambiguousFields,
      confidenceNotes: [
        "Deterministic demo extractor: terms are matched from explicit wording only.",
        paidAdvertising === "prohibited"
          ? "“Unpaid” / “paid advertising prohibited” wording detected — paid placement marked prohibited."
          : "No explicit paid-advertising wording detected.",
      ],
      clarificationQuestions,
    };

    return extractionResultSchema.parse(result);
  }
}
