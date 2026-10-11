import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { Participate } from "./participate";

it("opens a history bookmark inside the same service workspace without a second header or legacy table", () => {
  const html = renderToStaticMarkup(<Participate view="history" service={{ url: "/participate" }}><p>Legacy table</p></Participate>);
  expect(html).toContain('aria-label="Participation workspace"');
  expect(html).toContain('src="/participate?view=history"');
  expect(html).not.toContain("participate.openzcash.org");
  expect(html).not.toContain('aria-label="Participation views"');
  expect(html).not.toContain("Legacy table");
});

it("retains public history when an installation has no participation service configured", () => {
  const html = renderToStaticMarkup(<Participate view="history" service={null}><p>Public history fallback</p></Participate>);
  expect(html).toContain("Public history fallback");
  expect(html).not.toContain("<iframe");
});

it("distinguishes the 25 anchored mainnet records from new free demo submissions", () => {
  const html = renderToStaticMarkup(<Participate service={{ url: "/participate" }} />);
  expect(html).toContain('aria-label="Participation workspace"');
  expect(html.match(/Enter the pilot/g)).toHaveLength(1);
  expect(html).not.toContain("From a proposal");
  expect(html).not.toContain('aria-label="Participation views"');
  expect(html).toContain("25 proposals anchored");
  expect(html).toContain("Zcash mainnet");
  expect(html).toContain("1bb7383043cab4d72b7129b5e5bdc7441ac7c073af59679bb91403216b795bf1");
  expect(html).toContain("Sign in with an email code.");
  expect(html).toContain("after a separate confirmed anchor");
  expect(html).not.toContain("timestamping is in preparation");
});
