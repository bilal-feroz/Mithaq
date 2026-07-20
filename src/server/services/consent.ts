/**
 * Consent Studio service: dynamic consent challenge, term extraction and
 * owner approval of the structured policy.
 */
import { randomInt } from "node:crypto";
import { z } from "zod";
import { opaqueId } from "@/domain/hash";
import {
  languageSchema,
  platformSchema,
  purposeSchema,
  territorySchema,
  topicTagSchema,
  type ExtractionResult,
} from "@/domain/schemas";
import type { ConsentPolicy, Language } from "@/domain/types";
import { getStore } from "@/server/data";
import { getExtractionAdapter } from "@/server/providers/extraction";

/**
 * Dynamic consent challenge — a server-generated random phrase the owner
 * speaks (or types). It ties this consent capture to this moment; it is NOT
 * biometric verification and is never described as such.
 */
const CHALLENGE_WORDS = [
  "obsidian",
  "harbor",
  "lantern",
  "meridian",
  "juniper",
  "silver",
  "archive",
  "falcon",
  "compass",
  "aurora",
  "granite",
  "sable",
  "monsoon",
  "cedar",
  "beacon",
  "quartz",
  "mirage",
  "atlas",
] as const;

export type ConsentChallenge = {
  phrase: string;
  issuedAt: string;
  nonce: string;
};

export function buildConsentChallenge(): ConsentChallenge {
  const words: string[] = [];
  while (words.length < 4) {
    const word = CHALLENGE_WORDS[randomInt(CHALLENGE_WORDS.length)]!;
    if (!words.includes(word)) words.push(word);
  }
  const number = randomInt(10, 99);
  return {
    phrase: `${words[0]} ${words[1]} ${number} ${words[2]} ${words[3]}`,
    issuedAt: new Date().toISOString(),
    nonce: opaqueId(6),
  };
}

export async function extractConsentTerms(input: {
  consentText: string;
  language: Language;
  voiceId: string;
  actorProfileId: string;
}): Promise<{ result: ExtractionResult; adapterName: string }> {
  const adapter = getExtractionAdapter();
  const result = await adapter.extract({
    consentText: input.consentText,
    language: input.language,
  });

  const store = getStore();
  await store.appendAuditEvent({
    aggregateType: "voice_profile",
    aggregateId: input.voiceId,
    eventType: "consent.extracted",
    actorId: input.actorProfileId,
    payload: {
      voiceId: input.voiceId,
      adapter: adapter.name,
      language: input.language,
      missingFields: result.missingFields,
      ambiguousFields: result.ambiguousFields.map((f) => f.field),
    },
    createdAt: new Date().toISOString(),
  });

  return { result, adapterName: adapter.name };
}

export const policyApprovalSchema = z.object({
  voiceId: z.string().min(1),
  authorizedOrganizationIds: z.array(z.string().min(1)).min(1).max(20),
  allowedPurposes: z.array(purposeSchema).min(1),
  allowedPlatforms: z.array(platformSchema).min(1),
  allowedLanguages: z.array(languageSchema).min(1),
  allowedTerritories: z.array(territorySchema).min(1),
  paidAdvertising: z.enum(["allowed", "prohibited"]),
  editingAllowed: z.boolean(),
  maximumAssets: z.number().int().min(1).max(100),
  validUntil: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  prohibitedTopics: z.array(topicTagSchema).max(50),
  sourceConsentText: z.string().min(10).max(8000),
  sourceConsentLanguage: languageSchema,
});

export type PolicyApprovalInput = z.infer<typeof policyApprovalSchema>;

/**
 * Owner approval issues a policy version. If an active version exists it is
 * superseded (never mutated); otherwise a fresh version starts the chain.
 */
