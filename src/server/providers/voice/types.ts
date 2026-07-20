export interface VoiceGenerationProvider {
  /** Stable provider name recorded in decisions, tokens and assets. */
  name: string;
  /** Model identifier bound into the decision token. */
  model: string;

  generate(input: {
    voiceId: string;
    script: string;
    language: string;
    model?: string;
  }): Promise<{
    audioBuffer: Buffer;
    mimeType: string;
    providerAssetId?: string;
  }>;
}
