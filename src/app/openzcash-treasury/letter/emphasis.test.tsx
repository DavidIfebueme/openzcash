// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { emphasize } from "./emphasis";

afterEach(cleanup);

it("sets a marked phrase in bold and leaves the rest of the paragraph as written", () => {
  const { container } = render(<p>{emphasize("**We will not apply** for a grant.")}</p>);
  expect(container.querySelector("strong")?.textContent).toBe("We will not apply");
  expect(container.textContent).toBe("We will not apply for a grant.");
});

it("returns unmarked copy unchanged", () => {
  const { container } = render(<p>{emphasize("Plain sentence.")}</p>);
  expect(container.querySelector("strong")).toBeNull();
  expect(container.textContent).toBe("Plain sentence.");
});
