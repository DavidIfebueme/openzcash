import { zarvisConfig } from "@/lib/zarvis/config";
import { sameOrigin } from "@/lib/zarvis/validation";
import { readBoundedBytes } from "@/lib/zarvis/request-body";
import { reserveVoiceRequest } from "@/lib/zarvis/usage";
import { queueDaily, spendTodayUsd } from "@/lib/zarvis/metrics-store";
import { MAX_AUDIO_BYTES, TranscriptionFailure, VOICE_LIMITS, audioType, transcribeAudio, voiceConfig, voiceUsd } from "@/lib/zarvis/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const fail = (error: string, status: number, extra = {}) => Response.json({ error }, { status, headers: { ...headers, ...extra } });
const FAILED = "Zarvis could not turn that recording into text. Please try again or type your question.";
const TOO_LONG = "That recording is too long. Keep it under one minute.";

type VoiceOutcome = "completed" | "failed" | "aborted" | "empty" | "quota" | "spend_cap" | "invalid" | "forbidden" | "disabled" | "storage";
/** One line per recording: outcome, timing, length and detected language. The audio and the transcript never reach the log. */
function logVoice(outcome: VoiceOutcome, ms: number, extra: { audioSeconds?: number; lang?: string | null; estimatedUsd?: number; errorClass?: string } = {}) {
  console.info(JSON.stringify({ event: "zarvis.voice", at: new Date().toISOString(), outcome, ms: Math.round(ms), ...extra }));
}

export async function POST(request: Request) {
  const started = performance.now();
  const elapsed = () => performance.now() - started;
  if (!sameOrigin(request)) { logVoice("forbidden", elapsed()); return fail("Please open Zarvis on OpenZcash to dictate a question.", 403); }
  const config = zarvisConfig();
  const voice = voiceConfig();
  if (!config.enabled || !voice.enabled) { logVoice("disabled", elapsed()); return fail("Voice input is not available right now. You can still type your question.", 503); }
  const type = audioType(request.headers.get("content-type"));
  if (!type) { logVoice("invalid", elapsed()); return fail("Send a short audio recording.", 415); }
  // Transcription is paid usage too: over the daily estimated-spend ceiling it stops with the model answers.
  if (typeof config.dailyUsdCap === "number" && spendTodayUsd() >= config.dailyUsdCap) {
    queueDaily("voice", { spendCap: 1 }); logVoice("spend_cap", elapsed());
    return fail("Voice input has reached today's limit. You can still type your question.", 429, { "Retry-After": "3600" });
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try { bytes = await readBoundedBytes(request, MAX_AUDIO_BYTES); }
  catch (error) {
    logVoice("invalid", elapsed());
    return error instanceof Error && error.message === "BODY_TOO_LARGE" ? fail(TOO_LONG, 413) : fail(FAILED, 400);
  }
  if (bytes.byteLength < 500) { logVoice("empty", elapsed()); return fail("That recording was too short. Tap the microphone and speak your question.", 422); }
  let refund: (() => Promise<boolean>) | undefined;
  try {
    const allowance = await reserveVoiceRequest(request.headers, VOICE_LIMITS);
    if (!allowance.allowed) {
      queueDaily("voice", { quota: 1 }); logVoice("quota", elapsed());
      return fail("Voice input has reached its limit for now. You can still type your question.", 429, { "Retry-After": String(allowance.retryAfter) });
    }
    refund = allowance.refund;
  } catch { logVoice("storage", elapsed()); return fail("Voice input is temporarily unavailable. You can still type your question.", 503); }
  try {
    const transcript = await transcribeAudio(new Blob([bytes], { type }), voice, request.signal);
    const estimatedUsd = voiceUsd(transcript.audioSeconds);
    queueDaily("voice", { completed: 1, estimatedUsd, latencyMs: elapsed() });
    logVoice("completed", elapsed(), { audioSeconds: Math.round(transcript.audioSeconds * 10) / 10, lang: transcript.language, estimatedUsd });
    return Response.json({ text: transcript.text, language: transcript.language }, { headers });
  } catch (error) {
    const failure = error instanceof TranscriptionFailure ? error : new TranscriptionFailure("provider");
    const estimatedUsd = voiceUsd(failure.audioSeconds);
    // A failure on our side or the provider's gives the unit back; a recording that was transcribed (even to silence) keeps it.
    if (["provider", "timeout", "aborted"].includes(failure.errorClass) && refund) void refund();
    if (failure.errorClass === "aborted") { queueDaily("voice", { aborted: 1, estimatedUsd }); logVoice("aborted", elapsed()); return fail("Transcription stopped.", 499); }
    if (failure.errorClass === "empty") {
      queueDaily("voice", { completed: 1, estimatedUsd, latencyMs: elapsed() }); logVoice("empty", elapsed(), { audioSeconds: failure.audioSeconds, estimatedUsd });
      return fail("Zarvis could not hear a question in that recording. Try again a little closer to the microphone.", 422);
    }
    queueDaily("voice", { failed: 1, estimatedUsd }); logVoice("failed", elapsed(), { errorClass: failure.errorClass, estimatedUsd });
    return failure.errorClass === "too_long" ? fail(TOO_LONG, 413) : fail(FAILED, 502);
  }
}
