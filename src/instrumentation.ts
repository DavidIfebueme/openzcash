/**
 * Server-process scheduler. The Railway web service is always-on, so it refreshes
 * the ZCG mirror itself — once shortly after boot, then every 6h — keeping the
 * public data current with the official spreadsheet without any external cron.
 *
 * Next.js calls register() once at server startup. Guarded to the Node runtime
 * and production only (no surprise imports in dev / edge). refreshZcg is
 * idempotent (per-tab delete + reinsert), so an overlapping stale-on-load run is
 * harmless.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  // The isolated chat process has no portal collectors, database writes or canaries.
  if (process.env.PRIVATE_CHAT_DEPLOYMENT === "pilot" ||
      process.env.PRIVATE_CHAT_ISOLATED === "true") return;
  if (process.env.DISABLE_AUTO_REFRESH !== "true") {
    const { startNewsSchedule } = await import("@/lib/news/feed");
    startNewsSchedule();
  }
  // Public policy collection has its own durable daily checkpoint.
  const { startLegalSchedule } = await import("@/lib/legal/schedule");
  startLegalSchedule();
  // Public read-only market snapshots are shared with both page and API bundles.
  // Start collection off the request path so visitors do not each wait on providers.
  const { startMarketSnapshots } = await import("@/lib/markets/sources");
  startMarketSnapshots();
  // Zarvis canary: the zero-cost starter checks, hourly, in this process. Scheduled
  // GitHub Actions jobs do not start for this repository, so nothing external is relied on.
  const { startCanarySchedule } = await import("@/lib/zarvis/canary-schedule");
  startCanarySchedule();

  // DISABLE_AUTO_REFRESH freezes the accounting snapshot: no spreadsheet
  // import, no treasury mirror and no published verdicts. The diligence
  // signals are an in-memory cache built from public GitHub/forum data, so
  // they still warm — otherwise the under-review table silently loses its
  // Diligence column in a paused environment.
  const paused = process.env.DISABLE_AUTO_REFRESH === "true";
  if (paused) {
    console.log(
      "[cron] automatic refresh paused (DISABLE_AUTO_REFRESH); diligence signals still warm",
    );
  }

  // Every 6h: the import is idempotent and cheap, and the signal warms are
  // TTL-guarded (applicant 6h, searches 24h), so most cycles only refresh
  // what actually went stale.
  const CYCLE_MS = 6 * 60 * 60 * 1000;

  const run = async () => {
    if (!paused) await refreshAll();
    // Diligence signals for the under-review set. Long-running by design
    // (GitHub search API pacing), so it trails everything else.
    try {
      const { warmDiligence } = await import("@/lib/zcg/diligence");
      const d = await warmDiligence();
      console.log(`[cron] diligence ok=${d.ok} proposals=${d.proposals}`);
    } catch (e) {
      console.error(
        "[cron] diligence warm failed:",
        e instanceof Error ? e.message : e,
      );
    }
  };

  const refreshAll = async () => {
    try {
      const { refreshZcg } = await import("@/lib/zcg/refresh");
      const r = await refreshZcg();
      const tabs = [
        ...r.disbursements.map((x) => `${x.gid}=${x.status}`),
        ...r.snapshots.map(
          (x) => `${x.scope}=${x.ok ? (x.sheetStatus ?? "ok") : "error"}`,
        ),
        ...r.proposals.map((x) => `${x.gid}=${x.status}`),
        ...r.totals.map((x) => `${x.gid}=${x.status}`),
      ].join(" ");
      console.log(
        `[cron] ZCG refresh ok=${r.ok} in ${r.ms}ms warnings=${r.sourceWarnings.join(",") || "none"} ${tabs}`,
      );
    } catch (e) {
      console.error(
        "[cron] ZCG refresh failed:",
        e instanceof Error ? e.message : e,
      );
    }
    // ZecHub treasury dashboard mirror — cheap (2 CSV tabs), same cycle.
    try {
      const { importZechubTreasury } =
        await import("@/lib/zechub/import-treasury");
      const z = await importZechubTreasury();
      console.log(
        `[cron] zechub treasury: ${z.map((r) => `${r.gid}=${r.status}`).join(" ")}`,
      );
    } catch (e) {
      console.error(
        "[cron] zechub treasury failed:",
        e instanceof Error ? e.message : e,
      );
    }
    // Verdicts/amounts for sheet rows whose application left the open review
    // set (closed/deleted issues) run FIRST: they are cheap and they decide
    // what the under-review list shows, so the post-boot window in which a
    // GitHub-decided row transiently reads "under review" stays short.
    try {
      const { warmIssueAmounts } = await import("@/lib/zcg/issue-amounts");
      const a = await warmIssueAmounts();
      console.log(`[cron] issue amounts ok=${a.ok} fetched=${a.fetched}`);
    } catch (e) {
      console.error(
        "[cron] issue amounts warm failed:",
        e instanceof Error ? e.message : e,
      );
    }
  };

  // A short delay so the DB/migrations are settled before the first run.
  setTimeout(run, 30_000);
  setInterval(run, CYCLE_MS);
}
