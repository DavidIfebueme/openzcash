import { SourceNote } from "@/components/workspace";
import {
  CAMERA_BITRATE_BPS,
  DENVER_ITEM_URL,
  DURATION_S,
  LICENCE,
  MICS,
  VIEWS,
  mbPerMinute,
  partFrame,
  partsOf,
} from "@/lib/ceremony/recordings";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import { CeremonyPlayer } from "./player";
import { Films } from "./films";
import styles from "../ceremony.module.css";

export const metadata = {
  title: "Watch the ceremony · Zcash Ceremony · OpenZcash",
  description:
    "71 minutes of the Denver station of the 2016 Zcash parameter ceremony, as three cameras and three microphones recorded them, in seven parts. Streams from the Internet Archive.",
};

const PARTS_OF_RECORDING = partsOf(DURATION_S, 7);

export default function WatchPage() {
  const audioMb =
    ((Math.max(...MICS.map((m) => m.bytes)) / DURATION_S) * 60) / 1e6;
  return (
    <div className={styles.page}>
      <PartHeader
        eyebrow={partEyebrow("watch", "Denver station")}
        title="Watch the ceremony"
      >
        Zooko Wilcox ran the Denver station while journalist Morgen Peck
        observed. Three cameras and three microphones recorded 71 minutes of it
        together on the first evening, starting two minutes before her phone
        began echoing the station&apos;s Google Hangout. Nothing loads until you
        press play.
      </PartHeader>

      <CeremonyPlayer
        views={VIEWS.map(({ id, label, shot, url, poster }) => ({
          id,
          label,
          shot,
          url,
          poster,
        }))}
        mics={MICS.map(({ id, label, url }) => ({ id, label, url }))}
        parts={PARTS_OF_RECORDING}
        partFrames={PARTS_OF_RECORDING.map((p) => partFrame(p.index))}
        videoMbPerMinute={mbPerMinute(CAMERA_BITRATE_BPS)}
        audioMbPerMinute={audioMb}
      />

      <p className={styles.note}>
        Cameras 1 and 2 go dark for a few minutes; Camera 3, the wide shot, runs
        throughout. The recordings stream from the Internet Archive as 720p
        MP4s; the cameras recorded in 1080p.
      </p>

      <Films />

      <SourceNote href={DENVER_ITEM_URL} label="Internet Archive item">
        Denver footage recorded by Nathaniel Kramer and published by Electric
        Coin Company on the Internet Archive in December 2016 under{" "}
        <a href={LICENCE.href} target="_blank" rel="noreferrer">
          {LICENCE.label}
        </a>
        . OpenZcash streams the files from there and keeps only still frames.
        The other films play from their own platforms.
      </SourceNote>

      <Pager slug="watch" />
    </div>
  );
}
