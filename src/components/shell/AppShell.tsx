import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck, Waves } from "lucide-react";
import { getEnv } from "@/server/env";
import { getSession } from "@/server/session";
import { NavLink } from "./NavLink";
import { RoleSwitcher } from "./RoleSwitcher";
import { ResetDemoButton } from "./ResetDemoButton";

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-3 px-1">
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-border-glass-strong bg-gradient-to-b from-white/[0.1] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
      >
        <ShieldCheck
          className="h-[18px] w-[18px] text-metal"
          strokeWidth={1.8}
        />
      </span>
      <span className="min-w-0">
        <span className="display block bg-gradient-to-b from-[#f2f5f9] to-[#aeb9c7] bg-clip-text text-[17px] font-extrabold leading-none tracking-[-0.01em] text-transparent">
          MITHAQ
          <span className="ml-1.5 align-middle text-[10px] font-bold tracking-[0.22em] text-metal-dim">
            GATE
          </span>
        </span>
        <span
          lang="ar"
          dir="rtl"
          className="block text-right text-[11px] leading-snug text-text-muted"
        >
          ميثاق — بوابة الإذن الصوتي
        </span>
      </span>
    </Link>
  );
}

function ProviderBadge({ mock }: { mock: boolean }) {
  return (
    <div
      data-testid="provider-badge"
      className="flex items-center gap-2 rounded-[9px] border border-border-glass bg-black/25 px-2.5 py-2"
    >
      <Waves
        className={
          mock ? "h-3.5 w-3.5 text-warning" : "h-3.5 w-3.5 text-approved"
        }
        strokeWidth={1.9}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold leading-tight text-text-secondary">
          {mock ? "Demo provider" : "ElevenLabs"}
        </p>
        <p className="text-[10px] leading-tight text-text-muted">
          {mock ? "deterministic mock audio" : "live voice generation"}
        </p>
      </div>
    </div>
  );
}

export async function AppShell({ children }: { children: ReactNode }) {
  const [session, env] = await Promise.all([
    getSession(),
    Promise.resolve(getEnv()),
  ]);
  const mockProvider = env.voiceProvider === "mock";

  const nav = (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      <NavLink href="/" label="Overview" iconName="overview" />
      <NavLink
        href="/studio"
        label="Consent Studio"
        hint="voice owner"
        iconName="studio"
      />
      <NavLink
        href="/gate"
        label="Generation Gate"
        hint="requester"
        iconName="gate"
      />
      <NavLink
        href="/console"
        label="Owner Console"
        hint="voice owner"
        iconName="console"
      />
      <NavLink
        href="/verify"
        label="Public Verifier"
        hint="anyone"
        iconName="verify"
      />
    </nav>
  );

  return (
    <div className="min-h-dvh">
      <div className="atmosphere" aria-hidden />
      <div className="grain" aria-hidden />

      {/* desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col gap-6 border-r border-border-glass bg-[rgba(11,15,21,0.72)] p-4 backdrop-blur-xl lg:flex">
        <Wordmark />
        {nav}
        <div className="mt-auto flex flex-col gap-2.5">
          <ProviderBadge mock={mockProvider} />
          <RoleSwitcher current={session.role} />
          {env.demoMode && (
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">
                demo mode
              </span>
              <ResetDemoButton />
            </div>
          )}
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-border-glass bg-[rgba(9,12,17,0.82)] px-4 pb-3 pt-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Wordmark />
          <details className="relative">
            <summary className="action-quiet min-h-[38px] cursor-pointer list-none px-3 py-1.5 text-[12.5px] [&::-webkit-details-marker]:hidden">
              {session.role === "owner" ? "Umar · Owner" : "Bilal · Requester"}
            </summary>
            <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-[14px] border border-border-glass-strong bg-[rgba(14,18,26,0.97)] p-2 shadow-raised">
              <RoleSwitcher current={session.role} testIdSuffix="-mobile" />
              {env.demoMode && (
                <div className="mt-2 flex justify-end">
                  <ResetDemoButton />
                </div>
              )}
            </div>
          </details>
        </div>
        <nav
          aria-label="Primary mobile"
          className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5"
        >
          {[
            { href: "/", label: "Overview", iconName: "overview" as const },
            {
              href: "/studio",
              label: "Consent Studio",
              iconName: "studio" as const,
            },
            {
              href: "/gate",
              label: "Generation Gate",
              iconName: "gate" as const,
            },
            {
              href: "/console",
              label: "Owner Console",
              iconName: "console" as const,
            },
            { href: "/verify", label: "Verifier", iconName: "verify" as const },
          ].map((item) => (
            <NavLink key={item.href} {...item} compact />
          ))}
        </nav>
      </header>

      <main className="min-h-dvh px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:ml-[236px] lg:px-10 lg:pt-9 xl:px-14">
        <div className="mx-auto w-full max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
