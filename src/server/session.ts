/**
 * Demo-mode persona session.
 *
 * The hackathon build uses a polished role-switching demo mode with two
 * seeded personas (voice owner / organization requester) instead of full
 * Supabase auth. The active persona lives in an httpOnly cookie and every
 * server action authorizes against it server-side — the browser only ever
 * chooses WHICH seeded persona to act as, never what that persona may do.
 */
import { cookies } from "next/headers";
import { DEMO_IDS } from "@/domain/fixtures";
import type { Organization, Profile } from "@/domain/types";
import { getStore } from "@/server/data";

const ROLE_COOKIE = "mithaq_role";

export type SessionRole = "owner" | "requester";

export type Session = {
  role: SessionRole;
  profile: Profile;
  organization: Organization | null;
};

export async function getSessionRole(): Promise<SessionRole> {
  const store = await cookies();
  const value = store.get(ROLE_COOKIE)?.value;
  return value === "owner" ? "owner" : "requester";
}

export async function setSessionRole(role: SessionRole): Promise<void> {
  const store = await cookies();
  store.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session> {
  const role = await getSessionRole();
  const store = getStore();
  const profileId = role === "owner" ? DEMO_IDS.owner : DEMO_IDS.requester;
  const profile = await store.getProfile(profileId);
  if (!profile) throw new Error("Demo persona missing from store");
  const organization =
    role === "requester"
      ? await store.getOrganizationForProfile(profileId)
      : null;
  return { role, profile, organization };
}

export async function requireOwnerSession(): Promise<Session> {
  const session = await getSession();
  if (session.role !== "owner") {
    throw new Error("This action requires the voice-owner role");
  }
  return session;
}

export async function requireRequesterSession(): Promise<
  Session & { organization: Organization }
> {
  const session = await getSession();
  if (session.role !== "requester" || !session.organization) {
    throw new Error("This action requires the organization-requester role");
  }
  return session as Session & { organization: Organization };
}
