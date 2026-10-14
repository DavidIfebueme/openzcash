import { getPaymentSchedule } from "@/lib/zcg/schedule-repo";
import Link from "next/link";
import { PageHeader, Stat } from "@/components/ui";
import { disbursementsSummary } from "@/lib/zcg/disbursements-repo";
import { listProposals, officeUnderReview } from "@/lib/zcg/proposals-repo";
import { publicationDay } from "@/lib/zcg/publication-policy";
import { cached, LEDGER_TTL_MS } from "@/lib/cache/memo";
import { currentElection, getElections } from "@/lib/zcg/governance-repo";
import { formatUsdCents } from "@/lib/zcg/format";
import { formatZecCompact } from "@/lib/zcash/units";
import { listChangelog } from "@/lib/zcg/changelog";
import { proposalStatusLabel } from "@/lib/zcg/status-labels";
import { MEMBERS, SEATED_FROM } from "./current-committee-data";
import { maybeAutoRefresh } from "@/lib/zcg/freshness";
import { homeMetadata } from "@/lib/seo/page-metadata";
import "./overview.css";

export const dynamic = "force-dynamic";
// The root redirects here, so a shared openzcash.org link previews as the
// site (site title, description and card), while the tab still reads ZCG.
export const metadata = homeMetadata({ title: "ZCG · OpenZcash", path: "/zcg" });

type Tile = { href: string; label: string; sub: string; mark: string };

// Every ZCG tool stays one click away; the four primary records carry counts.
// Marks are the sidebar's page glyphs (PNG).
const glyph = (name: string) => `/logos/glyphs/${name}.png`;
const TILES: Tile[] = [
  { href: "/zcg/totals", label: "Totals", sub: "Where the money goes", mark: glyph("totals") },
  { href: "/zcg/grants", label: "Grants", sub: "Approved projects", mark: glyph("grants") },
  { href: "/zcg/disbursements", label: "Disbursements", sub: "The full ledger", mark: glyph("disbursements") },
  { href: "/zcg/recipients", label: "Recipients", sub: "By amount received", mark: glyph("recipients") },
  { href: "/zcg/proposals", label: "Proposals", sub: "Governance funnel", mark: glyph("proposals") },
  { href: "/zcg/committee", label: "Committee", sub: "Members, mandates & elections", mark: glyph("committee") },
  { href: "/zcg/analytics", label: "Insights", sub: "Burn-rate & delivery", mark: glyph("insights") },
  { href: "/zcg/investments", label: "Investments", sub: "Maya liquidity position", mark: glyph("investments") },
  { href: "/zcg/stipends", label: "Stipends", sub: "Committee pay", mark: glyph("stipends") },
  { href: "/zcg/budget", label: "Budget", sub: "Discretionary · USD × ZEC", mark: glyph("budget") },
  { href: "/coinholders", label: "Coinholder program", sub: "Coinholder-directed grants", mark: glyph("coinholder") },
  { href: "/zcg/reconciliation", label: "Reconciliation", sub: "On-chain ↔ ledger", mark: glyph("reconciliation") },
  { href: "/zcg/meetings", label: "Meetings", sub: "Committee minutes", mark: glyph("meetings") },
  { href: "/zcg/methodology", label: "Methodology", sub: "Sources & API", mark: glyph("methodology") },
  { href: "/zcg/copilot", label: "ZCG Copilot", sub: "Ask about public records", mark: glyph("copilot") },
];

const PRIMARY_ROUTES = [
  "/zcg/grants",
  "/zcg/proposals",
  "/zcg/disbursements",
  "/zcg/recipients",
];

const changeLabel = (v: string | null) => proposalStatusLabel(v);

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m ?? 1) - 1];
  return `${month} ${d}, ${y}`;
}

