"use server";

/**
 * Server actions — the ONLY mutation surface reachable from the browser.
 * Every action re-authorizes against the server-side session; nothing here
 * trusts client-supplied identity. Next.js server actions are POST-only with
 * origin checks (CSRF-safe by construction).
 */
import { revalidatePath } from "next/cache";
import type { GenerationRequestInput } from "@/domain/schemas";
import { getEnv } from "@/server/env";
import { getStore } from "@/server/data";
import {
  getSession,
  requireOwnerSession,
  requireRequesterSession,
  setSessionRole,
  type SessionRole,
} from "@/server/session";
import {
  reevaluateRequest,
  submitGenerationRequest,
} from "@/server/services/evaluation";
import {
  decideAmendment,
  draftAmendmentForRequest,
} from "@/server/services/amendment";
import {
  GenerationDeniedError,
  generateAssetForRequest,
} from "@/server/services/generation";
import {
  approveConsentPolicy,
  buildConsentChallenge,
  extractConsentTerms,
  revokePolicy,
  type PolicyApprovalInput,
} from "@/server/services/consent";
import type { ExtractionResult } from "@/domain/schemas";
import type { Language } from "@/domain/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

function fail<T>(error: unknown): ActionResult<T> {
  if (error instanceof GenerationDeniedError) {
    return { ok: false, error: error.message, code: error.code };
  }
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Something went wrong.",
  };
}

export async function switchRoleAction(role: SessionRole): Promise<ActionResult<null>> {
  try {
    await setSessionRole(role);
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function submitRequestAction(
  input: GenerationRequestInput,
): Promise<ActionResult<{ requestId: string }>> {
  try {
    const session = await requireRequesterSession();
    const outcome = await submitGenerationRequest(input, {
      profileId: session.profile.id,
      organizationId: session.organization.id,
    });
    revalidatePath("/gate");
    revalidatePath("/console");
    return { ok: true, data: { requestId: outcome.request.id } };
  } catch (error) {
    return fail(error);
  }
}

/** "Convert to Organic": resubmit the same request with organic placement. */
export async function convertToOrganicAction(
  requestId: string,
): Promise<ActionResult<{ requestId: string }>> {
  try {
    const session = await requireRequesterSession();
    const store = getStore();
    const original = await store.getRequest(requestId);
    if (!original || original.organizationId !== session.organization.id) {
      throw new Error("Request not found for this organization.");
    }
    const outcome = await submitGenerationRequest(
      {
        voiceId: original.voiceId,
        script: original.script,
        campaignName: original.campaignName,
        purpose: original.purpose,
        platform: original.platform,
        language: original.language,
        placement: "organic",
        territory: original.territory,
        publicationDate: original.publicationDate,
        topicTags: original.topicTags,
      },
      { profileId: session.profile.id, organizationId: session.organization.id },
    );
    revalidatePath("/gate");
    return { ok: true, data: { requestId: outcome.request.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function rerunEvaluationAction(
  requestId: string,
): Promise<ActionResult<{ requestId: string }>> {
  try {
    const session = await getSession();
    const outcome = await reevaluateRequest(requestId, session.profile.id);
    revalidatePath("/gate");
    revalidatePath("/console");
    return { ok: true, data: { requestId: outcome.request.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function generateAudioAction(
  requestId: string,
): Promise<ActionResult<{ assetId: string; verificationId: string }>> {
  try {
    const session = await requireRequesterSession();
    const result = await generateAssetForRequest(requestId, {
      profileId: session.profile.id,
      organizationId: session.organization.id,
    });
    revalidatePath("/gate");
    revalidatePath("/console");
    return {
      ok: true,
      data: {
        assetId: result.asset.id,
        verificationId: result.asset.verificationId,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function requestAmendmentAction(
  requestId: string,
): Promise<ActionResult<{ amendmentId: string }>> {
  try {
    const session = await requireRequesterSession();
    const amendment = await draftAmendmentForRequest(requestId, {
      profileId: session.profile.id,
      organizationId: session.organization.id,
    });
    revalidatePath("/gate");
    revalidatePath("/console");
    return { ok: true, data: { amendmentId: amendment.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function decideAmendmentAction(
  amendmentId: string,
  verdict: "approved" | "rejected",
  note: string | null,
): Promise<ActionResult<{ resultingPolicyVersion: number | null; rerunOutcome: string | null }>> {
  try {
    const session = await requireOwnerSession();
    const result = await decideAmendment(amendmentId, verdict, note, {
      profileId: session.profile.id,
    });
    revalidatePath("/console");
    revalidatePath("/gate");
    revalidatePath(`/amendments/${amendmentId}`);
    return {
      ok: true,
      data: {
        resultingPolicyVersion: result.newPolicy?.version ?? null,
        rerunOutcome: result.rerun?.decision.outcome ?? null,
      },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function revokePolicyAction(
  policyId: string,
): Promise<ActionResult<null>> {
  try {
    const session = await requireOwnerSession();
    await revokePolicy(policyId, { profileId: session.profile.id });
    revalidatePath("/console");
    revalidatePath("/gate");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function getConsentChallengeAction(): Promise<
  ActionResult<{ phrase: string; issuedAt: string }>
> {
  try {
    await requireOwnerSession();
    const challenge = buildConsentChallenge();
    return { ok: true, data: { phrase: challenge.phrase, issuedAt: challenge.issuedAt } };
  } catch (error) {
    return fail(error);
  }
}

export async function extractConsentAction(input: {
  consentText: string;
  language: Language;
  voiceId: string;
}): Promise<ActionResult<{ result: ExtractionResult; adapterName: string }>> {
  try {
    const session = await requireOwnerSession();
    const data = await extractConsentTerms({
      consentText: input.consentText,
      language: input.language,
      voiceId: input.voiceId,
      actorProfileId: session.profile.id,
    });
    return { ok: true, data };
  } catch (error) {
    return fail(error);
  }
}

export async function approvePolicyAction(
  input: PolicyApprovalInput,
): Promise<ActionResult<{ policyId: string; version: number }>> {
  try {
    const session = await requireOwnerSession();
    const policy = await approveConsentPolicy(input, {
      profileId: session.profile.id,
    });
    revalidatePath("/console");
    revalidatePath("/studio");
    revalidatePath("/gate");
    return { ok: true, data: { policyId: policy.id, version: policy.version } };
  } catch (error) {
    return fail(error);
  }
}

export async function resetDemoAction(): Promise<ActionResult<null>> {
  try {
    const env = getEnv();
    if (!env.demoMode) {
      throw new Error("Demo reset is only available in demo mode.");
    }
    await getStore().reset();
    revalidatePath("/", "layout");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
