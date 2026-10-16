import "server-only";
import { collectEcosystemDaily, type EcosystemCollectionOutcome } from "./collector";
import { ecosystemCollectionDay } from "./checkpoint";

export const ECOSYSTEM_FIRST_RUN_MS = 60_000;
export const ECOSYSTEM_CHECK_MS = 15 * 60_000;
export function createEcosystemSchedule({ collect = collectEcosystemDaily, now = Date.now,
  disabled = () => process.env.DISABLE_AUTO_REFRESH === "true", report = () => {},
}: { collect?: typeof collectEcosystemDaily; now?: () => number; disabled?: () => boolean;
  report?: (result: EcosystemCollectionOutcome) => void } = {}) {
  let running: Promise<EcosystemCollectionOutcome> | null = null;
  let first: ReturnType<typeof setTimeout> | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  function execute(): Promise<EcosystemCollectionOutcome> {
    const at = now(), day = ecosystemCollectionDay(at);
    if (disabled()) return Promise.resolve({ ok: true, outcome: "disabled", day });
    if (running) return running;
    running = Promise.resolve().then(() => collect({ day, at: new Date(at).toISOString() }))
      .catch((): EcosystemCollectionOutcome => ({ ok: false, outcome: "unavailable", day }))
      .finally(() => { running = null; });
    return running;
  }
  const tick = () => { void execute().then(report).catch(() => {}); };
  function start() {
    if (disabled()) return false;
    if (interval) return true;
    first = setTimeout(tick, ECOSYSTEM_FIRST_RUN_MS);
    interval = setInterval(tick, ECOSYSTEM_CHECK_MS);
    first.unref?.(); interval.unref?.();
    return true;
  }
  function stop() {
    if (first) clearTimeout(first);
    if (interval) clearInterval(interval);
    first = interval = null;
  }
  return { start, stop, execute };
}
const schedule = createEcosystemSchedule({ report(result) {
  console.info(JSON.stringify({ event: "ecosystem.collection", ...result }));
} });
export const startEcosystemSchedule = schedule.start;
