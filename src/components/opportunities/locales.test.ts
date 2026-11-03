import { test } from "vitest";
import assert from "node:assert/strict";
import {
  countries,
  countryFlag,
  countryName,
  matchesLocale,
  normalizeCountry,
} from "./locales";
import {
  newDraft,
  migrateDraft,
  publishDraft,
  sampleOpportunities,
  validateDraft,
} from "./model";
test("country selection is independent of work language and survives publication", () => {
  for (const country of ["BR", "PT", "US", "GLOBAL"]) {
    const restored = migrateDraft(
      JSON.parse(JSON.stringify(newDraft({ language: "pt", country }))),
    );
    const item = publishDraft(restored, "demo");
    assert.equal(item.language, "pt");
    assert.equal(item.country, country);
  }
  const before = newDraft({ language: "pt", country: "BR" });
  assert.equal(
    publishDraft({ ...before, language: "en" }, "demo").country,
    "BR",
  );
});
test("country and language filters intersect without guessing nationality", () => {
  const brazil = { language: "pt", country: "BR" },
    portugal = { language: "pt", country: "PT" },
    global = { language: "en", country: "GLOBAL" };
  assert.equal(matchesLocale(brazil, "pt", "BR"), true);
  assert.equal(matchesLocale(portugal, "pt", "BR"), false);
  assert.equal(matchesLocale(brazil, "en", "BR"), false);
  assert.equal(matchesLocale(global, "en", "all"), true);
  assert.equal(matchesLocale(global, "en", "US"), false);
  assert.equal(matchesLocale(brazil, "all", "all"), true);
});
test("legacy drafts and unsafe locale inputs keep working with neutral defaults", () => {
  const d = migrateDraft({ id: "older", title: "A saved older draft" });
  assert.equal(d.language, "any");
  assert.equal(d.country, "GLOBAL");
  assert.equal(normalizeCountry("<script>"), "GLOBAL");
  assert.equal(countryFlag("invalid"), "🌐");
  assert.ok(
    validateDraft(
      { ...d, language: "unknown", country: "XX" },
      0,
      ["personal"],
      [],
    ).language,
  );
  assert.ok(
    validateDraft(
      { ...d, language: "unknown", country: "XX" },
      0,
      ["personal"],
      [],
    ).country,
  );
});
test("flags and labels use selected ISO countries, not language codes", () => {
  assert.equal(countryFlag("BR"), "🇧🇷");
  assert.equal(countryName("BR"), "Brazil");
  assert.equal(countryFlag("PT"), "🇵🇹");
  assert.equal(countryFlag("GB"), "🇬🇧");
  assert.equal(countries.length, 250);
  assert.equal(new Set(countries.map((c) => c.code)).size, 250);
});
test("the PAY example appears under Portuguese and Brazil with its own artwork", () => {
  const item = sampleOpportunities.find((o) => o.id === "0xramp-pay-brasil")!;
  assert.equal(item.type, "Task");
  assert.equal(item.art, "0xramp-pay");
  assert.equal(matchesLocale(item, "pt", "BR"), true);
  assert.match(item.criteria.join(" "), /Nenhum pagamento real/);
});
