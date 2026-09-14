"use client";

import { useEffect, useId, useRef } from "react";
import type { OfficeProposalDTO } from "@/lib/zcg/github-applications";

export function ProposalDialog({
  proposal,
  onClose,
}: {
  proposal: OfficeProposalDTO;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const summaryId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const date = proposal.createdAt
    ? new Date(`${proposal.createdAt}T00:00:00Z`)
    : null;
  const dateLabel = date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
    })
    : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={summaryId}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) {
          event.currentTarget.close();
        }
      }}
      className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-0 text-stone-900 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-violet-700">
            UNDER REVIEW · #{proposal.number}
          </span>
          <button
            type="button"
            aria-label="Close proposal details"
            onClick={() => dialogRef.current?.close()}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>

        <h2 id={titleId} className="break-words text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          {proposal.title}
        </h2>
        {proposal.applicant && (
          <p className="mt-2 break-words text-sm text-stone-500">@{proposal.applicant}</p>
        )}

        <dl className="my-5 grid grid-cols-2 gap-4 rounded-xl bg-stone-50 p-4">
          <div>
            <dt className="text-xs text-stone-500">Application date</dt>
            <dd className="mt-1 text-sm font-medium">
              {dateLabel ? <time dateTime={proposal.createdAt}>{dateLabel}</time> : "Not available"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-stone-500">Requested amount</dt>
            <dd className="mt-1 text-sm font-medium">
              {proposal.amount != null ? `$${proposal.amount.toLocaleString("en-US")} USD` : "Not available"}
            </dd>
          </div>
        </dl>

        <p className="mb-2 text-xs font-medium text-stone-500">Project summary</p>
        <p id={summaryId} className="break-words text-sm leading-relaxed text-stone-700">
          {proposal.summary || "A summary is not available for this application. Open the full proposal for details."}
        </p>

        <a
          href={proposal.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-700"
        >
          View full proposal
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </dialog>
  );
}
