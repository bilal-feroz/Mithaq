"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type ComparisonRow = {
  label: string;
  current: string;
  proposed: string;
  changed: boolean;
};

/**
 * The current → proposed policy comparison. The animated version transition
 * makes the versioning model tangible: v(n) dims toward superseded while
 * v(n+1) rises.
 */
export function AmendmentComparison({
  currentVersion,
  proposedVersion,
  decided,
  rows,
}: {
  currentVersion: number;
  proposedVersion: number;
  decided: boolean;
  rows: ComparisonRow[];
}) {
  const reduced = useReducedMotion();
  return (
    <section className="glass-strong halo-informational overflow-hidden p-0" aria-label="Policy comparison">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border-glass px-5 py-4 md:px-7">
        <div className={cn("min-w-0", decided && "opacity-55")}>
          <p className="micro-label">Current policy</p>
          <p className="display mt-0.5 text-[15px] font-bold text-text-primary">
            Version {currentVersion}
            {decided && (
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                superseded
              </span>
            )}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-text-muted" aria-hidden />
        <motion.div
          initial={reduced ? false : { opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 text-right"
        >
          <p className="micro-label text-informational/80">Proposed version</p>
          <p className="display mt-0.5 text-[15px] font-bold text-informational">
            Version {proposedVersion}
            {decided && (
              <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-approved">
                active
              </span>
            )}
          </p>
        </motion.div>
      </div>

      <dl>
        {rows.map((row, index) => (
          <motion.div
            key={row.label}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 + index * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              "grid grid-cols-1 gap-1 border-b border-border-glass/60 px-5 py-3.5 last:border-b-0 md:grid-cols-[200px_1fr_auto_1fr] md:items-center md:gap-4 md:px-7",
              row.changed && "bg-informational-soft/40",
            )}
          >
            <dt className="micro-label md:text-[10.5px]">{row.label}</dt>
            <dd
              className={cn(
                "text-[13px]",
                row.changed ? "text-text-muted line-through decoration-text-muted/50" : "text-text-secondary",
              )}
            >
              {row.current}
            </dd>
            <ArrowRight className="hidden h-3.5 w-3.5 text-text-muted md:block" aria-hidden />
            <dd
              className={cn(
                "text-[13px] font-medium",
                row.changed ? "text-informational" : "text-text-secondary",
              )}
            >
              {row.proposed}
            </dd>
          </motion.div>
        ))}
      </dl>
    </section>
  );
}
