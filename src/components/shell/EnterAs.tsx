"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { switchRoleAction } from "@/server/actions";
import type { SessionRole } from "@/server/session";

export function EnterAs({
  role,
  href,
  label,
  testId,
}: {
  role: SessionRole;
  href: string;
  label: string;
  testId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await switchRoleAction(role);
          router.push(href);
          router.refresh();
        })
      }
      className="action-primary w-full justify-between"
    >
      {isPending ? "Entering…" : label}
      <ArrowRight className="h-4 w-4" strokeWidth={2.1} aria-hidden />
    </button>
  );
}
