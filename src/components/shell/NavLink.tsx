"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileSignature,
  Landmark,
  LayoutGrid,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icon lookup lives client-side: component functions cannot cross the RSC boundary. */
const ICONS = {
  overview: LayoutGrid,
  studio: FileSignature,
  gate: ShieldCheck,
  console: Landmark,
  verify: ScanSearch,
} as const;

export type NavIconName = keyof typeof ICONS;

export function NavLink({
  href,
  label,
  hint,
  iconName,
  compact = false,
}: {
  href: string;
  label: string;
  hint?: string;
  iconName: NavIconName;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const Icon = ICONS[iconName];
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-150",
        compact && "shrink-0 gap-2 rounded-full px-3.5 py-1.5",
        active
          ? "border border-border-glass bg-white/[0.06] text-text-primary"
          : "border border-transparent text-text-secondary hover:bg-white/[0.04] hover:text-text-primary",
      )}
    >
      <Icon
        className={cn(
          compact ? "h-3.5 w-3.5 shrink-0" : "h-[17px] w-[17px] shrink-0",
          active
            ? "text-metal"
            : "text-text-muted group-hover:text-text-secondary",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0">
        <span
          className={cn(
            "block font-medium leading-tight",
            compact ? "text-[12.5px]" : "text-[13.5px]",
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="block text-[10.5px] leading-tight text-text-muted">
            {hint}
          </span>
        )}
      </span>
    </Link>
  );
}
