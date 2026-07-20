"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { decideAmendmentAction } from "@/server/actions";
import { formatUtcDateTime } from "@/lib/utils";

export function AmendmentDecision({
  amendmentId,
  status,
  isOwner,
  proposedVersion,
  resultingVersion,
  rerunOutcome,
  requestId,
  ownerDecisionAt,
}: {
  amendmentId: string;
  status: "pending" | "approved" | "rejected";
  isOwner: boolean;
  proposedVersion: number;
  resultingVersion: number | null;
  rerunOutcome: string | null;
  requestId: string;
  ownerDecisionAt: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  function decide(verdict: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const result = await decideAmendmentAction(
        amendmentId,
        verdict,
        note || null,
      );
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  }

  if (status === "approved") {
    return (
      <section
        data-testid="amendment-approved-panel"
        className="glass-strong halo-approved light-sweep p-6 md:p-7"
        aria-live="polite"
      >
        <div className="flex items-start gap-3.5">
          <CheckCircle2
            className="mt-0.5 h-6 w-6 shrink-0 text-approved"
            strokeWidth={1.8}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 className="display text-[18px] font-bold text-text-primary">
              Amendment approved — policy version {resultingVersion} is active
            </h2>
            <p className="mt-1.5 max-w-[62ch] text-[13px] leading-relaxed text-text-secondary">
              Version {resultingVersion! - 1} is preserved as superseded. The
              originating request was automatically re-evaluated against the new
              version by the deterministic engine
              {rerunOutcome && (
                <>
                  {" "}
                  — outcome:{" "}
                  <strong
                    data-testid="rerun-outcome"
                    className={
                      rerunOutcome === "approved"
                        ? "text-approved"
                        : "text-blocked"
                    }
                  >
                    {rerunOutcome.toUpperCase()}
                  </strong>
                </>
              )}
              .
            </p>
            {ownerDecisionAt && (
              <p className="forensic mt-2 text-[11px] text-text-muted">
                decided {formatUtcDateTime(ownerDecisionAt)}
              </p>
            )}
            <Link
              href={`/gate?request=${requestId}`}
              data-testid="view-rerun-request"
              className="action-quiet mt-4 inline-flex"
            >
              View the re-evaluated request
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (status === "rejected") {
    return (
      <section className="glass-panel border-blocked/25 p-6" aria-live="polite">
        <div className="flex items-start gap-3.5">
          <XCircle
            className="mt-0.5 h-6 w-6 shrink-0 text-blocked"
            strokeWidth={1.8}
            aria-hidden
          />
          <div>
            <h2 className="display text-[17px] font-bold text-text-primary">
              Amendment rejected
            </h2>
            <p className="mt-1.5 text-[13px] text-text-secondary">
              The policy is unchanged. The requester can adjust the request to
              fit the existing terms instead.
            </p>
            {ownerDecisionAt && (
              <p className="forensic mt-2 text-[11px] text-text-muted">
                decided {formatUtcDateTime(ownerDecisionAt)}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="glass-panel p-6" aria-label="Your decision">
      <h2 className="micro-label">Your decision</h2>
      <p className="mt-2 max-w-[64ch] text-[13px] leading-relaxed text-text-secondary">
        Approving issues policy{" "}
        <strong className="text-text-primary">version {proposedVersion}</strong>{" "}
        with this single scoped exception. Nothing else changes, the current
        version is preserved, and the blocked request re-evaluates
        automatically.
      </p>
      <label htmlFor="decision-note" className="micro-label mt-4 block">
        Note to requester (optional)
      </label>
      <input
        id="decision-note"
        type="text"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="e.g. Keep the placement inside the approved budget."
        className="field mt-1.5 max-w-[480px]"
      />
      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-blocked">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          type="button"
          data-testid="approve-amendment"
          disabled={isPending || !isOwner}
          onClick={() => decide("approved")}
          className="action-primary"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Issuing version…
            </>
          ) : (
            "Approve — issue new version"
          )}
        </button>
        <button
          type="button"
          data-testid="reject-amendment"
          disabled={isPending || !isOwner}
          onClick={() => decide("rejected")}
          className="action-danger"
        >
          Reject
        </button>
      </div>
      {!isOwner && (
        <p className="mt-3 text-[12px] text-warning">
          Switch to the owner persona to decide this amendment.
        </p>
      )}
    </section>
  );
}
