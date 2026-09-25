"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clock, partAt, type Part } from "@/lib/ceremony/recordings";
import styles from "./player.module.css";

type ViewInfo = {
  id: string;
  label: string;
  shot: string;
  url: string;
  poster: string;
};
type MicInfo = { id: string; label: string; url: string };
/** "camera": the chosen camera's own sound; otherwise a microphone id. */
type Sound = "camera" | string;

type Props = {
  views: ViewInfo[];
  mics: MicInfo[];
  parts: Part[];
  partFrames: string[];
  videoMbPerMinute: number;
  audioMbPerMinute: number;
};

/** Drift between the muted video and a microphone track before we resync. */
const MAX_DRIFT_S = 0.35;

type Connection = { saveData?: boolean; effectiveType?: string };

const noSubscription = () => () => {};

function isSlowConnection(): boolean {
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  return Boolean(c && (c.saveData || ["slow-2g", "2g", "3g"].includes(c.effectiveType ?? "")));
}

export function CeremonyPlayer({
  views,
  mics,
  parts,
  partFrames,
  videoMbPerMinute,
  audioMbPerMinute,
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  /** Where to land once a newly chosen source has loaded. */
  const pending = useRef<{ t: number; play: boolean } | null>(null);

  const [viewId, setViewId] = useState(views[views.length - 1].id);
  const [sound, setSound] = useState<Sound>("camera");
  const [listenOnly, setListenOnly] = useState(false);
  const [time, setTime] = useState(0);

  const view = views.find((v) => v.id === viewId) ?? views[0];
  const micId = sound === "camera" ? mics[0].id : sound;
  const mic = mics.find((m) => m.id === micId) ?? mics[0];
  const current = partAt(parts, time);

  // Read once on the client; the server renders without the hint.
  const slow = useSyncExternalStore(noSubscription, isSlowConnection, () => false);

  /** The element the listener hears right now. */
  const media = useCallback(
    () => (listenOnly ? audio.current : video.current),
    [listenOnly],
  );

  const land = useCallback((el: HTMLMediaElement | null) => {
    const p = pending.current;
    if (!el || !p) return;
    pending.current = null;
    el.currentTime = p.t;
    if (p.play) void el.play().catch(() => {});
  }, []);

  /** Keep a microphone track in step with the muted video. */
  const follow = () => {
    const v = video.current;
    const a = audio.current;
    if (listenOnly || sound === "camera" || !v || !a) return;
    if (Math.abs(a.currentTime - v.currentTime) > MAX_DRIFT_S)
      a.currentTime = v.currentTime;
    if (v.paused && !a.paused) a.pause();
    if (!v.paused && a.paused) void a.play().catch(() => {});
  };

  const chooseView = (id: string) => {
    if (id === viewId) return;
    const v = video.current;
    if (v && v.currentTime > 0)
      pending.current = { t: v.currentTime, play: !v.paused };
    setViewId(id);
  };

  // A new camera source reloads the element; resume where the last one was.
  useEffect(() => {
    const v = video.current;
    if (!v || listenOnly) return;
    if (pending.current?.play) void v.play().catch(() => {});
  }, [viewId, listenOnly]);

  const chooseSound = (next: Sound) => {
    setSound(next);
    const v = video.current;
    const a = audio.current;
    if (!v) return;
    v.muted = next !== "camera";
    if (next === "camera") {
      a?.pause();
    } else if (a && !v.paused) {
      a.currentTime = v.currentTime;
      void a.play().catch(() => {});
    }
  };

  const toggleListenOnly = () => {
    const from = media();
    const t = from?.currentTime ?? time;
    const play = from ? !from.paused : false;
    from?.pause();
    pending.current = t > 0 || play ? { t, play } : null;
    setListenOnly((x) => !x);
  };

  // After switching modes, land the other element on the same moment.
  useEffect(() => {
    const el = media();
    if (!el || !pending.current) return;
    if (el.readyState >= 1) land(el);
    else if (pending.current.play) void el.play().catch(() => {});
  }, [listenOnly, media, land]);

  const seek = (t: number) => {
    const el = media();
    if (!el) return;
    if (el.readyState >= 1) {
      el.currentTime = t;
      void el.play().catch(() => {});
    } else {
      pending.current = { t, play: true };
      void el.play().catch(() => {});
    }
    setTime(t);
  };

  return (
    <div className={styles.player}>
      <div className={styles.main}>
        <div className={styles.stage}>
          {listenOnly ? (
            <div className={styles.listen}>
              <p className={styles.listenTitle}>
                Listening to {mic.label.toLowerCase()}
              </p>
              <p className={styles.listenNote}>
                No video is loaded in this mode.
              </p>
            </div>
          ) : (
            <video
              ref={video}
              key="video"
              className={styles.video}
              src={view.url}
              poster={view.poster}
              preload="none"
              playsInline
              controls
              muted={sound !== "camera"}
              onLoadedMetadata={(e) => land(e.currentTarget)}
              onTimeUpdate={(e) => {
                setTime(e.currentTarget.currentTime);
                follow();
              }}
              onPlay={follow}
              onPause={follow}
              onSeeked={follow}
              aria-label={`${view.label}, ${view.shot.toLowerCase()}, Denver station`}
            />
          )}
          <audio
            ref={audio}
            src={mic.url}
            preload="none"
            controls={listenOnly}
            className={listenOnly ? styles.audio : styles.hidden}
            onLoadedMetadata={(e) => {
              if (listenOnly) land(e.currentTarget);
            }}
            onTimeUpdate={(e) => {
              if (listenOnly) setTime(e.currentTarget.currentTime);
            }}
            aria-label={mic.label}
          />
        </div>
        <div className={styles.bar} aria-hidden="true">
          {parts.map((p) => (
            <span
              key={p.index}
              className={
                p.index < current
                  ? styles.done
                  : p.index === current
                    ? styles.now
                    : undefined
              }
            />
          ))}
        </div>
        <div className={styles.status}>
          <span>
            Part {current} of {parts.length} · {clock(time)} /{" "}
            {clock(parts[parts.length - 1].end)}
          </span>
          <span>
            {listenOnly ? "Listen only" : `${view.label} · ${view.shot}`}
          </span>
        </div>
      </div>

      <div className={styles.side}>
        <div role="group" aria-label="Camera" className={styles.group}>
          <div className={styles.label}>Camera</div>
          <div className={styles.views}>
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={!listenOnly && v.id === viewId}
                disabled={listenOnly}
                onClick={() => chooseView(v.id)}
                className={styles.choice}
              >
                <span className={styles.thumb}>
                  <Image src={v.poster} alt="" fill sizes="140px" />
                </span>
                <span className={styles.choiceText}>
                  <strong>{v.label}</strong>
                  <span>{v.shot}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Sound" className={styles.group}>
          <div className={styles.label}>Sound</div>
          {!listenOnly ? (
            <button
              type="button"
              aria-pressed={sound === "camera"}
              onClick={() => chooseSound("camera")}
              className={styles.pill}
            >
              The camera&apos;s own sound
            </button>
          ) : null}
          {mics.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={listenOnly ? m.id === micId : sound === m.id}
              onClick={() => chooseSound(m.id)}
              className={styles.pill}
            >
              {m.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-pressed={listenOnly}
          onClick={toggleListenOnly}
          className={styles.listenToggle}
        >
          <strong>{listenOnly ? "Back to video" : "Listen only"}</strong>
          <span>
            {listenOnly
              ? `Video streams about ${Math.round(videoMbPerMinute)} MB a minute.`
              : `Sound alone, under ${Math.ceil(audioMbPerMinute)} MB a minute.`}
          </span>
        </button>
        {slow && !listenOnly ? (
          <p className={styles.hint}>
            Your connection looks slow. Listen only keeps the story going with a
            fraction of the data.
          </p>
        ) : null}
      </div>

      <section aria-labelledby="parts" className={styles.parts}>
        <h2 id="parts" className={styles.partsTitle}>
          In seven parts
        </h2>
        <ol className={styles.partList}>
          {parts.map((p, i) => (
            <li key={p.index}>
              <button
                type="button"
                onClick={() => seek(p.start)}
                aria-current={p.index === current ? "true" : undefined}
                className={styles.part}
              >
                <span className={styles.partFrame}>
                  <Image
                    src={partFrames[i]}
                    alt=""
                    fill
                    sizes="180px"
                    loading="lazy"
                  />
                </span>
                <strong>Part {p.index}</strong>
                <span>
                  {clock(p.start)} to {clock(p.end)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
