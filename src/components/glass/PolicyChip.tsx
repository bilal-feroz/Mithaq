import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "approved" | "blocked" | "warning" | "informational";

const TONES: Record<Tone, string> = {
  neutral: "border-border-glass bg-white/[0.04] text-text-primary",
  approved: "border-approved/30 bg-approved-soft text-approved",
  blocked: "border-blocked/30 bg-blocked-soft text-blocked",
  warning: "border-warning/35 bg-warning-soft text-warning",
  informational: "border-informational/30 bg-informational-soft text-informational",
};

/** A normalized policy term rendered as an elegant chip. Terms never truncate. */
export function PolicyChip({
  label,
  value,
  tone = "neutral",
  icon,
  className,
}: {
  label?: string;
  value: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium leading-none",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {label && (
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] opacity-70">
          {label}
        </span>
      )}
      <span>{value}</span>
    </span>
  );
}

/** Chip group with consistent wrapping rhythm. */
export function ChipGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}
