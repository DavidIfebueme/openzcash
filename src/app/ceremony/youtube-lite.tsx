"use client";

import { useState } from "react";
import styles from "./youtube-lite.module.css";

/**
 * A YouTube film that costs one thumbnail until someone asks for it. The
 * player comes from youtube-nocookie.com, YouTube's privacy-enhanced mode, and
 * loads only after the click.
 */
export function YouTubeLite({
  id,
  title,
  start,
}: {
  id: string;
  title: string;
  start?: number;
}) {
  const [on, setOn] = useState(false);
  if (on) {
    const params = new URLSearchParams({ autoplay: "1", rel: "0" });
    if (start) params.set("start", String(start));
    return (
      <iframe
        className={styles.frame}
        src={`https://www.youtube-nocookie.com/embed/${id}?${params}`}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  return (
    <button
      type="button"
      className={styles.lite}
      onClick={() => setOn(true)}
      aria-label={`Play ${title}`}
    >
      {/* A remote thumbnail; next/image would proxy it through this server for no gain. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
      />
      <span className={styles.liteIcon} aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        >
          <path d="M8 5.5v13l10.5-6.5z" />
        </svg>
      </span>
    </button>
  );
}
