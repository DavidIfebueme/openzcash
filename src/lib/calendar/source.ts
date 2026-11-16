import "server-only";
import { OPEN_DECISION } from "@/lib/governance/open-decisions";
import { ACTIVE_CYCLE } from "@/lib/coinholder/cycles";
import { getElections, getMeetings } from "@/lib/zcg/governance-repo";
import { getPaymentSchedule } from "@/lib/zcg/schedule-repo";
import { getArboristCalls } from "@/lib/arborist/notes";
import { getDashboardReading } from "@/lib/network/provider";
import { UPGRADES } from "@/lib/governance/upgrades";
import { dateOfHeight } from "@/lib/funding/history";
import {
  arboristEvents,
  coinholderEvents,
  electionEvents,
  governanceEvents,
  meetingEvents,
  networkEvents,
  paymentEvents,
  upgradeEvents,
  utcDay,
  type CalendarEvent,
} from "./events";

/** A complete read is kept this long. */
export const CALENDAR_TTL_MS = 5 * 60_000;
/** After a failed source, the next request tries again this soon. */
export const CALENDAR_RETRY_MS = 30_000;
/** The network reading only dates an estimate; never hold the page for it. */
const NETWORK_TIMEOUT_MS = 2_500;

export interface CalendarData {
  events: CalendarEvent[];
  /** Sources that have not been read yet, so their dates are missing. */
  unavailable: string[];
}

type Source = {
  name: string;
  read: (today: string) => Promise<CalendarEvent[]>;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** One reading of the chain dates every block-anchored event, from when it was read. */
async function network(): Promise<CalendarEvent[]> {
  const reading = await withTimeout(getDashboardReading(), NETWORK_TIMEOUT_MS);
  if (!reading) throw new Error("no network reading");
  const { info } = reading.data;
  return networkEvents({
    height: info.best_block,
    observedAt: Date.parse(reading.fetchedAt),
    spacingSeconds: info.target_block_spacing_secs,
    nu7ActivationHeight: info.nu7_activation_height,
  });
}

const SOURCES: Source[] = [
  {
    name: "ZCG meetings",
    read: async () => meetingEvents(await getMeetings()),
  },
  {
    name: "ZCG elections",
    read: async () => electionEvents(await getElections()),
  },
  {
    name: "the payment schedule",
    read: async (today) =>
      paymentEvents((await getPaymentSchedule()).byMonth, today),
  },
  {
    name: "Arborist Calls",
    read: async () => arboristEvents(await getArboristCalls()),
  },
  { name: "the network height", read: network },
];

// One cache for the News page and the feed, which Next may bundle apart.
type Collected = { data: CalendarData; failed: boolean };
type State = {
  lastGood: Map<string, CalendarEvent[]>;
  memo: (Collected & { at: number }) | null;
  pending: Promise<Collected> | null;
};
const scope = globalThis as typeof globalThis & { __openZcashCalendar?: State };
const state = (scope.__openZcashCalendar ??= {
  lastGood: new Map(),
  memo: null,
  pending: null,
});

async function collect(): Promise<Collected> {
  const today = utcDay(Date.now());
  const results = await Promise.allSettled(
    SOURCES.map((source) => source.read(today)),
  );
  const unavailable: string[] = [];
  const read = results.flatMap((result, index) => {
    const { name } = SOURCES[index];
    if (result.status === "fulfilled") {
      state.lastGood.set(name, result.value);
      return result.value;
    }
    const reason =
      result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
    console.error(`[calendar] ${name} could not be read: ${reason}`);
    // A source that failed keeps its last good dates; only a source that was
    // never read is reported as missing.
    const previous = state.lastGood.get(name);
    if (!previous) unavailable.push(name);
    return previous ?? [];
  });
  const events = [
    ...governanceEvents(OPEN_DECISION),
    ...coinholderEvents(ACTIVE_CYCLE),
    ...upgradeEvents(UPGRADES, (height) => dateOfHeight(height)),
    ...read,
  ];
  // One id, one entry: calendar apps would otherwise drop one of the two.
  const unique = [
    ...new Map(events.map((event) => [event.id, event])).values(),
  ];
  return {
    data: { events: unique, unavailable },
    failed: results.some((result) => result.status === "rejected"),
  };
}

/** Every calendar event; refreshed every five minutes, sooner after a failure. */
export async function getCalendarData(): Promise<CalendarData> {
  const memo = state.memo;
  const ttl = memo?.failed ? CALENDAR_RETRY_MS : CALENDAR_TTL_MS;
  if (memo && Date.now() - memo.at < ttl) return memo.data;
  state.pending ??= collect()
    .then((collected) => {
      state.memo = { ...collected, at: Date.now() };
      return collected;
    })
    .finally(() => {
      state.pending = null;
    });
  return (await state.pending).data;
}
