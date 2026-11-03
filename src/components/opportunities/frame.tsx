"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BASE } from "./model";
import { Link, useApp, Provider } from "./state";
import { Icon } from "./visuals";
import { Hero, BetaNote } from "./components";
import { zec } from "./data";
import {
  BETA_PREVIEW,
  BETA_ZEC_USD,
  BETA_RATE_DATE,
  BETA_RATE_SOURCE,
} from "./beta";

export function Dialog({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const overflow = document.body.style.overflow;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={"op-dialog " + className}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== ref.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom
        ) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="rd-icon-button"
          onClick={onClose}
          aria-label={"Close " + title}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function Frame({ children }: { children: ReactNode }) {
  const a = useApp(),
    [about, setAbout] = useState(false);
  const active =
    a.path.includes("/campaigns/") || a.tab === "campaigns"
      ? "campaigns"
      : a.tab === "activity"
        ? "activity"
        : "explore";
  const showBanner =
    a.path === BASE && ["explore", "campaigns", "activity"].includes(a.tab);
  return (
    <section className="opportunities-beta" aria-label="Opportunities beta">
      <div className="op-content">
        <div className="op-page">
          {showBanner && (
            <Hero
              compact
              title="Zcash Opportunities"
              description={
                BETA_PREVIEW
                  ? "Discover ways to build with Zcash."
                  : "Contribute your skills. Earn Zcash."
              }
              stats={[
                [
                  BETA_PREVIEW ? "Per opportunity" : "Pledged rewards",
                  BETA_PREVIEW
                    ? "< 1 ZEC"
                    : zec(a.items.reduce((n, o) => n + o.reward, 0)) + " ZEC",
                ],
                ["Opportunities", String(a.items.length)],
                [
                  "Organizers",
                  String(new Set(a.items.map((o) => o.community)).size),
                ],
              ]}
            />
          )}
          <div className="op-appbar op-workspace-bar">
            <div className="op-workspace-bar-inner">
              <nav aria-label="Opportunities sections">
                {[
                  ["explore", "Explore"],
                  ["campaigns", "Campaigns"],
                  ["activity", "My work"],
                ].map(([key, label]) => (
                  <Link
                    key={key}
                    to={key === "explore" ? BASE : BASE + "?tab=" + key}
                    aria-current={active === key ? "page" : undefined}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              <div className="op-workspace-actions">
                <button
                  className="op-text op-about-action"
                  onClick={() => setAbout(true)}
                  aria-label="About Opportunities"
                >
                  <Icon name="info" size={16} />
                  <span>About</span>
                </button>
                {a.path === BASE && a.tab === "explore" && (
                  <Link
                    to={BASE + "/new"}
                    className="op-button primary op-new-opportunity"
                    aria-label="Create opportunity"
                  >
                    <Icon name="plus" size={16} />
                    <span>Create opportunity</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
          {showBanner && BETA_PREVIEW && (
            <BetaNote compact>
              Example rewards up to $100. Publishing and submissions are coming
              soon.
            </BetaNote>
          )}
          {children}
        </div>
        <Dialog
          open={about}
          onClose={() => setAbout(false)}
          title="About Opportunities"
        >
          <p>
            Explore tasks, contests and campaigns from across the Zcash
            ecosystem. The initial order is randomized for each visit, with no
            featured projects.
          </p>
          <div className="op-notice">
            <strong>Read-only beta</strong>
            <p>
              All opportunities, organizers and rewards are examples. Explore
              the setup and choose a stock cover; publishing, uploads,
              applications and entries are not available yet. No funds are
              committed and no project sponsorship is implied.
            </p>
          </div>
          <p className="beta-rate">
            Example conversion: 1 ZEC = $
            {BETA_ZEC_USD.toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
            USD · {BETA_RATE_DATE}.{" "}
            <a href={BETA_RATE_SOURCE} target="_blank" rel="noreferrer">
              CoinGecko reference
            </a>
            . This is not a live quote.
          </p>
        </Dialog>
        <Dialog
          open={a.authOpen}
          onClose={() => a.setAuthOpen(false)}
          title="Coming soon"
        >
          <p>Accounts and participation open after beta.</p>
        </Dialog>
        {a.toast && (
          <div className="op-toast" role="status">
            {a.toast}
          </div>
        )}
      </div>
    </section>
  );
}
export function OpportunitiesLayout({
  children,
  initialOrder,
  campaignOrder,
}: {
  children: ReactNode;
  initialOrder: string[];
  campaignOrder: string[];
}) {
  return (
    <Provider initialOrder={initialOrder} campaignOrder={campaignOrder}>
      <Frame>{children}</Frame>
    </Provider>
  );
}
