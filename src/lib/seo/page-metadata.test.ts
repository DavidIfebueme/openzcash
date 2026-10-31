import { describe, expect, it } from "vitest";
import type { Metadata } from "next";
import { CARD_VERSION } from "./card-params";
import {
  DESCRIPTION_LIMIT,
  descriptionLead,
  homeMetadata,
  pageMetadata,
  rootShareMetadata,
  sectionOf,
  shareTitle,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_SHARE_TITLE,
  SITE_URL,
} from "./page-metadata";

type Image = { url: string; width?: number; height?: number; alt?: string };

function cardOf(meta: Metadata): URLSearchParams {
  const images = meta.openGraph?.images as Image[];
  return new URL(images[0].url, SITE_URL).searchParams;
}

describe("shareTitle", () => {
  it("drops the site suffix, which og:site_name carries", () => {
    expect(shareTitle("Zcash governance · OpenZcash")).toBe("Zcash governance");
    expect(shareTitle("The people · Zcash Ceremony · OpenZcash")).toBe(
      "The people · Zcash Ceremony",
    );
  });

  it("keeps titles without the suffix", () => {
    expect(shareTitle("Sep 2026 · Operations · OpenZcash Monthly")).toBe(
      "Sep 2026 · Operations · OpenZcash Monthly",
    );
  });
});

describe("sectionOf", () => {
  it("names the app a route belongs to", () => {
    expect(sectionOf("/zcg/grants")).toBe("ZCG");
    expect(sectionOf("/coinholders/results")).toBe("Coinholder Grants");
    expect(sectionOf("/ceremony/people")).toBe("Zcash Ceremony");
    expect(sectionOf("/development")).toBe("Ecosystem");
  });

  it("falls back to the app of the first segment", () => {
    expect(sectionOf("/zarvis/about")).toBe("Zarvis");
    expect(sectionOf("/monthly/2026-09-operations")).toBe("Monthly");
  });

  it("is undefined for unknown or missing routes", () => {
    expect(sectionOf("/nowhere")).toBeUndefined();
    expect(sectionOf(undefined)).toBeUndefined();
  });
});

