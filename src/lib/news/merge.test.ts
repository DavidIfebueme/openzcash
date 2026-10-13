import { describe, expect, it } from "vitest";
import { mergeNews } from "./merge";
import { newsView } from "./view";
import type { NewsItem } from "./feed";

const application: NewsItem = {
  id: "application:486", source: "application", program: "zcg", kind: "ZCG proposal",
  title: "Konclave: taking the viewing key off the coordinator",
  url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/486",
  ts: "2026-10-13T02:40:05.000Z",
};
const forum: NewsItem = {
  id: "forum:58165", source: "forum", kind: "Forum",
  title: "Grant Application: Konclave (taking the viewing key off the coordinator)",
  url: "https://forum.zcashcommunity.com/t/grant-application-konclave/58165",
  ts: "2026-10-13T02:45:07.460Z",
};

describe("proposal source reconciliation", () => {
  it.each([[application, forum], [forum, application]])("keeps both sources regardless of publication or retrieval order", (...items) => {
    const merged = mergeNews(items);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: application.id, source: "proposal", title: application.title, ts: forum.ts });
    expect(merged[0].references?.map(ref => ref.url)).toEqual([forum.url, application.url]);
    const now = Date.parse(forum.ts);
    expect(newsView(merged, { source: "proposal" }, now).shown).toHaveLength(1);
    expect(newsView(merged, { source: "forum" }, now).shown).toHaveLength(1);
    expect(newsView(merged, { source: "application" }, now)).toMatchObject({ source: "proposal", totalCount: 1 });
  });

  it("retains existing source dates and a stable ID when the forum appears later", () => {
    const first = mergeNews([application]);
    const second = mergeNews([forum, application]);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].references).toEqual(expect.arrayContaining([
      { source: "github", url: application.url, publishedAt: application.ts },
      { source: "forum", url: forum.url, publishedAt: forum.ts },
    ]));
  });

  it("matches aliases, topic slugs and post links without treating a post number as a topic", () => {
    const sheet: NewsItem = { ...application, id: "proposal:sheet", source: "proposal", title: "Reworded official title",
      url: "https://forum.z.cash/t/58165/2", references: [{ source: "forum", url: "https://forum.z.cash/t/58165/2" }] };
    expect(mergeNews([forum, sheet])).toHaveLength(1);
    expect(mergeNews([{ ...forum, url: "https://forum.zcashcommunity.com/t/unrelated/2" }, sheet])).toHaveLength(2);
  });

  it("keeps distinct issues, programs and ambiguous renewals separate", () => {
    const differentIssue: NewsItem = { ...application, id: "proposal:other", source: "proposal", url: application.url.replace("486", "487"), references: [{ source: "github", url: application.url.replace("486", "487") }] };
    expect(mergeNews([application, differentIssue])).toHaveLength(2);
    expect(mergeNews([application, { ...differentIssue, url: "/zcg/proposals", references: [], program: "coinholder" }])).toHaveLength(2);
    expect(mergeNews([application, { ...application, id: "application:other", url: application.url.replace("486", "487") }, forum])).toHaveLength(3);
  });

  it("does not hide releases, payments or separate records with matching titles", () => {
    const items = [application, ...(["github", "sheet", "dao", "application"] as const).map((source, index) => ({ ...application, id: `other:${index}`, source }))];
    expect(mergeNews(items)).toHaveLength(5);
  });
});
