import { describe, expect, it } from "vitest";
import { claimCheckpoint, completeCheckpoint, ecosystemCollectionDay, emptyCheckpoint, ECOSYSTEM_LEASE_MS } from "./checkpoint";
const at = "2026-10-16T03:30:00.000Z", day = "2026-10-16";
describe("Ecosystem daily checkpoint", () => {
  it("follows the São Paulo day across midnight/year boundaries", () => {
    expect(ecosystemCollectionDay(new Date("2026-10-16T02:59:59Z"))).toBe("2026-10-15");
    expect(ecosystemCollectionDay(new Date("2026-10-16T03:00:00Z"))).toBe(day);
    expect(ecosystemCollectionDay(new Date("2027-01-01T02:00:00Z"))).toBe("2026-12-31");
    expect(() => claimCheckpoint(emptyCheckpoint(), "2026-10-15", at, "a")).toThrow();
  });
  it("prevents duplicate workers and same-day recollection after restart", () => {
    const first = claimCheckpoint(emptyCheckpoint(), day, at, "a");
    expect(first.status).toBe("claimed");
    expect(claimCheckpoint(first.row, day, at, "b").status).toBe("locked");
    const success = completeCheckpoint(first.row, "a", at, true);
    const restored = JSON.parse(JSON.stringify(success));
    expect(claimCheckpoint(restored, day, at, "restart").status).toBe("already-collected");
    expect(claimCheckpoint(restored, "2026-10-17", "2026-10-17T03:00:00.000Z", "next").status).toBe("claimed");
  });
  it("allows recovery after an abandoned lease but rejects its late completion", () => {
    const old = claimCheckpoint(emptyCheckpoint(), day, at, "old").row;
    const later = new Date(Date.parse(at) + ECOSYSTEM_LEASE_MS).toISOString();
    expect(completeCheckpoint(old, "old", later, true)).toBe(old);
    const replacement = claimCheckpoint(old, day, later, "new");
    expect(replacement.status).toBe("claimed");
    expect(completeCheckpoint(replacement.row, "old", later, true)).toBe(replacement.row);
    expect(completeCheckpoint(replacement.row, "new", later, true).successfulDay).toBe(day);
  });
  it("keeps the previous success during failures and persists a one-hour retry delay", () => {
    const yesterday = { ...emptyCheckpoint(), successfulDay: "2026-10-15", lastSuccessAt: "2026-10-15T04:00:00.000Z" };
    const failed = completeCheckpoint(claimCheckpoint(yesterday, day, at, "a").row, "a", at, false);
    expect(failed).toMatchObject({ successfulDay: "2026-10-15", lastSuccessAt: yesterday.lastSuccessAt, nextRetryAt: "2026-10-16T04:30:00.000Z", outcome: "source-unavailable" });
    expect(claimCheckpoint(failed, day, at, "b").status).toBe("retry-later");
    expect(claimCheckpoint(failed, day, failed.nextRetryAt!, "c").status).toBe("claimed");
  });
});
