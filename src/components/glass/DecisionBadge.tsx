import { Ban, CheckCircle2, Clock3, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type DecisionKind = "approved" | "blocked" | "revoked" | "pending";

const CONFIG: Record<
  DecisionKind,
  { label: string; icon: typeof CheckCircle2; text: string; ring: string }
> = {
  approved: {
    label: "REQUEST APPROVED",
    icon: CheckCircle2,
    text: "text-approved",
    ring: "border-approved/35 bg-approved-soft",
  },
  blocked: {
    label: "REQUEST BLOCKED",
    icon: Ban,
    text: "text-blocked",
    ring: "border-blocked/35 bg-blocked-soft",
  },
  revoked: {
    label: "POLICY REVOKED",
    icon: ShieldOff,
    text: "text-blocked",
    ring: "border-blocked/35 bg-blocked-soft",
  },
  pending: {
    label: "AWAITING EVALUATION",
    icon: Clock3,
    text: "text-text-secondary",
    ring: "border-border-glass bg-white/[0.03]",
  },
};

/**
 * The hero decision statement. Icon + text — never color alone.
 */
export function DecisionBadge({
  kind,
  size = "hero",
  className,
}: {
  kind: DecisionKind;
  size?: "hero" | "compact";
  className?: string;
}) {
  const config = CONFIG[kind];
  const Icon = config.icon;
  if (size === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold tracking-wide",
          config.ring,
          config.text,
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        {config.label}
      </span>
    );
  }
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border",
          config.ring,
        )}
        aria-hidden
      >
        <Icon className={cn("h-7 w-7", config.text)} strokeWidth={1.9} />
      </span>
      <div
        className={cn(
          "display text-[clamp(26px,4vw,40px)] font-extrabold leading-none tracking-[-0.03em]",
          config.text,
        )}
      >
        {config.label}
      </div>
    </div>
  );
}
