import {
  BASE,
  sampleCampaigns,
  sampleOpportunities,
  sampleOrganizers,
} from "./model";
export function opportunityRoute(
  segments: string[] = [],
): { title: string; description: string; path: string } | null {
  const path = BASE + (segments.length ? "/" + segments.join("/") : "");
  const description =
    "Explore Zcash tasks, wallets and community projects. Read-only beta: try the setup and cover library. Publishing and submissions are coming soon.";
  if (!segments.length)
    return { title: "Zcash Opportunities · Beta", description, path };
  if (segments.length === 1 && segments[0] === "new")
    return { title: "Create an opportunity · Beta", description, path };
  if (segments.length !== 2) return null;
  const [kind, id] = segments;
  if ((kind === "campaigns" || kind === "communities") && id === "new")
    return {
      title:
        (kind === "campaigns" ? "Create a campaign" : "Create a community") +
        " · Beta",
      description,
      path,
    };
  const record =
    kind === "tasks"
      ? sampleOpportunities.find((o) => o.id === id)
      : kind === "campaigns"
        ? sampleCampaigns.find((c) => c.id === id)
        : kind === "communities"
          ? sampleOrganizers.find((o) => o.id === id)
          : null;
  if (!record) return null;
  return {
    title: ("title" in record ? record.title : record.name) + " · Beta",
    description,
    path,
  };
}
