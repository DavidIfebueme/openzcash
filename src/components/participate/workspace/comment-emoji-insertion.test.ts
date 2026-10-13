import { describe, expect, it } from "vitest";
import { insertCommentEmoji } from "./comment-emoji-insertion";

describe("comment emoji insertion", () => {
  it("inserts at the caret, preserving the text on both sides", () => {
    expect(insertCommentEmoji("Thank you!", "🙏", 5, 5, 100)).toEqual({ value: "Thank🙏 you!", caret: 7 });
  });

  it("replaces selected text and returns the new caret offset", () => {
    expect(insertCommentEmoji("Great work", "👏", 0, 5, 100)).toEqual({ value: "👏 work", caret: 2 });
  });

  it("uses the replaced selection when checking the UTF-16 limit", () => {
    expect(insertCommentEmoji("12345", "👍", 3, 5, 5)).toEqual({ value: "123👍", caret: 5 });
    expect(insertCommentEmoji("1234", "👍", 4, 4, 5)).toBeNull();
    expect(insertCommentEmoji("123", "🛡️", 3, 3, 5)).toBeNull();
  });

  it("rejects a whole joined emoji rather than truncating it at the limit", () => {
    expect(insertCommentEmoji("Hello", "👩🏽‍💻", 5, 5, 11)).toBeNull();
    expect(insertCommentEmoji("Hello", "👩🏽‍💻", 5, 5, 12)).toEqual({ value: "Hello👩🏽‍💻", caret: 12 });
  });

  it("moves an interior caret past the whole existing emoji", () => {
    expect(insertCommentEmoji("a👩🏽‍💻b", "👍", 3, 3, 100)).toEqual({ value: "a👩🏽‍💻👍b", caret: 10 });
  });

  it("expands a partial selection to avoid leaving broken emoji or accents", () => {
    expect(insertCommentEmoji("a👩🏽‍💻b", "👍", 3, 6, 100)).toEqual({ value: "a👍b", caret: 3 });
    expect(insertCommentEmoji("e\u0301!", "❤️", 1, 2, 100)).toEqual({ value: "❤️!", caret: 2 });
  });

  it("clamps invalid selection offsets and rejects invalid limits", () => {
    expect(insertCommentEmoji("ok", "👍", -4, 99, 100)).toEqual({ value: "👍", caret: 2 });
    expect(insertCommentEmoji("ok", "👍", 2, 2, Number.NaN)).toBeNull();
  });
});
