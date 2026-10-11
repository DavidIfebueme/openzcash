"use client";

import styles from "./network-motion.module.css";

const defaultFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

type AnimatedValueProps = {
  value: number;
  format?: Intl.NumberFormat;
};

type Character = { key: string; value: string; digit: boolean };

/** Place-based keys preserve unchanged digits, even when the number grows. */
function characters(parts: Intl.NumberFormatPart[]): Character[] {
  let integerPlace = parts.filter((part) => part.type === "integer")
    .reduce((count, part) => count + Array.from(part.value).length, 0);
  let fractionalPlace = 0;
  const occurrences = new Map<string, number>();
  return parts.flatMap((part) => {
    const occurrence = occurrences.get(part.type) ?? 0;
    occurrences.set(part.type, occurrence + 1);
    const symbols = Array.from(part.value);
    return symbols.map((value, index) => {
      if (part.type === "integer") {
        integerPlace -= 1;
        return { key: `integer:${integerPlace}:${value}`, value, digit: true };
      }
      if (part.type === "fraction") {
        const place = fractionalPlace++;
        return { key: `fraction:${place}:${value}`, value, digit: true };
      }
      if (part.type === "exponentInteger") {
        return { key: `exponent:${symbols.length - index - 1}:${value}`, value, digit: true };
      }
      const place = part.type === "group" ? integerPlace : occurrence;
      return { key: `${part.type}:${place}:${index}:${value}`, value, digit: false };
    });
  });
}

/** Reveal only newly rendered digits; the displayed value is always the latest reading. */
export function AnimatedValue({ value, format = defaultFormat }: AnimatedValueProps) {
  const parts = format.formatToParts(value);
  const text = parts.map((part) => part.value).join("");
  return <span className={styles.value}>
    <span className={styles.screenReader}>{text}</span>
    <span className={styles.characters} aria-hidden="true">
      {characters(parts).map((character) => <span
        key={character.key}
        className={character.digit ? styles.digit : styles.symbol}
      >{character.value}</span>)}
    </span>
  </span>;
}
