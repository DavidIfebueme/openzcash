import { expect, it } from "vitest";
import { countries, countryFlag, countryName } from "./locales";
import { curatedItems, filterCatalog } from "./catalog";
it("filters explicitly provided locale metadata without guessing a country", () => {
  const item = curatedItems[0];
  const items = [{ ...item, id: "brazil", language: "pt", country: "BR" }, { ...item, id: "portugal", language: "pt", country: "PT" }, item];
  expect(filterCatalog(items, new URLSearchParams("language=pt&country=BR")).map((x) => x.id)).toEqual(["brazil"]);
  expect(filterCatalog([item], new URLSearchParams("country=GLOBAL"))).toEqual([]);
  expect(filterCatalog(items, new URLSearchParams("language=pt"))).toHaveLength(2);
});
it("uses ISO countries for flags, independently from language", () => {
  expect(countryFlag("BR")).toBe("🇧🇷"); expect(countryName("BR")).toBe("Brazil"); expect(countryFlag("PT")).toBe("🇵🇹");
  expect(countries).toHaveLength(250); expect(new Set(countries.map((c) => c.code)).size).toBe(250);
});
