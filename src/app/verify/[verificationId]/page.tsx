import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Clock3, ShieldCheck, ShieldOff, X } from "lucide-react";
import { getPublicVerification } from "@/server/services/verification";
import {
  LANGUAGE_LABELS,
  PLACEMENT_LABELS,
  PLATFORM_LABELS,
  PURPOSE_LABELS,
  territoryLabel,
} from "@/lib/labels";
import type { Language, Placement, Platform, Purpose } from "@/domain/types";
import { formatBytes, formatUtcDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { HashCompare } from "@/components/verify/HashCompare";

export const metadata: Metadata = { title: "Verification" };

const STATUS_CONFIG = {
  active: {
    label: "CONSENT ACTIVE",
    icon: ShieldCheck,
    text: "text-approved",
    halo: "halo-approved",
    chip: "border-approved/40 bg-approved-soft text-approved",
  },
  revoked: {
    label: "CONSENT REVOKED",
    icon: ShieldOff,
    text: "text-blocked",
    halo: "halo-blocked",
    chip: "border-blocked/40 bg-blocked-soft text-blocked",
  },
  expired: {
    label: "CONSENT EXPIRED",
    icon: Clock3,
    text: "text-warning",
    halo: "halo-warning",
    chip: "border-warning/40 bg-warning-soft text-warning",
  },
} as const;

export default async function VerificationPage({
  params,
}: {
  params: Promise<{ verificationId: string }>;
}) {
  const { verificationId } = await params;
  const verification = await getPublicVerification(verificationId);

  if (!verification) {
    return (
      <div className="mx-auto max-w-[600px] pt-10 text-center">
        <h1 className="display text-[24px] font-bold text-text-primary">
          Verification not found
        </h1>
        <p className="mt-2 text-[13.5px] text-text-secondary">
          No asset is registered under this verification ID.
        </p>
        <Link href="/verify" className="action-quiet mx-auto mt-6 inline-flex">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Look up another ID
        </Link>
      </div>
    );
  }

  const config = STATUS_CONFIG[verification.status];
  const StatusIcon = config.icon;
  const passedCount = verification.decisionTrail.filter(
    (clause) => clause.status === "passed",
  ).length;

  return (
    <div className="mx-auto max-w-[760px]">
      <Reveal>
        <Link
          href="/verify"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-text-muted transition-colors hover:text-text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Public Verifier
        </Link>
      </Reveal>

      {/* status seal */}
      <Reveal delay={0.05} className="mt-4">
        <section
          data-testid="verification-status"
          data-status={verification.status}
          aria-live="polite"
          className={cn("glass-strong light-sweep p-7 text-center md:p-9", config.halo)}
        >
          <span
            aria-hidden
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2",
              verification.status === "active"
                ? "border-approved/45 bg-approved-soft"
                : verification.status === "revoked"
                  ? "border-blocked/45 bg-blocked-soft"
                  : "border-warning/45 bg-warning-soft",
            )}
          >
            <StatusIcon className={cn("h-8 w-8", config.text)} strokeWidth={1.7} />
          </span>
          <h1
            className={cn(
              "display mt-5 text-[clamp(24px,3.6vw,36px)] font-extrabold tracking-[-0.03em]",
              config.text,
            )}
          >
            {config.label}
          </h1>
          <p className="mx-auto mt-3 max-w-[58ch] text-[13.5px] leading-relaxed text-text-secondary">
            {verification.statusDetail}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className={cn("rounded-full border px-3 py-1 text-[11.5px] font-semibold", config.chip)}>
              policy v{verification.policyVersionUsed} at approval
            </span>
            <span className="rounded-full border border-border-glass bg-white/[0.04] px-3 py-1 text-[11.5px] font-medium text-text-secondary">
              current: v{verification.currentPolicyVersion} · {verification.currentPolicyStatus}
            </span>
          </div>
        </section>
      </Reveal>

      {/* facts */}
      <Reveal delay={0.12} className="mt-5">
        <section className="glass-panel p-6 md:p-7" aria-label="Registered facts">
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Fact label="Voice owner" value={verification.ownerDisplayName} />
            <Fact label="Voice" value={verification.voiceDisplayName} />
            <Fact label="Authorized organization" value={verification.organizationName} />
            <Fact
              label="Purpose"
              value={PURPOSE_LABELS[verification.purpose as Purpose] ?? verification.purpose}
            />
            <Fact
              label="Platform · placement"
              value={`${PLATFORM_LABELS[verification.platform as Platform] ?? verification.platform} · ${
                PLACEMENT_LABELS[verification.placement as Placement] ?? verification.placement
              }`}
            />
            <Fact
              label="Language · territory"
              value={`${LANGUAGE_LABELS[verification.language as Language] ?? verification.language} · ${territoryLabel(verification.territory)}`}
            />
            <Fact label="Approved" value={formatUtcDateTime(verification.approvedAt)} />
            <Fact label="Generated" value={formatUtcDateTime(verification.generatedAt)} />
          </div>

          <div className="mt-6 border-t border-border-glass pt-5">
            <SecurityLabel>Master file fingerprint</SecurityLabel>
            <p className="forensic mt-2 break-all rounded-[10px] border border-border-glass bg-black/30 px-3.5 py-2.5 text-[12px] leading-relaxed text-text-secondary">
              sha256:{verification.assetSha256}
            </p>
            <p className="mt-1.5 text-[11.5px] text-text-muted">
              {formatBytes(verification.assetByteLength)} · {verification.assetMimeType} ·
              provider: {verification.provider === "mock" ? "demo provider" : verification.provider}
            </p>
          </div>

          <div className="mt-6 grid gap-6 border-t border-border-glass pt-5 sm:grid-cols-[1fr_auto]">
            <div>
              <SecurityLabel>Decision trail</SecurityLabel>
              <p className="mt-2 text-[12.5px] text-text-secondary">
                {passedCount} of {verification.decisionTrail.length} conditions
                passed at approval under policy v{verification.policyVersionUsed}.
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {verification.decisionTrail.map((clause) => (
                  <li key={clause.clause} className="flex items-center gap-2 text-[12px] text-text-secondary">
                    {clause.status === "passed" ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-approved" strokeWidth={2.4} aria-hidden />
                    ) : (
                      <X className="h-3.5 w-3.5 shrink-0 text-blocked" strokeWidth={2.4} aria-hidden />
                    )}
                    {clause.clause}
                    <span className="sr-only">{clause.status}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-[14px] border border-border-glass bg-[#f4f6f8] p-2.5 shadow-panel">
                {/* QR data URL is generated server-side */}
                <Image
                  src={verification.qrDataUrl}
                  alt={`QR code linking to this verification page`}
                  width={132}
                  height={132}
                  unoptimized
                />
              </div>
              <p className="forensic text-[10.5px] text-text-muted">
                {verification.verificationId}
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* hash compare */}
      <Reveal delay={0.18} className="mt-5">
        <HashCompare verificationId={verification.verificationId} />
      </Reveal>

      <Reveal delay={0.22} className="mt-8 pb-6 text-center">
        <p className="mx-auto max-w-[64ch] text-[11.5px] leading-relaxed text-text-muted">
          MITHAQ verifies registration within its enforcement pipeline — not
          legal identity or universal legal consent. Public platforms may
          re-encode uploaded media, which changes its hash; perceptual
          fingerprinting for re-encoded copies is future work.
        </p>
      </Reveal>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <p className="mt-1 text-[14px] font-medium text-text-primary">{value}</p>
    </div>
  );
}
