import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
import { Participate } from "./participate";

it("frames the native workspace without portal tabs and without an embedded document", () => {
  const html = renderToStaticMarkup(
    <Participate view="proposals" configured>
      <p>Workspace</p>
    </Participate>,
  );
  expect(html).toContain("Workspace");
  expect(html).not.toContain("<iframe");
  expect(html).not.toContain('aria-label="Participation views"');
  expect(html).toContain("Community participation on OpenZcash.");
});

it("keeps its own tabs and the public history when no participation service is configured", () => {
  const html = renderToStaticMarkup(
    <Participate view="history" configured={false}>
      <p>Public history fallback</p>
    </Participate>,
  );
  expect(html).toContain("Public history fallback");
  expect(html).toContain('aria-label="Participation views"');
  expect(html).toContain('href="/zcg/participate?view=history"');
  expect(html).toContain("View decision history");
});

it("distinguishes the 25 anchored mainnet records from real community proposals and free demo credits in the introduction", () => {
  const html = renderToStaticMarkup(
    <Participate view="proposals" configured />,
  );
  expect(html.match(/Enter Participate/g)).toHaveLength(1);
  expect(html).toContain("25 proposals anchored");
  expect(html).toContain("Zcash mainnet");
  expect(html).toContain(
    "1bb7383043cab4d72b7129b5e5bdc7441ac7c073af59679bb91403216b795bf1",
  );
  expect(html).toContain("Sign in with an email code.");
  expect(html).toContain("Community proposals are published on OpenZcash");
  expect(html).toContain(
    "official ZCG GitHub source are automatically anchored on Zcash",
  );
});
