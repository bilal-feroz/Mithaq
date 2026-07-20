/**
 * Runtime validation schemas. Every boundary (form input, server action,
 * LLM extraction output, provider response) validates against these before
 * the data touches the deterministic engine or the store.
 */
import { z } from "zod";
import {
  LANGUAGES,
  PLACEMENTS,
  PLATFORMS,
  POLICY_STATUSES,
  PURPOSES,
  REQUEST_STATUSES,
} from "./types";

const isoInstant = z
  .string()
  .min(4)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Must be a parseable ISO date/time",
  });

export const platformSchema = z.enum(PLATFORMS);
export const languageSchema = z.enum(LANGUAGES);
export const placementSchema = z.enum(PLACEMENTS);
export const purposeSchema = z.enum(PURPOSES);
export const policyStatusSchema = z.enum(POLICY_STATUSES);
export const requestStatusSchema = z.enum(REQUEST_STATUSES);

export const territorySchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .transform((value) => value.toUpperCase());

export const topicTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .transform((value) => value.toLowerCase().replace(/\s+/g, " "));

export const policyGrantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  campaignName: z.string().min(1).max(120),
  platform: platformSchema,
  placement: z.literal("paid"),
  maximumAssets: z.number().int().min(1).max(10),
  assetsUsed: z.number().int().min(0),
  validUntil: isoInstant,
  sourceAmendmentId: z.string().min(1),
});

export const consentPolicySchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(1),
  ownerId: z.string().min(1),
  voiceId: z.string().min(1),
  status: policyStatusSchema,
  authorizedOrganizationIds: z.array(z.string().min(1)).max(20),
  allowedPurposes: z.array(purposeSchema).max(PURPOSES.length),
  allowedPlatforms: z.array(platformSchema).max(PLATFORMS.length),
  allowedLanguages: z.array(languageSchema).max(LANGUAGES.length),
  allowedTerritories: z.array(territorySchema).max(50),
  paidAdvertising: z.enum(["allowed", "prohibited"]),
  editingAllowed: z.boolean(),
  maximumAssets: z.number().int().min(0).max(1000),
  assetsUsed: z.number().int().min(0),
  validFrom: isoInstant,
  validUntil: isoInstant,
  prohibitedTopics: z.array(topicTagSchema).max(50),
  grants: z.array(policyGrantSchema).max(20),
  sourceConsentText: z.string().max(8000),
  sourceConsentLanguage: languageSchema,
  ownerApprovedAt: isoInstant.nullable(),
  supersedesPolicyId: z.string().nullable(),
  revokedAt: isoInstant.nullable(),
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

export type ConsentPolicyParsed = z.infer<typeof consentPolicySchema>;

/** Script bounds: enough for a short spot, small enough to stay honest. */
export const scriptSchema = z.string().trim().min(10).max(2000);

/** What a requester actually submits from the Generation Gate form. */
export const generationRequestInputSchema = z.object({
  voiceId: z.string().min(1),
  script: scriptSchema,
  campaignName: z.string().trim().min(2).max(120),
  purpose: purposeSchema,
  platform: platformSchema,
  language: languageSchema,
  placement: placementSchema,
  territory: territorySchema,
  publicationDate: isoInstant,
  topicTags: z.array(topicTagSchema).max(10),
});

export type GenerationRequestInput = z.infer<typeof generationRequestInputSchema>;

export const generationRequestSchema = generationRequestInputSchema.extend({
  id: z.string().min(1),
  requesterId: z.string().min(1),
  organizationId: z.string().min(1),
  scriptHash: z.string().regex(/^[0-9a-f]{64}$/),
  status: requestStatusSchema,
  createdAt: isoInstant,
  updatedAt: isoInstant,
});

export const amendmentProposalSchema = z.object({
  kind: z.literal("scoped_paid_placement"),
  campaignName: z.string().trim().min(2).max(120),
  platform: platformSchema,
  placement: z.literal("paid"),
  additionalAssets: z.number().int().min(1).max(3),
  validUntil: isoInstant,
  rationale: z.string().trim().min(10).max(1200),
});

/**
 * The structured draft an extraction adapter must return. The adapter may be
 * an LLM or the deterministic fallback — either way the output is validated
 * here and NEVER trusted to invent permission: anything absent stays absent
 * and is surfaced to the owner as missing/ambiguous.
 */
export const extractionResultSchema = z.object({
  draft: z.object({
    authorizedOrganizationNames: z.array(z.string().trim().min(1)).max(10),
    allowedPurposes: z.array(purposeSchema).max(PURPOSES.length),
    allowedPlatforms: z.array(platformSchema).max(PLATFORMS.length),
    allowedLanguages: z.array(languageSchema).max(LANGUAGES.length),
    allowedTerritories: z.array(territorySchema).max(50),
    paidAdvertising: z.enum(["allowed", "prohibited"]).nullable(),
    maximumAssets: z.number().int().min(1).max(1000).nullable(),
    validUntil: isoInstant.nullable(),
    prohibitedTopics: z.array(topicTagSchema).max(50),
  }),
  missingFields: z.array(z.string()).max(30),
  ambiguousFields: z
    .array(
      z.object({
        field: z.string(),
        note: z.string().max(500),
      }),
    )
    .max(30),
  confidenceNotes: z.array(z.string().max(500)).max(30),
  clarificationQuestions: z.array(z.string().max(300)).max(10),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

export const decisionTokenClaimsSchema = z.object({
  jti: z.string().min(8),
  decisionId: z.string().min(1),
  requestId: z.string().min(1),
  policyId: z.string().min(1),
  policyVersion: z.number().int().min(1),
  voiceId: z.string().min(1),
  organizationId: z.string().min(1),
  scriptHash: z.string().regex(/^[0-9a-f]{64}$/),
  provider: z.string().min(1),
  model: z.string().min(1),
  issuedAt: z.number().int(),
  expiresAt: z.number().int(),
  maximumUses: z.literal(1),
});
