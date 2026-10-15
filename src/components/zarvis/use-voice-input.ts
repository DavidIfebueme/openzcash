"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LEVEL_SAMPLES, MAX_RECORDING_SECONDS, MIN_RECORDING_MS, frameLevel, microphoneError, recordingType, voiceSupported } from "@/lib/zarvis/voice-client";
import { retryHint } from "./zarvis-provider";

export type VoicePhase = "idle" | "starting" | "recording" | "transcribing";
export type VoiceInput = {
  supported: boolean; phase: VoicePhase; seconds: number; levels: number[]; error: string | null; retryable: boolean;
  start: () => void; stop: () => void; cancel: () => void; dismiss: () => void;
};
type Session = {
  stream: MediaStream | null; recorder: MediaRecorder | null; audio: AudioContext | null; chunks: Blob[];
  startedAt: number; discard: boolean; timer: ReturnType<typeof setInterval> | null; frame: number; upload: AbortController | null;
};
const quiet = () => Array<number>(LEVEL_SAMPLES).fill(0);
const noSubscription = () => () => {};

/** Tap to record, tap to stop: the recording goes to /api/zarvis/transcribe and the text is handed to `onTranscript`. Nothing is sent to Zarvis itself. */
export function useVoiceInput(onTranscript: (text: string) => void): VoiceInput {
  // Read after hydration; the server render never shows the button.
  const supported = useSyncExternalStore(noSubscription, voiceSupported, () => false);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(quiet);
  const [error, setError] = useState<string | null>(null);
  // A usage limit is not fixed by recording again, so that message offers no retry.
  const [retryable, setRetryable] = useState(true);
  const session = useRef<Session | null>(null);
  const deliver = useRef(onTranscript);
  useEffect(() => { deliver.current = onTranscript; }, [onTranscript]);

  const quietMeter = useCallback((current: Session) => {
    if (current.timer) clearInterval(current.timer);
    cancelAnimationFrame(current.frame);
    current.timer = null;
  }, []);
  /** Turns the microphone off (the browser's recording indicator goes away) and stops the meter. */
  const release = useCallback((current: Session) => {
    quietMeter(current);
    current.stream?.getTracks().forEach((track) => track.stop());
    void current.audio?.close().catch(() => {});
    current.stream = null; current.audio = null;
  }, [quietMeter]);

  const upload = useCallback(async (current: Session, recording: Blob) => {
    const controller = new AbortController(); current.upload = controller;
    try {
      const response = await fetch("/api/zarvis/transcribe", { method: "POST", headers: { "Content-Type": recording.type || "audio/webm" }, body: recording, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (session.current !== current) return;
      if (!response.ok) {
        const wait = response.status === 429 ? Number(response.headers.get("retry-after")) : NaN;
        setRetryable(response.status !== 429);
        throw new Error(`${data.error ?? "Zarvis could not turn that recording into text. Please try again."}${Number.isFinite(wait) && wait > 0 ? ` ${retryHint(wait)}` : ""}`);
      }
      if (typeof data.text === "string" && data.text.trim()) deliver.current(data.text);
    } catch (e) {
      if (session.current !== current || controller.signal.aborted) return;
      setError(e instanceof TypeError ? "The recording could not be sent. Check your connection and try again." : e instanceof Error ? e.message : "Zarvis could not turn that recording into text. Please try again.");
    } finally {
      if (session.current === current) { session.current = null; setPhase("idle"); }
    }
  }, []);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current?.recorder || current.recorder.state === "inactive") return;
    if (performance.now() - current.startedAt < MIN_RECORDING_MS) {
      current.discard = true; setError("That was too short. Tap the microphone, speak your question, then tap stop.");
    }
    // The tracks stay open until the recorder's last chunk arrives (Safari would cut it short); onstop releases them.
    quietMeter(current);
    current.recorder.stop();
  }, [quietMeter]);

  const cancel = useCallback(() => {
    const current = session.current;
    if (!current) return;
    current.discard = true;
    current.upload?.abort();
    if (current.recorder && current.recorder.state !== "inactive") current.recorder.stop();
    release(current);
    session.current = null; setPhase("idle"); setLevels(quiet());
  }, [release]);

  const start = useCallback(() => {
    if (session.current || !voiceSupported()) return;
    setError(null); setRetryable(true); setSeconds(0); setLevels(quiet()); setPhase("starting");
    const current: Session = { stream: null, recorder: null, audio: null, chunks: [], startedAt: 0, discard: false, timer: null, frame: 0, upload: null };
    session.current = current;
    // Created inside the tap so Safari lets the meter run; it only ever reads the microphone's loudness.
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    try { current.audio = AudioContextClass ? new AudioContextClass() : null; void current.audio?.resume().catch(() => {}); } catch { current.audio = null; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }).then((stream) => {
      if (session.current !== current) { stream.getTracks().forEach((track) => track.stop()); return; }
      current.stream = stream;
      const type = recordingType();
      let recorder: MediaRecorder;
      try { recorder = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 64_000 }); }
      catch { recorder = new MediaRecorder(stream); }
      current.recorder = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) current.chunks.push(event.data); };
      recorder.onstop = () => {
        release(current);
        if (current.discard || session.current !== current) { if (session.current === current) { session.current = null; setPhase("idle"); } return; }
        setPhase("transcribing");
        void upload(current, new Blob(current.chunks, { type: recorder.mimeType || type || "audio/webm" }));
      };
      recorder.start(250);
      current.startedAt = performance.now();
      setPhase("recording");
      current.timer = setInterval(() => {
        const elapsed = (performance.now() - current.startedAt) / 1000;
        setSeconds(Math.min(MAX_RECORDING_SECONDS, Math.floor(elapsed)));
        if (elapsed >= MAX_RECORDING_SECONDS) stop();
      }, 250);
      // The meter is only feedback: if the browser refuses it, recording carries on with a flat meter.
      try {
        if (current.audio) {
          const analyser = current.audio.createAnalyser(); analyser.fftSize = 512;
          current.audio.createMediaStreamSource(stream).connect(analyser);
          const frame = new Uint8Array(analyser.fftSize);
          let last = 0;
          const sample = (now: number) => {
            if (session.current !== current || !current.timer) return;
            if (now - last > 80) { last = now; analyser.getByteTimeDomainData(frame); const level = frameLevel(frame); setLevels((all) => [...all.slice(1), level]); }
            current.frame = requestAnimationFrame(sample);
          };
          current.frame = requestAnimationFrame(sample);
        }
      } catch { /* no meter */ }
    }).catch((e) => {
      if (session.current !== current) return;
      release(current); session.current = null; setPhase("idle"); setError(microphoneError(e));
    });
  }, [release, stop, upload]);

  // Leaving the tab or locking the phone keeps what was said: the recording stops and is transcribed.
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [stop]);
  useEffect(() => {
    if (phase !== "recording" && phase !== "starting") return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); cancel(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [phase, cancel]);
  useEffect(() => () => {
    const current = session.current;
    if (!current) return;
    current.discard = true; current.upload?.abort();
    if (current.recorder && current.recorder.state !== "inactive") current.recorder.stop();
    release(current); session.current = null;
  }, [release]);

  return { supported, phase, seconds, levels, error, retryable, start, stop, cancel, dismiss: useCallback(() => setError(null), []) };
}
