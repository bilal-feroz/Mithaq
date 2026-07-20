import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { DEMO_IDS } from "@/domain/fixtures";
import { getStore } from "@/server/data";
import { getSession } from "@/server/session";
import {
  LANGUAGE_LABELS,
  PLATFORM_LABELS,
  PURPOSE_LABELS,
  territoryLabel,
} from "@/lib/labels";
import { formatUtcDate, formatUtcDateTime } from "@/lib/utils";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ChipGroup, PolicyChip } from "@/components/glass/PolicyChip";
import { DecisionBadge } from "@/components/glass/DecisionBadge";
import { MetricGlass } from "@/components/glass/MetricGlass";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { TimelineEvent } from "@/components/glass/TimelineEvent";
import { RoleNotice } from "@/components/gate/RoleNotice";
import { RevokeZone } from "@/components/console/RevokeZone";
import { PolicyStatusSeal } from "@/components/console/PolicyStatusSeal";

export const metadata: Metadata = { title: "Owner Console" };

export default async function ConsolePage() {
  const store = getStore();
  const session = await getSession();

  const voice = await store.getVoice(DEMO_IDS.voice);
  const owner = voice ? await store.getProfile(voice.ownerId) : null;
  const versions = await store.listPolicyVersionsForVoice(DEMO_IDS.voice);
  const policy = versions.at(-1) ?? null;
  const requests = await store.listRequestsForOwner(DEMO_IDS.owner);
  const amendments = await store.listAmendmentsForOwner(DEMO_IDS.owner);
  const pendingAmendments = amendments.filter((a) => a.status === "pending");
  const auditEvents = await store.listAuditEvents(12);

  const requestsWithDecisions = await Promise.all(
    requests.slice(0, 6).map(async (request) => ({
      request,
      decision: await store.getLatestDecisionForRequest(request.id),
    })),
  );
  const approvedCount = requests.filter((r) =>
    ["approved", "generating", "generated"].includes(r.status),
  ).length;
  const blockedCount = requests.filter((r) => r.status === "blocked").length;

  const expiryDays = policy
    ? Math.max(
        0,
        Math.ceil((Date.parse(policy.validUntil) - Date.now()) / 86_400_000),
      )
    : 0;

  return (
    <div>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SecurityLabel>Voice owner console</SecurityLabel>
            <h1 className="display mt-2 text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.02em] text-text-primary">
              {owner?.displayName ?? "Owner"}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-text-secondary">
              Active voice:{" "}
              <span className="text-text-primary">{voice?.displayName}</span>
              {policy && (
                <>
                  {" "}
                  · policy v{policy.version} · {policy.status}
                </>
              )}
            </p>
          </div>
          {pendingAmendments.length > 0 && (
            <Link
              href={`/amendments/${pendingAmendments[0]!.id}`}
              className="action-primary"
              data-testid="open-pending-amendment"
            >
              <Inbox className="h-4 w-4" aria-hidden />
              Review pending amendment
            </Link>
          )}
        </div>
      </Reveal>

      {session.role !== "owner" && (
        <RoleNotice
          message="You are viewing as Bilal (requester). Policy control belongs to the owner persona."
          targetRole="owner"
          targetLabel="Switch to Umar — owner"
        />
      )}

      <div className="mt-7 grid items-start gap-6 lg:grid-cols-12">
        {/* policy passport */}
        <Reveal delay={0.05} className="lg:col-span-7">
          <GlassPanel
            eyebrow="Policy passport"
            title={
              policy ? (
                <span className="flex items-center gap-3">
                  Consent policy
                  <span className="flex items-center gap-1.5">
                    {versions.map((version) => (
                      <span
                        key={version.id}
                        className={
                          version.id === policy.id
                            ? "forensic rounded-[6px] border border-informational/35 bg-informational-soft px-2 py-0.5 text-[11px] font-semibold text-informational"
                            : "forensic rounded-[6px] border border-border-glass px-2 py-0.5 text-[11px] text-text-muted"
                        }
                      >
                        v{version.version}
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                "No policy yet"
              )
            }
            action={
              policy ? <PolicyStatusSeal status={policy.status} /> : undefined
            }
            className="h-full"
          >
            {policy ? (
              <>
                <ChipGroup>
                  <PolicyChip label="org" value="Kanban Studios" />
                  <PolicyChip
                    label="purposes"
                    value={policy.allowedPurposes
                      .map((p) => PURPOSE_LABELS[p])
                      .join(" · ")}
                  />
                  <PolicyChip
                    label="platforms"
                    value={policy.allowedPlatforms
                      .map((p) => PLATFORM_LABELS[p])
                      .join(" · ")}
                  />
                  <PolicyChip
                    label="languages"
                    value={policy.allowedLanguages
                      .map((l) => LANGUAGE_LABELS[l])
                      .join(" · ")}
                  />
                  <PolicyChip
                    label="territories"
                    value={policy.allowedTerritories
                      .map(territoryLabel)
                      .join(" · ")}
                  />
                  <PolicyChip
                    label="placement"
                    value={
                      policy.paidAdvertising === "prohibited"
                        ? "Organic only"
                        : "Paid allowed"
                    }
                    tone={
                      policy.paidAdvertising === "prohibited"
                        ? "warning"
                        : "approved"
                    }
                  />
                  {policy.prohibitedTopics.length > 0 && (
                    <PolicyChip
                      label="prohibited"
                      value={policy.prohibitedTopics.join(" · ")}
                      tone="blocked"
                    />
                  )}
                  <PolicyChip
                    label="editing"
                    value={
                      policy.editingAllowed
                        ? "Light edits allowed"
                        : "No editing"
                    }
                  />
                </ChipGroup>

                {policy.grants.length > 0 && (
                  <div className="mt-4">
                    <p className="micro-label mb-2">Amendment grants</p>
                    <ChipGroup>
                      {policy.grants.map((grant) => (
                        <PolicyChip
                          key={grant.id}
                          label={`${grant.assetsUsed}/${grant.maximumAssets} used`}
                          value={grant.label}
                          tone="informational"
                        />
                      ))}
                    </ChipGroup>
                  </div>
                )}

                <blockquote
                  lang={policy.sourceConsentLanguage === "ar" ? "ar" : "en"}
                  dir={policy.sourceConsentLanguage === "ar" ? "rtl" : "ltr"}
                  className="glass-inset mt-5 px-4 py-3.5 text-[12.5px] italic leading-relaxed text-text-secondary"
                >
                  “{policy.sourceConsentText}”
                </blockquote>
                <p className="forensic mt-3 text-[11px] text-text-muted">
                  approved{" "}
                  {policy.ownerApprovedAt
                    ? formatUtcDateTime(policy.ownerApprovedAt)
                    : "—"}{" "}
                  · valid until {formatUtcDate(policy.validUntil)}
                  {policy.revokedAt &&
                    ` · revoked ${formatUtcDateTime(policy.revokedAt)}`}
                </p>
              </>
            ) : (
              <p className="text-[13.5px] text-text-secondary">
                Create a consent policy in the{" "}
                <Link
                  href="/studio"
                  className="text-informational underline-offset-2 hover:underline"
                >
                  Consent Studio
                </Link>
                .
              </p>
            )}
          </GlassPanel>
        </Reveal>

        {/* usage + counters */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Reveal delay={0.1}>
            <GlassPanel eyebrow="Usage" title="Authorized allowance">
              <div className="flex flex-col gap-3">
                <MetricGlass
                  label="Base allocation"
                  value={
                    policy
                      ? `${policy.assetsUsed} of ${policy.maximumAssets} authorized assets used`
                      : "—"
                  }
                  used={policy?.assetsUsed}
                  total={policy?.maximumAssets}
                />
                {policy?.grants.map((grant) => (
                  <MetricGlass
                    key={grant.id}
                    label="Amendment grant"
                    value={`${grant.assetsUsed} of ${grant.maximumAssets} used`}
                    detail={grant.label}
                    used={grant.assetsUsed}
                    total={grant.maximumAssets}
                  />
                ))}
                <div className="grid grid-cols-3 gap-3">
                  <MetricGlass
                    label="Approved"
                    value={String(approvedCount)}
                    tone="approved"
                  />
                  <MetricGlass
                    label="Blocked"
                    value={String(blockedCount)}
                    tone="blocked"
                  />
                  <MetricGlass
                    label="Expires in"
                    value={policy?.status === "active" ? `${expiryDays}d` : "—"}
                    detail={
                      policy ? formatUtcDate(policy.validUntil) : undefined
                    }
                  />
                </div>
              </div>
            </GlassPanel>
          </Reveal>

          <Reveal delay={0.15}>
            <GlassPanel
              eyebrow="Amendment inbox"
              title={
                pendingAmendments.length > 0
                  ? `${pendingAmendments.length} awaiting your decision`
                  : "No pending amendments"
              }
            >
              {amendments.length === 0 ? (
                <p className="text-[13px] text-text-muted">
                  When a blocked request proposes a scoped exception, it appears
                  here for your approval.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {amendments.slice(0, 4).map((amendment) => (
                    <li key={amendment.id}>
                      <Link
                        href={`/amendments/${amendment.id}`}
                        data-testid={`amendment-${amendment.status}`}
                        className="glass-inset group flex items-center gap-3 px-3.5 py-3 transition-colors hover:border-border-glass-strong"
                      >
                        <span
                          className={
                            amendment.status === "pending"
                              ? "h-2 w-2 shrink-0 rounded-full bg-warning"
                              : amendment.status === "approved"
                                ? "h-2 w-2 shrink-0 rounded-full bg-approved"
                                : "h-2 w-2 shrink-0 rounded-full bg-blocked"
                          }
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-text-primary">
                            {amendment.proposal.campaignName} — paid{" "}
                            {PLATFORM_LABELS[amendment.proposal.platform]}
                          </span>
                          <span className="block text-[11.5px] capitalize text-text-muted">
                            {amendment.status} ·{" "}
                            {formatUtcDateTime(amendment.createdAt)}
                          </span>
                        </span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </GlassPanel>
          </Reveal>
        </div>

        {/* recent requests */}
        <Reveal delay={0.2} className="lg:col-span-7">
          <GlassPanel
            eyebrow="Recent activity"
            title="Generation requests"
            className="h-full"
          >
            {requestsWithDecisions.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No requests yet. Bilal submits them through the Generation Gate.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {requestsWithDecisions.map(({ request, decision }) => (
                  <li
                    key={request.id}
                    className="glass-inset flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-3"
                  >
                    <DecisionBadge
                      kind={
                        decision?.outcome === "approved"
                          ? "approved"
                          : "blocked"
                      }
                      size="compact"
                    />
                    <span className="min-w-0 flex-1 text-[13px] text-text-secondary">
                      <span className="font-medium text-text-primary">
                        {request.campaignName}
                      </span>{" "}
                      · {PLATFORM_LABELS[request.platform]} ·{" "}
                      {LANGUAGE_LABELS[request.language]} · {request.placement}
                    </span>
                    <span className="forensic text-[11px] text-text-muted">
                      {formatUtcDateTime(request.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </Reveal>

        {/* audit timeline */}
        <Reveal delay={0.25} className="lg:col-span-5">
          <GlassPanel
            eyebrow="Audit timeline"
            title="Hash-linked events"
            action={
              <span className="forensic text-[10.5px] text-text-muted">
                tamper-evident chain
              </span>
            }
            className="h-full"
          >
            <ol className="flex flex-col">
              {auditEvents
                .slice()
                .reverse()
                .map((event, index, array) => (
                  <TimelineEvent
                    key={event.id}
                    event={event}
                    isLast={index === array.length - 1}
                  />
                ))}
            </ol>
          </GlassPanel>
        </Reveal>

        {/* danger zone */}
        {policy && policy.status === "active" && session.role === "owner" && (
          <Reveal delay={0.3} className="lg:col-span-12">
            <RevokeZone policyId={policy.id} policyVersion={policy.version} />
          </Reveal>
        )}
      </div>
    </div>
  );
}
