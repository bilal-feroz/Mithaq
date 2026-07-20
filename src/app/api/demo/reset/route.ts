import { NextResponse } from "next/server";
import { getStore } from "@/server/data";
import { getEnv } from "@/server/env";

/** Reseeds the in-process demo store. Demo mode only. Used by the E2E suite. */
export async function POST() {
  const env = getEnv();
  if (!env.demoMode) {
    return NextResponse.json(
      { error: "Demo reset is only available in demo mode" },
      { status: 403 },
    );
  }
  await getStore().reset();
  const response = NextResponse.json({ ok: true });
  response.cookies.set("mithaq_role", "owner", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
