import { getTreasurySummary } from "@/lib/zcash/treasury-summary";
import { TreasuryPool } from "./treasury-pool";

/**
 * The treasuries, pinned to the bottom of every shell page: ZCG's operating
 * balance, the Lockbox / Coinholder pool and the NSM balance consensus holds
 * out of circulation. Each pool links to its own page on wide screens and is
 * plain figures in the phone's Treasury sheet (see TreasuryPool). Server component streamed into the client shell
 * through a Suspense boundary, so a slow price or chain source never delays
 * the page itself.
 */
export async function TreasuryBar() {
  const t = await getTreasurySummary();
  if (!t || (!t.operating && !t.lockbox && !t.nsm)) return null;
  const pools = [t.operating, t.lockbox, t.nsm].filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );
  return (
    <div className="rd-treasury-inner">
      <div className="rd-treasury-pools">
        {pools.map((p) => (
          <TreasuryPool
            key={p.name}
            href={p.href}
            className={
              p.asOf ? "rd-treasury-pool is-dated" : "rd-treasury-pool"
            }
            title={p.exact}
          >
            {/* One name line, so the pool is always wide enough for both. */}
            <span className="rd-treasury-head">
              <span className="rd-treasury-name">{p.name}</span>
              {p.asOf ? (
                // Only when the sheet figure is stale or flagged: its date, quietly.
                <span className="rd-treasury-asof tnum" title={p.asOf.title}>
                  {p.asOf.date ? (
                    <>
                      <span className="rd-treasury-asof-lead">as of </span>
                      {p.asOf.date}
                    </>
                  ) : (
                    "undated"
                  )}
                </span>
              ) : null}
            </span>
            <span className="rd-treasury-zec tnum">
              {p.zec} <small>ZEC</small>
            </span>
            {p.usd ? (
              <span className="rd-treasury-usd tnum">
                ≈ {p.usd}
                {p.sub ? ` · ${p.sub}` : ""}
              </span>
            ) : null}
          </TreasuryPool>
        ))}
      </div>
      <span className="rd-treasury-meta tnum">
        {t.height ? `block ${t.height}` : ""}
        {t.height && t.price ? " · " : ""}
        {t.price ? `ZEC ${t.price}` : ""}
      </span>
    </div>
  );
}
