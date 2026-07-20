import {
  Ban,
  CheckCircle2,
  FileAudio,
  FileSignature,
  GitBranch,
  KeyRound,
  Mic2,
  ShieldAlert,
  ShieldOff,
  Sparkles,
} from "lucide-react";
import type { AuditEvent } from "@/domain/types";
import { formatUtcDateTime, shortHash } from "@/lib/utils";
import { cn } from "@/lib/utils";

const EVENT_META: Record<
  string,
  { label: string; icon: typeof Sparkles; tone: string }
> = {
  "voice.registered": {
    label: "Voice registered",
    icon: Mic2,
    tone: "text-text-secondary",
  },
  "consent.extracted": {
    label: "Consent terms extracted",
    icon: Sparkles,
    tone: "text-informational",
  },
  "policy.created": {
    label: "Policy drafted",
    icon: FileSignature,
    tone: "text-text-secondary",
  },
  "policy.activated": {
    label: "Policy approved by owner",
    icon: CheckCircle2,
    tone: "text-approved",
  },
  "policy.version_created": {
    label: "New policy version issued",
    icon: GitBranch,
    tone: "text-informational",
  },
  "policy.superseded": {
    label: "Previous version superseded",
    icon: GitBranch,
    tone: "text-text-secondary",
  },
  "policy.revoked": {
    label: "Policy revoked by owner",
    icon: ShieldOff,
    tone: "text-blocked",
  },
  "request.submitted": {
    label: "Generation request submitted",
    icon: FileSignature,
    tone: "text-text-secondary",
  },
  "decision.approved": {
    label: "Request approved",
    icon: CheckCircle2,
    tone: "text-approved",
  },
  "decision.blocked": {
    label: "Request blocked",
    icon: Ban,
    tone: "text-blocked",
  },
  "amendment.requested": {
    label: "Amendment proposed",
    icon: FileSignature,
    tone: "text-warning",
  },
  "amendment.approved": {
    label: "Amendment approved",
    icon: CheckCircle2,
    tone: "text-approved",
  },
  "amendment.rejected": {
    label: "Amendment rejected",
    icon: Ban,
    tone: "text-blocked",
  },
  "token.minted": {
    label: "Authorization token minted",
    icon: KeyRound,
    tone: "text-informational",
  },
  "token.consumed": {
    label: "Token consumed (single use)",
    icon: KeyRound,
    tone: "text-approved",
  },
  "token.rejected": {
    label: "Token rejected",
    icon: ShieldAlert,
    tone: "text-blocked",
  },
  "asset.generated": {
    label: "Audio asset registered",
    icon: FileAudio,
    tone: "text-approved",
  },
  "generation.failed": {
    label: "Provider generation failed",
    icon: ShieldAlert,
    tone: "text-blocked",
  },
};

/** One hash-linked audit event in the vertical timeline. */
export function TimelineEvent({
  event,
  isLast = false,
}: {
  event: AuditEvent;
  isLast?: boolean;
}) {
  const meta = EVENT_META[event.eventType] ?? {
    label: event.eventType,
    icon: Sparkles,
    tone: "text-text-secondary",
  };
  const Icon = meta.icon;
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className="absolute left-[13px] top-8 h-[calc(100%-30px)] w-px bg-white/[0.09]"
        />
      )}
      <span
        aria-hidden
        className="mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-border-glass bg-background-elevated"
      >
        <Icon className={cn("h-3.5 w-3.5", meta.tone)} strokeWidth={1.9} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-medium leading-tight text-text-primary">
          {meta.label}
        </p>
        <p className="forensic mt-1 text-[11px] text-text-muted">
          {formatUtcDateTime(event.createdAt)} · #
          {shortHash(event.currentEventHash, 10)}
        </p>
      </div>
    </li>
  );
}
