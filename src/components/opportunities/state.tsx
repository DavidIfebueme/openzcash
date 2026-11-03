"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import NextLink from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  BASE,
  sampleCampaigns,
  sampleOpportunities,
  sampleOrganizers,
  type Draft,
  type Opportunity,
  type Organizer,
  type Campaign,
  type Contribution,
  type Profile,
} from "./model";
import { betaMutation } from "./beta";

const noWrite = betaMutation<unknown[]>(() => {});
const emptyDrafts: Draft[] = [],
  emptyItems: Opportunity[] = [],
  emptyOrganizers: Organizer[] = [],
  emptyCampaigns: Campaign[] = [],
  emptyContributions: Contribution[] = [];
function useStateValue(initialOrder: string[], campaignOrder: string[]) {
  const path = usePathname(),
    search = useSearchParams(),
    router = useRouter();
  const params = new URLSearchParams(search.toString()),
    tab = params.get("tab") || "explore";
  const location = path + (params.size ? "?" + params : "");
  // Server-generated order is the same during hydration and all inner navigation.
  const [order] = useState(initialOrder),
    [campaignIds] = useState(campaignOrder);
  const items = order
    .map((id) => sampleOpportunities.find((o) => o.id === id)!)
    .filter(Boolean);
  const campaigns = campaignIds
    .map((id) => sampleCampaigns.find((c) => c.id === id)!)
    .filter(Boolean);
  const [bookmarks, setBookmarks] = useState<string[]>([]),
    [bookmarksLoaded, setBookmarksLoaded] = useState(false);
  const [toast, setToast] = useState(""),
    [authOpen, setAuthOpen] = useState(false),
    [profile, setProfile] = useState<Profile | null>(null);
  const lastList = useRef(BASE);
  useEffect(() => {
    let saved: string[] = [];
    try {
      const value = JSON.parse(
        localStorage.getItem("oz-opportunities-beta:bookmarks") || "[]",
      );
      if (Array.isArray(value))
        saved = value.filter(
          (id: unknown) =>
            typeof id === "string" &&
            sampleOpportunities.some((o) => o.id === id),
        );
    } catch {}
    // Browser preferences load after the shared server/client initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBookmarks(saved);
    setBookmarksLoaded(true);
  }, []);
  useEffect(() => {
    if (bookmarksLoaded)
      try {
        localStorage.setItem(
          "oz-opportunities-beta:bookmarks",
          JSON.stringify(bookmarks),
        );
      } catch {}
  }, [bookmarks, bookmarksLoaded]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path, tab]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  function rememberList() {
    if (
      path === BASE ||
      path.startsWith(BASE + "/campaigns/") ||
      path.startsWith(BASE + "/communities/")
    )
      lastList.current = location;
  }
  function go(to: string, replace = false) {
    rememberList();
    if (to.split("?")[0] === path) {
      window.history[replace ? "replaceState" : "pushState"](null, "", to);
    } else router[replace ? "replace" : "push"](to, { scroll: true });
  }
  function filter(key: string, value: string) {
    const p = new URLSearchParams(params);
    if (value && value !== "all") p.set(key, value);
    else p.delete(key);
    go(path + (p.size ? "?" + p : ""), true);
  }
  function toggleSave(id: string) {
    setBookmarks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  const organizers: Organizer[] = [
    {
      id: "personal",
      name: "Your profile",
      mark: "YO",
      color: "gold",
      description: "Demo contributor",
    },
    ...sampleOrganizers,
  ];
  const managed = organizers.map((o) => o.id);
  function organizerFor(id: string) {
    return (
      organizers.find((o) => o.id === id) || {
        id,
        name: "Example organizer",
        mark: "EO",
        color: "gold",
        description: "",
      }
    );
  }
  return {
    location,
    path,
    params,
    tab,
    go,
    filter,
    rememberList,
    lastList,
    items,
    campaigns,
    organizers,
    organizerFor,
    managed,
    bookmarks,
    toggleSave,
    profile,
    setProfile,
    toast,
    setToast,
    authOpen,
    setAuthOpen,
    drafts: emptyDrafts,
    published: emptyItems,
    localOrganizers: emptyOrganizers,
    localCampaigns: emptyCampaigns,
    submissions: emptyContributions,
    saveDraft: noWrite,
    finishDraft: noWrite,
    setLocalOrganizers: noWrite as Dispatch<SetStateAction<Organizer[]>>,
    setLocalCampaigns: noWrite as Dispatch<SetStateAction<Campaign[]>>,
    setSubmissions: noWrite as Dispatch<SetStateAction<Contribution[]>>,
  };
}
type State = ReturnType<typeof useStateValue>;
const Context = createContext<State | null>(null);
export function Provider({
  children,
  initialOrder,
  campaignOrder,
}: {
  children: ReactNode;
  initialOrder: string[];
  campaignOrder: string[];
}) {
  const value = useStateValue(initialOrder, campaignOrder);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp() {
  const state = useContext(Context);
  if (!state) throw Error("Missing Opportunities provider");
  return state;
}
export function Link({
  to,
  children,
  onClick,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-current"?: "page";
  onClick?: () => void;
}) {
  const { rememberList } = useApp();
  return (
    <NextLink
      href={to}
      {...props}
      onClick={() => {
        rememberList();
        onClick?.();
      }}
    >
      {children}
    </NextLink>
  );
}
