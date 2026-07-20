/**
 * MITHAQ deterministic policy engine.
 *
 * This module makes every authorization decision. It is a pure function:
 *  - no LLM, no network, no database, no filesystem, no clock reads;
 *  - the same (policy, request, evaluatedAt) always yields the same decision;
 *  - deny-by-default: a request is approved only when every clause passes;
 *  - explicit prohibitions override general permissions;
 *  - the script text can never influence authorization — it is never parsed
 *    here, only its presence is checked. Instructions embedded in a script
 *    ("ignore all previous rules…") are inert data.
 *
 * Owner-approved amendment grants are the single sanctioned exception path:
 * a grant is an explicit, narrowly scoped permission (one campaign, one
 * platform, its own asset budget, its own expiry) that can satisfy the paid
 * placement rule. Grants never widen topics, purposes, languages, territories
 * or organizations.
 */
import type {
  ClauseResult,
  ConsentPolicy,
  GenerationRequest,
  PolicyDecision,
  PolicyGrant,
} from "./types";
import {
  normalizeCampaignName,
  normalizeTerritory,
  normalizeTopicTag,
} from "./normalize";

export type PolicyEvaluationInput = {
  policy: ConsentPolicy;
  request: GenerationRequest;
  /** ISO timestamp injected by the caller; the engine never reads a clock. */
  evaluatedAt: string;
};

