import {
  FileSignature,
  KeyRound,
  Mic2,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { DEMO_IDS } from "@/domain/fixtures";
import { getStore } from "@/server/data";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { ChipGroup, PolicyChip } from "@/components/glass/PolicyChip";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { Reveal } from "@/components/glass/Reveal";
import { EnterAs } from "@/components/shell/EnterAs";

const PIPELINE = [
  { icon: Mic2, title: "Consent", text: "The owner grants terms in plain language — Arabic or English." },
  { icon: FileSignature, title: "Policy", text: "AI extracts; the owner reviews and approves a versioned policy." },
  { icon: ShieldCheck, title: "Gate", text: "A deterministic engine evaluates every request, clause by clause." },
  { icon: KeyRound, title: "Token", text: "Approval mints a 60-second, single-use, request-bound token." },
  { icon: ScanSearch, title: "Verify", text: "Every asset is hashed and publicly verifiable — revocation shows instantly." },
];

export default async function LandingPage() {
  const store = getStore();
  const policy = await store.getLatestPolicyForVoice(DEMO_IDS.voice);

  return (
    <div className="grid-overlay -mx-4 -mt-6 px-4 pt-10 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-10 lg:-mt-9 lg:px-10 lg:pt-14 xl:-mx-14 xl:px-14">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <SecurityLabel>Verifiable consent &amp; enforcement for AI voices</SecurityLabel>
          <h1 className="display mt-4 max-w-[17ch] text-[clamp(30px,4.6vw,54px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-text-primary">
            Consent registries declare what is allowed.{" "}
            <span className="bg-gradient-to-b from-[#eef2f7] to-[#93a1b3] bg-clip-text text-transparent">
              MITHAQ enforces it
            </span>{" "}
            before generation.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-text-secondary">
            OAuth-style authorization for your voice. Employees never touch the
            provider API key — every generation passes a deterministic policy
            engine, and only an approved request receives a short-lived,
            single-use authorization token.
          </p>
          <p className="micro-label mt-6">
            Registries declare · Provenance records · MITHAQ enforces
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[7fr_5fr] lg:gap-6">
          <Reveal delay={0.08}>
            <GlassPanel
              eyebrow="Live demo policy"
              title={
                <>
                  Awaiz Demo Voice — policy passport{" "}
                  <span className="forensic ml-1 text-[11px] font-medium text-text-muted">
                    v{policy?.version ?? 1}
                  </span>
                </>
              }
              className="h-full"
            >
              {policy ? (
                <>
                  <ChipGroup>
                    <PolicyChip label="org" value="Kanban Studios" />
                    <PolicyChip label="purpose" value="Brand promotion" />
                    <PolicyChip label="platforms" value="Instagram · YouTube" />
                    <PolicyChip label="languages" value="Arabic · English" />
                    <PolicyChip label="territories" value="UAE · Saudi Arabia" />
                    <PolicyChip
                      label="placement"
                      value={policy.paidAdvertising === "prohibited" ? "Organic only" : "Paid allowed"}
                      tone={policy.paidAdvertising === "prohibited" ? "warning" : "approved"}
                    />
                    <PolicyChip label="assets" value={`${policy.assetsUsed} of ${policy.maximumAssets} used`} />
                    <PolicyChip label="prohibited" value="Political content" tone="blocked" />
                    <PolicyChip label="until" value="30 Jul 2026" />
                  </ChipGroup>
                  <blockquote
                    lang="en"
                    className="glass-inset mt-5 px-4 py-3.5 text-[13px] italic leading-relaxed text-text-secondary"
                  >
                    “{policy.sourceConsentText}”
                  </blockquote>
                  <p className="mt-3 text-[11.5px] text-text-muted">
                    Natural-language consent above · enforced terms as chips. The
                    engine reads only the structured, owner-approved terms.
                  </p>
                </>
              ) : (
                <p className="text-text-secondary">
                  No policy yet — create one in the Consent Studio.
                </p>
              )}
            </GlassPanel>
          </Reveal>

          <div className="flex flex-col gap-5">
            <Reveal delay={0.14}>
              <GlassPanel eyebrow="Voice owner" title="Awaiz Ahmed">
                <p className="mb-4 text-[13px] leading-relaxed text-text-secondary">
                  Review consent terms, approve amendments, watch usage — and
                  revoke everything with one decision.
                </p>
                <EnterAs
                  role="owner"
                  href="/console"
                  label="Enter as Awaiz — Owner Console"
                  testId="enter-owner"
                />
              </GlassPanel>
            </Reveal>
            <Reveal delay={0.2}>
              <GlassPanel eyebrow="Organization requester" title="Bilal · Kanban Studios">
                <p className="mb-4 text-[13px] leading-relaxed text-text-secondary">
                  Submit generation requests through the gate and watch every
                  clause evaluate deterministically.
                </p>
                <EnterAs
                  role="requester"
                  href="/gate"
                  label="Enter as Bilal — Generation Gate"
                  testId="enter-requester"
                />
              </GlassPanel>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.26} className="mt-12">
          <p className="micro-label mb-4">How enforcement works</p>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {PIPELINE.map((step, index) => (
              <li key={step.title} className="glass-subtle relative p-4">
                <span className="forensic absolute right-3 top-3 text-[10px] text-text-muted">
                  0{index + 1}
                </span>
                <step.icon className="h-[18px] w-[18px] text-metal" strokeWidth={1.7} aria-hidden />
                <p className="mt-2.5 text-[13.5px] font-semibold text-text-primary">{step.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal delay={0.3} className="mt-12 border-t border-border-glass pt-6 pb-4">
          <p className="max-w-[88ch] text-[11.5px] leading-relaxed text-text-muted">
            MITHAQ does not prove legal identity, legal ownership of a voice or
            universal legal validity. This prototype enforces a registered
            account owner&apos;s approved policy within an organization-controlled
            generation pipeline. The LLM extracts and explains; it never
            authorizes — every allow/block decision is made by a deterministic
            policy engine. Voice generation today; avatar support is roadmap
            only.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
