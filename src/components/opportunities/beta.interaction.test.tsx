// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OpportunitiesLayout } from "./frame";
import { OpportunitiesRoutes } from "./routes";
import { sampleCampaigns, sampleOpportunities } from "./model";

const navigation = vi.hoisted(() => ({
  path: "/opportunities",
  search: "",
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock("next/image", () => ({
  default: ({
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    void _unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

const order = sampleOpportunities.map((o) => o.id).reverse();
function Beta() {
  return (
    <OpportunitiesLayout
      initialOrder={order}
      campaignOrder={sampleCampaigns.map((c) => c.id)}
    >
      <OpportunitiesRoutes />
    </OpportunitiesLayout>
  );
}

beforeEach(() => {
  navigation.path = "/opportunities";
  navigation.search = "";
  localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps randomized order when filtering and returning from a detail", () => {
  const view = render(<Beta />);
  const links = () =>
    Array.from(view.container.querySelectorAll(".op-card h2 a")).map((a) =>
      a.getAttribute("href")?.split("/").pop(),
    );
  expect(links()).toEqual(order);
  navigation.search = "type=Task";
  view.rerender(<Beta />);
  expect(links()).toEqual(
    order.filter(
      (id) => sampleOpportunities.find((o) => o.id === id)?.type === "Task",
    ),
  );
  navigation.path = "/opportunities/tasks/" + order[0];
  view.rerender(<Beta />);
  navigation.path = "/opportunities";
  navigation.search = "";
  view.rerender(<Beta />);
  expect(links()).toEqual(order);
});

it("allows choosing stock art but cannot advance, upload or publish, even with a draft query", () => {
  navigation.path = "/opportunities/new";
  navigation.search = "draft=legacy&step=3";
  localStorage.setItem(
    "oz-opportunities:drafts",
    JSON.stringify([{ id: "legacy", step: 3, title: "Legacy draft" }]),
  );
  const writes = vi.spyOn(Storage.prototype, "setItem");
  const view = render(<Beta />);
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
    target: { value: "Try another wallet" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Change cover" }));
  const dialog = screen.getByRole("dialog", { name: "Choose a cover" });
  expect(
    within(dialog).getAllByRole("button", { name: /^Choose / }),
  ).toHaveLength(27);
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Choose Zingo!" }),
  );
  expect(
    view.container.querySelector(".cover-current strong")?.textContent,
  ).toBe("Zingo!");
  expect(
    (screen.getByRole("button", { name: "Upload image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("button", { name: /Continue/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  for (const button of within(
    screen.getByRole("list", { name: "Creation progress" }),
  )
    .getAllByRole("button")
    .slice(1)) {
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
  }
  expect(screen.getByRole("heading", { name: "Basics" })).toBeTruthy();
  expect(view.container.querySelector('input[type="file"]')).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: /Publish in preview|Sign in to publish/,
    }),
  ).toBeNull();
  expect(
    writes.mock.calls.every(
      ([key]) => key === "oz-opportunities-beta:bookmarks",
    ),
  ).toBe(true);
});

it.each(["Task", "Contest"])(
  "keeps %s participation locked while details remain readable",
  (type) => {
    const item = sampleOpportunities.find((o) => o.type === type)!;
    navigation.path = "/opportunities/tasks/" + item.id;
    const view = render(<Beta />);
    const action = screen.getByRole("button", {
      name: type === "Task" ? "Applications soon" : "Submissions soon",
    }) as HTMLButtonElement;
    expect(action.disabled).toBe(true);
    fireEvent.click(action);
    expect(view.container.querySelector("#contribution-form")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Acceptance criteria" }),
    ).toBeTruthy();
  },
);

it.each(["campaigns", "communities"])(
  "keeps %s creation locked when a form is submitted directly",
  (kind) => {
    navigation.path = "/opportunities/" + kind + "/new";
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const view = render(<Beta />);
    expect(
      (screen.getByRole("button", { name: "Coming soon" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.submit(view.container.querySelector("form")!);
    expect(screen.queryByRole("heading", { name: /Review your/ })).toBeNull();
    expect(
      writes.mock.calls.every(
        ([key]) => key === "oz-opportunities-beta:bookmarks",
      ),
    ).toBe(true);
  },
);
