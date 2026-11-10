import { describe, expect, it } from "vitest";
import {
  sheetNewsItems,
  type PaidLedgerRow,
  type RecordedPayment,
} from "./sheet";

const row = (over: Partial<PaidLedgerRow> & { id: string }): PaidLedgerRow => ({
  recipient: "ZcashMe, Inc.",
  project: "Zcash Network School Kazakhstan",
  usd: 428_500n,
  paid: "2026-11-01",
  isTest: false,
  ...over,
});

const recorded = (title: string, at: string, count = 1): RecordedPayment => ({
  title,
  detail: `${count} payment${count === 1 ? "" : "s"} · $4,285`,
  at: new Date(at),
});

const stamps = (rows: PaidLedgerRow[], records: RecordedPayment[]) =>
  Object.fromEntries(sheetNewsItems(rows, records).map((i) => [i.id, i.ts]));

describe("spreadsheet payments in the news feed", () => {
  it("dates a payment by when the ledger recorded it, not its earlier paid-out date", () => {
    const [item] = sheetNewsItems(
      [row({ id: "ms1" })],
      [recorded("Zcash Network School Kazakhstan", "2026-11-07T18:34:11Z")],
    );
    expect(item).toEqual({
      id: "sheet:ms1",
      source: "sheet",
      kind: "ZCG ledger",
      title: "ZcashMe, Inc. — $4,285 · paid Nov 1",
      url: "/zcg/grant?g=Zcash%20Network%20School%20Kazakhstan",
      ts: "2026-11-07T18:34:11.000Z",
    });
  });

  it("keeps the paid-out date when no later record is known", () => {
    expect(stamps([row({ id: "ms1" })], [])).toEqual({
      "sheet:ms1": "2026-11-01T00:00:00.000Z",
    });
  });

  it("never dates a payment before it was paid", () => {
    expect(
      stamps(
        [row({ id: "ms1" })],
        [recorded("Zcash Network School Kazakhstan", "2026-10-31T23:00:00Z")],
      ),
    ).toEqual({ "sheet:ms1": "2026-11-01T00:00:00.000Z" });
  });

  it("lets one recorded payment lift only the most recently paid entry", () => {
    expect(
      stamps(
        [row({ id: "startup", paid: "2026-09-28" }), row({ id: "ms1" })],
        [recorded("Zcash Network School Kazakhstan", "2026-11-07T18:34:11Z")],
      ),
    ).toEqual({
      "sheet:startup": "2026-09-28T00:00:00.000Z",
      "sheet:ms1": "2026-11-07T18:34:11.000Z",
    });
  });

  it("gives each monthly milestone its own record", () => {
    expect(
      stamps(
        [
          row({ id: "ms10", paid: "2026-11-05" }),
          row({ id: "ms9", paid: "2026-10-05" }),
        ],
        [
          recorded("Zcash Network School Kazakhstan", "2026-11-06T04:46:03Z"),
          recorded("Zcash Network School Kazakhstan", "2026-10-06T04:40:00Z"),
        ],
      ),
    ).toEqual({
      "sheet:ms10": "2026-11-06T04:46:03.000Z",
      "sheet:ms9": "2026-10-06T04:40:00.000Z",
    });
  });

  it("lifts as many entries as the record counted", () => {
    expect(
      stamps(
        [
          row({ id: "ms10", paid: "2026-11-05" }),
          row({ id: "event", paid: "2026-11-05" }),
          row({ id: "ms9", paid: "2026-10-05" }),
        ],
        [recorded("Zcash Network School Kazakhstan", "2026-11-06T04:46:03Z", 2)],
      ),
    ).toEqual({
      "sheet:ms10": "2026-11-06T04:46:03.000Z",
      "sheet:event": "2026-11-06T04:46:03.000Z",
      "sheet:ms9": "2026-10-05T00:00:00.000Z",
    });
  });

  it("does not resurface a payment edited long after it was paid", () => {
    expect(
      stamps(
        [row({ id: "old", paid: "2026-08-01" })],
        [recorded("Zcash Network School Kazakhstan", "2026-11-07T18:34:11Z")],
      ),
    ).toEqual({ "sheet:old": "2026-08-01T00:00:00.000Z" });
  });

  it("matches rows without a project by recipient, as the record does", () => {
    const [item] = sheetNewsItems(
      [row({ id: "fee", recipient: "FPF", project: null, usd: 1_523_554n, paid: "2026-10-30" })],
      [recorded("FPF", "2026-11-07T18:34:11Z")],
    );
    expect(item).toMatchObject({
      title: "FPF — $15,235.54 · paid Oct 30",
      url: "/zcg/disbursements",
      ts: "2026-11-07T18:34:11.000Z",
    });
  });

  it("leaves test rows on their paid-out date and omits rows with no date", () => {
    expect(
      stamps(
        [row({ id: "test", isTest: true }), row({ id: "undated", paid: null })],
        [recorded("Zcash Network School Kazakhstan", "2026-11-07T18:34:11Z", 2)],
      ),
    ).toEqual({ "sheet:test": "2026-11-01T00:00:00.000Z" });
  });

  it("keeps the ledger order of rows", () => {
    const ids = ["a", "b", "c"];
    expect(
      sheetNewsItems(ids.map((id) => row({ id })), []).map((i) => i.id),
    ).toEqual(["sheet:a", "sheet:b", "sheet:c"]);
  });
});
