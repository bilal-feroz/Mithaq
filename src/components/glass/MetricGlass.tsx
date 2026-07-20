import { cn } from "@/lib/utils";

/**
 * A single focused metric with an optional allocation meter.
 * "1 of 1 authorized assets used" style.
 */
export function MetricGlass({
  label,
  value,
  detail,
  used,
  total,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  used?: number;
  total?: number;
  tone?: "neutral" | "approved" | "warning" | "blocked";
  className?: string;
}) {
  const showMeter = typeof used === "number" && typeof total === "number" && total > 0;
  const ratio = showMeter ? Math.min(1, used! / total!) : 0;
  const meterColor =
    tone === "blocked"
      ? "bg-blocked"
      : tone === "warning" || ratio >= 1
        ? "bg-warning"
        : "bg-approved";
  return (
    <div className={cn("glass-subtle p-4", className)}>
      <p className="micro-label">{label}</p>
      <p className="display mt-1.5 text-[22px] font-bold leading-tight text-text-primary">
        {value}
      </p>
      {showMeter && (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={used}
          aria-label={`${label}: ${used} of ${total} used`}
        >
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", meterColor)}
            style={{ width: `${Math.max(ratio * 100, used! > 0 ? 6 : 0)}%` }}
          />
        </div>
      )}
      {detail && <p className="mt-2 text-[12px] text-text-muted">{detail}</p>}
    </div>
  );
}
