/**
 * The Denver station recording of the October 2016 Zcash parameter ceremony,
 * as Electric Coin Company published it on the Internet Archive in December
 * 2016 (item ThePhoneAnomalyDuringTheZcashCeremonyDenverStation, CC BY-NC 4.0).
 * Three cameras and three microphones ran together for 71:30. The files stay
 * at the Internet Archive; this site streams them and keeps only small frames.
 *
 * A fourth file, Vcam-long.mp4 in item ZcashCeremony_201612, is the same wide
 * shot as Camera 3 (every per-minute frame matches), so it is not a view here.
 */

export const DENVER_ITEM = "ThePhoneAnomalyDuringTheZcashCeremonyDenverStation";
export const DENVER_ITEM_URL = `https://archive.org/details/${DENVER_ITEM}`;
export const LICENCE = {
  label: "CC BY-NC 4.0",
  href: "https://creativecommons.org/licenses/by-nc/4.0/",
};

/** Length of every camera and microphone file, in seconds (71:30). */
export const DURATION_S = 4290;
/** Measured on Camera2.mp4: H.264 1280x720 plus AAC, 9.28 Mbit/s. */
export const CAMERA_BITRATE_BPS = 9_284_332;

const download = (file: string) =>
  `https://archive.org/download/${DENVER_ITEM}/${file}`;

export type View = {
  id: string;
  label: string;
  shot: string;
  url: string;
  bytes: number;
  /** A 960 px frame served by this site, shown before anything streams. */
  poster: string;
};

const view = (n: number, shot: string, bytes: number): View => ({
  id: `camera-${n}`,
  label: `Camera ${n}`,
  shot,
  url: download(`Camera${n}.mp4`),
  bytes,
  poster: `/ceremony/camera-${n}.webp`,
});

export const VIEWS: View[] = [
  view(1, "Close shot", 4_976_814_779),
  view(2, "Close shot", 4_978_822_904),
  view(3, "Wide shot of the room", 4_974_715_237),
];

/**
 * A 320 px frame from inside part `n` (1-based), from Camera 3: the wide shot
 * runs throughout, while Cameras 1 and 2 go dark for a few minutes.
 */
export const partFrame = (n: number) => `/ceremony/camera-3-part-${n}.webp`;

export type Mic = { id: string; label: string; url: string; bytes: number };

export const MICS: Mic[] = [
  {
    id: "zooko",
    label: "Zooko Wilcox's microphone",
    url: download("ZookoMic.mp3"),
    bytes: 56_387_072,
  },
  {
    id: "morgen",
    label: "Morgen Peck's microphone",
    url: download("MorgenMic.mp3"),
    bytes: 56_699_904,
  },
  {
    id: "computer",
    label: "The computer's microphone",
    url: download("ComputerMic.mp3"),
    bytes: 59_143_680,
  },
];

export type Part = { index: number; start: number; end: number };

/** Equal, contiguous parts in whole seconds, numbered from 1. */
export function partsOf(durationS: number, count: number): Part[] {
  const edge = (i: number) => Math.round((i * durationS) / count);
  return Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    start: edge(i),
    end: edge(i + 1),
  }));
}

/** The part a moment falls in, clamped to the first and last part. */
export function partAt(parts: Part[], t: number): number {
  const hit = parts.find((p) => t >= p.start && t < p.end);
  if (hit) return hit.index;
  return t < parts[0].start ? parts[0].index : parts[parts.length - 1].index;
}

/** Megabytes per minute of playback at a given bitrate. */
export const mbPerMinute = (bitrateBps: number) =>
  ((bitrateBps / 8) * 60) / 1e6;

/** "12:05" or "1:02:05" for a number of seconds. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
