import type { Metadata } from "next";
import { DEMO_IDS } from "@/domain/fixtures";
import { getStore } from "@/server/data";
import { getEnv } from "@/server/env";
import { getSession } from "@/server/session";
import { GateForm } from "@/components/gate/GateForm";
import { DecisionSurface } from "@/components/gate/DecisionSurface";
import { GateIdle } from "@/components/gate/GateIdle";
import { RoleNotice } from "@/components/gate/RoleNotice";
import { Reveal } from "@/components/glass/Reveal";
import { SecurityLabel } from "@/components/glass/SecurityLabel";

export const metadata: Metadata = { title: "Generation Gate" };

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request: requestId } = await searchParams;
  const store = getStore();
  const env = getEnv();
  const session = await getSession();

  const policy = await store.getLatestPolicyForVoice(DEMO_IDS.voice);
  const voice = await store.getVoice(DEMO_IDS.voice);
  const owner = voice ? await store.getProfile(voice.ownerId) : null;

  const request = requestId ? await store.getRequest(requestId) : null;
  const decision = request
    ? await store.getLatestDecisionForRequest(request.id)
    : null;
  const decisions = request
    ? await store.listDecisionsForRequest(request.id)
    : [];
  const asset = request ? await store.getAssetForRequest(request.id) : null;
  const tokens = request ? await store.listTokensForRequest(request.id) : [];
  const pendingAmendment = request
    ? await store.getPendingAmendmentForRequest(request.id)
    : null;
  const amendments = request
    ? await store.listAmendmentsForRequest(request.id)
    : [];

  return (
    <div>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SecurityLabel>Deterministic policy enforcement</SecurityLabel>
            <h1 className="display mt-2 text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.02em] text-text-primary">
              Generation Gate
            </h1>
            <p className="mt-1.5 max-w-[52ch] text-[13.5px] text-text-secondary">
              Submit a voice-generation request. Every clause of{" "}
              {owner?.displayName ?? "the owner"}&apos;s consent policy is
              evaluated by the deterministic engine — the model never decides.
            </p>
          </div>
        </div>
      </Reveal>

      {session.role !== "requester" && (
        <RoleNotice
          message="You are viewing as Umar (voice owner). Requests are submitted by the requester persona."
          targetRole="requester"
          targetLabel="Switch to Bilal — requester"
        />
      )}

      {/* When a decision exists it is the mobile focal point: decision first,
          form second; the desktop grid keeps form left, decision right. */}
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-12">
        <Reveal
          delay={0.06}
          className={
            request && decision
              ? "order-2 lg:order-1 lg:col-span-5"
              : "lg:col-span-5"
          }
        >
          <GateForm
            voice={
              voice && owner
                ? {
                    id: voice.id,
                    name: voice.displayName,
                    owner: owner.displayName,
                  }
                : null
            }
            hasActivePolicy={Boolean(policy)}
            disabled={session.role !== "requester"}
          />
        </Reveal>

        <div
          className={
            request && decision
              ? "order-1 lg:order-2 lg:col-span-7"
              : "lg:col-span-7"
          }
        >
          {request && decision ? (
            <DecisionSurface
              request={request}
              decision={decision}
              evaluationCount={decisions.length}
              asset={asset}
              latestToken={tokens.at(-1) ?? null}
              pendingAmendment={pendingAmendment}
              amendments={amendments}
              currentPolicyVersion={policy?.version ?? decision.policyVersion}
              currentPolicyStatus={policy?.status ?? "active"}
              mockProvider={env.voiceProvider === "mock"}
              isRequester={session.role === "requester"}
            />
          ) : (
            <GateIdle policy={policy} />
          )}
        </div>
      </div>
    </div>
  );
}
