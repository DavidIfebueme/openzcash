"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BASE } from "./model";
import { Link, useApp, Provider } from "./state";
import { Icon } from "./visuals";
import { BETA_ZEC_USD, BETA_RATE_DATE, BETA_RATE_SOURCE } from "./beta";

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
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={"op-dialog " + className}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
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
      {children}
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
  return (
    <section className="opportunities-beta" aria-label="Opportunities beta">
      <div className="op-content">
        <div className="op-appbar">
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
          <div className="op-appactions">
            <span className="beta-label">Beta</span>
            <button
              className="op-text"
              onClick={() => setAbout(true)}
              aria-label="About Opportunities"
            >
              <Icon name="info" size={16} />
              <span>About</span>
            </button>
          </div>
        </div>
        <div className="op-page">{children}</div>
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
