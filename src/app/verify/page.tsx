import type { Metadata } from "next";
import { ScanSearch } from "lucide-react";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { VerifyLookup } from "@/components/verify/VerifyLookup";

export const metadata: Metadata = { title: "Public Verifier" };

export default function VerifyIndexPage() {
  return (
    <div className="mx-auto max-w-[760px]">
      <Reveal>
        <div className="pt-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border-glass-strong bg-white/[0.05]">
            <ScanSearch className="h-7 w-7 text-metal" strokeWidth={1.6} aria-hidden />
          </span>
          <SecurityLabel className="mt-5 justify-center">
            Public verification
          </SecurityLabel>
          <h1 className="display mt-2 text-[clamp(24px,3.4vw,34px)] font-bold tracking-[-0.02em] text-text-primary">
            Verify a MITHAQ-authorized voice asset
          </h1>
          <p className="mx-auto mt-2.5 max-w-[52ch] text-[13.5px] leading-relaxed text-text-secondary">
            Every generated asset carries an opaque verification ID and QR code.
            Look one up to see the consent status it was approved under — and
            whether that consent still stands.
          </p>
        </div>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <VerifyLookup />
      </Reveal>
      <Reveal delay={0.16} className="mt-10 text-center">
        <p className="mx-auto max-w-[60ch] text-[11.5px] leading-relaxed text-text-muted">
          Verification confirms registration within MITHAQ&apos;s enforcement
          pipeline: that a consent policy existed, that a request was approved
          under a specific version, and that an exact master file was
          registered. It does not establish legal identity or universal legal
          consent.
        </p>
      </Reveal>
    </div>
  );
}
