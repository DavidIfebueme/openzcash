"use client";

import Image from "next/image";
import { useRef, useState, useSyncExternalStore } from "react";
import { clock, partAt, type Part } from "@/lib/ceremony/recordings";
import { createController, type PlayerController } from "./controller";
import styles from "./player.module.css";

type ViewInfo = {
  id: string;
  label: string;
  shot: string;
  url: string;
  poster: string;
};
type MicInfo = { id: string; label: string; url: string };

type Props = {
  views: ViewInfo[];
  mics: MicInfo[];
  parts: Part[];
  partFrames: string[];
  videoMbPerMinute: number;
  audioMbPerMinute: number;
};

type Connection = { saveData?: boolean; effectiveType?: string };

const noSubscription = () => () => {};

function isSlowConnection(): boolean {
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  return Boolean(
    c &&
    (c.saveData || ["slow-2g", "2g", "3g"].includes(c.effectiveType ?? "")),
  );
}

/** How much of part `p` has played at time `t`, from 0 to 1. */
const fillOf = (p: Part, t: number) =>
  t >= p.end ? 1 : t <= p.start ? 0 : (t - p.start) / (p.end - p.start);

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
  // The elements keep their first source in markup; later choices are made
  // by the controller inside the click, so React never reloads them.
  const [first] = useState(() => ({
    view: views[views.length - 1],
    mic: mics[0],
  }));
  // Created on first use, inside a handler, so refs are never read in render.
  const ctlRef = useRef<PlayerController | null>(null);
  const ctl = () => (ctlRef.current ??= createController({ video, audio }));

  const [viewId, setViewId] = useState(first.view.id);
  const [micId, setMicId] = useState<string | null>(null);
  const [listenOnly, setListenOnly] = useState(false);
  const [time, setTime] = useState(0);
  const slow = useSyncExternalStore(
    noSubscription,
    isSlowConnection,
    () => false,
  );

  const view = views.find((v) => v.id === viewId) ?? views[0];
  const listening = mics.find((m) => m.id === micId) ?? first.mic;
  const current = partAt(parts, time);
  const end = parts[parts.length - 1].end;

  const chooseView = (v: ViewInfo) => {
    ctl().chooseView(v.url);
    setViewId(v.id);
  };
  const chooseMic = (m: MicInfo) => {
    ctl().chooseMic(m.url);
    setMicId(m.id);
  };
  const chooseCameraSound = () => {
    ctl().chooseCameraSound();
    setMicId(null);
  };
  const toggleListenOnly = () => {
    ctl().toggleListenOnly();
    setListenOnly(ctl().listenOnly);
  };
  const seek = (t: number) => {
    ctl().seek(t);
    setTime(t);
  };

  return (
    <div className={styles.player}>
      <div className={styles.main}>
        <div className={styles.stage}>
          <video
            ref={video}
            className={listenOnly ? styles.hidden : styles.video}
            src={first.view.url}
            poster={view.poster}
            preload="none"
            playsInline
            controls
            onLoadedMetadata={() => ctl().loaded("video")}
            onTimeUpdate={(e) => {
              if (!ctl().listenOnly) setTime(e.currentTarget.currentTime);
              ctl().follow();
            }}
            onPlay={() => ctl().follow()}
            onPause={() => ctl().follow()}
            onSeeked={() => ctl().follow()}
            aria-label={`${view.label}, ${view.shot.toLowerCase()}, Denver station`}
          />
          {listenOnly ? (
            <div className={styles.listen}>
              <p className={styles.listenTitle}>
                Listening to {listening.label.toLowerCase()}
              </p>
              <p className={styles.listenNote}>
                No video is loaded in this mode.
              </p>
            </div>
          ) : null}
          <audio
            ref={audio}
            src={first.mic.url}
            preload="none"
            controls={listenOnly}
            className={listenOnly ? styles.audio : styles.hidden}
            onLoadedMetadata={() => ctl().loaded("audio")}
            onTimeUpdate={(e) => {
              if (ctl().listenOnly) setTime(e.currentTarget.currentTime);
            }}
            aria-label={listening.label}
          />
        </div>

        <div className={styles.bar} role="group" aria-label="Jump to a part">
          {parts.map((p) => (
            <button
              key={p.index}
              type="button"
              className={styles.segment}
              aria-current={p.index === current ? "true" : undefined}
              aria-label={`Part ${p.index}, ${clock(p.start)} to ${clock(p.end)}`}
              onClick={() => seek(p.start)}
            >
              <span className={styles.track}>
                <span
                  className={styles.fill}
                  style={{ width: `${fillOf(p, time) * 100}%` }}
                />
              </span>
            </button>
          ))}
        </div>
        <div className={styles.status}>
          <span>
            Part {current} of {parts.length} · {clock(time)} / {clock(end)}
          </span>
          <span>
            {listenOnly
              ? `Listen only · ${listening.label}`
              : `${view.label} · ${view.shot}`}
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
                onClick={() => chooseView(v)}
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
              aria-pressed={micId === null}
              onClick={chooseCameraSound}
              className={styles.pill}
            >
              The camera&apos;s own sound
            </button>
          ) : null}
          {mics.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={listenOnly ? m.id === listening.id : m.id === micId}
              onClick={() => chooseMic(m)}
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