const REQUIRED_REQUEST_FIELDS = [
  "requesterId",
  "organizationId",
  "voiceId",
  "script",
  "scriptHash",
  "campaignName",
  "purpose",
  "platform",
  "language",
  "placement",
  "territory",
  "publicationDate",
] as const satisfies readonly (keyof GenerationRequest)[];

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyDecision {
  const { policy, request, evaluatedAt } = input;
  const clauses: ClauseResult[] = [];
  const now = Date.parse(evaluatedAt);

  // ── 1. Request completeness ────────────────────────────────────────────
  const missing = REQUIRED_REQUEST_FIELDS.filter((field) => {
    const value = request[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
  clauses.push(
    missing.length === 0
      ? {
          clause: "Request completeness",
          status: "passed",
          code: "MISSING_REQUIRED_FIELD",
          explanation: "All required request fields are present.",
        }
      : {
          clause: "Request completeness",
          status: "failed",
          code: "MISSING_REQUIRED_FIELD",
          expected: "all required fields present",
          received: `missing: ${missing.join(", ")}`,
          explanation: `The request is missing required information: ${missing.join(", ")}.`,
          suggestedRemedy:
            "Complete the missing fields and resubmit the request.",
        },
  );

  // ── 2. Voice identity ──────────────────────────────────────────────────
  clauses.push(
    request.voiceId === policy.voiceId
      ? {
          clause: "Voice identity",
          status: "passed",
          code: "VOICE_MISMATCH",
          explanation:
            "The requested voice is the voice covered by this policy.",
        }
      : {
          clause: "Voice identity",
          status: "failed",
          code: "VOICE_MISMATCH",
          expected: policy.voiceId,
          received: request.voiceId,
          explanation:
            "The requested voice is not the voice covered by this consent policy.",
          suggestedRemedy:
            "Select the voice this policy covers, or locate the policy for the requested voice.",
        },
  );

  // ── 3. Policy status & validity window ─────────────────────────────────
  clauses.push(evaluatePolicyStatus(policy, now));

  // ── 4. Authorized organization ─────────────────────────────────────────
  clauses.push(
    policy.authorizedOrganizationIds.includes(request.organizationId)
      ? {
          clause: "Authorized organization",
          status: "passed",
          code: "ORGANIZATION_NOT_AUTHORIZED",
          explanation:
            "The requesting organization is authorized by the owner.",
        }
      : {
          clause: "Authorized organization",
          status: "failed",
          code: "ORGANIZATION_NOT_AUTHORIZED",
          expected: policy.authorizedOrganizationIds,
          received: request.organizationId,
          explanation:
            "The owner has not authorized this organization to use the voice.",
          suggestedRemedy:
            "Ask the voice owner to authorize your organization, or submit under an authorized organization.",
        },
  );

  // ── 5. Campaign purpose ────────────────────────────────────────────────
  clauses.push(
    policy.allowedPurposes.includes(request.purpose)
      ? {
          clause: "Campaign purpose",
          status: "passed",
          code: "PURPOSE_NOT_ALLOWED",
          explanation: `Purpose "${request.purpose}" is within the approved purposes.`,
        }
      : {
          clause: "Campaign purpose",
          status: "failed",
          code: "PURPOSE_NOT_ALLOWED",
          expected: policy.allowedPurposes,
          received: request.purpose,
          explanation: `The owner approved this voice for: ${policy.allowedPurposes.join(", ")} — not "${request.purpose}".`,
          suggestedRemedy:
            "Change the campaign purpose to an approved purpose, or request an amendment.",
        },
  );

  // ── 6. Platform ────────────────────────────────────────────────────────
  clauses.push(
    policy.allowedPlatforms.includes(request.platform)
      ? {
          clause: "Platform",
          status: "passed",
          code: "PLATFORM_NOT_ALLOWED",
          explanation: `Platform "${request.platform}" is within the approved platforms.`,
        }
      : {
          clause: "Platform",
          status: "failed",
          code: "PLATFORM_NOT_ALLOWED",
          expected: policy.allowedPlatforms,
          received: request.platform,
          explanation: `The owner approved publication on: ${policy.allowedPlatforms.join(", ")} — not "${request.platform}".`,
          suggestedRemedy:
            "Target an approved platform, or request an amendment for this platform.",
        },
  );

  // ── 7. Language ────────────────────────────────────────────────────────
  clauses.push(
    policy.allowedLanguages.includes(request.language)
      ? {
          clause: "Language",
          status: "passed",
          code: "LANGUAGE_NOT_ALLOWED",
          explanation: `Language "${request.language}" is within the approved languages.`,
        }
      : {
          clause: "Language",
          status: "failed",
          code: "LANGUAGE_NOT_ALLOWED",
          expected: policy.allowedLanguages,
          received: request.language,
          explanation: `The owner approved these languages: ${policy.allowedLanguages.join(", ")} — not "${request.language}".`,
          suggestedRemedy:
            "Produce the asset in an approved language, or request an amendment.",
        },
  );

  // ── 8. Territory ───────────────────────────────────────────────────────
  const territory = normalizeTerritory(request.territory);
  const allowedTerritories = policy.allowedTerritories.map(normalizeTerritory);
  clauses.push(
    allowedTerritories.includes(territory)
      ? {
          clause: "Territory",
          status: "passed",
          code: "TERRITORY_NOT_ALLOWED",
          explanation: `Territory "${territory}" is within the approved territories.`,
        }
      : {
          clause: "Territory",
          status: "failed",
          code: "TERRITORY_NOT_ALLOWED",
          expected: allowedTerritories,
          received: territory,
          explanation: `The owner approved distribution in: ${allowedTerritories.join(", ")} — not "${territory}".`,
          suggestedRemedy:
            "Restrict distribution to an approved territory, or request an amendment.",
        },
  );

  // ── 9. Publication window ──────────────────────────────────────────────
  clauses.push(evaluatePublicationWindow(policy, request));

  // ── 10. Placement / paid advertising ───────────────────────────────────
  const grant = findMatchingGrant(policy, request, now);
  clauses.push(evaluatePlacement(policy, request, grant));

  // ── 11. Content topics (explicit prohibitions override permissions) ────
  const prohibited = policy.prohibitedTopics.map(normalizeTopicTag);
  const tagHits = request.topicTags
    .map(normalizeTopicTag)
    .filter((tag) => prohibited.includes(tag));
  clauses.push(
    tagHits.length === 0
      ? {
          clause: "Content topics",
          status: "passed",
          code: "PROHIBITED_TOPIC",
          explanation:
            prohibited.length > 0
              ? `No declared topic touches the prohibited topics (${prohibited.join(", ")}).`
              : "The policy prohibits no topics.",
        }
      : {
          clause: "Content topics",
          status: "failed",
          code: "PROHIBITED_TOPIC",
          expected: `none of: ${prohibited.join(", ")}`,
          received: tagHits,
          explanation: `The owner explicitly prohibited ${tagHits.join(", ")} content. Explicit prohibitions override general permissions.`,
          suggestedRemedy:
            "Remove the prohibited topic from this campaign. Prohibited topics cannot be unlocked by amendment scope in this policy.",
        },
  );

  // ── 12. Usage allowance ────────────────────────────────────────────────
  clauses.push(evaluateUsage(policy, request, grant));

  const outcome = clauses.every((clause) => clause.status === "passed")
    ? "approved"
    : "blocked";

  return {
    outcome,
    policyId: policy.id,
    policyVersion: policy.version,
    requestId: request.id,
    evaluatedAt,
    clauses,
    matchedGrantId: grant?.id ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────

function evaluatePolicyStatus(
  policy: ConsentPolicy,
  now: number,
): ClauseResult {
  const clause = "Policy status";
  if (policy.status === "draft") {
    return {
      clause,
      status: "failed",
      code: "POLICY_NOT_ACTIVE",
      expected: "active",
      received: policy.status,
      explanation:
        "The consent policy is still a draft. The owner has not approved it.",
      suggestedRemedy:
        "Ask the voice owner to review and approve the policy in the Consent Studio.",
    };
  }
  if (policy.status === "superseded") {
    return {
      clause,
      status: "failed",
      code: "POLICY_SUPERSEDED",
      expected: "active",
      received: policy.status,
      explanation:
        "A newer policy version replaced this one. New requests must evaluate against the active version.",
      suggestedRemedy:
        "Resubmit the request against the current active policy version.",
    };
  }
  if (policy.status === "revoked") {
    return {
      clause,
      status: "failed",
      code: "POLICY_REVOKED",
      expected: "active",
      received: policy.status,
      explanation: policy.revokedAt
        ? `The owner revoked this consent policy on ${formatInstant(policy.revokedAt)}. Revocation applies to all future requests immediately.`
        : "The owner revoked this consent policy. Revocation applies to all future requests immediately.",
      suggestedRemedy:
        "Only the voice owner can grant new consent by issuing a new policy.",
    };
  }
  if (policy.status === "expired" || Date.parse(policy.validUntil) < now) {
    return {
      clause,
      status: "failed",
      code: "POLICY_EXPIRED",
      expected: `valid until ${formatInstant(policy.validUntil)}`,
      received: "evaluation after expiry",
      explanation: `The consent policy expired on ${formatInstant(policy.validUntil)}.`,
      suggestedRemedy: "Ask the voice owner to issue a renewed policy.",
    };
  }
  if (Date.parse(policy.validFrom) > now) {
    return {
      clause,
      status: "failed",
      code: "POLICY_NOT_YET_ACTIVE",
      expected: `valid from ${formatInstant(policy.validFrom)}`,
      received: "evaluation before the validity window",
      explanation: `The consent policy only takes effect on ${formatInstant(policy.validFrom)}.`,
      suggestedRemedy:
        "Wait for the validity window, or ask the owner to adjust it.",
    };
  }
  return {
    clause,
    status: "passed",
    code: "POLICY_NOT_ACTIVE",
    explanation: `Policy version ${policy.version} is active and within its validity window.`,
  };
}

function evaluatePublicationWindow(
  policy: ConsentPolicy,
  request: GenerationRequest,
): ClauseResult {
  const clause = "Publication window";
  const publication = Date.parse(request.publicationDate);
  if (Number.isNaN(publication)) {
    return {
      clause,
      status: "failed",
      code: "PUBLICATION_DATE_OUTSIDE_VALIDITY",
      expected: "a valid publication date",
      received: request.publicationDate,
      explanation: "The intended publication date could not be interpreted.",
      suggestedRemedy: "Provide a valid intended publication date.",
    };
  }
  const from = Date.parse(policy.validFrom);
  const until = Date.parse(policy.validUntil);
  if (publication < from || publication > until) {
    return {
      clause,
      status: "failed",
      code: "PUBLICATION_DATE_OUTSIDE_VALIDITY",
      expected: `between ${formatInstant(policy.validFrom)} and ${formatInstant(policy.validUntil)}`,
      received: formatInstant(request.publicationDate),
      explanation: `The intended publication date falls outside the consent window (${formatInstant(policy.validFrom)} → ${formatInstant(policy.validUntil)}).`,
      suggestedRemedy:
        "Schedule publication inside the consent window, or ask the owner to extend it.",
    };
  }
  return {
    clause,
    status: "passed",
    code: "PUBLICATION_DATE_OUTSIDE_VALIDITY",
    explanation:
      "The intended publication date falls inside the consent window.",
  };
}

/**
 * A grant matches only when every scoped dimension matches exactly:
 * paid placement, platform, campaign name (normalized) and the grant's own
 * validity window covering both evaluation time and publication date.
 * Usage headroom is deliberately NOT part of matching — an exhausted grant
 * still "matches" so the usage clause can report USAGE_LIMIT_REACHED
 * precisely rather than mislabeling it as a placement failure.
 */
function findMatchingGrant(
  policy: ConsentPolicy,
  request: GenerationRequest,
  now: number,
): PolicyGrant | null {
  if (request.placement !== "paid") return null;
  return (
    policy.grants.find(
      (grant) =>
        grant.placement === "paid" &&
        grant.platform === request.platform &&
        normalizeCampaignName(grant.campaignName) ===
          normalizeCampaignName(request.campaignName) &&
        now <= Date.parse(grant.validUntil) &&
        Date.parse(request.publicationDate) <= Date.parse(grant.validUntil),
    ) ?? null
  );
}

function evaluatePlacement(
  policy: ConsentPolicy,
  request: GenerationRequest,
  grant: PolicyGrant | null,
): ClauseResult {
  const clause = "Placement";
  if (request.placement === "organic") {
    return {
      clause,
      status: "passed",
      code: "PAID_ADVERTISING_PROHIBITED",
      explanation: "Organic placement — within the owner's placement terms.",
    };
  }
  if (policy.paidAdvertising === "allowed") {
    return {
      clause,
      status: "passed",
      code: "PAID_ADVERTISING_PROHIBITED",
      explanation: "Paid placement is generally permitted by this policy.",
    };
  }
  if (grant) {
    return {
      clause,
      status: "passed",
      code: "PAID_ADVERTISING_PROHIBITED",
      explanation: `Paid placement permitted by owner-approved amendment grant: ${grant.label} (until ${formatInstant(grant.validUntil)}).`,
    };
  }
  return {
    clause,
    status: "failed",
    code: "PAID_ADVERTISING_PROHIBITED",
    expected: "organic placement",
    received: "paid placement",
    explanation:
      "The owner prohibited paid advertising with this voice. Explicit prohibitions override general permissions.",
    suggestedRemedy:
      "This request can proceed as an organic post, or you can request a narrowly scoped amendment for this campaign and platform.",
  };
}

function evaluateUsage(
  policy: ConsentPolicy,
  request: GenerationRequest,
  grant: PolicyGrant | null,
): ClauseResult {
  const clause = "Usage allowance";
  // The applicable budget pool: a matched grant carries its own allowance;
  // everything else draws from the base policy allowance.
  if (request.placement === "paid" && grant) {
    return grant.assetsUsed < grant.maximumAssets
      ? {
          clause,
          status: "passed",
          code: "USAGE_LIMIT_REACHED",
          explanation: `Amendment grant allowance available: ${grant.assetsUsed} of ${grant.maximumAssets} used.`,
        }
      : {
          clause,
          status: "failed",
          code: "USAGE_LIMIT_REACHED",
          expected: `fewer than ${grant.maximumAssets} grant assets used`,
          received: `${grant.assetsUsed} used`,
          explanation: `The amendment grant's allowance is exhausted (${grant.assetsUsed} of ${grant.maximumAssets} used).`,
          suggestedRemedy:
            "Request a further amendment if additional assets are genuinely needed.",
        };
  }
  return policy.assetsUsed < policy.maximumAssets
    ? {
        clause,
        status: "passed",
        code: "USAGE_LIMIT_REACHED",
        explanation: `Usage allowance available: ${policy.assetsUsed} of ${policy.maximumAssets} authorized assets used.`,
      }
    : {
        clause,
        status: "failed",
        code: "USAGE_LIMIT_REACHED",
        expected: `fewer than ${policy.maximumAssets} assets used`,
        received: `${policy.assetsUsed} used`,
        explanation: `The authorized allowance is exhausted (${policy.assetsUsed} of ${policy.maximumAssets} assets used).`,
        suggestedRemedy: "Request an amendment authorizing additional assets.",
      };
}

/** Deterministic, timezone-stable instant formatting (UTC date). */
function formatInstant(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toISOString().slice(0, 10);
}
