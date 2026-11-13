// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TransactionLink } from "./transaction-link";

afterEach(cleanup);

const TXID = "3ad07a5e214b44da6c6fb6a5f4018ce1f18ed84e09ade768596f29c238993281";
const trigger = () =>
  screen.getByRole("button", {
    name: "View transaction 3ad07a…3281 in a block explorer",
  });

it("shows the short id and opens nothing until the reader asks", () => {
  render(<TransactionLink txid={TXID} />);
  expect(trigger().textContent).toContain("3ad07a…3281");
  expect(trigger().getAttribute("title")).toBe(TXID);
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.queryAllByRole("link")).toEqual([]);
});

it("lets the reader choose the explorer, each one opening this transaction in a new tab", () => {
  render(<TransactionLink txid={TXID} />);
  fireEvent.click(trigger());
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  const menu = screen.getByRole("menu", { name: "Open in a block explorer" });
  const items = screen.getAllByRole("menuitem");
  expect(menu.contains(items[0])).toBe(true);
  expect(
    items.map((item) => [
      item.getAttribute("aria-label"),
      item.getAttribute("href"),
    ]),
  ).toEqual([
    [
      "ZecBlock, zecblock.com, opens in a new tab",
      `https://zecblock.com/tx/${TXID}`,
    ],
    [
      "Zcash Info, zcashinfo.com, opens in a new tab",
      `https://zcashinfo.com/tx/${TXID}`,
    ],
  ]);
  for (const item of items) {
    expect(item.getAttribute("target")).toBe("_blank");
    expect(item.getAttribute("rel")).toBe("noopener noreferrer");
  }
  // The first choice has the focus, so the keyboard can go on from the click.
  expect(document.activeElement).toBe(items[0]);
});

it("moves through the choices with the arrow keys and wraps around", () => {
  render(<TransactionLink txid={TXID} />);
  fireEvent.click(trigger());
  const [first, second] = screen.getAllByRole("menuitem");
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "ArrowDown" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "ArrowUp" });
  expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: "Home" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(second);
});

it("closes on Escape and gives the focus back to the id", () => {
  render(<TransactionLink txid={TXID} />);
  fireEvent.click(trigger());
  fireEvent.keyDown(screen.getAllByRole("menuitem")[0], { key: "Escape" });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

it("closes when the reader presses outside, chooses an explorer or presses the id again", () => {
  render(
    <div>
      <TransactionLink txid={TXID} />
      <p>elsewhere</p>
    </div>,
  );
  fireEvent.click(trigger());
  fireEvent.pointerDown(screen.getByText("elsewhere"));
  expect(screen.queryByRole("menu")).toBeNull();

  fireEvent.click(trigger());
  const item = screen.getAllByRole("menuitem")[0];
  item.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(item);
  expect(screen.queryByRole("menu")).toBeNull();

  fireEvent.click(trigger());
  fireEvent.click(trigger());
  expect(screen.queryByRole("menu")).toBeNull();
});

it("shows a plain id, with nothing to press, when no explorer page can be built for it", () => {
  render(<TransactionLink txid="not-a-transaction-id" />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText("not-a-…n-id")).toBeTruthy();
});
