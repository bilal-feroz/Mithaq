import { getEnv } from "@/server/env";
import type { ConsentExtractionAdapter } from "./types";
import { MockExtractionAdapter } from "./mock";

let cached: ConsentExtractionAdapter | null = null;

export function getExtractionAdapter(): ConsentExtractionAdapter {
  if (cached) return cached;
  const env = getEnv();
  if (env.aiProvider === "anthropic" && env.anthropicApiKey) {
    // Lazy import keeps the SDK out of mock-mode module graphs.
    const { AnthropicExtractionAdapter } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("./anthropic") as typeof import("./anthropic");
    cached = new AnthropicExtractionAdapter(env.anthropicApiKey);
  } else {
    cached = new MockExtractionAdapter();
  }
  return cached;
}

export type { ConsentExtractionAdapter } from "./types";
