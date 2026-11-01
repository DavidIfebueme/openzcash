import "server-only";
import { readQ4 } from "./q4-server";

/** The always-on Railway process discovers new/edited applications without waiting for a visitor. */
export function createTopicSchedule({ read = readQ4, enabled = () => process.env.COINHOLDER_TAGS_ENABLED !== "false" && process.env.DISABLE_AUTO_REFRESH !== "true" } = {}) {
  let first: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;
  const tick = () => {
    if (enabled()) void read().catch(() => console.info(JSON.stringify({ event: "coinholder.topics", outcome: "source-unavailable" })));
  };
  function start() {
    if (interval || !enabled()) return;
    first = setTimeout(tick, 20_000);
    interval = setInterval(tick, 5 * 60_000);
    first.unref?.(); interval.unref?.();
  }
  function stop() { clearTimeout(first); clearInterval(interval); first = interval = undefined; }
  return { start, stop };
}
export const startCoinholderTopicSchedule = createTopicSchedule().start;
