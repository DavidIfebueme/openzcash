// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TREASURY_ACCOUNT } from "@/lib/openzcash-treasury/account";
import { AccountDetails } from "./account-details";

const writeText = vi.fn();
const qrCode = "data:image/png;base64,iVBORw0KGgo=";

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
});
afterEach(cleanup);

it("copies the complete donation destination and only announces success after the clipboard resolves", async () => {
  let resolveCopy!: () => void;
  writeText.mockImplementation(() => new Promise<void>((resolve) => { resolveCopy = resolve; }));
  render(<AccountDetails qrCode={qrCode} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
  expect(writeText).toHaveBeenCalledWith(TREASURY_ACCOUNT.address);
  expect(screen.getByRole("status").textContent).toBe("");
  resolveCopy();
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Address copied."));
  expect(screen.getByText(TREASURY_ACCOUNT.address)).toBeTruthy();
  const download = screen.getByRole("link", { name: "Save QR" });
  expect(download.getAttribute("href")).toBe(qrCode);
  expect(download.getAttribute("download")).toBe("openzcash-donation-qr.png");
});

it("copies the full viewing key rather than its abbreviated display", async () => {
  writeText.mockResolvedValue(undefined);
  render(<AccountDetails qrCode={qrCode} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Viewing key copied."));
  expect(writeText).toHaveBeenCalledWith(TREASURY_ACCOUNT.viewingKey);
  expect(writeText.mock.calls[0][0]).not.toContain("…");
});

it("shows the whole viewing key in its own frame, so it can be selected when the clipboard fails", async () => {
  writeText.mockRejectedValue(new Error("Clipboard denied"));
  const { container } = render(<AccountDetails qrCode={qrCode} />);
  const key = screen.getByText(TREASURY_ACCOUNT.viewingKey);
  expect(key.tagName).toBe("CODE");
  expect(container.textContent).not.toContain("…");
  expect(container.querySelector("details")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Could not copy"));
  expect(screen.queryByText("Viewing key copied.")).toBeNull();
});

it("frames the address like the key and shows a larger QR code", () => {
  render(<AccountDetails qrCode={qrCode} />);
  const address = screen.getByText(TREASURY_ACCOUNT.address);
  const key = screen.getByText(TREASURY_ACCOUNT.viewingKey);
  expect(address.tagName).toBe("CODE");
  expect(address.className).toBe(key.className);
  expect(screen.getByAltText("QR code for the OpenZcash Zcash donation address").getAttribute("width")).toBe("200");
});

it("points to the open letter under the donation address instead of repeating the memo guidance", () => {
  render(<AccountDetails qrCode={qrCode} />);
  const letter = screen.getByRole("link", { name: /An open letter/ });
  expect(letter.getAttribute("href")).toBe("/openzcash-treasury/letter");
  expect(letter.textContent).toContain("how to designate");
  expect(screen.queryByText(/retroactive work/)).toBeNull();
  expect(screen.getByText("Amounts and memos are publicly viewable. Keep personal details out of memos.")).toBeTruthy();
});
