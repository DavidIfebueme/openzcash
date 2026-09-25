import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAMERA_BITRATE_BPS,
  DURATION_S,
  MICS,
  VIEWS,
  mbPerMinute,
  partFrame,
  partAt,
  partsOf,
} from "./recordings";
import { LINEAGE, WITNESSES, OBSERVER, AUTHORS, uniquePeople } from "./people";
import { RECORDS } from "./record";
import { CHAPTERS, CORRECTIONS, TIMELINE, daysUntil } from "./story";

const PUBLIC = path.join(process.cwd(), "public");

describe("the Denver recording", () => {
  const parts = partsOf(DURATION_S, 7);

  it("splits 71:30 into seven contiguous parts", () => {
    expect(parts).toHaveLength(7);
    expect(parts[0].start).toBe(0);
    expect(parts.at(-1)!.end).toBe(DURATION_S);
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].start).toBe(parts[i - 1].end);
    }
    for (const p of parts) {
      expect(p.end - p.start).toBeGreaterThanOrEqual(612);
      expect(p.end - p.start).toBeLessThanOrEqual(614);
    }
  });

  it("finds the part a moment belongs to, clamped to the recording", () => {
    expect(partAt(parts, -5)).toBe(1);
    expect(partAt(parts, 0)).toBe(1);
    expect(partAt(parts, parts[1].start - 0.5)).toBe(1);
    expect(partAt(parts, parts[1].start)).toBe(2);
    expect(partAt(parts, DURATION_S)).toBe(7);
    expect(partAt(parts, DURATION_S + 60)).toBe(7);
  });

  it("offers three camera views and three microphones, all from the Internet Archive", () => {
    expect(VIEWS.map((v) => v.id)).toEqual([
      "camera-1",
      "camera-2",
      "camera-3",
    ]);
    expect(MICS).toHaveLength(3);
    for (const x of [...VIEWS, ...MICS]) {
      expect(x.url).toMatch(
        /^https:\/\/archive\.org\/download\/ThePhoneAnomalyDuringTheZcashCeremonyDenverStation\//,
      );
    }
    for (const m of MICS) expect(m.url).toMatch(/\.mp3$/);
  });

  it("ships a light poster per view and a frame for every part", () => {
    for (let i = 1; i <= 7; i++) {
      expect(existsSync(path.join(PUBLIC, partFrame(i))), partFrame(i)).toBe(true);
    }
    for (const v of VIEWS) {
      expect(existsSync(path.join(PUBLIC, v.poster)), v.poster).toBe(true);
      
    }
  });

  it("states the data cost of video and of listening only", () => {
    expect(mbPerMinute(CAMERA_BITRATE_BPS)).toBeCloseTo(69.6, 1);
    const listen = ((MICS[0].bytes / DURATION_S) * 60) / 1e6;
    expect(listen).toBeLessThan(1);
  });
});

describe("the people and the record", () => {
  it("names six witnesses, three of them under the pseudonyms of 2016, each with a source", () => {
    expect(WITNESSES).toHaveLength(6);
    expect(WITNESSES.filter((w) => w.knownAs).map((w) => w.knownAs)).toEqual([
      "Fabrice Renault",
      "Moses Spears",
      "John Dobbertin",
    ]);
    for (const w of [...WITNESSES, OBSERVER]) {
      expect(w.sources.length, w.name).toBeGreaterThan(0);
      for (const s of w.sources) expect(s.href).toMatch(/^https:\/\//);
    }
  });

  it("counts every person once across the groups", () => {
    expect(uniquePeople()).toHaveLength(23);
    expect(AUTHORS.length + LINEAGE.length + WITNESSES.length + 1).toBe(23);
  });

  it("links every record to its source and keeps the Denver camera sizes", () => {
    for (const r of RECORDS)
      expect(r.source.href, r.item).toMatch(/^https:\/\//);
    const cameras = RECORDS.find(
      (r) => r.item === "Denver station, three cameras",
    )!;
    expect(cameras.bytes).toBe(4_976_814_779 + 4_978_822_904 + 4_974_715_237);
  });
});

describe("the story", () => {
  it("counts the days to the tenth anniversary", () => {
    expect(daysUntil("2026-10-28", new Date("2026-09-25T12:00:00Z"))).toBe(33);
    expect(daysUntil("2026-10-28", new Date("2026-10-28T08:00:00Z"))).toBe(0);
    expect(daysUntil("2026-10-28", new Date("2026-11-02T08:00:00Z"))).toBe(0);
  });

  it("keeps six chapters, a timeline in order and the corrected Major Grants history", () => {
    expect(CHAPTERS).toHaveLength(6);
    const years = TIMELINE.map((y) => Number(y.year));
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(CORRECTIONS).toHaveLength(4);
    const text = JSON.stringify([TIMELINE, CORRECTIONS]);
    expect(text).not.toMatch(/Community Grants in 2021|died in 2021/);
    expect(text).toMatch(/February 2022/);
  });
});
