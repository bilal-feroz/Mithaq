"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ShieldOff } from "lucide-react";
import { revokePolicyAction } from "@/server/actions";

/**
 * The isolated danger zone. Revocation requires explicit confirmation and
 * spells out exactly what changes — and what is preserved.
 */
export function RevokeZone({
  policyId,
  policyVersion,
}: {
  policyId: string;
  policyVersion: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="glass-panel border-blocked/25 p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-blocked/35 bg-blocked-soft"
          >
            <ShieldOff className="h-5 w-5 text-blocked" strokeWidth={1.8} />
          </span>
          <div>
            <h2
              id="danger-zone-title"
              className="display text-[16px] font-semibold text-text-primary"
            >
              Revoke consent policy v{policyVersion}
            </h2>
            <p className="mt-1 max-w-[62ch] text-[12.5px] leading-relaxed text-text-secondary">
              Every future request blocks immediately and unused authorization
              tokens are rejected. Historical decisions and generated assets
              remain on record — the public verifier will show this policy as
              revoked.
            </p>
          </div>
        </div>

        {!confirming ? (
          <button
            type="button"
            data-testid="revoke-policy"
            onClick={() => setConfirming(true)}
            className="action-danger"
          >
            Revoke policy…
          </button>
        ) : (
          <div
            role="alertdialog"
            aria-label="Confirm revocation"
            className="flex flex-wrap items-center gap-2.5 rounded-[12px] border border-blocked/35 bg-blocked-soft px-4 py-3"
          >
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-blocked"
              aria-hidden
            />
            <span className="text-[13px] font-medium text-text-primary">
              This takes effect immediately. Revoke consent?
            </span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="action-quiet min-h-[38px] px-3.5 py-1.5 text-[12.5px]"
            >
              Keep policy
            </button>
            <button
              type="button"
              data-testid="confirm-revoke"
              disabled={isPending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await revokePolicyAction(policyId);
                  if (!result.ok) setError(result.error);
                  setConfirming(false);
                  router.refresh();
                });
              }}
              className="action-danger min-h-[38px] px-3.5 py-1.5 text-[12.5px]"
            >
              {isPending ? "Revoking…" : "Yes — revoke now"}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-blocked">
          {error}
        </p>
      )}
    </section>
  );
}
