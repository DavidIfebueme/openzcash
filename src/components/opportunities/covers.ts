export type StockCover = {
  id: string;
  name: string;
  topic: string;
  keywords: string[];
};
export const stockCovers: StockCover[] = [
  { id: "nu7", name: "NU7 · Zcash network upgrade", topic: "Infrastructure", keywords: ["nu7", "upgrade"] },
  { id: "zechub", name: "ZecHub · Learn & contribute", topic: "Education", keywords: ["zechub", "wiki", "glossary", "education"] },
  {
    id: "wallet",
    name: "Zcash payments",
    topic: "Wallets",
    keywords: ["payment", "receive", "send"],
  },
  {
    id: "code",
    name: "Build with Zcash",
    topic: "Development",
    keywords: ["code", "developer", "prototype"],
  },
  {
    id: "story",
    name: "Privacy stories",
    topic: "Content",
    keywords: ["story", "writing"],
  },
  {
    id: "language",
    name: "Translation",
    topic: "Content",
    keywords: ["language", "translate"],
  },
  {
    id: "design",
    name: "Product design",
    topic: "Design",
    keywords: ["interface", "design"],
  },
  {
    id: "research",
    name: "User research",
    topic: "Research",
    keywords: ["research", "usability"],
  },
  {
    id: "zebra",
    name: "Zebra node",
    topic: "Infrastructure",
    keywords: ["zebra", "node"],
  },
  {
    id: "zakura",
    name: "Zakura node",
    topic: "Infrastructure",
    keywords: ["zakura", "node"],
  },
  { id: "zodl", name: "Zodl", topic: "Wallets", keywords: ["zodl", "zashi"] },
  { id: "zingo", name: "Zingo!", topic: "Wallets", keywords: ["zingo"] },
  { id: "ywallet", name: "YWallet", topic: "Wallets", keywords: ["ywallet"] },
  { id: "zkool", name: "Zkool", topic: "Wallets", keywords: ["zkool"] },
  { id: "cake", name: "Cake Wallet", topic: "Wallets", keywords: ["cake"] },
  { id: "edge", name: "Edge", topic: "Wallets", keywords: ["edge"] },
  {
    id: "unstoppable",
    name: "Unstoppable",
    topic: "Wallets",
    keywords: ["unstoppable"],
  },
  { id: "brave", name: "Brave Wallet", topic: "Wallets", keywords: ["brave"] },
  { id: "vizor", name: "Vizor", topic: "Wallets", keywords: ["vizor"] },
  {
    id: "hashsmash",
    name: "HashSmash · Yukon",
    topic: "Research",
    keywords: ["hashsmash", "hashmash", "yukon", "collision"],
  },
  {
    id: "education",
    name: "Learn Zcash",
    topic: "Education",
    keywords: ["learn", "guide", "education"],
  },
  {
    id: "workshop",
    name: "Builders workshop",
    topic: "Development",
    keywords: ["workshop", "tools"],
  },
  {
    id: "meetup",
    name: "Community meetup",
    topic: "Community",
    keywords: ["meetup", "event"],
  },
  {
    id: "video",
    name: "Video & film",
    topic: "Content",
    keywords: ["video", "film"],
  },
  {
    id: "security",
    name: "Security & privacy",
    topic: "Research",
    keywords: ["security", "audit", "shield"],
  },
  {
    id: "community",
    name: "Community connections",
    topic: "Community",
    keywords: ["community", "network"],
  },
  {
    id: "0xramp-pay",
    name: "0xramp PAY",
    topic: "Payments",
    keywords: ["0xramp", "pay", "pix", "payment"],
  },
  {
    id: "crosslink",
    name: "Crosslink",
    topic: "Infrastructure",
    keywords: ["crosslink", "shielded labs", "feature net"],
  },
  {
    id: "zero-indexer",
    name: "zero-indexer",
    topic: "Infrastructure",
    keywords: ["zero", "indexer", "shielded labs", "integration"],
  },
];
export const coverTopics = [...new Set(stockCovers.map((c) => c.topic))];
export const isCover = (value: unknown): value is string =>
  typeof value === "string" && stockCovers.some((c) => c.id === value);
export function suggestedCover(category: string, title = ""): string {
  const words = title.toLowerCase().split(/[^a-z0-9]+/);
  const specific = stockCovers
    .filter((c) =>
      [
        "nu7",
        "zechub",
        "zebra",
        "zakura",
        "zodl",
        "zingo",
        "ywallet",
        "zkool",
        "cake",
        "edge",
        "unstoppable",
        "brave",
        "vizor",
        "hashsmash",
        "0xramp-pay",
        "crosslink",
        "zero-indexer",
      ].includes(c.id),
    )
    .find((c) =>
      c.keywords
        .filter(
          (k) =>
            ![
              "node",
              "payment",
              "pay",
              "pix",
              "indexer",
              "integration",
            ].includes(k),
        )
        .some((k) => words.includes(k)),
    );
  return (
    specific?.id ||
    (
      {
        Development: "code",
        Content: "story",
        Design: "design",
        Translation: "language",
        Research: "research",
        Wallets: "wallet",
        Education: "education",
        Community: "community",
        Events: "meetup",
      } as Record<string, string>
    )[category] ||
    "code"
  );
}
export const resolveCover = (
  value: unknown,
  category = "Development",
  title = "",
) => (isCover(value) ? value : suggestedCover(category, title));
export const coverLabel = (value: string) =>
  stockCovers.find((c) => c.id === value)?.name || "Build with Zcash";
export const stockCoverUrl = (value: string) =>
  "/opportunities/art/" +
  (stockCovers.some((c) => c.id === value) ? value : "code") +
  ".png?v=20261103-paper-3";
export function filterCovers(query: string, topic = "All") {
  const q = query.trim().toLowerCase();
  return stockCovers.filter(
    (c) =>
      (topic === "All" || c.topic === topic) &&
      [c.name, c.topic, ...c.keywords].join(" ").toLowerCase().includes(q),
  );
}
