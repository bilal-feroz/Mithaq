/**
 * Store selection. Demo mode (no Supabase credentials) → LocalStore.
 * With Supabase configured → SupabaseStore (see supabase-store.ts and
 * supabase/migrations for the schema + RLS).
 *
 * The instance is cached on globalThis so all server entry points in one
 * process (server components, server actions, route handlers) share state,
 * including across dev-server hot reloads.
 */
import { getEnv } from "@/server/env";
import type { DataStore } from "./types";
import { LocalStore } from "./local-store";

const globalRef = globalThis as unknown as {
  __mithaqStore?: DataStore;
};

export function getStore(): DataStore {
  if (globalRef.__mithaqStore) return globalRef.__mithaqStore;
  const env = getEnv();
  if (env.supabase) {
    // Lazy import keeps @supabase/supabase-js out of the demo-mode bundle.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SupabaseStore } = require("./supabase-store") as {
      SupabaseStore: new (config: {
        url: string;
        serviceRoleKey: string;
      }) => DataStore;
    };
    globalRef.__mithaqStore = new SupabaseStore({
      url: env.supabase.url,
      serviceRoleKey: env.supabase.serviceRoleKey,
    });
  } else {
    globalRef.__mithaqStore = new LocalStore();
  }
  return globalRef.__mithaqStore;
}
