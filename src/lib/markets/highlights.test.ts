import { describe, expect, it } from "vitest";
import { nativeSwapDetail } from "./highlights";

const usd = (n: number) => `$${(n / 1e6).toFixed(1)}M`;
const history = (volumeAllTimeUsd: number, stale = false) => ({
  data: { volumeAllTimeUsd },
  stale,
});
const network = (paused: boolean, stale = false) => ({
  data: { paused },
  stale,
});

describe("native swap highlight line", () => {
  it("shows the all-time volume when the network is trading", () => {
    expect(
      nativeSwapDetail(
        history(9_830_690),
        network(false),
        usd,
        "Native ZEC pool",
      ),
    ).toBe("$9.8M all-time");
  });

  it("says when trading is paused or the history is a saved copy", () => {
    expect(
      nativeSwapDetail(
        history(9_830_690),
        network(true),
        usd,
        "Native ZEC pool",
      ),
    ).toBe("$9.8M all-time · trading paused");
    expect(
      nativeSwapDetail(
        history(9_830_690, true),
        network(false),
        usd,
        "Native ZEC pool",
      ),
    ).toBe("$9.8M all-time · saved");
  });

  it("never implies trading is active without a current network read", () => {
    expect(
      nativeSwapDetail(
        history(9_830_690),
        { data: null, stale: true },
        usd,
        "Native ZEC pool",
      ),
    ).toBe("$9.8M all-time · status unavailable");
    expect(
      nativeSwapDetail(
        history(9_830_690),
        network(false, true),
        usd,
        "Native ZEC pool",
      ),
    ).toBe("$9.8M all-time · status unavailable");
  });

  it("falls back to a plain label without history, still stating the network status", () => {
    const missing = { data: null, stale: true };
    expect(
      nativeSwapDetail(missing, network(false), usd, "Native ZEC pool"),
    ).toBe("Native ZEC pool");
    expect(
      nativeSwapDetail(missing, network(true), usd, "Native ZEC pool"),
    ).toBe("Native ZEC pool · trading paused");
    expect(nativeSwapDetail(missing, missing, usd, "Native ZEC pool")).toBe(
      "Native ZEC pool · status unavailable",
    );
  });
});
