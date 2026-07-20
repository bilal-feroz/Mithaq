import type { Metadata } from "next";
import { DEMO_IDS } from "@/domain/fixtures";
import { getStore } from "@/server/data";
import { getEnv } from "@/server/env";
import { getSession } from "@/server/session";
import { buildConsentChallenge } from "@/server/services/consent";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";
import { RoleNotice } from "@/components/gate/RoleNotice";
import { StudioFlow } from "@/components/studio/StudioFlow";

export const metadata: Metadata = { title: "Consent Studio" };

export default async function StudioPage() {
  const store = getStore();
  const env = getEnv();
  const session = await getSession();

  const voice = await store.getVoice(DEMO_IDS.voice);
  const latestPolicy = await store.getLatestPolicyForVoice(DEMO_IDS.voice);
  const organization = await store.getOrganization(DEMO_IDS.organization);
  const challenge = buildConsentChallenge();

  return (
    <div>
      <Reveal>
        <SecurityLabel>Owner consent capture</SecurityLabel>
        <h1 className="display mt-2 text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.02em] text-text-primary">
          Consent Studio
        </h1>
        <p className="mt-1.5 max-w-[56ch] text-[13.5px] text-text-secondary">
          Speak or type your consent in Arabic or English. AI extracts the
          terms; nothing becomes enforceable until you review and approve the
          structured policy yourself.
        </p>
      </Reveal>

      {session.role !== "owner" && (
        <RoleNotice
          message="You are viewing as Bilal (requester). Consent is granted by the voice owner."
          targetRole="owner"
          targetLabel="Switch to Umar — owner"
        />
      )}

      <StudioFlow
        voice={voice ? { id: voice.id, name: voice.displayName } : null}
        organizations={
          organization ? [{ id: organization.id, name: organization.name }] : []
        }
        challengePhrase={challenge.phrase}
        existingPolicyVersion={
          latestPolicy?.status === "active" ? latestPolicy.version : null
        }
        aiProvider={env.aiProvider}
        isOwner={session.role === "owner"}
      />
    </div>
  );
}
