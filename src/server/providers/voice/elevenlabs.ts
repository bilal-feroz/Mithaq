/**
 * ElevenLabsVoiceProvider — real text-to-speech, used only when
 * VOICE_PROVIDER=elevenlabs and ELEVENLABS_API_KEY are configured.
 * The API key lives exclusively in this server module.
 */
import type { VoiceGenerationProvider } from "./types";

const DEFAULT_MODEL = "eleven_multilingual_v2";

export class ElevenLabsVoiceProvider implements VoiceGenerationProvider {
  name = "elevenlabs";
  model = DEFAULT_MODEL;

  constructor(
    private readonly config: {
      apiKey: string;
      defaultVoiceId: string | null;
    },
  ) {}

  async generate(input: {
    voiceId: string;
    script: string;
    language: string;
    model?: string;
  }): Promise<{ audioBuffer: Buffer; mimeType: string; providerAssetId?: string }> {
    const providerVoiceId = this.config.defaultVoiceId ?? input.voiceId;
    const model = input.model ?? DEFAULT_MODEL;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.config.apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: input.script,
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `ElevenLabs generation failed (${response.status}): ${detail.slice(0, 300)}`,
      );
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBuffer,
      mimeType: "audio/mpeg",
      providerAssetId: response.headers.get("request-id") ?? undefined,
    };
  }
}
