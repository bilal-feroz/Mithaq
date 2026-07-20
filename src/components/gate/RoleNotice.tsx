"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UserRound } from "lucide-react";
import { switchRoleAction } from "@/server/actions";
import type { SessionRole } from "@/server/session";

export function RoleNotice({
  message,
  targetRole,
  targetLabel,
}: {
  message: string;
  targetRole: SessionRole;
  targetLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-informational/25 bg-informational-soft px-4 py-3">
      <p className="flex items-center gap-2 text-[13px] text-text-primary">
        <UserRound className="h-4 w-4 text-informational" strokeWidth={1.9} aria-hidden />
        {message}
      </p>
      <button
        type="button"
        data-testid="role-notice-switch"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await switchRoleAction(targetRole);
            router.refresh();
          })
        }
        className="action-quiet min-h-[36px] px-3.5 py-1.5 text-[12.5px]"
      >
        {isPending ? "Switching…" : targetLabel}
      </button>
    </div>
  );
}
