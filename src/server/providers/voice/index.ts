import { getEnv } from "@/server/env";
import type { VoiceGenerationProvider } from "./types";
import { MockVoiceProvider } from "./mock";
import { ElevenLabsVoiceProvider } from "./elevenlabs";

let cached: VoiceGenerationProvider | null = null;

export function getVoiceProvider(): VoiceGenerationProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.voiceProvider === "elevenlabs" && env.elevenLabsApiKey) {
    cached = new ElevenLabsVoiceProvider({
      apiKey: env.elevenLabsApiKey,
      defaultVoiceId: env.elevenLabsDefaultVoiceId,
    });
  } else {
    cached = new MockVoiceProvider();
  }
  return cached;
}

export type { VoiceGenerationProvider } from "./types";
