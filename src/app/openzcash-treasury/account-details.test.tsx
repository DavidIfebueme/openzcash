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

it("exposes a selectable read-only full key when clipboard access fails", async () => {
  writeText.mockRejectedValue(new Error("Clipboard denied"));
  render(<AccountDetails qrCode={qrCode} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Could not copy"));
  const key = screen.getByRole("textbox", { name: "Public viewing key" }) as HTMLTextAreaElement;
  expect(key.value).toBe(TREASURY_ACCOUNT.viewingKey);
  expect(key.readOnly).toBe(true);
  expect(key.closest("details")?.open).toBe(true);
  expect(screen.queryByText("Viewing key copied.")).toBeNull();
});

it("tells donors how to designate a donation in the memo and where the rest goes", () => {
  render(<AccountDetails qrCode={qrCode} />);
  const note = screen.getByText(/write "For Michae2xl: retroactive work" in the memo/);
  expect(note.textContent).toContain("Donations without that note go entirely to maintenance and improvements.");
});
