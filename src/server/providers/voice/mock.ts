/**
 * MockVoiceProvider — the default, credential-free provider.
 *
 * It does NOT pretend to be ElevenLabs: it is surfaced in the UI as
 * "Demo provider" and recorded as provider "mock". It renders a real,
 * playable 16-bit PCM WAV: a deterministic melodic "voice-like" sequence
 * derived from the script hash, so the same script always yields the same
 * bytes (and therefore the same asset hash).
 */
import { hashScript, sha256Hex } from "@/domain/hash";
import type { VoiceGenerationProvider } from "./types";

const SAMPLE_RATE = 22050;

export class MockVoiceProvider implements VoiceGenerationProvider {
  name = "mock";
  model = "mithaq-demo-voice-1";

  async generate(input: {
    voiceId: string;
    script: string;
    language: string;
    model?: string;
  }): Promise<{
    audioBuffer: Buffer;
    mimeType: string;
    providerAssetId?: string;
  }> {
    const seedHex = sha256Hex(`${input.voiceId}:${hashScript(input.script)}`);
    const audioBuffer = renderVoiceLikeWav(seedHex, input.script.length);
    return {
      audioBuffer,
      mimeType: "audio/wav",
      providerAssetId: `mock-${seedHex.slice(0, 12)}`,
    };
  }
}

/** Deterministic PRNG over the seed hash bytes (mulberry32). */
function prngFromSeed(seedHex: string): () => number {
  let state = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function renderVoiceLikeWav(seedHex: string, scriptLength: number): Buffer {
  const random = prngFromSeed(seedHex);
  const durationSeconds = Math.min(2.8 + scriptLength * 0.02, 6.5);
  const totalSamples = Math.floor(durationSeconds * SAMPLE_RATE);
  const samples = new Float64Array(totalSamples);

  // Syllable sequence: short tonal bursts with harmonics and vibrato,
  // grouped into "words" separated by brief silences.
  const basePitch = 118 + random() * 46; // comfortable low register
  let cursor = Math.floor(0.12 * SAMPLE_RATE);
  let syllablesInWord = 0;
  let wordLength = 2 + Math.floor(random() * 3);

  while (cursor < totalSamples - SAMPLE_RATE * 0.25) {
    const syllableDuration = 0.1 + random() * 0.13;
    const syllableSamples = Math.floor(syllableDuration * SAMPLE_RATE);
    const pitch = basePitch * (0.82 + random() * 0.5);
    const vibratoRate = 4.5 + random() * 2;
    const brightness = 0.35 + random() * 0.4;

    for (let i = 0; i < syllableSamples && cursor + i < totalSamples; i += 1) {
      const t = i / SAMPLE_RATE;
      const progress = i / syllableSamples;
      // Attack-decay envelope shaped like a spoken syllable.
      const envelope =
        Math.min(1, progress / 0.18) * Math.pow(1 - progress, 0.55);
      const vibrato = 1 + 0.012 * Math.sin(2 * Math.PI * vibratoRate * t);
      const phase = 2 * Math.PI * pitch * vibrato * t;
      const wave =
        Math.sin(phase) +
        brightness * 0.55 * Math.sin(2 * phase) +
        brightness * 0.3 * Math.sin(3 * phase) +
        0.045 * (random() * 2 - 1); // breathiness
      samples[cursor + i]! += wave * envelope * 0.24;
    }

    cursor += syllableSamples;
    syllablesInWord += 1;
    if (syllablesInWord >= wordLength) {
      cursor += Math.floor((0.09 + random() * 0.12) * SAMPLE_RATE);
      syllablesInWord = 0;
      wordLength = 2 + Math.floor(random() * 3);
    } else {
      cursor += Math.floor(0.018 * SAMPLE_RATE);
    }
  }

  // Gentle global fade in/out to avoid clicks.
  const fade = Math.floor(0.05 * SAMPLE_RATE);
  for (let i = 0; i < fade; i += 1) {
    samples[i]! *= i / fade;
    samples[totalSamples - 1 - i]! *= i / fade;
  }

  return encodeWav(samples);
}

function encodeWav(samples: Float64Array): Buffer {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}