export async function approveConsentPolicy(
  rawInput: PolicyApprovalInput,
  actor: { profileId: string },
): Promise<ConsentPolicy> {
  const input = policyApprovalSchema.parse(rawInput);
  const store = getStore();

  const voice = await store.getVoice(input.voiceId);
  if (!voice || voice.ownerId !== actor.profileId) {
    throw new Error(
      "Only the voice owner can approve a consent policy for this voice.",
    );
  }

  const latest = await store.getLatestPolicyForVoice(input.voiceId);
  const now = new Date().toISOString();
  const version = latest ? latest.version + 1 : 1;
  const baseId = latest
    ? latest.id.replace(/-v\d+$/, "")
    : `policy-${opaqueId(5)}`;

  const policy: ConsentPolicy = {
    id: `${baseId}-v${version}`,
    version,
    ownerId: actor.profileId,
    voiceId: input.voiceId,
    status: "active",
    authorizedOrganizationIds: input.authorizedOrganizationIds,
    allowedPurposes: input.allowedPurposes,
    allowedPlatforms: input.allowedPlatforms,
    allowedLanguages: input.allowedLanguages,
    allowedTerritories: input.allowedTerritories,
    paidAdvertising: input.paidAdvertising,
    editingAllowed: input.editingAllowed,
    maximumAssets: input.maximumAssets,
    assetsUsed: 0,
    validFrom: now,
    validUntil: input.validUntil,
    prohibitedTopics: input.prohibitedTopics,
    grants: [],
    sourceConsentText: input.sourceConsentText,
    sourceConsentLanguage: input.sourceConsentLanguage,
    ownerApprovedAt: now,
    supersedesPolicyId: latest?.id ?? null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (latest && latest.status === "active") {
    await store.createPolicyVersion(policy, latest.id, now);
  } else {
    await store.insertPolicy(policy);
  }

  await store.appendAuditEvent({
    aggregateType: "consent_policy",
    aggregateId: policy.id,
    eventType: "policy.created",
    actorId: actor.profileId,
    payload: {
      policyId: policy.id,
      version,
      voiceId: policy.voiceId,
      source: "consent_studio",
    },
    createdAt: now,
  });
  await store.appendAuditEvent({
    aggregateType: "consent_policy",
    aggregateId: policy.id,
    eventType: "policy.activated",
    actorId: actor.profileId,
    payload: {
      policyId: policy.id,
      version,
      ownerApprovedAt: now,
      terms: {
        authorizedOrganizationIds: policy.authorizedOrganizationIds,
        purposes: policy.allowedPurposes,
        platforms: policy.allowedPlatforms,
        languages: policy.allowedLanguages,
        territories: policy.allowedTerritories,
        paidAdvertising: policy.paidAdvertising,
        editingAllowed: policy.editingAllowed,
        maximumAssets: policy.maximumAssets,
        validUntil: policy.validUntil,
        prohibitedTopics: policy.prohibitedTopics,
      },
    },
    createdAt: now,
  });

  return policy;
}

export async function revokePolicy(
  policyId: string,
  actor: { profileId: string },
): Promise<ConsentPolicy> {
  const store = getStore();
  const policy = await store.getPolicy(policyId);
  if (!policy) throw new Error("Policy not found.");
  const voice = await store.getVoice(policy.voiceId);
  if (!voice || voice.ownerId !== actor.profileId) {
    throw new Error("Only the voice owner can revoke this policy.");
  }

  if (policy.status === "revoked") return policy;
  const latest = await store.getLatestPolicyForVoice(policy.voiceId);
  if (policy.status !== "active" || latest?.id !== policy.id) {
    throw new Error("Only the current active policy can be revoked.");
  }

  const now = new Date().toISOString();
  const revoked = await store.revokePolicy(policyId, now);
  await store.appendAuditEvent({
    aggregateType: "consent_policy",
    aggregateId: policyId,
    eventType: "policy.revoked",
    actorId: actor.profileId,
    payload: { policyId, version: policy.version, revokedAt: now },
    createdAt: now,
  });
  return revoked;
}
