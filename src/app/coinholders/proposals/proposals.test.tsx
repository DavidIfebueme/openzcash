// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Proposals } from "./proposals";
import type { Q4ProposalSummary } from "@/lib/coinholder/q4";

afterEach(cleanup);
const base = { applicant: "example", organization: null, summary: "Completed work", createdAt: "2026-10-30T12:00:00Z", updatedAt: "2026-10-30T13:00:00Z", url: "https://github.com/example" };
const proposals: Q4ProposalSummary[] = [
  { ...base, number: 70, title: "Maya integration", organization: "Maya Protocol", category: "Integration", requestedUsdCents: 5000000 },
  { ...base, number: 69, title: "Zebra research", category: "Research", requestedUsdCents: 7500000 },
  { ...base, number: 71, title: "Unspecified request", category: null, requestedUsdCents: null },
];
describe("Q4 proposal exploration", () => {
  it("keeps the full amount and cents for large requests", () => {
    render(<Proposals proposals={[{ ...proposals[0], requestedUsdCents: 123456789 }]} />);
    expect(screen.getByText("$1,234,567.89")).toBeTruthy();
  });
  it("shows a source-linked check only for confirmed ZCG history", () => {
    render(<Proposals proposals={proposals} zcgHistory={{
      70: { status: "confirmed", basis: "recipient", title: "Earlier integration", recipient: "Maya Protocol", href: "/zcg/grant?g=Earlier%20integration" },
      69: { status: "unconfirmed" }, 71: { status: "unavailable" },
    }} />);
    expect(screen.getByRole("link", { name: /Prior ZCG funding or approval/ }).getAttribute("href")).toBe("/zcg/grant?g=Earlier%20integration");
    expect(screen.getByLabelText(/No prior ZCG approval or grant confirmed/).textContent).toBe("—");
    expect(screen.getByLabelText(/ZCG history could not be fully checked/).textContent).toBe("?");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("combines search and category and lets the reader clear an empty search", () => {
    render(<Proposals proposals={proposals} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Maya Protocol" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Research" } });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText("No matching proposals")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
  it("sorts numeric requests and keeps missing amounts last", () => {
    render(<Proposals proposals={proposals} />);
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "highest" } });
    let articles = screen.getAllByRole("article");
    expect(within(articles[0]).getByText("Zebra research")).toBeTruthy();
    expect(within(articles[2]).getByText("Not specified")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "lowest" } });
    articles = screen.getAllByRole("article");
    expect(within(articles[0]).getByText("Maya integration")).toBeTruthy();
    expect(within(articles[2]).getByText("Not specified")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Maya integration" }).getAttribute("href")).toBe("/coinholders/proposals/70");
  });
});
