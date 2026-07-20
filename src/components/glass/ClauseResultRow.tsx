import { Check, X } from "lucide-react";
import type { ClauseResult } from "@/domain/types";
import { cn } from "@/lib/utils";

/**
 * One evaluated clause. Status is communicated by icon + text + a 3px rail,
 * never by color alone. Screen readers hear "passed"/"failed" explicitly.
 */
export function ClauseResultRow({
  clause,
  emphasized = false,
}: {
  clause: ClauseResult;
  emphasized?: boolean;
}) {
  const failed = clause.status === "failed";
  return (
    <li
      className={cn(
        "relative flex items-start gap-3 rounded-[10px] py-2.5 pl-4 pr-3",
        failed && "bg-blocked-soft/60",
        failed && emphasized && "border border-blocked/25",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 left-0 w-[3px] rounded-full",
          failed ? "bg-blocked" : "bg-approved/70",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
          failed
            ? "border-blocked/40 bg-blocked-soft text-blocked"
            : "border-approved/35 bg-approved-soft text-approved",
        )}
      >
        {failed ? (
          <X className="h-3 w-3" strokeWidth={2.6} />
        ) : (
          <Check className="h-3 w-3" strokeWidth={2.6} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="text-[13.5px] font-semibold text-text-primary">
            {clause.clause}
          </span>
          <span className="sr-only">{failed ? "failed" : "passed"}.</span>
          {failed && (
            <span className="forensic rounded-[5px] border border-blocked/30 bg-blocked-soft px-1.5 py-px text-[10.5px] font-medium text-blocked">
              {clause.code}
            </span>
          )}
        </div>
        <p
          className={cn(
            "mt-0.5 text-[12.5px] leading-relaxed",
            failed ? "text-text-primary/85" : "text-text-muted",
          )}
        >
          {clause.explanation}
        </p>
        {failed && clause.expected !== undefined && (
          <p className="forensic mt-1.5 text-[11.5px] text-text-muted">
            expected {formatValue(clause.expected)} · received{" "}
            {formatValue(clause.received)}
          </p>
        )}
      </div>
    </li>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
