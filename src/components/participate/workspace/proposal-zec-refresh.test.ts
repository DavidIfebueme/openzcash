import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PriceState } from "./proposal-zec-estimate";
import { useProposalZecPrice } from "./proposal-zec-estimate";
import { fundingQuoteExpiresAt } from "@/lib/participate/workspace/domain/funding-quote";

// Run the real hook's state and effect lifecycle without adding a DOM dependency.
const lifecycle = vi.hoisted(() => ({
  state: undefined as PriceState | undefined,
  effects: [] as { deps?: readonly unknown[]; cleanup?: () => void }[],
  refs: [] as { current: unknown }[],
  effectIndex: 0,
  refIndex: 0,
  queued: [] as (() => void)[],
  render: () => {},
}));

vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: PriceState) => {
      lifecycle.state ??= initial;
      return [lifecycle.state, (next: PriceState | ((current: PriceState) => PriceState)) => {
        lifecycle.state = typeof next === "function" ? next(lifecycle.state!) : next;
        lifecycle.render();
      }];
    },
    useRef: <T>(initial: T) => {
      const index = lifecycle.refIndex++;
      lifecycle.refs[index] ??= { current: initial };
      return lifecycle.refs[index] as { current: T };
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const index = lifecycle.effectIndex++;
      const previous = lifecycle.effects[index];
      if (previous && deps && previous.deps && deps.length === previous.deps.length &&
        deps.every((dependency, position) => Object.is(dependency, previous.deps![position]))) return;
      lifecycle.queued.push(() => {
        previous?.cleanup?.();
        lifecycle.effects[index] = { deps, cleanup: effect() || undefined };
      });
    },
  };
});

let page: EventTarget & { visibilityState: string };
let browser: EventTarget;
const start = new Date("2026-10-12T12:00:00.000Z");

function response() {
  const quotedAt = new Date();
  return new Response(JSON.stringify({ rateUsdPerZecE8: "30000000000", quotedAt: quotedAt.toISOString(),
    retrievedAt: quotedAt.toISOString(), expiresAt: fundingQuoteExpiresAt(quotedAt).toISOString() }));
}

async function mount() {
  lifecycle.render = () => {
    lifecycle.effectIndex = 0;
    lifecycle.refIndex = 0;
    useProposalZecPrice(true);
    const queued = lifecycle.queued.splice(0);
    queued.forEach(effect => effect());
  };
  lifecycle.render();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(start);
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  browser = new EventTarget();
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("fetch", vi.fn(async () => response()));
});

afterEach(() => {
  lifecycle.effects.forEach(effect => effect.cleanup?.());
  lifecycle.state = undefined;
  lifecycle.effects = [];
  lifecycle.refs = [];
  lifecycle.queued = [];
  lifecycle.render = () => {};
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("hourly Participate ZEC display refresh", () => {
  it("fetches once on entry, keeps the estimate beyond five minutes, and refreshes after one hour", async () => {
    await mount();
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59 * 60_000);
    expect(lifecycle.state?.status).toBe("ready");
    page.dispatchEvent(new Event("visibilitychange"));
    browser.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(lifecycle.state?.price?.quotedAt).toBe("2026-10-12T13:00:00.000Z");
  });

  it("expires a hidden tab's estimate and waits for visibility before fetching again", async () => {
    await mount();
    page.visibilityState = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(61 * 60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(lifecycle.state).toEqual({ status: "unavailable", price: null });
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(lifecycle.state?.status).toBe("ready");
  });

  it("retries a failed hourly refresh promptly without extending the expired estimate", async () => {
    await mount();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Provider unavailable"));
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(lifecycle.state).toEqual({ status: "unavailable", price: null });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(lifecycle.state?.price?.quotedAt).toBe("2026-10-12T13:00:15.000Z");
  });

  it("removes the expired estimate while its next refresh is still pending", async () => {
    await mount();
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>(() => {}));
    await vi.advanceTimersByTimeAsync(60 * 60_000 + 1_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(lifecycle.state).toEqual({ status: "unavailable", price: null });
  });
});
