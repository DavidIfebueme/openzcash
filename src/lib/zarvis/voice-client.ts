import { MAX_QUESTION_LENGTH } from "./context";

/** Browser side of dictation: pure helpers the recording hook and its tests share. */
export const MAX_RECORDING_SECONDS = 60;
export const MIN_RECORDING_MS = 700;
export const LEVEL_SAMPLES = 40;
/** In order of preference: Opus where the browser records it (Chrome, Firefox, Android), AAC in MP4 on Safari and iOS. */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && typeof MediaRecorder !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}
export function recordingType(isSupported: (type: string) => boolean = (type) => MediaRecorder.isTypeSupported(type)): string | undefined {
  return RECORDING_TYPES.find((type) => { try { return isSupported(type); } catch { return false; } });
}
/** A dictated question joins whatever is already typed instead of replacing it. */
export function mergeTranscript(draft: string, text: string): string {
  const spoken = text.trim();
  if (!spoken) return draft;
  return (draft.trim() ? `${draft.trimEnd()} ${spoken}` : spoken).slice(0, MAX_QUESTION_LENGTH);
}
export const clockLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
/** Fixed, actionable messages for the ways a microphone fails to start; the browser's own text is never shown. */
export function microphoneError(error: unknown): string {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is blocked for this site. Allow it in your browser's site settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found. Connect one, or type your question.";
  if (name === "NotReadableError" || name === "AbortError") return "Another app is using the microphone. Close it and try again.";
  return "The microphone could not start. Please try again, or type your question.";
}
/** Root-mean-square loudness of one analyser frame, scaled to 0–1 so quiet speech still moves the meter. */
export function frameLevel(samples: Uint8Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const sample of samples) { const centred = (sample - 128) / 128; sum += centred * centred; }
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}
