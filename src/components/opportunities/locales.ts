export const languages = [
  { code: "any", name: "Any language", short: "Any language" },
  { code: "en", name: "English", short: "English" },
  { code: "pt", name: "Português", short: "Português" },
  { code: "es", name: "Español", short: "Español" },
  { code: "fr", name: "Français", short: "Français" },
  { code: "de", name: "Deutsch", short: "Deutsch" },
  { code: "it", name: "Italiano", short: "Italiano" },
  { code: "ar", name: "العربية · Arabic", short: "العربية" },
  { code: "hi", name: "हिन्दी · Hindi", short: "हिन्दी" },
  { code: "id", name: "Bahasa Indonesia", short: "Indonesia" },
  { code: "ja", name: "日本語 · Japanese", short: "日本語" },
  { code: "ko", name: "한국어 · Korean", short: "한국어" },
  { code: "ru", name: "Русский · Russian", short: "Русский" },
  { code: "tr", name: "Türkçe", short: "Türkçe" },
  { code: "uk", name: "Українська · Ukrainian", short: "Українська" },
  { code: "vi", name: "Tiếng Việt", short: "Tiếng Việt" },
  { code: "zh", name: "中文 · Chinese", short: "中文" },
];
const regionCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
const names = new Intl.DisplayNames(["en"], { type: "region" });
export const countries = [
  { code: "GLOBAL", name: "Global" },
  ...regionCodes
    .map((code) => ({ code, name: names.of(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name)),
];
export const validLanguage = (value: unknown): value is string =>
  typeof value === "string" && languages.some((l) => l.code === value);
export const validCountry = (value: unknown): value is string =>
  typeof value === "string" && countries.some((c) => c.code === value);
export const normalizeLanguage = (value: unknown) =>
  validLanguage(value) ? value : "any";
export const normalizeCountry = (value: unknown) =>
  validCountry(value) ? value : "GLOBAL";
export const languageName = (code: unknown) =>
  languages.find((l) => l.code === normalizeLanguage(code))!.short;
export const countryName = (code: unknown) =>
  countries.find((c) => c.code === normalizeCountry(code))!.name;
export function countryFlag(value: unknown) {
  const code = normalizeCountry(value);
  return code === "GLOBAL"
    ? "🌐"
    : String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)));
}
export function matchesLocale(
  item: { language?: string; country?: string },
  language = "all",
  country = "all",
) {
  return (
    (language === "all" || normalizeLanguage(item.language) === language) &&
    (country === "all" || normalizeCountry(item.country) === country)
  );
}