describe("pageMetadata", () => {
  const meta = pageMetadata({
    title: "Decisions · ZCG · OpenZcash",
    description: "Every verdict the committee has taken.",
    path: "/zcg/decisions",
  });

  it("keeps the document title and description unchanged", () => {
    expect(meta.title).toBe("Decisions · ZCG · OpenZcash");
    expect(meta.description).toBe("Every verdict the committee has taken.");
  });

  it("gives the page its own Open Graph block", () => {
    expect(meta.openGraph).toMatchObject({
      title: "Decisions · ZCG",
      description: "Every verdict the committee has taken.",
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
      url: "/zcg/decisions",
    });
  });

  it("points og:image at a 1200×630 card with alt text", () => {
    const [image] = meta.openGraph?.images as Image[];
    expect(image).toMatchObject({
      width: 1200,
      height: 630,
      alt: "Decisions · ZCG",
    });
    expect(image.url.startsWith("/og?")).toBe(true);
  });

  it("builds the card from the title, with the app as eyebrow", () => {
    const card = cardOf(meta);
    expect(card.get("t")).toBe("Decisions");
    expect(card.get("s")).toBe("ZCG");
    expect(card.get("v")).toBe(CARD_VERSION);
  });

  it("gives X a large card with the same title, description and image", () => {
    const [image] = meta.openGraph?.images as Image[];
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: "Decisions · ZCG",
      description: "Every verdict the committee has taken.",
    });
    expect((meta.twitter?.images as Image[])[0].url).toBe(image.url);
  });

  it("uses the app's one-liner as kicker on an app's landing page", () => {
    const card = cardOf(
      pageMetadata({
        title: "Zcash governance · OpenZcash",
        path: "/governance",
      }),
    );
    expect(card.get("t")).toBe("Zcash governance");
    expect(card.get("k")).toBe("Upgrades, polls and open questions");
    expect(card.has("s")).toBe(false);
  });

  it("keeps the eyebrow beside a page's own card title", () => {
    const card = cardOf(
      pageMetadata({ title: "Grants ZCG · OpenZcash", path: "/zcg/grants", card: { title: "Grants" } }),
    );
    expect(card.get("t")).toBe("Grants");
    expect(card.get("s")).toBe("ZCG");
  });

  it("shows the app's share of the block reward on its landing page", () => {
    const card = cardOf(
      pageMetadata({
        title: "Coinholder-Directed Retroactive Grants Program · OpenZcash",
        path: "/coinholders",
        card: { title: "Coinholder Grants" },
      }),
    );
    expect(card.get("t")).toBe("Coinholder Grants");
    expect(card.get("n")).toBe("12% of every block reward (ZIP 1016)");
    expect(card.get("k")).toBe("Coinholder-Directed Retroactive Grants Program");
  });

  it("drops an eyebrow the title already says", () => {
    const communities = cardOf(
      pageMetadata({ title: "Global Communities · OpenZcash", path: "/communities" }),
    );
    expect(communities.get("t")).toBe("Global Communities");
    expect(communities.has("s")).toBe(false);

    const card = cardOf(
      pageMetadata({
        title: "ZCG Committee · OpenZcash",
        path: "/zcg/committee",
      }),
    );
    expect(card.get("t")).toBe("ZCG Committee");
    expect(card.has("s")).toBe(false);
  });

  it("lets a page set the card's title, kicker, stat and section", () => {
    const card = cardOf(
      pageMetadata({
        title:
          "Results · Coinholder-Directed Retroactive Grants Program · OpenZcash",
        path: "/coinholders/results",
        card: {
          title: "Results",
          kicker: "Every round",
          stat: "Q3 2026 · 17 of 37 funded",
        },
      }),
    );
    expect(card.get("t")).toBe("Results");
    expect(card.get("k")).toBe("Every round");
    expect(card.get("n")).toBe("Q3 2026 · 17 of 37 funded");
    expect(card.get("s")).toBe("Coinholder Grants");
  });

  it("can hide the eyebrow", () => {
    const card = cardOf(
      pageMetadata({
        title: "Grants ZCG · OpenZcash",
        path: "/zcg/grants",
        card: { section: null },
      }),
    );
    expect(card.has("s")).toBe(false);
  });

  it("omits og:url and description when none is given", () => {
    const bare = pageMetadata({ title: "Grant detail · OpenZcash" });
    expect(bare.description).toBeUndefined();
    expect(bare.openGraph).not.toHaveProperty("url");
    expect(bare.openGraph).not.toHaveProperty("description");
    expect(bare.twitter).not.toHaveProperty("description");
  });
});

describe("pageMetadata: share title", () => {
  const meta = pageMetadata({
    title: "Grants ZCG · OpenZcash",
    shareTitle: "Grants · ZCG",
    path: "/zcg/grants",
    card: { title: "Grants" },
  });

  it("can share under a better title than the document's", () => {
    expect(meta.title).toBe("Grants ZCG · OpenZcash");
    expect(meta.openGraph).toMatchObject({ title: "Grants · ZCG" });
    expect(meta.twitter).toMatchObject({ title: "Grants · ZCG" });
    expect((meta.openGraph?.images as Image[])[0].alt).toBe("Grants · ZCG");
  });

  it("keeps the card title and eyebrow", () => {
    const card = cardOf(meta);
    expect(card.get("t")).toBe("Grants");
    expect(card.get("s")).toBe("ZCG");
  });
});

describe("pageMetadata: kicker", () => {
  it("keeps the SEO description out of the image unless a caption is explicitly provided", () => {
    const card = cardOf(
      pageMetadata({
        title: "Decisions · ZCG · OpenZcash",
        description:
          "Every verdict the Zcash Community Grants committee has taken on a grant proposal, dated, with the minutes of that day and the grant it created.",
        path: "/zcg/decisions",
      }),
    );
    expect(card.has("k")).toBe(false);
  });

  it("prefers a page's own kicker, then the app's one-liner on its landing page", () => {
    const own = cardOf(
      pageMetadata({
        title: "News · OpenZcash",
        description: "Something else entirely.",
        path: "/news",
        card: { kicker: "The last seven days" },
      }),
    );
    expect(own.get("k")).toBe("The last seven days");
    const landing = cardOf(
      pageMetadata({
        title: "Zcash governance · OpenZcash",
        description: "Decisions that bind the whole Zcash network.",
        path: "/governance",
      }),
    );
    expect(landing.get("k")).toBe("Upgrades, polls and open questions");
  });
});

