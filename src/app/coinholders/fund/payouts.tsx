import { formatPaidZec, type PayoutSummary } from "@/lib/coinholder/fund";
import { Stat } from "../stat";
import styles from "../coinholders.module.css";

const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
export const price = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * What has left the fund, by round, as FPF reports it: the totals, then one
 * row per payout with the ZEC sent, the grants' USD value and the ZEC/USD
 * price the two imply. Renders nothing until a payout has been reported.
 */
export function Payouts({
  summary,
  sheetUrl,
  multisigUrl,
}: {
  summary: PayoutSummary;
  sheetUrl: string;
  multisigUrl: string;
}) {
  const { rows, totalUsd, totalZec, totalGrants } = summary;
  if (!rows.length) return null;
  const latest = rows.reduce((a, b) =>
    Date.parse(b.date) >= Date.parse(a.date) ? b : a,
  );
  const roundsLabel = `${rows.length} ${rows.length === 1 ? "round" : "rounds"}`;
  return (
    <section className={styles.panel} aria-labelledby="payouts">
      <div className={styles.panelHead}>
        <h2 id="payouts" className={styles.panelTitle}>
          Paid from the fund
        </h2>
      </div>
      <div className={`${styles.stats} ${styles.flush}`}>
        <Stat
          label="Paid out"
          value={formatPaidZec(totalZec)}
          unit="ZEC"
          sub={
            totalGrants !== null
              ? `${totalGrants} grants in ${roundsLabel}`
              : roundsLabel
          }
        />
        <Stat
          label="In USD"
          value={usd(totalUsd)}
          sub="the grants' value when paid"
        />
        <Stat
          label="Latest payout"
          value={latest.date}
          sub={`${latest.round} · ${formatPaidZec(latest.zec)} ZEC`}
        />
      </div>
      <div className={styles.panelBody}>
        <div className={styles.tableScroll}>
          <table className={styles.mini}>
            <caption className="sr-only">
              Payouts from the fund by round: date, grants, USD, ZEC and the
              price each implies
            </caption>
            <thead>
              <tr>
                <th scope="col">Round</th>
                <th scope="col">Paid on</th>
                <th scope="col">Grants</th>
                <th scope="col">In USD</th>
                <th scope="col">In ZEC</th>
                <th scope="col">ZEC/USD</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.roundId}>
                  <th scope="row">
                    <a href={r.source} target="_blank" rel="noreferrer">
                      {r.round}
                    </a>
                  </th>
                  <td>{r.date}</td>
                  <td>{r.grants ?? "·"}</td>
                  <td>{usd(r.usd)}</td>
                  <td>{formatPaidZec(r.zec)}</td>
                  <td>{price(r.zecUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.panelNote}>
          Grants are set in USD and paid in ZEC on the day, so their ZEC cost
          moves with the price. The key-holders sent the Q3 2026 grants through
          the shielded pool, so the chain shows what left the multisig, not each
          grant. Amounts by grant are in{" "}
          <a href={sheetUrl} target="_blank" rel="noreferrer">
            FPF&apos;s Coinholder sheet
          </a>
          ; the multisig is{" "}
          <a href={multisigUrl} target="_blank" rel="noreferrer">
            on the explorer
          </a>
          .
        </p>
      </div>
    </section>
  );
}
