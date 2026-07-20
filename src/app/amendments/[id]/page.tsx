import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bot } from "lucide-react";
import { getStore } from "@/server/data";
import { getSession } from "@/server/session";
import { PLATFORM_LABELS } from "@/lib/labels";
import { formatUtcDate, formatUtcDateTime } from "@/lib/utils";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { RoleNotice } from "@/components/gate/RoleNotice";
import { AmendmentComparison } from "@/components/amendments/AmendmentComparison";
import { AmendmentDecision } from "@/components/amendments/AmendmentDecision";

export const metadata: Metadata = { title: "Amendment review" };

export default async function AmendmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getStore();
  const session = await getSession();

  const amendment = await store.getAmendment(id);
  if (!amendment) notFound();

  const [policy, request, requester, organization, resultingPolicy] =
    await Promise.all([
      store.getPolicy(amendment.policyId),
      store.getRequest(amendment.requestId),
      store.getProfile(amendment.requestedById),
      store.getOrganization(amendment.organizationId),
      amendment.resultingPolicyId
        ? store.getPolicy(amendment.resultingPolicyId)
        : null,
    ]);
  if (!policy || !request) notFound();

  const rerunDecision =
    amendment.status === "approved"
      ? await store.getLatestDecisionForRequest(amendment.requestId)
      : null;

  return (
    <div className="mx-auto max-w-[920px]">
      <Reveal>
        <Link
          href="/console"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted transition-colors hover:text-text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Owner Console
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <SecurityLabel>Policy amendment · narrow scope</SecurityLabel>
            <h1 className="display mt-2 text-[clamp(22px,3vw,30px)] font-bold tracking-[-0.02em] text-text-primary">
              One paid {PLATFORM_LABELS[amendment.proposal.platform]} placement
            </h1>
            <p className="mt-1.5 text-[13.5px] text-text-secondary">
              Requested by {requester?.displayName ?? "requester"} ·{" "}
              {organization?.name ?? "organization"} ·{" "}
              {formatUtcDateTime(amendment.createdAt)}
            </p>
          </div>
          <span
            data-testid="amendment-status"
            className={
              amendment.status === "pending"
                ? "rounded-full border border-warning/40 bg-warning-soft px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-warning"
                : amendment.status === "approved"
                  ? "rounded-full border border-approved/40 bg-approved-soft px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-approved"
                  : "rounded-full border border-blocked/40 bg-blocked-soft px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-blocked"
            }
          >
            {amendment.status}
          </span>
        </div>
      </Reveal>

      {session.role !== "owner" && amendment.status === "pending" && (
        <RoleNotice
          message="Only the voice owner can decide this amendment."
          targetRole="owner"
          targetLabel="Switch to Umar — owner"
        />
      )}

      <Reveal delay={0.07} className="mt-6">
        <GlassPanel eyebrow="Why this is needed" title="Agent-drafted proposal">
          <figure className="flex gap-3.5">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-informational/30 bg-informational-soft"
            >
              <Bot
                className="h-[18px] w-[18px] text-informational"
                strokeWidth={1.8}
              />
            </span>
            <blockquote className="text-[13.5px] leading-relaxed text-text-secondary">
              {amendment.proposal.rationale}
            </blockquote>
          </figure>
          <p className="forensic mt-4 border-t border-border-glass pt-3 text-[11px] text-text-muted">
            Original block: {amendment.failedClauseCodes.join(", ")} · The agent
            drafts; you grant authority; the deterministic engine re-evaluates.
          </p>
        </GlassPanel>
      </Reveal>

      <Reveal delay={0.12} className="mt-5">
        <AmendmentComparison
          currentVersion={policy.version}
          proposedVersion={policy.version + 1}
          decided={amendment.status !== "pending"}
          rows={[
            {
              label: "Paid advertising",
              current:
                policy.paidAdvertising === "prohibited"
                  ? "Prohibited"
                  : "Allowed",
              proposed: `One paid ${PLATFORM_LABELS[amendment.proposal.platform]} placement`,
              changed: true,
            },
            {
              label: "Campaign scope",
              current: "General terms",
              proposed: `${amendment.proposal.campaignName} only`,
              changed: true,
            },
            {
              label: "Asset limit",
              current: `${policy.maximumAssets} authorized`,
              proposed: `+${amendment.proposal.additionalAssets} amendment-specific use`,
              changed: true,
            },
            {
              label: "Expiry",
              current: formatUtcDate(policy.validUntil),
              proposed: `${formatUtcDate(amendment.proposal.validUntil)} — unchanged`,
              changed: false,
            },
            {
              label: "Languages · territories · topics",
              current: "As approved",
              proposed: "Unchanged",
              changed: false,
            },
          ]}
        />
      </Reveal>

      <Reveal delay={0.17} className="mt-5">
        <AmendmentDecision
          amendmentId={amendment.id}
          status={amendment.status}
          isOwner={session.role === "owner"}
          proposedVersion={policy.version + 1}
          resultingVersion={
            resultingPolicy?.version ?? amendment.resultingPolicyVersion
          }
          rerunOutcome={rerunDecision?.outcome ?? null}
          requestId={amendment.requestId}
          ownerDecisionAt={amendment.ownerDecisionAt}
        />
      </Reveal>
    </div>
  );
}