describe("descriptionLead", () => {
  it("is the first sentence, without its period, when it fits", () => {
    expect(
      descriptionLead(
        "Each grant is an approved project that aggregates its milestones. A single grantee can hold several grants.",
      ),
    ).toBe("Each grant is an approved project that aggregates its milestones");
  });

  it("cuts a long sentence at a colon before a comma", () => {
    expect(
      descriptionLead(
        "Ten years of Zcash since the genesis block of October 28, 2016: every generation of shielded pools, the end of the trusted setup, the halvings, and the claims that keep circulating.",
      ),
    ).toBe("Ten years of Zcash since the genesis block of October 28, 2016");
  });

  it("skips clauses too short to stand alone", () => {
    expect(
      descriptionLead(
        "The six witnesses of the 2016 Zcash ceremony and their pseudonyms, the authors of Zerocoin and Zerocash, and the cypherpunk lineage behind them.",
      ),
    ).toBe("The six witnesses of the 2016 Zcash ceremony and their pseudonyms");
  });

  it("never cuts inside parentheses", () => {
    expect(
      descriptionLead(
        "Native ZEC pool depth, value locked and yield from public Midgard APIs (Maya Protocol, THORChain), refreshed every few minutes.",
      ),
    ).toBe(
      "Native ZEC pool depth, value locked and yield from public Midgard APIs (Maya Protocol, THORChain)",
    );
  });

  it("takes the next sentence along when the first is too short", () => {
    expect(
      descriptionLead(
        "zcashd is deprecated. The Z3 stack (Zebra, Zaino, Zallet) is its modular Rust replacement: a validating node, an indexing/lightwallet service and a wallet, run together.",
      ),
    ).toBe(
      "zcashd is deprecated. The Z3 stack (Zebra, Zaino, Zallet) is its modular Rust replacement",
    );
  });

  it("falls back to a word-boundary cut", () => {
    const lead = descriptionLead(`${"word ".repeat(40)}end.`, 50);
    expect(lead?.endsWith("…")).toBe(true);
    expect(Array.from(lead!).length).toBeLessThanOrEqual(50);
  });

  it("is undefined without a description", () => {
    expect(descriptionLead(undefined)).toBeUndefined();
    expect(descriptionLead("   ")).toBeUndefined();
  });
});

describe("pageMetadata: description length", () => {
  it(`fails outside production above ${DESCRIPTION_LIMIT} characters`, () => {
    expect(() =>
      pageMetadata({
        title: "Long · OpenZcash",
        description: "x".repeat(DESCRIPTION_LIMIT + 1),
      }),
    ).toThrow(/over 200/);
    expect(() =>
      pageMetadata({
        title: "Fits · OpenZcash",
        description: "x".repeat(DESCRIPTION_LIMIT),
      }),
    ).not.toThrow();
  });
});

describe("pageMetadata: detail path", () => {
  it("keeps the query in og:url and finds the app from the path alone", () => {
    const meta = pageMetadata({
      title: "Grant detail · OpenZcash",
      path: "/zcg/grant?g=Zebra%20Node",
    });
    expect(meta.openGraph).toMatchObject({ url: "/zcg/grant?g=Zebra%20Node" });
    expect(cardOf(meta).get("s")).toBe("ZCG");
  });
});

describe("homeMetadata", () => {
  const meta = homeMetadata({ title: "ZCG · OpenZcash", path: "/zcg" });

  it("keeps the page's document title", () => {
    expect(meta.title).toBe("ZCG · OpenZcash");
  });

  it("shares as the site, with the site card", () => {
    expect(meta.openGraph).toMatchObject({
      title: SITE_SHARE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: SITE_NAME,
      url: "/zcg",
    });
    expect(cardOf(meta).has("t")).toBe(false);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: SITE_SHARE_TITLE,
    });
  });
});

describe("rootShareMetadata", () => {
  const root = rootShareMetadata();

  it("resolves relative image URLs against the production origin", () => {
    expect(root.metadataBase?.toString()).toBe(`${SITE_URL}/`);
  });

  it("never sets a title or description a page could inherit", () => {
    expect(root.openGraph).not.toHaveProperty("title");
    expect(root.openGraph).not.toHaveProperty("description");
    expect(root.twitter).not.toHaveProperty("title");
    expect(root.twitter).not.toHaveProperty("description");
  });

  it("falls back to the site card", () => {
    expect(root.openGraph).toMatchObject({
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    });
    expect(cardOf(root).has("t")).toBe(false);
    expect(root.twitter).toMatchObject({ card: "summary_large_image" });
  });
});
