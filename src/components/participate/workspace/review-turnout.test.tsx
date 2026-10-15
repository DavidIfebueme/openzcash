// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ReviewTurnout } from "./review-turnout";
afterEach(cleanup);

it("distinguishes an opened review with no responses from an unknown source", () => {
  const { rerender } = render(<ReviewTurnout recorded={0} eligible={5} />);
  expect(screen.getByRole("group", { name: /^0% turnout: 0 of 5/ })).toBeTruthy();
  rerender(<ReviewTurnout />);
  expect(screen.getByRole("group", { name: /^Turnout unavailable/ })).toBeTruthy();
  expect(screen.queryByText("0%")).toBeNull();
});

it.each([[6, 5], [-1, 5], [1, 0], [NaN, 5], [2.5, 5], [4, NaN]])("does not display impossible participation %s / %s", (recorded, eligible) => {
  render(<ReviewTurnout recorded={recorded} eligible={eligible} />);
  expect(screen.getByRole("group", { name: /^Turnout unavailable/ })).toBeTruthy();
  expect(screen.getByText("—")).toBeTruthy();
});