export default async function ZcgPage() {
  // The home is the stale-on-load fallback for the mirror: the boot scheduler
  // refreshes every 6h, and a render older than that kicks a re-import too.
  void maybeAutoRefresh();
  const [s, changes, schedule, proposals, queue, elections] = await Promise.all([
    disbursementsSummary(),
    listChangelog(7, 12, "zcg").catch(() => []),
    // Derived figure; never lets the app's first screen fail.
    getPaymentSchedule().catch(() => null),
    // Same published (D-1) list and cache entry as /zcg/proposals.
    cached(`listProposals:all:${publicationDay()}`, LEDGER_TTL_MS, () =>
      listProposals({}),
    ).catch(() => null),
    // The published review queue, the same set the 3D office walks.
    officeUnderReview(100).catch(() => null),
    getElections().catch(() => []),
  ]);
  const underReview = queue ? queue.length : null;
  const liveElection = currentElection(elections);
  const next = schedule?.rows[0] ?? null;
  // Include current-year past estimates; earlier years remain separate history.
  const scheduledCents = schedule ? schedule.totalCents + schedule.currentYearPast.totalCents : 0n;
  const scheduledCount = schedule ? schedule.rows.length + schedule.currentYearPast.rows.length - schedule.currentYearPast.excludedAmounts : 0;
  const [dollars, cents] = formatUsdCents(scheduledCents).split(".");

  const primaryCounts: Record<string, string> = {
    "/zcg/grants": `${s.grantCount} approved projects`,
    "/zcg/proposals":
      proposals && underReview != null
        ? `${proposals.length} · ${underReview} under review`
        : "Governance funnel",
    "/zcg/disbursements": `${s.count.toLocaleString("en-US")} ledger rows`,
    "/zcg/recipients": `${s.recipientCount} · by amount received`,
  };

  return (
    <div className="zcg-overview">
      <PageHeader
        title="Zcash Community Grants"
        subtitle="Public accounting for Zcash Community Grants, imported from the official spreadsheet. An off-chain disbursement ledger that can be cross-referenced with the on-chain Lockbox/ZCG outflows."
      />

      <section className="zcg-overview-metrics" aria-label="Funding summary">
        <Stat
          label="Grants"
          value={String(s.grantCount)}
          sub={`approved projects · ${s.paidCount} payments made`}
        />
        <Stat
          label="USD paid to date"
          value={formatUsdCents(s.usdPaidCents, { compact: true })}
          sub="budgeted value of paid entries"
          tone="warn"
        />
        <Stat
          label="ZEC paid (ledger)"
          value={formatZecCompact(s.zecPaidZat, { symbol: false })}
          sub="recorded by the spreadsheet"
        />
        <Stat
          label="Recipients"
          value={String(s.recipientCount)}
          sub="orgs and individuals"
        />
      </section>

      {liveElection ? (
        <Link href="/zcg/committee" className="zcg-live-vote">
          <span className="zcg-live-dot" aria-hidden />
          <strong>Live · a community vote is happening right now</strong>
          <span>
            {liveElection.title} · {liveElection.seats} seats
            {liveElection.votingCloses
              ? ` · voting closes ${formatDay(liveElection.votingCloses)}`
              : ""}
          </span>
          <span aria-hidden>→</span>
        </Link>
      ) : null}

      <div className="zcg-two">
        <div className="zcg-col">
        <section
          className="zcg-overview-schedule"
          aria-labelledby="overview-schedule-title"
        >
          <div className="zcg-card-head">
            <h2 id="overview-schedule-title">Scheduled payments</h2>
            <Link href="/zcg/schedule">Open schedule →</Link>
          </div>
          {schedule ? (
            <>
              <p className="zcg-overview-schedule-value tnum">
                {dollars}<small>.{cents ?? "00"}</small>
              </p>
              <p className="zcg-overview-schedule-note">
                <strong>{scheduledCount} {scheduledCount === 1 ? "entry" : "entries"} · Payment not recorded</strong>
                Includes upcoming estimates and current-year past estimates ({schedule.scheduleYear}). Earlier years are separate history.
              </p>
              {next ? (
                <p className="zcg-overview-next">
                  <span>
                    Next · <b className="tnum">{next.estimatedPayoutDate}</b> ·{" "}
                    <Link href={`/zcg/grant?g=${encodeURIComponent(next.project ?? "")}`}>
                      {next.project}
                    </Link>
                    {next.milestoneLabel ? `, ${next.milestoneLabel}` : ""}
                  </span>
                  <b className="tnum">{formatUsdCents(next.amountUsdCents)}</b>
                </p>
              ) : null}
            </>
          ) : (
            <p className="zcg-overview-schedule-note">
              The schedule is temporarily unavailable.
            </p>
          )}
        </section>

        <nav className="zcg-tools" aria-label="More ZCG tools">
          {TILES.filter((tile) => !PRIMARY_ROUTES.includes(tile.href)).map(
            (tile) => (
              <Link key={tile.href} href={tile.href}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tile.mark} alt="" width={16} height={16} />
                <span>
                  <strong>{tile.label}</strong>
                  <small>{tile.sub}</small>
                </span>
              </Link>
            ),
          )}
        </nav>
        </div>

        <section className="zcg-changes" aria-labelledby="overview-changes-title">
          <div className="zcg-card-head">
            <h2 id="overview-changes-title">Changed this week</h2>
            <a href="/api/feeds/zcg.xml" title="Subscribe to changes via RSS">
              RSS ↗
            </a>
          </div>
          {changes.length > 0 ? (
            <ul>
              {changes.map((c) => (
                <li key={c.id}>
                  <span className="zcg-change-text">
                    {c.kind === "proposal_status" ? (
                      <Link href={`/zcg/proposals?status=${c.toVal ?? ""}`}>
                        <span className="zcg-change-title">{c.title}</span>
                        <span className="zcg-change-muted">
                          {" "}
                          moved {changeLabel(c.fromVal)} →{" "}
                        </span>
                        <span className="zcg-change-title">
                          {changeLabel(c.toVal)}
                        </span>
                      </Link>
                    ) : c.kind === "proposal_new" ? (
                      <Link href="/zcg/proposals?status=under_review">
                        <span className="zcg-change-muted">New proposal · </span>
                        <span className="zcg-change-title">{c.title}</span>
                      </Link>
                    ) : (
                      <Link href="/zcg/disbursements">
                        <span className="zcg-change-title">{c.title}</span>
                        <span className="zcg-change-muted"> · {c.detail}</span>
                      </Link>
                    )}
                  </span>
                  <span className="zcg-change-date tnum">
                    {c.at.toISOString().slice(5, 10).replace("-", "/")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="zcg-overview-schedule-note">
              No changes recorded in the last seven days.
            </p>
          )}
          <p className="zcg-card-foot">
            Automatic diff between daily imports of the official spreadsheet:
            new proposals, verdict changes, and newly recorded payments.
          </p>
        </section>
      </div>

      <nav className="zcg-overview-primary" aria-label="Grant records">
        {PRIMARY_ROUTES.map((href) =>
          TILES.find((tile) => tile.href === href)!,
        ).map((tile) => (
          <Link key={tile.href} href={tile.href}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tile.mark} alt="" width={18} height={18} />
            <span>
              <strong>{tile.label}</strong>
              <small>{primaryCounts[tile.href] ?? tile.sub}</small>
            </span>
            <span aria-hidden>→</span>
          </Link>
        ))}
      </nav>

      <section className="zcg-committee-row" aria-label="Current committee">
        <div className="zcg-avatars">
          {MEMBERS.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.name} src={m.img} alt="" width={30} height={30} />
          ))}
        </div>
        <div>
          <strong>
            Current committee · {MEMBERS.length} seats · from {SEATED_FROM}
          </strong>
          <small>
            {MEMBERS.map((m) => m.name).join(", ")} · source-linked roles,
            terms, elections, stipends and minutes
          </small>
        </div>
        <Link href="/zcg/committee">Committee →</Link>
      </section>

      <Link className="zcg-overview-office" href="/zcg/office">
        <span>
          <strong>Step into the ZCG office</strong>
          <small>
            A living 3D room where every proposal under review walks the floor
            as a zebra, in front of the committee.
          </small>
        </span>
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
