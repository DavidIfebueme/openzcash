// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppMark } from "@/components/app-marks";
import { APPS } from "./design-routes";
import { chatEntryNavigation } from "./private-chat-entry-navigation";

function shape(element: Element) {
  const clone = element.cloneNode(true) as Element;
  for (const attribute of ["class", "width", "height", "focusable"])
    clone.removeAttribute(attribute);
  return clone.outerHTML;
}

describe("Private Chat navigation artwork", () => {
  for (const app of APPS.filter(app => !app.hidden && !app.admin && !app.logo && app.icon !== "zarvis")) {
    it(`keeps the portal's ${app.label} icon when entering the chat`, () => {
      const portal = document.createElement("div");
      portal.innerHTML = renderToStaticMarkup(<AppMark app={app} />);
      const chat = document.createElement("nav");
      chat.innerHTML = chatEntryNavigation();
      const actual = chat.querySelector(`a[href="${app.href}"] > svg`)!;
      expect(actual).not.toBeNull();
      expect(shape(actual)).toBe(shape(portal.querySelector("svg")!));
    });
  }
});
