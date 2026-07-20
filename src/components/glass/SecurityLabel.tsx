import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** 11px uppercase security micro-label with icon. Used sparingly. */
export function SecurityLabel({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-text-muted",
        className,
      )}
    >
      {icon ?? <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />}
      {children}
    </span>
  );
}
