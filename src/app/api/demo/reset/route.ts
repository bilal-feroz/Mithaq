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
  return NextResponse.json({ ok: true });
}
