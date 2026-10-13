"use client";
import { useEffect, useState } from "react";
import { githubCommentsSnapshotSchema, ZCG_GITHUB_ISSUES, type GitHubCommentsSnapshot } from "@/lib/participate/github-comments-model";
import { ProposalMarkdown } from "./proposal-markdown";
const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";

export function GitHubComments({ issueNumber, visible }: { issueNumber: number; visible: boolean }) {
  const [snapshot, setSnapshot] = useState<GitHubCommentsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [limit, setLimit] = useState(5);
  const current = snapshot?.issueNumber === issueNumber ? snapshot : null;
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || controller.signal.aborted || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch(`/api/participate/github-comments/${issueNumber}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const value = githubCommentsSnapshotSchema.parse(await response.json());
        if (value.issueNumber !== issueNumber) throw new Error("Wrong source");
        if (!controller.signal.aborted) { setSnapshot(value); setFailed(value.stale); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5 * 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [issueNumber, visible, attempt]);
  return <section className="proposal-record-box" aria-label="GitHub comments">
    <header><h4>GitHub comments</h4>{current ? <span>{current.comments.length} {current.comments.length === 1 ? "comment" : "comments"}</span> : null}</header>
    <p className="proposal-record-caption">Current discussion · Updated every 5 minutes. Separate from this preserved revision.</p>
    {failed ? <p role="status">GitHub is temporarily unavailable.{current ? " Showing the last available comments." : ""} <button className="dao-text-button" type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button></p> : !current ? <p role="status">Loading GitHub comments…</p> : null}
    {current?.comments.slice(0, limit).map(comment => <details className="proposal-source-comment" key={comment.id} open={current.comments[0].id === comment.id}>
      <summary><span><strong>@{comment.author}{comment.bot ? " · Bot" : ""}</strong><small>{date(comment.createdAt)}</small></span></summary>
      {comment.updatedAt !== comment.createdAt ? <p className="proposal-record-caption">Edited {date(comment.updatedAt)}</p> : null}
      <ProposalMarkdown>{comment.body}</ProposalMarkdown>
      <a className="dao-text-button" href={comment.url} target="_blank" rel="noopener noreferrer">Original comment ↗</a>
    </details>)}
    {current && current.comments.length === 0 ? <p className="proposal-record-empty">No public comments on GitHub yet.</p> : null}
    {current && current.comments.length > limit ? <button type="button" className="dao-text-button" onClick={() => setLimit(value => value + 5)}>Show older comments ({current.comments.length - limit})</button> : null}
    <p className="proposal-record-caption">{current ? <>Checked {date(current.checkedAt)} · </> : null}<a href={`${ZCG_GITHUB_ISSUES}/${issueNumber}`} target="_blank" rel="noopener noreferrer">Open GitHub ↗</a></p>
  </section>;
}
