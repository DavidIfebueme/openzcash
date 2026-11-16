"use client";

import { useState, type ReactNode } from "react";

/** Copies a link to the clipboard and says so; falls back to showing it. */
export function CopyLinkButton({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      className={className}
      title={value}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied("copied");
        } catch {
          setCopied("failed");
          window.prompt("Copy the calendar link", value);
        }
      }}
    >
      {children}
      <span aria-live="polite">{copied === "copied" ? "Copied" : "Copy link"}</span>
    </button>
  );
}
