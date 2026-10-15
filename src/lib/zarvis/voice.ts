import "server-only";
import { MAX_QUESTION_LENGTH } from "./context";

/** Dictation: a short recording becomes the text of a question. ElevenLabs Scribe transcribes; nothing here keeps the audio or the text. */
/** A minute of mono speech at the 64 kbps the browser is asked for is about 0.5 MB; 2 MB leaves room for browsers that ignore it. */
export const MAX_AUDIO_BYTES = 2_000_000;
export const MAX_AUDIO_SECONDS = 60;
const STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const STT_TIMEOUT_MS = 25_000;
/** Scribe v2 batch list price ($0.22 per hour) plus the 20% keyterm surcharge, for the daily spend estimate. */
const USD_PER_AUDIO_SECOND = (0.22 * 1.2) / 3_600;
/** Accepted container types: what MediaRecorder produces on Chrome, Firefox, Safari and the phone browsers. */
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/mpeg",
  "audio/aac",
  "audio/x-m4a",
  "audio/wav",
]);
/** Words Zcash people say that a general model would mishear; each under 50 characters and 5 words, fewer than 100 in all. */
export const VOICE_KEYTERMS = [
  "Zcash",
  "ZEC",
  "Zarvis",
  "OpenZcash",
  "Zallet",
  "Zebra",
  "zebrad",
  "Zashi",
  "ZODL",
  "Ywallet",
  "Zingo",
  "lightwalletd",
  "Orchard",
  "Sapling",
  "Sprout",
  "shielded",
  "unified address",
  "viewing key",
  "Halo 2",
  "FROST",
  "ZIP",
  "NU7",
  "Crosslink",
  "Tachyon",
  "Zcash Community Grants",
  "ZCG",
  "Coinholder Grants",
  "coinholders",
  "Zcash Foundation",
  "Electric Coin Company",
  "ECC",
  "Shielded Labs",
  "Zakura",
  "ZecHub",
  "dev fund",
  "lockbox",
  "halving",
  "Zooko",
  "NEAR Intents",
  "Maya",
];

/**
 * Dictation counters, separate from the chat quota: generous for one person, tight enough that a script cannot run up the bill.
 * The 60-second limit is only known after Scribe has measured the audio, so a low-bitrate file at the byte limit could run long;
 * these counts and the daily USD cap bound that exposure.
 */
export const VOICE_LIMITS = {
  dailyLimit: 300,
  hourlyLimit: 100,
  networkDailyLimit: 30,
  networkWindowLimit: 10,
};

export type VoiceConfig = { enabled: boolean; apiKey: string; model: string };
export function voiceConfig(): VoiceConfig {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim() ?? "";
  return {
    enabled: process.env.ZARVIS_VOICE !== "false" && Boolean(apiKey),
    apiKey,
    model: process.env.ZARVIS_STT_MODEL?.trim() || "scribe_v2",
  };
}

/** The container type without codec parameters, or null when it is not audio this route accepts. */
export function audioType(contentType: string | null): string | null {
  const base = (contentType ?? "").split(";")[0].trim().toLowerCase();
  return AUDIO_TYPES.has(base) ? base : null;
}

export const voiceUsd = (seconds: number) =>
  Math.max(0, seconds) * USD_PER_AUDIO_SECOND;

export class TranscriptionFailure extends Error {
  constructor(
    readonly errorClass:
      "provider" | "timeout" | "aborted" | "empty" | "too_long",
    readonly audioSeconds = 0,
  ) {
    super(errorClass);
  }
}
export type Transcript = {
  text: string;
  language: string | null;
  audioSeconds: number;
};

/** Sends one recording to Scribe and returns its text. Only a fixed error class leaves this function, never the provider's message. */
export async function transcribeAudio(
  audio: Blob,
  config: VoiceConfig,
  signal: AbortSignal,
): Promise<Transcript> {
  const form = new FormData();
  form.set("model_id", config.model);
  form.set("file", audio, `question.${audio.type.split("/")[1] ?? "webm"}`);
  form.set("tag_audio_events", "false");
  form.set("no_verbatim", "true");
  for (const term of VOICE_KEYTERMS) form.append("keyterms", term);
  const deadline = AbortSignal.timeout(STT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(STT_URL, {
      method: "POST",
      headers: { "xi-api-key": config.apiKey },
      body: form,
      signal: AbortSignal.any([signal, deadline]),
    });
  } catch {
    throw new TranscriptionFailure(
      signal.aborted ? "aborted" : deadline.aborted ? "timeout" : "provider",
    );
  }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {});
    throw new TranscriptionFailure("provider");
  }
  const data: unknown = await response.json().catch(() => null);
  const record = (data && typeof data === "object" ? data : {}) as Record<
    string,
    unknown
  >;
  const audioSeconds =
    typeof record.audio_duration_secs === "number" &&
    Number.isFinite(record.audio_duration_secs)
      ? record.audio_duration_secs
      : 0;
  if (audioSeconds > MAX_AUDIO_SECONDS + 15)
    throw new TranscriptionFailure("too_long", audioSeconds);
  const text =
    typeof record.text === "string"
      ? record.text.replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION_LENGTH)
      : "";
  if (!text) throw new TranscriptionFailure("empty", audioSeconds);
  return {
    text,
    language:
      typeof record.language_code === "string"
        ? record.language_code.slice(0, 8)
        : null,
    audioSeconds,
  };
}
