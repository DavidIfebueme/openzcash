import "server-only";
import { zarvisConfig } from "./config";
import { runCanary, type CanaryResult } from "./canary";
import { recordCanary } from "./metrics-store";
import { sendAlert } from "./alerts";
import { getZipCorpus } from "./zips";
import { warmSemantic } from "./semantic";

/** Warm the ZIP corpus and the embedding model shortly after boot, so the first run meets neither a build-time snapshot nor a cold model. */
export const CANARY_WARMUP_MS = 20_000;
/** First run after boot: the data readers and migrations are settled by then. */
export const CANARY_FIRST_RUN_MS = 3 * 60_000;
export const CANARY_INTERVAL_MS = 60 * 60_000;
export const CANARY_TIMEOUT_MS = 90_000;
/** A stale corpus is a cost regression (numbered ZIP questions go to the model), alerted once it persists. */
export const STALE_RUNS_BEFORE_ALERT = 3;
export type CanaryOutcome = CanaryResult & { stored: boolean };

const state: { running: Promise<CanaryOutcome> | null; staleRuns: number } = { running: null, staleRuns: 0 };

/** One canary execution: run, store, alert and log. Shared by the schedule and the on-demand endpoint; callers arriving during a run share it. */
export function executeCanary(): Promise<CanaryOutcome> {
  if (state.running) return state.running;
  state.running = (async () => {
    const config = zarvisConfig();
    const result = await runCanary(AbortSignal.timeout(CANARY_TIMEOUT_MS), { model: config.canaryModel && config.enabled });
    const stored = await recordCanary(result);
    if (!result.ok) sendAlert("canary", `Zarvis canary failed: ${result.failed} of ${result.passed + result.failed} checks (${result.failedCases.join(", ")}).`);
    state.staleRuns = result.skippedCases.includes("zip") ? state.staleRuns + 1 : 0;
    if (state.staleRuns >= STALE_RUNS_BEFORE_ALERT) sendAlert("canary", `Zarvis ZIP corpus stale for ${state.staleRuns} consecutive canary runs; numbered ZIP questions are answered by the model instead of directly.`);
    console.info(JSON.stringify({ event: "zarvis.canary", at: result.at, ok: result.ok, ms: result.ms, passed: result.passed, failed: result.failed, skipped: result.skipped, failedCases: result.failedCases, skippedCases: result.skippedCases, stored }));
    return { ...result, stored };
  })().finally(() => { state.running = null; });
  return state.running;
}

/** In-process hourly schedule for the always-on server (see src/instrumentation.ts). ZARVIS_CANARY_SCHEDULE=false disables it. */
export function startCanarySchedule(): boolean {
  if (process.env.ZARVIS_CANARY_SCHEDULE === "false") return false;
  const tick = () => { executeCanary().catch((error) => console.error("[cron] zarvis canary failed:", error instanceof Error ? error.message : error)); };
  setTimeout(() => { getZipCorpus(AbortSignal.timeout(35_000)).catch(() => {}); warmSemantic().catch(() => {}); }, CANARY_WARMUP_MS);
  setTimeout(tick, CANARY_FIRST_RUN_MS);
  setInterval(tick, CANARY_INTERVAL_MS);
  return true;
}

export function resetCanaryScheduleForTests() { state.running = null; state.staleRuns = 0; }
