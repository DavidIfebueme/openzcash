import { describe, expect, it } from "vitest";
import {
  CARD_LIMITS,
  CARD_VERSION,
  cardImagePath,
  cleanCardText,
  readCardParams,
} from "./card-params";

describe("cleanCardText", () => {
  it("returns undefined for missing, non-string or blank input", () => {
    expect(cleanCardText(undefined, 10)).toBeUndefined();
    expect(cleanCardText(null, 10)).toBeUndefined();
    expect(cleanCardText(42, 10)).toBeUndefined();
    expect(cleanCardText("   \n\t ", 10)).toBeUndefined();
  });

  it("collapses whitespace and strips control characters", () => {
    expect(cleanCardText("  Grants\u0000 and\n\n  proposals\u0007 ", 80)).toBe(
      "Grants and proposals",
    );
  });

  it("keeps text within the cap untouched", () => {
    expect(cleanCardText("Zcash Ceremony", 14)).toBe("Zcash Ceremony");
  });

  it("cuts long text at a word boundary and adds an ellipsis", () => {
    const out = cleanCardText("The road to the genesis block of Zcash", 20);
    expect(out).toBe("The road to the…");
    expect(Array.from(out!).length).toBeLessThanOrEqual(20);
  });

  it("caps by code point, never inside a character", () => {
    const out = cleanCardText("ÉÉÉÉÉÉ", 4);
    expect(Array.from(out!)).toEqual(["É", "É", "É", "…"]);
  });
});

describe("cleanCardText: only what the card fonts can draw", () => {
  it("keeps Latin-1 letters and typographic punctuation", () => {
    const text = "Zcash’s “Dev Fund” – 12% · São Paulo, Zürich… €5 ™";
    expect(cleanCardText(text, 90)).toBe(text);
  });

  it("drops scripts, emoji and symbols the fonts do not cover", () => {
    expect(cleanCardText("中文标题", 90)).toBeUndefined();
    expect(cleanCardText("مرحبا", 90)).toBeUndefined();
    expect(cleanCardText("Zcash مرحبا 🦓 ✓ → ok", 90)).toBe("Zcash ok");
    expect(cleanCardText("👩‍👩‍👧 family", 90)).toBe("family");
  });

  it("strips bidi overrides and invisible characters", () => {
    expect(cleanCardText("Grant\u202egnp.exe", 90)).toBe("Grantgnp.exe");
    expect(cleanCardText("a\u200bb\u200c\u200d\u200e\u200f\u2066c\u2069", 90)).toBe("abc");
    expect(cleanCardText("soft\u00adhyphen", 90)).toBe("softhyphen");
  });

  it("reduces other Latin letters to their base letter", () => {
    expect(cleanCardText("Łódź Świętokrzyskie Jiří Đorđe", 90)).toBe(
      "Lódz Swietokrzyskie Jirí Dorde",
    );
    expect(cleanCardText("e\u0301te\u0301", 90)).toBe("été");
    expect(cleanCardText("zk\u2011SNARK", 90)).toBe("zk-SNARK");
  });

  it("turns any Unicode space into a plain one", () => {
    expect(cleanCardText("a\u00a0b\u2009c\u3000d", 90)).toBe("a b c d");
  });
});

describe("cardImagePath", () => {
  it("encodes every field and the design version", () => {
    const path = cardImagePath({
      title: "Results",
      kicker: "Every round & every vote",
      stat: "Q3 2026 · 17 of 37 funded",
      section: "Coinholder Grants",
    });
    expect(path.startsWith("/og?")).toBe(true);
    const params = new URL(path, "https://openzcash.org").searchParams;
    expect(params.get("t")).toBe("Results");
    expect(params.get("k")).toBe("Every round & every vote");
    expect(params.get("n")).toBe("Q3 2026 · 17 of 37 funded");
    expect(params.get("s")).toBe("Coinholder Grants");
    expect(params.get("v")).toBe(CARD_VERSION);
  });

  it("leaves out empty fields", () => {
    const params = new URL(cardImagePath({ title: "News" }), "https://x.test")
      .searchParams;
    expect([...params.keys()].sort()).toEqual(["t", "v"]);
  });

  it("caps each field so the URL stays short", () => {
    const params = new URL(
      cardImagePath({ title: "x".repeat(500), kicker: "y ".repeat(500) }),
      "https://x.test",
    ).searchParams;
    expect(Array.from(params.get("t")!).length).toBeLessThanOrEqual(
      CARD_LIMITS.title,
    );
    expect(Array.from(params.get("k")!).length).toBeLessThanOrEqual(
      CARD_LIMITS.kicker,
    );
  });

  it("points the site card at the bare route", () => {
    expect(cardImagePath(null)).toBe(`/og?v=${CARD_VERSION}`);
  });
});

describe("readCardParams", () => {
  it("shows a category only once across legacy preview fields", () => {
    const params = new URLSearchParams({ t: "Proposals", s: "Coinholder Grants", n: "coinholder grants.", k: " PROPOSALS " });
    expect(readCardParams(params)).toEqual({ title: "Proposals", section: "Coinholder Grants" });
    const written = new URL(cardImagePath({ title: "Proposals", section: "Coinholder Grants", stat: "Coinholder Grants" }), "https://x.test");
    expect(written.searchParams.has("n")).toBe(false);
  });

  it("preserves a distinct round or amount alongside its category", () => {
    expect(readCardParams(new URLSearchParams({ t: "Proposals", s: "Coinholder Grants", n: "Q4 2026" })))
      .toEqual({ title: "Proposals", section: "Coinholder Grants", stat: "Q4 2026" });
    expect(readCardParams(new URLSearchParams({ t: "10%", n: "$10" })))
      .toEqual({ title: "10%", stat: "$10" });
  });

  it("round-trips what cardImagePath writes", () => {
    const card = {
      title: "Decisions",
      kicker: "Every verdict, dated",
      stat: "12 this year",
      section: "ZCG",
    };
    const url = new URL(cardImagePath(card), "https://x.test");
    expect(readCardParams(url.searchParams)).toEqual(card);
  });

  it("reads a request without a title as the site card", () => {
    expect(readCardParams(new URLSearchParams("k=hello&n=1"))).toBeNull();
  });

  it("caps hand-written oversized parameters", () => {
    const params = new URLSearchParams({
      t: "T".repeat(10_000),
      s: "S".repeat(10_000),
      n: "N".repeat(10_000),
    });
    const card = readCardParams(params)!;
    expect(Array.from(card.title).length).toBeLessThanOrEqual(
      CARD_LIMITS.title,
    );
    expect(Array.from(card.section!).length).toBeLessThanOrEqual(
      CARD_LIMITS.section,
    );
    expect(Array.from(card.stat!).length).toBeLessThanOrEqual(CARD_LIMITS.stat);
  });
});
