"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { resetDemoAction } from "@/server/actions";

export function ResetDemoButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        data-testid="reset-demo"
        onClick={() => {
          if (
            !window.confirm(
              "Reset all demo requests, amendments, assets, tokens, usage and revocation state?",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await resetDemoAction();
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.push("/");
            router.refresh();
          });
        }}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[11.5px] font-medium text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-secondary disabled:opacity-50"
      >
        <RotateCcw className="h-3 w-3" strokeWidth={2} aria-hidden />
        {isPending ? "Resetting…" : "Reset demo"}
      </button>
      {error && (
        <span
          role="alert"
          className="mt-1 flex max-w-48 items-start gap-1 text-right text-[10px] text-blocked"
        >
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          {error}
        </span>
      )}
    </div>
  );
}
