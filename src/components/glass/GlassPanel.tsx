import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Level-2 glass surface — the primary product panel.
 * Owns the glass recipe; screens compose, never re-implement.
 */
export function GlassPanel({
  eyebrow,
  title,
  action,
  children,
  className,
  padding = "p-6 md:p-7",
}: {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  return (
    <section className={cn("glass-panel", padding, className)}>
      {(eyebrow || title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {eyebrow && <p className="micro-label mb-1.5">{eyebrow}</p>}
            {title && (
              <h2 className="display text-[17px] font-semibold text-text-primary">
                {title}
              </h2>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Level-4 compact sub-surface for grouping inside a panel. */
export function GlassCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("glass-subtle p-4", className)}>{children}</div>;
}
