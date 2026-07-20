/**
 * Server environment validation. Parsed once, lazily.
 *
 * MITHAQ boots in DEMO MODE with a completely empty environment:
 *  - local in-process store (Supabase optional)
 *  - mock extraction adapter, mock voice provider
 *  - an ephemeral, per-boot decision-token secret (with a logged warning)
 *
 * Misconfiguration fails loudly: choosing a real provider without its key
 * throws at startup rather than silently degrading.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  DECISION_TOKEN_SECRET: z.string().min(32).optional().or(z.literal("").transform(() => undefined)),

  AI_PROVIDER: z.enum(["mock", "anthropic", "openai"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  VOICE_PROVIDER: z.enum(["mock", "elevenlabs"]).default("mock"),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),
});

export type MithaqEnv = {
  nodeEnv: "development" | "test" | "production";
  appUrl: string;

  supabase: { url: string; anonKey: string; serviceRoleKey: string } | null;

  decisionTokenSecret: string;
  /** True when the secret was generated per-boot instead of provided. */
  ephemeralTokenSecret: boolean;

  aiProvider: "mock" | "anthropic" | "openai";
  anthropicApiKey: string | null;
  openaiApiKey: string | null;

  voiceProvider: "mock" | "elevenlabs";
  elevenLabsApiKey: string | null;
  elevenLabsDefaultVoiceId: string | null;

  /** Demo mode: no Supabase configured → local in-process store. */
  demoMode: boolean;
};

let cached: MithaqEnv | null = null;

export function getEnv(): MithaqEnv {
  if (cached) return cached;

  const parsed = rawEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  const raw = parsed.data;

  const supabase =
    raw.NEXT_PUBLIC_SUPABASE_URL && raw.SUPABASE_SERVICE_ROLE_KEY
      ? {
          url: raw.NEXT_PUBLIC_SUPABASE_URL,
          anonKey: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          serviceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY,
        }
      : null;

  if (raw.VOICE_PROVIDER === "elevenlabs" && !raw.ELEVENLABS_API_KEY) {
    throw new Error(
      "VOICE_PROVIDER=elevenlabs requires ELEVENLABS_API_KEY. Remove the setting to fall back to the mock provider.",
    );
  }
  if (raw.AI_PROVIDER === "anthropic" && !raw.ANTHROPIC_API_KEY) {
    throw new Error(
      "AI_PROVIDER=anthropic requires ANTHROPIC_API_KEY. Remove the setting to fall back to the mock adapter.",
    );
  }
  if (raw.AI_PROVIDER === "openai" && !raw.OPENAI_API_KEY) {
    throw new Error(
      "AI_PROVIDER=openai requires OPENAI_API_KEY. Remove the setting to fall back to the mock adapter.",
    );
  }

  let decisionTokenSecret = raw.DECISION_TOKEN_SECRET ?? null;
  let ephemeralTokenSecret = false;
  if (!decisionTokenSecret) {
    decisionTokenSecret = randomBytes(48).toString("base64url");
    ephemeralTokenSecret = true;
    // Tokens are 60-second single-use and never leave the server, so an
    // ephemeral per-boot secret is acceptable for demo mode only.
    console.warn(
      "[mithaq] DECISION_TOKEN_SECRET not set — using an ephemeral per-boot secret (demo mode). Set a strong secret for any real deployment.",
    );
  }

  cached = {
    nodeEnv: raw.NODE_ENV,
    appUrl: raw.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    supabase,
    decisionTokenSecret,
    ephemeralTokenSecret,
    aiProvider: raw.AI_PROVIDER,
    anthropicApiKey: raw.ANTHROPIC_API_KEY ?? null,
    openaiApiKey: raw.OPENAI_API_KEY ?? null,
    voiceProvider: raw.VOICE_PROVIDER,
    elevenLabsApiKey: raw.ELEVENLABS_API_KEY ?? null,
    elevenLabsDefaultVoiceId: raw.ELEVENLABS_DEFAULT_VOICE_ID ?? null,
    demoMode: supabase === null,
  };
  return cached;
}
