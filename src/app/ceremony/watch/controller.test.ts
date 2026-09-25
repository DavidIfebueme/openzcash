import { describe, expect, it } from "vitest";
import { createController, type MediaLike } from "./controller";

/** A media element stand-in: records calls, loads on demand. */
class FakeMedia implements MediaLike {
  calls: string[] = [];
  currentTime = 0;
  paused = true;
  muted = false;
  readyState = 0;
  private _src = "";
  constructor(private readonly name: string) {}
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    this.readyState = 0;
    this.currentTime = 0;
    this.paused = true;
    this.calls.push(`${this.name}.src=${v}`);
  }
  play() {
    this.paused = false;
    this.calls.push(`${this.name}.play`);
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
    this.calls.push(`${this.name}.pause`);
  }
  /** What the browser does once metadata arrives. */
  load() {
    this.readyState = 1;
  }
}

function setup() {
  const video = new FakeMedia("video");
  const audio = new FakeMedia("audio");
  video.src = "cam3";
  audio.src = "zooko";
  video.calls = [];
  audio.calls = [];
  const c = createController({ video: { current: video }, audio: { current: audio } });
  return { video, audio, c };
}

describe("ceremony player controller", () => {
  it("switches camera while playing, plays in the click and lands on the same moment", () => {
    const { video, c } = setup();
    video.readyState = 1;
    video.currentTime = 600;
    video.paused = false;
    c.chooseView("cam2");
    expect(video.src).toBe("cam2");
    expect(video.calls.at(-1)).toBe("video.play");
    video.load();
    c.loaded("video");
    expect(video.currentTime).toBe(600);
    expect(video.paused).toBe(false);
  });

  it("switches camera while paused without starting playback", () => {
    const { video, c } = setup();
    video.readyState = 1;
    video.currentTime = 300;
    c.chooseView("cam1");
    expect(video.calls).not.toContain("video.play");
    video.load();
    c.loaded("video");
    expect(video.currentTime).toBe(300);
    expect(video.paused).toBe(true);
  });

  it("changes microphone in listen-only mode without losing the place", () => {
    const { audio, c } = setup();
    c.toggleListenOnly();
    audio.readyState = 1;
    audio.currentTime = 900;
    audio.paused = false;
    c.chooseMic("morgen");
    expect(audio.src).toBe("morgen");
    expect(audio.calls.at(-1)).toBe("audio.play");
    audio.load();
    c.loaded("audio");
    expect(audio.currentTime).toBe(900);
    expect(audio.paused).toBe(false);
  });

  it("carries the moment into listen-only and back, playing inside the click", () => {
    const { video, audio, c } = setup();
    video.readyState = 1;
    video.currentTime = 1200;
    video.paused = false;
    c.toggleListenOnly();
    expect(video.paused).toBe(true);
    expect(audio.calls.at(-1)).toBe("audio.play");
    audio.load();
    c.loaded("audio");
    expect(audio.currentTime).toBe(1200);
    audio.currentTime = 1230;
    c.toggleListenOnly();
    expect(audio.paused).toBe(true);
    expect(video.currentTime).toBe(1230);
    expect(video.calls.at(-1)).toBe("video.play");
  });

  it("seeks before anything has loaded, then lands on the part", () => {
    const { video, c } = setup();
    c.seek(613);
    expect(video.calls.at(-1)).toBe("video.play");
    video.load();
    c.loaded("video");
    expect(video.currentTime).toBe(613);
  });

  it("mutes the camera for a microphone and unlocks the audio inside the click", () => {
    const { video, audio, c } = setup();
    c.chooseMic("computer");
    expect(video.muted).toBe(true);
    expect(audio.src).toBe("computer");
    expect(audio.calls.slice(-2)).toEqual(["audio.play", "audio.pause"]);
    c.chooseCameraSound();
    expect(video.muted).toBe(false);
  });

  it("keeps a microphone in step with the video", () => {
    const { video, audio, c } = setup();
    c.chooseMic("zooko");
    audio.readyState = 1;
    video.readyState = 1;
    video.paused = false;
    video.currentTime = 50;
    audio.currentTime = 49;
    c.follow();
    expect(audio.currentTime).toBe(50);
    expect(audio.paused).toBe(false);
    video.paused = true;
    c.follow();
    expect(audio.paused).toBe(true);
  });
});
