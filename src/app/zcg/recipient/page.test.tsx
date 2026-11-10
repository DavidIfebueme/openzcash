import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";
import { renderToStaticMarkup } from "react-dom/server";

const repo = vi.hoisted(() => ({ recipientMilestones: vi.fn() }));
vi.mock("@/lib/zcg/grants-repo", () => repo);

vi.mock("@/components/record-actions", () => ({ CopyPageLink: () => null }));

import RecipientPage, { generateMetadata } from "./page";

const metadataFor = (r: string) =>
  generateMetadata({ searchParams: Promise.resolve({ r }) }) as Promise<Metadata>;

function imageUrl(meta: Metadata): URL {
  const [image] = meta.openGraph?.images as { url: string }[];
  return new URL(image.url, "https://openzcash.org");
}

describe("recipient link preview", () => {
  beforeEach(() => {
    repo.recipientMilestones.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shares the generic card when the ledger has no recipient by that name", async () => {
    repo.recipientMilestones.mockResolvedValue([]);
    const meta = await metadataFor("Nobody Real");
    expect(meta.openGraph).toMatchObject({ title: "Recipient ledger" });
    expect(meta.openGraph).not.toHaveProperty("url");
    expect(imageUrl(meta).searchParams.get("t")).toBe("Recipient ledger");
    expect(JSON.stringify(meta)).not.toContain("Nobody");
  });

  it("shares the generic card when the lookup fails", async () => {
    repo.recipientMilestones.mockRejectedValue(new Error("db down"));
    const meta = await metadataFor("Zcash Foundation");
    expect(imageUrl(meta).searchParams.get("t")).toBe("Recipient ledger");
  });

  it("carries the name the ledger stores, not the spelling in the link", async () => {
    repo.recipientMilestones.mockResolvedValue([
      { recipientNameRaw: "Zcash Foundation", isPaid: true },
      { recipientNameRaw: "Zcash Foundation", isPaid: false },
    ]);
    const meta = await metadataFor("zcash   FOUNDATION");
    expect(repo.recipientMilestones).toHaveBeenCalledWith("zcash foundation");
    expect(meta.openGraph).toMatchObject({
      title: "Zcash Foundation · Recipient ledger",
      url: "/zcg/recipient?r=Zcash%20Foundation",
    });
    const card = imageUrl(meta).searchParams;
    expect(card.get("t")).toBe("Zcash Foundation");
    expect(card.get("n")).toBe("1 paid · 1 unpaid entries");
  });
});

const entry = (over: Record<string, unknown>) => ({
  id: String(over.sourceRowIndex),
  recipientNameRaw: "Kenbak",
  project: "CipherScan",
  disbursementType: "grant_milestone",
  deliverable: null,
  forMonth: null,
  milestoneLabel: null,
  isPaid: true,
  amountUsdCents: 0n,
  zecDisbursedZat: null,
  paidOutDate: null,
  paidOutRaw: "",
  estimatedPayoutDate: null,
  sourceSheetGid: "803214474",
  sourceRowIndex: 1,
  importedAt: new Date("2026-11-09T19:59:50Z"),
  ...over,
});

describe("recipient page for a merged alias family", () => {
  beforeEach(() => repo.recipientMilestones.mockReset());

  it("sums ZCG and Coinholder rows recorded under different names", async () => {
    repo.recipientMilestones.mockResolvedValue([
      entry({ sourceRowIndex: 10, sourceSheetGid: "722519692", project: "CipherScan Coinholder Retroactive Grant 2026", amountUsdCents: 37_500_000n, paidOutDate: "2026-10-16" }),
      entry({ sourceRowIndex: 9, sourceSheetGid: "722519692", recipientNameRaw: "Atmosphere Labs (Kenbak)", project: "CipherPay", amountUsdCents: 3_500_000n, paidOutDate: "2026-10-16" }),
      entry({ sourceRowIndex: 725, recipientNameRaw: "CipherScan", amountUsdCents: 1_470_000n, paidOutDate: "2026-07-23" }),
      entry({ sourceRowIndex: 726, recipientNameRaw: "CipherScan", amountUsdCents: 1_470_000n, isPaid: false }),
      entry({ sourceRowIndex: 751, recipientNameRaw: "Atmosphere Labs", project: "Zcash Integration for the Open Wallet Standard (OWS)", amountUsdCents: 2_000_000n, paidOutDate: "2026-04-24" }),
    ]);
    const html = renderToStaticMarkup(
      await RecipientPage({ searchParams: Promise.resolve({ r: "Kenbak" }) }),
    );
    expect(repo.recipientMilestones).toHaveBeenCalledWith("kenbak");
    expect(html).toContain("1 unpaid and 4 paid entries");
    // 375,000 + 35,000 + 14,700 + 20,000 paid; 14,700 still unpaid.
    expect(html).toContain("$444.7K");
    expect(html).toContain("$14.7K");
    expect(html).toContain(
      "<dt>Recorded as</dt><dd>Kenbak · Atmosphere Labs (Kenbak) · CipherScan · Atmosphere Labs</dd>",
    );
  });

  it("does not add a recorded-as line when the ledger uses one name", async () => {
    repo.recipientMilestones.mockResolvedValue([
      entry({ sourceRowIndex: 1, recipientNameRaw: "QEDIT", project: "ZSA", amountUsdCents: 100_000n }),
    ]);
    const html = renderToStaticMarkup(
      await RecipientPage({ searchParams: Promise.resolve({ r: "QEDIT" }) }),
    );
    expect(html).not.toContain("Recorded as");
  });
});
