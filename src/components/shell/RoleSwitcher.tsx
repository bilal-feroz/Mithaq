"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchRoleAction } from "@/server/actions";
import type { SessionRole } from "@/server/session";
import { cn } from "@/lib/utils";

const ROLES: {
  role: SessionRole;
  name: string;
  descriptor: string;
  initials: string;
  testId: string;
}[] = [
  {
    role: "owner",
    name: "Umar",
    descriptor: "Voice owner",
    initials: "AA",
    testId: "role-switch-owner",
  },
  {
    role: "requester",
    name: "Bilal",
    descriptor: "Kanban Studios",
    initials: "B",
    testId: "role-switch-requester",
  },
];

/**
 * Persona switcher for the hackathon demo mode. The current role must always
 * be obvious — it is pinned to the shell on every screen.
 */
export function RoleSwitcher({
  current,
  testIdSuffix = "",
}: {
  current: SessionRole;
  testIdSuffix?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(role: SessionRole) {
    if (role === current) return;
    startTransition(async () => {
      await switchRoleAction(role);
      router.refresh();
    });
  }

  return (
    <div
      role="radiogroup"
      aria-label="Active demo persona"
      className={cn(
        "glass-inset flex flex-col gap-1 p-1.5",
        isPending && "opacity-60",
      )}
    >
      <p className="micro-label px-2 pt-1">Acting as</p>
      {ROLES.map((entry) => {
        const active = entry.role === current;
        return (
          <button
            key={entry.role}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${entry.testId}${testIdSuffix}`}
            onClick={() => switchTo(entry.role)}
            disabled={isPending}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition-colors duration-150",
              active
                ? "border border-informational/30 bg-informational-soft"
                : "border border-transparent hover:bg-white/[0.05]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                active
                  ? "bg-informational/25 text-informational"
                  : "bg-white/[0.07] text-text-secondary",
              )}
            >
              {entry.initials}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[13px] font-semibold leading-tight",
                  active ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {entry.name}
              </span>
              <span className="block text-[11px] leading-tight text-text-muted">
                {entry.descriptor}
              </span>
            </span>
            {active && (
              <span
                className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-informational"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
