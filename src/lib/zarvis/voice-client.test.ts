import { describe, expect, it } from "vitest";
import { clockLabel, frameLevel, mergeTranscript, microphoneError, recordingType } from "./voice-client";
import { usageBuckets } from "./limits";

describe("Dictation helpers", () => {
  it("prefers Opus, falls back to MP4 for Safari, and survives a browser that throws", () => {
    expect(recordingType(() => true)).toBe("audio/webm;codecs=opus");
    expect(recordingType((type) => type === "audio/mp4")).toBe("audio/mp4");
    expect(recordingType(() => { throw new Error("no"); })).toBeUndefined();
  });
  it("adds the transcript after what is already typed, within the question limit", () => {
    expect(mergeTranscript("", "  How does Orchard work? ")).toBe("How does Orchard work?");
    expect(mergeTranscript("Compare with Sapling:  ", "and Orchard")).toBe("Compare with Sapling: and Orchard");
    expect(mergeTranscript("kept", "   ")).toBe("kept");
    expect(mergeTranscript("a".repeat(1_995), "more words here")).toHaveLength(2_000);
  });
  it("names each microphone failure with a way forward", () => {
    expect(microphoneError(new DOMException("denied", "NotAllowedError"))).toMatch(/site settings/);
    expect(microphoneError(new DOMException("none", "NotFoundError"))).toMatch(/No microphone/);
    expect(microphoneError(new DOMException("busy", "NotReadableError"))).toMatch(/Another app/);
    expect(microphoneError("weird")).toMatch(/could not start/);
  });
  it("formats the timer and measures loudness", () => {
    expect(clockLabel(7)).toBe("0:07"); expect(clockLabel(60)).toBe("1:00");
    expect(frameLevel(new Uint8Array(64).fill(128))).toBe(0);
    expect(frameLevel(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 160 : 96)))).toBeGreaterThan(0.5);
  });
  it("counts dictation under its own keys so it never spends the chat quota", () => {
    const limits = { dailyLimit: 1, hourlyLimit: 1, networkDailyLimit: 1, networkWindowLimit: 1 };
    const chat = usageBuckets("203.0.113.9", "k", 0, limits).map((b) => b.key);
    const voice = usageBuckets("203.0.113.9", "k", 0, limits, "voice").map((b) => b.key);
    expect(chat[0]).toBe("global:day:0");
    expect(voice.every((key) => key.startsWith("voice:"))).toBe(true);
    expect(voice.some((key) => chat.includes(key))).toBe(false);
  });
});
