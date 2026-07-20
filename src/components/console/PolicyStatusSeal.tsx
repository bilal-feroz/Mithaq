import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  active: "border-approved/35 bg-approved-soft text-approved",
  superseded: "border-border-glass bg-white/[0.04] text-text-muted",
  revoked: "border-blocked/40 bg-blocked-soft text-blocked",
  expired: "border-warning/40 bg-warning-soft text-warning",
  draft: "border-border-glass bg-white/[0.04] text-text-secondary",
};

export function PolicyStatusSeal({ status }: { status: string }) {
  return (
    <span
      data-testid="policy-status"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em]",
        TONES[status] ?? TONES.draft,
        status === "revoked" && "line-through decoration-2",
      )}
    >
      {status}
    </span>
  );
}
