import { describe, expect, it } from "vitest";
import {
  AVAILABILITY_TTL_MS,
  EMPTY_SESSION,
  normalizeAlias,
  sessionReducer,
} from "./session";

describe("private chat preview consent", () => {
  it("starts hidden and rejects availability before an alias is chosen", () => {
    expect(
      sessionReducer(EMPTY_SESSION, {
        type: "availability",
        enabled: true,
        now: 100,
      }),
    ).toEqual(EMPTY_SESSION);
    expect(
      sessionReducer(EMPTY_SESSION, { type: "enter", alias: "  João   Z " }),
    ).toEqual({ alias: "João Z", availableUntil: null });
  });
  it("requires opt-in again after expiry, disconnect, alias change, and leaving", () => {
    const entered = sessionReducer(EMPTY_SESSION, {
      type: "enter",
      alias: "Alice",
    });
    const available = sessionReducer(entered, {
      type: "availability",
      enabled: true,
      now: 100,
    });
    expect(available.availableUntil).toBe(100 + AVAILABILITY_TTL_MS);
    expect(
      sessionReducer(available, {
        type: "expire",
        now: 99 + AVAILABILITY_TTL_MS,
      }),
    ).toEqual(available);
    expect(
      sessionReducer(available, {
        type: "expire",
        now: 100 + AVAILABILITY_TTL_MS,
      }),
    ).toEqual(entered);
    expect(sessionReducer(available, { type: "offline" })).toEqual(entered);
    expect(sessionReducer(available, { type: "enter", alias: "Bob" })).toEqual({
      alias: "Bob",
      availableUntil: null,
    });
    expect(sessionReducer(available, { type: "leave" })).toEqual(EMPTY_SESSION);
  });
  it("turns availability off immediately without discarding the alias", () => {
    expect(
      sessionReducer(
        { alias: "Alice", availableUntil: 999 },
        { type: "availability", enabled: false, now: 100 },
      ),
    ).toEqual({ alias: "Alice", availableUntil: null });
  });
  it("rejects invalid aliases and never changes consent after a failed edit", () => {
    for (const alias of [
      "",
      "a",
      "a".repeat(25),
      "<script>",
      "alice\u202E",
      "a\u200Bb",
      "https://example.com",
    ]) {
      expect(normalizeAlias(alias)).toBeNull();
      expect(sessionReducer(EMPTY_SESSION, { type: "enter", alias })).toEqual(
        EMPTY_SESSION,
      );
    }
    expect(normalizeAlias("Zcash_BR-01")).toBe("Zcash_BR-01");
    expect(normalizeAlias("Jose\u0301")).toBe("José");
  });
});
