import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPS, backOf, childAppsOf, placeOf } from "./design-routes";
import { PHONE_MARK_SIZE, phoneHeaderOf } from "./phone-header";

const publicFile = (src: string) =>
  fileURLToPath(new URL(`../../public${src}`, import.meta.url));
const appOf = (id: string) => {
  const app = APPS.find((a) => a.id === id);
  if (!app) throw new Error(`no app ${id}`);
  return app;
};
/** A PNG states its width in the IHDR chunk, bytes 16 to 19. */
const pngWidth = (src: string) => readFileSync(publicFile(src)).readUInt32BE(16);

describe("phoneHeaderOf", () => {
  it("names the app alone on its landing page", () => {
    expect(phoneHeaderOf(placeOf("/zcg"))).toEqual({
      level: "app",
      app: appOf("zcg"),
      title: "ZCG",
    });
    expect(phoneHeaderOf(placeOf("/coinholders"))).toEqual({
      level: "app",
      app: appOf("coinholders"),
      title: "Coinholder Grants",
    });
  });

  it("covers apps that have an icon and no logo", () => {
    const header = phoneHeaderOf(placeOf("/zec-observatory"));
    expect(header?.level).toBe("app");
    expect(header?.title).toBe("ZEC Observatory");
    expect(header?.app.logo).toBeUndefined();
    expect(header?.app.icon).toBe("chart");
  });

  it("puts Ecosystem above each organization landing page while keeping the organization's mark", () => {
    for (const app of childAppsOf(appOf("ecosystem"))) {
      expect(phoneHeaderOf(placeOf(app.href))).toEqual({
        level: "page",
        app,
        over: { label: "Ecosystem", href: "/ecosystem" },
        title: app.label,
      });
    }
  });

  it("puts the organization above its own inner page", () => {
    expect(phoneHeaderOf(placeOf("/zechub/copilot"))).toEqual({
      level: "page",
      app: appOf("zechub"),
      over: { label: "ZecHub DAO", href: "/zechub" },
      title: "ZecHub Copilot",
    });
  });

  it("puts the app over the page on a page inside an app", () => {
    expect(phoneHeaderOf(placeOf("/zcg/grants"))).toEqual({
      level: "page",
      app: appOf("zcg"),
      over: { label: "ZCG", href: "/zcg" },
      title: "Grants",
    });
    expect(phoneHeaderOf(placeOf("/coinholders/verify"))).toEqual({
      level: "page",
      app: appOf("coinholders"),
      over: { label: "Coinholder Grants", href: "/coinholders" },
      title: "Verify it yourself",
    });
  });

  it("keeps a page under the app that lists it, whatever its path", () => {
    const header = phoneHeaderOf(placeOf("/zcg/coinholder/copilot"));
    expect(header?.app.id).toBe("coinholders");
    expect(header?.over).toEqual({
      label: "Coinholder Grants",
      href: "/coinholders",
    });
    expect(header?.title).toBe("Coinholder Copilot");
  });

  it("puts the list over the record on a detail page", () => {
    expect(phoneHeaderOf(placeOf("/zcg/grant"))).toEqual({
      level: "detail",
      app: appOf("zcg"),
      over: { label: "Grants", href: "/zcg/grants" },
      title: "Grant detail",
    });
    expect(phoneHeaderOf(placeOf("/zcg/recipient"))).toEqual({
      level: "detail",
      app: appOf("zcg"),
      over: { label: "Recipients", href: "/zcg/recipients" },
      title: "Recipient detail",
    });
  });

  it("has nothing to say about routes the navigation model does not know", () => {
    expect(phoneHeaderOf(placeOf("/zarvis/about"))).toBeUndefined();
    expect(phoneHeaderOf(placeOf("/nowhere"))).toBeUndefined();
    expect(phoneHeaderOf(undefined)).toBeUndefined();
  });

  it("gives the same answer as the breadcrumb on every route of the model", () => {
    for (const app of APPS) {
      if (app.href.includes("?")) continue;
      for (const page of app.pages) {
        const place = placeOf(page.href);
        const header = phoneHeaderOf(place);
        expect(header?.app).toBe(place?.app);
        expect(header?.title).toBe(place?.page?.label ?? place?.app.label);
      }
    }
  });

  it("uses the back destination as the parent line on every nested route", () => {
    const hrefs = APPS.flatMap((app) => [app.href, ...app.pages.map((page) => page.href)]);
    for (const href of [...hrefs, "/zcg/grant", "/ecosystem/history/zaino"]) {
      const header = phoneHeaderOf(placeOf(href));
      if (header?.over) expect(header.over, href).toEqual(backOf(href));
    }
  });

  it("does not change the place it reads", () => {
    const place = placeOf("/zcg/grant");
    const before = JSON.stringify(place);
    phoneHeaderOf(place);
    expect(JSON.stringify(place)).toBe(before);
  });
});

describe("PHONE_MARK_SIZE", () => {
  it("is the 26px mark of the phone top bar", () => {
    expect(PHONE_MARK_SIZE).toBe(26);
  });

  it("is never more than a third of a logo's width, so marks stay sharp at 3x", () => {
    for (const app of APPS) {
      if (!app.logo) continue;
      expect(app.logo).toMatch(/\.png$/);
      expect(pngWidth(app.logo)).toBeGreaterThanOrEqual(PHONE_MARK_SIZE * 3);
    }
  });
});
