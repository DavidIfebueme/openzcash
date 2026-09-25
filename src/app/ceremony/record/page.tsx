import { AFTER, RECORDS, gigabytes } from "@/lib/ceremony/record";
import { clock } from "@/lib/ceremony/recordings";
import { Pager, PartHeader, partEyebrow } from "../part-chrome";
import styles from "../ceremony.module.css";

export const metadata = {
  title: "The record · Zcash Ceremony · OpenZcash",
  description:
    "What the 2016 Zcash ceremony left on the record, where it lives and under which licence: footage, transcript, keys, disc images, Radiolab and the short film.",
};

export default function RecordPage() {
  return (
    <div className={styles.page}>
      <PartHeader eyebrow={partEyebrow("record")} title="The record">
        What the ceremony left on the record, where each piece lives and the
        licence it carries. The originals stay at their source; OpenZcash plays
        and links them.
      </PartHeader>

      <div className={`${styles.card} ${styles.wrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Item</th>
              <th className={styles.hideSm}>Contents</th>
              <th className={styles.num}>Size</th>
              <th className={`${styles.num} ${styles.hideSm}`}>Length</th>
              <th className={styles.hideSm}>Licence</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {RECORDS.map((r) => (
              <tr key={r.item}>
                <td>
                  <strong>{r.item}</strong>
                </td>
                <td className={styles.hideSm}>{r.contents}</td>
                <td className={styles.num}>{gigabytes(r.bytes)}</td>
                <td className={`${styles.num} ${styles.hideSm}`}>
                  {r.lengthS === null ? "·" : clock(r.lengthS)}
                </td>
                <td className={styles.hideSm}>{r.licence}</td>
                <td>
                  <a
                    className={styles.link}
                    href={r.source.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {r.source.label} ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        Sizes from the Internet Archive&apos;s item metadata, counting the
        original files only; lengths from the Internet Archive, YouTube and
        Radiolab&apos;s podcast feed, checked September 25, 2026. &ldquo;Not
        stated&rdquo; means the item carries no licence of its own.
      </p>

      <section className={styles.section} aria-labelledby="after">
        <h2 id="after" className={styles.h2}>
          What came after
        </h2>
        <div className={styles.after}>
          {AFTER.map((a) => (
            <div key={a.title} className={`${styles.card} ${styles.afterCard}`}>
              <span className={styles.date}>{a.date}</span>
              <span className={styles.afterTitle}>{a.title}</span>
              <span className={styles.muted}>{a.text}</span>
            </div>
          ))}
        </div>
      </section>

      <Pager slug="record" />
    </div>
  );
}
