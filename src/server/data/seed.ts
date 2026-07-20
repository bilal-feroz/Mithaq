/**
 * Demo seed — built from the canonical fixtures so the seeded world is
 * exactly the world the unit tests prove correct.
 */
import type {
  AmendmentRequest,
  AuditEvent,
  ConsentPolicy,
  DecisionTokenRecord,
  GeneratedAsset,
  GenerationRequest,
  Organization,
  Profile,
  StoredDecision,
  VoiceProfile,
} from "@/domain/types";
import { computeEventHash, computePayloadHash } from "@/domain/audit";
import {
  buildDemoPolicyV1,
  DEMO_ORGANIZATION,
  DEMO_OWNER,
  DEMO_REQUESTER,
  DEMO_VOICE,
} from "@/domain/fixtures";

export type SeedState = {
  profiles: Profile[];
  organizations: Organization[];
  organizationMembers: { organizationId: string; profileId: string }[];
  voiceProfiles: VoiceProfile[];
  consentPolicies: ConsentPolicy[];
  generationRequests: GenerationRequest[];
  policyDecisions: StoredDecision[];
  decisionTokens: DecisionTokenRecord[];
  amendmentRequests: AmendmentRequest[];
  generatedAssets: GeneratedAsset[];
  auditEvents: AuditEvent[];
};

export function buildSeedState(): SeedState {
  const policyV1 = buildDemoPolicyV1();

  const auditEvents: AuditEvent[] = [];
  const appendSeedEvent = (
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    actorId: string | null,
    payload: unknown,
    createdAt: string,
  ) => {
    const previousEventHash = auditEvents.at(-1)?.currentEventHash ?? null;
    auditEvents.push({
      id: `audit-seed-${auditEvents.length + 1}`,
      aggregateType,
      aggregateId,
      eventType,
      actorId,
      payload,
      payloadHash: computePayloadHash(payload),
      previousEventHash,
      currentEventHash: computeEventHash(payload, previousEventHash),
      createdAt,
    });
  };

  appendSeedEvent(
    "voice_profile",
    DEMO_VOICE.id,
    "voice.registered",
    DEMO_OWNER.id,
    { voiceId: DEMO_VOICE.id, displayName: DEMO_VOICE.displayName },
    DEMO_VOICE.createdAt,
  );
  appendSeedEvent(
    "consent_policy",
    policyV1.id,
    "policy.created",
    DEMO_OWNER.id,
    {
      policyId: policyV1.id,
      version: 1,
      voiceId: policyV1.voiceId,
      source: "consent_studio",
      consentLanguage: policyV1.sourceConsentLanguage,
    },
    policyV1.createdAt,
  );
  appendSeedEvent(
    "consent_policy",
    policyV1.id,
    "policy.activated",
    DEMO_OWNER.id,
    {
      policyId: policyV1.id,
      version: 1,
      ownerApprovedAt: policyV1.ownerApprovedAt,
      terms: {
        authorizedOrganizations: ["Kanban Studios"],
        purposes: policyV1.allowedPurposes,
        platforms: policyV1.allowedPlatforms,
        languages: policyV1.allowedLanguages,
        territories: policyV1.allowedTerritories,
        paidAdvertising: policyV1.paidAdvertising,
        maximumAssets: policyV1.maximumAssets,
        validUntil: policyV1.validUntil,
        prohibitedTopics: policyV1.prohibitedTopics,
      },
    },
    policyV1.ownerApprovedAt ?? policyV1.createdAt,
  );

  return {
    profiles: [DEMO_OWNER, DEMO_REQUESTER],
    organizations: [DEMO_ORGANIZATION],
    organizationMembers: [
      { organizationId: DEMO_ORGANIZATION.id, profileId: DEMO_REQUESTER.id },
    ],
    voiceProfiles: [DEMO_VOICE],
    consentPolicies: [policyV1],
    generationRequests: [],
    policyDecisions: [],
    decisionTokens: [],
    amendmentRequests: [],
    generatedAssets: [],
    auditEvents,
  };
}
