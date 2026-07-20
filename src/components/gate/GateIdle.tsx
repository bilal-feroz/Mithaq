import { ShieldCheck } from "lucide-react";
import type { ConsentPolicy } from "@/domain/types";
import {
  LANGUAGE_LABELS,
  PLATFORM_LABELS,
  PURPOSE_LABELS,
  territoryLabel,
} from "@/lib/labels";
import { formatUtcDate } from "@/lib/utils";
import { ChipGroup, PolicyChip } from "@/components/glass/PolicyChip";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";

/**
 * The decision surface before any request exists: the active policy passport,
 * so the requester sees exactly what the gate will enforce.
 */
export function GateIdle({ policy }: { policy: ConsentPolicy | null }) {
  if (!policy) {
    return (
      <Reveal delay={0.1}>
        <div className="glass-panel flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
          <ShieldCheck
            className="h-8 w-8 text-text-muted"
            strokeWidth={1.4}
            aria-hidden
          />
          <p className="mt-4 max-w-[36ch] text-[14px] text-text-secondary">
            No consent policy exists for this voice yet. The owner creates one
            in the Consent Studio.
          </p>
        </div>
      </Reveal>
    );
  }

  const revoked = policy.status === "revoked";

  return (
    <Reveal delay={0.1}>
      <div className="glass-panel p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SecurityLabel>The gate will enforce</SecurityLabel>
            <h2 className="display mt-2 text-[20px] font-bold text-text-primary">
              Active consent policy{" "}
              <span className="forensic text-[12px] font-medium text-text-muted">
                v{policy.version}
              </span>
            </h2>
          </div>
          <span
            className={
              revoked
                ? "rounded-full border border-blocked/35 bg-blocked-soft px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-blocked"
                : "rounded-full border border-approved/35 bg-approved-soft px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-approved"
            }
          >
            {policy.status}
          </span>
        </div>

        <ChipGroup className="mt-5">
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
            value={policy.allowedTerritories.map(territoryLabel).join(" · ")}
          />
          <PolicyChip
            label="placement"
            value={
              policy.paidAdvertising === "prohibited"
                ? "Organic only"
                : "Paid allowed"
            }
            tone={
              policy.paidAdvertising === "prohibited" ? "warning" : "approved"
            }
          />
          <PolicyChip
            label="allowance"
            value={`${policy.assetsUsed} of ${policy.maximumAssets} used`}
          />
          {policy.prohibitedTopics.length > 0 && (
            <PolicyChip
              label="prohibited"
              value={policy.prohibitedTopics.join(" · ")}
              tone="blocked"
            />
          )}
          <PolicyChip
            label="valid until"
            value={formatUtcDate(policy.validUntil)}
          />
          {policy.grants.map((grant) => (
            <PolicyChip
              key={grant.id}
              label="grant"
              value={grant.label}
              tone="informational"
            />
          ))}
        </ChipGroup>

        <div className="mt-8 flex min-h-[120px] items-center justify-center rounded-[14px] border border-dashed border-border-glass bg-black/15 px-6 py-8 text-center">
          <p className="max-w-[40ch] text-[13.5px] leading-relaxed text-text-muted">
            Submit a request on the left. The deterministic engine will evaluate
            it clause by clause and render its decision here — approvals mint a
            single-use authorization token.
          </p>
        </div>
      </div>
    </Reveal>
  );
}
