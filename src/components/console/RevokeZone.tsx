"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ShieldOff } from "lucide-react";
import { revokePolicyAction } from "@/server/actions";

/**
 * The isolated danger zone. Revocation requires an accessible modal
 * confirmation and spells out exactly what changes and what is preserved.
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
              remain on record; the public verifier will show the revocation.
            </p>
          </div>
        </div>

        <Dialog.Root open={confirming} onOpenChange={setConfirming}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              data-testid="revoke-policy"
              className="action-danger"
            >
              Revoke policy…
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
            <Dialog.Content
              data-testid="revoke-dialog"
              className="glass-strong fixed left-1/2 top-1/2 z-[51] w-[min(92vw,500px)] -translate-x-1/2 -translate-y-1/2 border-blocked/35 p-6 shadow-raised focus:outline-none"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-blocked/35 bg-blocked-soft"
              >
                <AlertTriangle className="h-5 w-5 text-blocked" />
              </span>
              <Dialog.Title className="display mt-4 text-[19px] font-bold text-text-primary">
                Revoke consent policy v{policyVersion}?
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                This takes effect immediately. Every future request and every
                unused token will be blocked. Historical approvals, generated
                assets, hashes and verification records remain preserved.
              </Dialog.Description>
              <div className="mt-6 flex flex-wrap justify-end gap-2.5">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    disabled={isPending}
                    className="action-quiet"
                  >
                    Keep policy
                  </button>
                </Dialog.Close>
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
                  className="action-danger"
                >
                  {isPending ? "Revoking…" : "Yes — revoke now"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-blocked">
          {error}
        </p>
      )}
    </section>
  );
}
