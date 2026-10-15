// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatComposer } from "./chat-composer";
afterEach(cleanup);
function setup(initial = "", enabled = true) {
  const sent = vi.fn();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <ChatComposer
        value={value}
        onChange={setValue}
        enabled={enabled}
        sending={false}
        onSend={(event) => {
          event.preventDefault();
          sent(value);
        }}
      />
    );
  }
  render(<Harness />);
  return {
    sent,
    input: screen.getByRole("textbox", {
      name: "Message",
    }) as HTMLTextAreaElement,
  };
}
describe("message composer", () => {
  it("inserts a searched emoji at the caret without sending the draft", async () => {
    const { input, sent } = setup("Hello friend");
    input.focus();
    input.setSelectionRange(6, 6);
    fireEvent.select(input);
    fireEvent.click(screen.getByRole("button", { name: "Choose emoji" }));
    expect(
      screen.getByRole("dialog", { name: "Choose an emoji" }),
    ).toBeVisible();
    const search = screen.getByRole("textbox", { name: "Search emoji" });
    expect(search).toHaveFocus();
    fireEvent.change(search, { target: { value: "rocket" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(sent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Rocket" }));
    expect(input).toHaveValue("Hello 🚀friend");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input.selectionStart).toBe(8);
    expect(sent).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("respects the protocol limit and allows an emoji to replace a selection", () => {
    const { input } = setup("a".repeat(400));
    input.focus();
    input.setSelectionRange(400, 400);
    fireEvent.click(screen.getByRole("button", { name: "Choose emoji" }));
    expect(screen.getByRole("button", { name: "Smile" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Close emoji picker" }));
    input.focus();
    input.setSelectionRange(398, 400);
    fireEvent.select(input);
    fireEvent.click(screen.getByRole("button", { name: "Choose emoji" }));
    fireEvent.click(screen.getByRole("button", { name: "Smile" }));
    expect(input.value).toBe("a".repeat(398) + "😊");
    expect(input.value.length).toBe(400);
  });
  it("supports Escape and closes on an outside click", () => {
    setup();
    const trigger = screen.getByRole("button", { name: "Choose emoji" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByLabelText("Search emoji"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("sends on Enter while preserving Shift+Enter and composition", () => {
    const { input, sent } = setup("Hello 😊");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(sent).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(sent).toHaveBeenCalledWith("Hello 😊");
  });
  it("keeps the composer and emoji control disabled before acceptance or connection", () => {
    const { input, sent } = setup("Hi", false);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose emoji" })).toBeDisabled();
    expect(sent).not.toHaveBeenCalled();
  });
});
