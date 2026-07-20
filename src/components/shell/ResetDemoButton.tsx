"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { resetDemoAction } from "@/server/actions";

export function ResetDemoButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      data-testid="reset-demo"
      onClick={() =>
        startTransition(async () => {
          await resetDemoAction();
          router.push("/");
          router.refresh();
        })
      }
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[11.5px] font-medium text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-secondary disabled:opacity-50"
    >
      <RotateCcw className="h-3 w-3" strokeWidth={2} aria-hidden />
      {isPending ? "Resetting…" : "Reset demo"}
    </button>
  );
}
