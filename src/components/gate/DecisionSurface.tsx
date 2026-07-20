"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  FileAudio,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCcw,
  ScanSearch,
  Undo2,
  Waves,
  Wand2,
} from "lucide-react";
import type {
  AmendmentRequest,
  DecisionTokenRecord,
  GeneratedAsset,
  GenerationRequest,
  StoredDecision,
} from "@/domain/types";
import {
  convertToOrganicAction,
  generateAudioAction,
  requestAmendmentAction,
  rerunEvaluationAction,
} from "@/server/actions";
import { cn, formatBytes, formatUtcDateTime, shortHash } from "@/lib/utils";
import { DecisionBadge } from "@/components/glass/DecisionBadge";
import { ClauseResultRow } from "@/components/glass/ClauseResultRow";
import { RevealList } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";

export function DecisionSurface({
  request,
  decision,
  evaluationCount,
  asset,
  latestToken,
  pendingAmendment,
  amendments,
  currentPolicyVersion,
  currentPolicyStatus,
  mockProvider,
  isRequester,
}: {
  request: GenerationRequest;
  decision: StoredDecision;
  evaluationCount: number;
  asset: GeneratedAsset | null;
  latestToken: DecisionTokenRecord | null;
  pendingAmendment: AmendmentRequest | null;
  amendments: AmendmentRequest[];
  currentPolicyVersion: number;
  currentPolicyStatus: string;
  mockProvider: boolean;
  isRequester: boolean;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approved = decision.outcome === "approved";
  const passed = decision.clauses.filter((c) => c.status === "passed").length;
  const failed = decision.clauses.filter((c) => c.status === "failed");
  const failedCodes = failed.map((c) => c.code);
  const revokedNow = failedCodes.includes("POLICY_REVOKED");
  const grantBacked = approved && decision.matchedGrantId !== null;
  const approvedAmendment =
    amendments.find((a) => a.status === "approved") ?? null;
  const onlyPaidFailure =
    failedCodes.length === 1 &&
    failedCodes[0] === "PAID_ADVERTISING_PROHIBITED";
  const amendable =
    failed.length > 0 &&
    failedCodes.every((code) =>
      ["PAID_ADVERTISING_PROHIBITED", "USAGE_LIMIT_REACHED"].includes(code),
    );
  const remedies = failed
    .map((clause) => clause.suggestedRemedy)
    .filter((remedy): remedy is string => Boolean(remedy));

  function run(
    name: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setBusy(name);
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Action failed.");
      setBusy(null);
      router.refresh();
    });
  }

  const kind = revokedNow ? "revoked" : approved ? "approved" : "blocked";

  return (
    <motion.section
      key={decision.id}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      aria-live="polite"
      data-testid="decision-surface"
      data-outcome={decision.outcome}
      className={cn(
        "glass-strong light-sweep p-6 md:p-8",
        approved ? "halo-approved" : "halo-blocked",
      )}
    >
      {/* hero decision */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <DecisionBadge kind={kind} />
        <div className="text-right">
          <p className="forensic text-[11px] text-text-muted">
            evaluated {formatUtcDateTime(decision.evaluatedAt)}
          </p>
          <p className="forensic mt-0.5 text-[11px] text-text-muted">
            policy v{decision.policyVersion}
            {evaluationCount > 1 && ` · evaluation #${evaluationCount}`}
          </p>
        </div>
      </div>

      {/* summary stats */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat
          label="Conditions passed"
          value={`${passed} of ${decision.clauses.length}`}
        />
        <Stat
          label="Conditions failed"
          value={String(failed.length)}
          tone={failed.length > 0 ? "blocked" : "approved"}
        />
        <Stat
          label="Authorization token"
          value={
            asset && latestToken?.status === "consumed"
              ? "Consumed"
              : approved
                ? "Ready to mint"
                : "Not issued"
          }
          detail={approved && !asset ? "single-use · 60s TTL" : undefined}
        />
        <Stat
          label="Provider"
          value={mockProvider ? "Demo provider" : "ElevenLabs"}
          detail={mockProvider ? "mock mode" : "live"}
        />
      </div>

      {grantBacked && (
        <p className="mt-4 flex items-start gap-2 rounded-[10px] border border-informational/25 bg-informational-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-informational">
          <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Approved under policy version {decision.policyVersion} via an
          owner-approved amendment grant scoped to this campaign and platform.
        </p>
      )}

      {/* clause evaluation */}
      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="micro-label">Clause evaluation</h3>
          <span className="forensic text-[11px] text-text-muted">
            deterministic engine · deny-by-default
          </span>
        </div>
        <RevealList className="flex flex-col gap-1" stagger={0.03} delay={0.15}>
          {[
            ...failed,
            ...decision.clauses.filter((c) => c.status === "passed"),
          ].map((clause) => (
            <ClauseResultRow
              key={clause.clause}
              clause={clause}
              emphasized={clause.status === "failed"}
            />
          ))}
        </RevealList>
      </div>

      {/* blocked: remedy panel */}
      {!approved && !revokedNow && remedies.length > 0 && (
        <div className="glass-subtle mt-6 border-warning/25 p-4">
          <SecurityLabel icon={<Wand2 className="h-3.5 w-3.5" aria-hidden />}>
            Suggested remedy
          </SecurityLabel>
          <ul className="mt-2 flex flex-col gap-1.5">
            {remedies.map((remedy) => (
              <li
                key={remedy}
                className="text-[13px] leading-relaxed text-text-secondary"
              >
                {remedy}
              </li>
            ))}
          </ul>
          {pendingAmendment && (
            <p
              data-testid="amendment-pending"
              className="mt-3 rounded-[10px] border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12.5px] font-medium text-warning"
            >
              Amendment sent to the voice owner — awaiting their decision.
              Switch to Umar to review it.
            </p>
          )}
        </div>
      )}

      {revokedNow && (
        <p className="mt-6 rounded-[10px] border border-blocked/30 bg-blocked-soft px-4 py-3 text-[13px] leading-relaxed text-text-primary">
          The owner revoked this consent policy. Revocation applies to every
          future request immediately; historical approvals below remain on
          record but authorize nothing new.
        </p>
      )}

      {/* generated asset */}
      {asset && (
        <div
          className="glass-subtle mt-6 border-approved/25 p-4"
          data-testid="asset-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SecurityLabel
              icon={<FileAudio className="h-3.5 w-3.5" aria-hidden />}
            >
              Registered master asset
            </SecurityLabel>
            {mockProvider && (
              <span className="rounded-full border border-warning/35 bg-warning-soft px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-warning">
                Demo provider
              </span>
            )}
          </div>
          <audio
            controls
            preload="metadata"
            src={`/api/assets/${asset.id}`}
            data-testid="audio-player"
            aria-label={`Generated voice audio for campaign ${request.campaignName}`}
            className="mt-3 w-full"
          />
          <dl className="forensic mt-3 grid gap-x-6 gap-y-1 text-[11.5px] text-text-muted sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0">SHA-256</dt>
              <dd className="truncate text-text-secondary" title={asset.sha256}>
                {shortHash(asset.sha256, 18)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt>Size</dt>
              <dd className="text-text-secondary">
                {formatBytes(asset.byteLength)} · {asset.mimeType}
              </dd>
            </div>
          </dl>
          <Link
            href={`/verify/${asset.verificationId}`}
            data-testid="verification-link"
            className="action-quiet mt-4 w-full"
          >
            <ScanSearch className="h-4 w-4" aria-hidden />
            Open public verification page
            <ArrowRight className="ml-auto h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {/* token trail */}
      {latestToken && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[10px] border border-border-glass bg-black/25 px-3.5 py-2.5">
          <SecurityLabel
            icon={<KeyRound className="h-3.5 w-3.5" aria-hidden />}
          >
            Token {latestToken.status}
          </SecurityLabel>
          <span className="forensic text-[11px] text-text-muted">
            jti {shortHash(latestToken.jti, 10)} · minted{" "}
            {formatUtcDateTime(latestToken.mintedAt)}
            {latestToken.consumedAt &&
              ` · consumed ${formatUtcDateTime(latestToken.consumedAt)}`}
          </span>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-[10px] border border-blocked/30 bg-blocked-soft px-3 py-2.5 text-[12.5px] text-blocked"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* actions */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        {approved && !asset && isRequester && (
          <button
            type="button"
            data-testid="generate-voice"
            disabled={isPending}
            onClick={() =>
              run("generate", () => generateAudioAction(request.id))
            }
            className="action-primary"
          >
            {busy === "generate" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Minting token · generating…
              </>
            ) : (
              <>
                <Waves className="h-4 w-4" aria-hidden />
                Generate voice
              </>
            )}
          </button>
        )}

        {!approved && onlyPaidFailure && isRequester && !pendingAmendment && (
          <button
            type="button"
            data-testid="convert-organic"
            disabled={isPending}
            onClick={() =>
              run("organic", async () => {
                const result = await convertToOrganicAction(request.id);
                if (result.ok)
                  router.push(`/gate?request=${result.data.requestId}`);
                return result;
              })
            }
            className="action-quiet"
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            {busy === "organic" ? "Converting…" : "Convert to organic"}
          </button>
        )}

        {!approved &&
          amendable &&
          isRequester &&
          !pendingAmendment &&
          !revokedNow && (
            <button
              type="button"
              data-testid="request-amendment"
              disabled={isPending}
              onClick={() =>
                run("amend", () => requestAmendmentAction(request.id))
              }
              className="action-primary"
            >
              <Wand2 className="h-4 w-4" aria-hidden />
              {busy === "amend" ? "Drafting proposal…" : "Request amendment"}
            </button>
          )}

        <button
          type="button"
          data-testid="rerun-evaluation"
          disabled={isPending}
          onClick={() => run("rerun", () => rerunEvaluationAction(request.id))}
          className="action-quiet"
        >
          <RefreshCcw
            className={cn("h-4 w-4", busy === "rerun" && "animate-spin")}
            aria-hidden
          />
          Re-run evaluation
        </button>
      </div>

      {/* provenance footnote */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border-glass pt-4">
        <SecurityLabel
          icon={<Fingerprint className="h-3.5 w-3.5" aria-hidden />}
        >
          script hash {shortHash(request.scriptHash, 10)}
        </SecurityLabel>
        <span className="forensic text-[11px] text-text-muted">
          current policy: v{currentPolicyVersion} · {currentPolicyStatus}
        </span>
        {approvedAmendment && (
          <span className="forensic text-[11px] text-text-muted">
            amendment {approvedAmendment.id.slice(0, 12)} approved
          </span>
        )}
      </div>
    </motion.section>
  );
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "approved" | "blocked";
}) {
  return (
    <div className="rounded-[12px] border border-border-glass bg-black/25 px-3.5 py-3">
      <p className="micro-label">{label}</p>
      <p
        className={cn(
          "display mt-1 text-[16px] font-bold leading-tight",
          tone === "blocked"
            ? "text-blocked"
            : tone === "approved"
              ? "text-approved"
              : "text-text-primary",
        )}
      >
        {value}
      </p>
      {detail && (
        <p className="forensic mt-0.5 text-[10.5px] text-text-muted">
          {detail}
        </p>
      )}
    </div>
  );
}
