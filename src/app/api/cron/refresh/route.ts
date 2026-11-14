/**
 * Manual ZCG spreadsheet re-import. The scheduled refresh runs in-process from
 * src/instrumentation.ts (every 6h); call this with
 * `Authorization: Bearer ${CRON_SECRET}` to trigger one on demand. Not an admin
 * route — it is gated by the shared secret, not a session — so it stays out of
 * ADMIN_APIS.
 */
import { timingSafeEqual } from "node:crypto";
import { refreshZcg } from "@/lib/zcg/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Constant-time Bearer-token check (mirrors the login route's comparison). */
function authorized(req: Request, secret: string): boolean {
  const a = Buffer.from(req.headers.get("authorization") ?? "", "utf8");
  const b = Buffer.from(`Bearer ${secret}`, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  if (!authorized(req, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (process.env.DISABLE_AUTO_REFRESH === "true") {
    return Response.json({ ok: true, skipped: "Snapshot preserved for design comparison" });
  }

  try {
    const r = await refreshZcg();
    // Trail the refresh with the signal warm-ups, fire-and-forget. Issue
    // verdicts/amounts go first (cheap, they decide the under-review list);
    // diligence paces itself against GitHub's search rate limit (can take
    // minutes), and the long-lived server keeps both running after this
    // response returns.
    import("@/lib/zechub/import-treasury")
      .then(({ importZechubTreasury }) => importZechubTreasury())
      .then(() => import("@/lib/zcg/issue-amounts"))
      .then(({ warmIssueAmounts }) => warmIssueAmounts())
      .then(() => import("@/lib/zcg/diligence"))
      .then(({ warmDiligence }) => warmDiligence())
      .catch(() => {});
    // Surface a real ok + per-tab results so cron monitoring catches a broken
    // import instead of seeing a blanket 200 even when every tab failed.
    return Response.json(
      {
        ok: r.ok,
        ms: r.ms,
        disbursements: r.disbursements,
        snapshots: r.snapshots,
        proposals: r.proposals,
        totals: r.totals,
        meetings: r.meetings,
        sourceWarnings: r.sourceWarnings,
      },
      { status: r.ok ? 200 : 502 },
    );
  } catch {
    // Fixed code only: the caught message can echo sheet layout internals,
    // URLs or database wording, and this route is reachable by any caller
    // holding the secret. The server log keeps the underlying error.
    return Response.json(
      { ok: false, error: "ZCG_REFRESH_FAILED" },
      { status: 500 },
    );
  }
}
