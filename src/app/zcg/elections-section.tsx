import { Card } from "@/components/ui";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  type Election,
  currentElection,
  getElections,
  isElectionClosed,
} from "@/lib/zcg/governance-repo";
import { cn } from "@/lib/utils";
import {
  DecidedBy,
  DecisionHomes,
} from "@/components/governance/decision-homes";
import {
  electionRecord,
  type ElectionEntry,
  type RecordElection,
} from "@/lib/governance/decisions";
import record from "@/data/governance/record.json";
import {
  type ElectionForm,
  ElectionControls,
  NewElectionButton,
} from "./governance-admin";

const RECORD_ELECTIONS = (record as unknown as { elections: RecordElection[] })
  .elections;

function fmt(iso?: string | null): string {
  if (!iso) return "·";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Results day, or its month when only the month is on record. */
function when(e: ElectionEntry): string {
  if (e.date) return fmt(e.date);
  if (!e.month) return "·";
  return new Date(`${e.month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysLeft(iso?: string | null): number | null {
  if (!iso) return null;
  const end = new Date(`${iso}T20:00:00Z`).getTime();
  return Math.ceil((end - Date.now()) / 86_400_000);
}

function toForm(e: Election): ElectionForm {
  return {
    title: e.title,
    status: e.status,
    seats: String(e.seats),
    url: e.url,
    nominationsClose: e.nominationsClose ?? "",
    communityCall: e.communityCall ?? "",
    votingCloses: e.votingCloses ?? "",
    resultsBy: e.resultsBy ?? "",
    elected: (e.elected ?? []).join(", "),
    note: e.note ?? "",
  };
}

function KeyDate({
  label,
  value,
  state = "todo",
}: {
  label: string;
  value: string;
  state?: "done" | "active" | "todo";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        state === "active"
          ? "border-emerald-500/40 bg-emerald-500/[0.07]"
          : "border-stone-200 bg-white",
      )}
    >
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-stone-600">
        {state === "done" ? (
          <span className="text-emerald-600">✓</span>
        ) : state === "active" ? (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        ) : null}
        {label}
      </p>
      <p className="mt-0.5 text-xs font-medium text-stone-800 tnum">{value}</p>
    </div>
  );
}

export async function ElectionsSection() {
  const [isAdmin, elections] = await Promise.all([
    getIsAdmin(),
    getElections(),
  ]);
  const current = currentElection(elections);
  const past = elections.filter((e) => isElectionClosed(e));
  const entries = electionRecord(RECORD_ELECTIONS, past);
  const left = current ? daysLeft(current.votingCloses) : null;

  return (
    <section id="elections" className="mb-8 scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-stone-700">
          Committee elections
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <DecidedBy who="ZCAP" how="Zcash Community Advisory Panel" />
          {isAdmin ? <NewElectionButton /> : null}
        </div>
      </div>

      {current ? (
        <div className="relative">
          {/* breathing neon glow to flag a live vote */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-1 animate-pulse rounded-[1.25rem] bg-gradient-to-r from-emerald-400/40 via-emerald-500/40 to-teal-400/40 blur-lg"
          />
          <Card className="relative overflow-hidden border-emerald-400/40 bg-gradient-to-br from-emerald-500/[0.08] to-white shadow-[0_0_28px_-6px_rgba(16,185,129,0.5)] ring-1 ring-emerald-400/50">
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Live · a community vote is happening right now
              </span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-stone-900">
                    {current.title}
                  </p>
                  <span className="text-xs text-stone-600">
                    {current.seats} seats
                  </span>
                  {isAdmin ? (
                    <ElectionControls
                      id={current.id}
                      initial={toForm(current)}
                    />
                  ) : null}
                </div>
                {current.note ? (
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-stone-600">
                    {current.note}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700/70">
                  Voting closes
                </p>
                <p className="text-lg font-semibold text-stone-900 tnum">
                  {fmt(current.votingCloses)}
                </p>
                {left != null && left >= 0 ? (
                  <p className="text-xs font-medium text-emerald-700">
                    {left} day{left === 1 ? "" : "s"} left · 20:00 UTC
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <KeyDate
                label="Nominations"
                value={fmt(current.nominationsClose)}
                state="done"
              />
              <KeyDate
                label="Community call"
                value={fmt(current.communityCall)}
                state="done"
              />
              <KeyDate
                label="Voting closes"
                value={fmt(current.votingCloses)}
                state="active"
              />
              <KeyDate label="Results by" value={fmt(current.resultsBy)} />
            </div>

            <div className="mt-4">
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-900/25 transition hover:bg-emerald-400"
              >
                Vote now on the forum ↗
              </a>
            </div>
          </Card>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-600">
            Past elections
          </p>
          {entries.length > 0 ? (
            <span className="tnum text-xs font-medium text-stone-600">
              {entries.length} closed
            </span>
          ) : null}
        </div>

        {entries.length === 0 ? (
          <Card className="border-dashed border-stone-200 px-4 py-10 text-center">
            <p className="text-sm text-stone-600">No past elections yet.</p>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => {
              const fromDb = e.dbId
                ? past.find((x) => x.id === e.dbId)
                : undefined;
              const href = e.sources[0]?.href;
              return (
                <li key={e.id}>
                  <Card className="flex h-full flex-col gap-2 border-stone-200/80 p-3.5 transition-colors hover:border-amber-300/70">
                    {/* Label + seats */}
                    <div className="flex items-start justify-between gap-2">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Official results for ${e.label}`}
                          className="group inline-flex min-w-0 items-start gap-1 text-[13px] font-semibold leading-snug tracking-tight text-stone-900 hover:text-amber-700"
                        >
                          <span>{e.label.replace(/ Election$/, "")}</span>
                          <span
                            aria-hidden
                            className="shrink-0 text-amber-600/70"
                          >
                            ↗
                          </span>
                        </a>
                      ) : (
                        <span className="text-[13px] font-semibold leading-snug tracking-tight text-stone-900">
                          {e.label.replace(/ Election$/, "")}
                        </span>
                      )}
                      <span className="tnum shrink-0 rounded-full border border-amber-300/50 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        {e.seats} {e.seats === 1 ? "seat" : "seats"}
                      </span>
                    </div>

                    {/* Elected, with approvals when the tally is public */}
                    <ul className="flex flex-wrap gap-1">
                      {e.elected.map((m, i) => (
                        <li
                          key={`${e.id}-${i}`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 py-0.5 pl-1.5 pr-2 text-[11px] font-medium text-emerald-800"
                        >
                          <span
                            aria-hidden="true"
                            className="h-1 w-1 shrink-0 rounded-full bg-emerald-500"
                          />
                          <span className="leading-none">
                            {m.name}
                            {m.approvals != null ? (
                              <span className="tnum font-normal text-emerald-700/80">
                                {" "}
                                · {m.approvals}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <p className="tnum mt-auto pt-0.5 text-[11px] text-stone-600">
                      {when(e)}
                      {e.ballots != null ? ` · ${e.ballots} ballots` : ""}
                      {e.sources[1] ? (
                        <>
                          {" · "}
                          <a
                            href={e.sources[1].href}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-amber-700"
                          >
                            Thread ↗
                          </a>
                        </>
                      ) : null}
                    </p>

                    {isAdmin && fromDb ? (
                      <div className="border-t border-stone-100 pt-2">
                        <ElectionControls
                          id={fromDb.id}
                          initial={toForm(fromDb)}
                        />
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <DecisionHomes current="elections" />
    </section>
  );
}
