/**
 * The ceremony player's logic, kept apart from React so every transition is
 * tested. Handlers run inside the click that triggered them, so play() stays
 * within the user gesture that browsers (Safari and iOS in particular) require
 * before sound can start.
 *
 * Two elements are always mounted: the video (one camera at a time) and an
 * audio element (one microphone). In video mode the camera plays its own
 * sound, or a microphone plays in step with the muted video. In listen-only
 * mode only the audio element plays.
 */
export type MediaLike = {
  currentTime: number;
  paused: boolean;
  muted: boolean;
  readyState: number;
  src: string;
  play(): Promise<void>;
  pause(): void;
};

type Which = "video" | "audio";
type Pending = { t: number; play: boolean };

/** Drift between a microphone and the video before we resync. */
export const MAX_DRIFT_S = 0.35;

/** A ref-like holder, read only when a handler runs. */
export type Holder = { readonly current: MediaLike | null };

export function createController(els: { video: Holder; audio: Holder }) {
  let listenOnly = false;
  /** The microphone playing with the video; null means the camera's own sound. */
  let mic: string | null = null;
  const pending: Record<Which, Pending | null> = { video: null, audio: null };

  const start = (el: MediaLike) => {
    void el.play().catch(() => {});
  };

  /** Put `el` at `t`, now if it has loaded, otherwise once it does. */
  const place = (which: Which, el: MediaLike, t: number, play: boolean) => {
    if (el.readyState >= 1) {
      el.currentTime = t;
      pending[which] = null;
    } else if (t > 0 || play) {
      pending[which] = { t, play };
    }
    if (play) start(el);
  };

  return {
    get listenOnly() {
      return listenOnly;
    },

    /** Call from the element's loadedmetadata event. */
    loaded(which: Which) {
      const el = which === "video" ? els.video.current : els.audio.current;
      const p = pending[which];
      if (!el || !p) return;
      pending[which] = null;
      el.currentTime = p.t;
      if (p.play && el.paused) start(el);
    },

    chooseView(url: string) {
      const v = els.video.current;
      if (!v || v.src === url) return;
      const t = v.currentTime;
      const play = !v.paused && !listenOnly;
      v.src = url;
      place("video", v, t, play);
    },

    chooseMic(url: string) {
      const v = els.video.current;
      const a = els.audio.current;
      if (!a) return;
      if (listenOnly) {
        const t = a.currentTime;
        const play = !a.paused;
        if (a.src !== url) a.src = url;
        place("audio", a, t, play);
        mic = url;
        return;
      }
      mic = url;
      if (v) v.muted = true;
      if (a.src !== url) a.src = url;
      if (v && !v.paused) {
        place("audio", a, v.currentTime, true);
      } else {
        // Unlock the element inside the click so later plays are allowed.
        void a.play().catch(() => {});
        a.pause();
        if (v) place("audio", a, v.currentTime, false);
      }
    },

    chooseCameraSound() {
      mic = null;
      const v = els.video.current;
      if (v) v.muted = false;
      els.audio.current?.pause();
    },

    toggleListenOnly() {
      const v = els.video.current;
      const a = els.audio.current;
      if (!v || !a) return;
      if (!listenOnly) {
        const t = v.currentTime;
        const play = !v.paused;
        v.pause();
        listenOnly = true;
        place("audio", a, t, play);
        return;
      }
      const t = a.currentTime;
      const play = !a.paused;
      a.pause();
      listenOnly = false;
      v.muted = mic !== null;
      place("video", v, t, play);
      if (play && mic !== null) start(a);
    },

    seek(t: number) {
      const v = els.video.current;
      const a = els.audio.current;
      if (listenOnly) {
        if (a) place("audio", a, t, true);
        return;
      }
      if (!v) return;
      place("video", v, t, true);
      if (mic !== null && a) place("audio", a, t, true);
    },

    /** Keep a microphone in step; call on the video's play, pause, seeked and timeupdate. */
    follow() {
      const v = els.video.current;
      const a = els.audio.current;
      if (listenOnly || mic === null || !v || !a) return;
      if (
        a.readyState >= 1 &&
        Math.abs(a.currentTime - v.currentTime) > MAX_DRIFT_S
      ) {
        a.currentTime = v.currentTime;
      }
      if (v.paused) {
        if (!a.paused) a.pause();
      } else if (a.paused) {
        if (a.readyState < 1) pending.audio = { t: v.currentTime, play: true };
        start(a);
      }
    },
  };
}

export type PlayerController = ReturnType<typeof createController>;
