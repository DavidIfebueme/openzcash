/** The proposal register's A:G range. H:K are deliberately never exported. */
export const PROPOSAL_SHEET_COLUMNS = ["Date Submitted", "Proposal Title", "Applicant(s)", "Grant Platform Link", "Forum Link", "Grant Status", "Date Committee Approved/ Rejected"] as const;
export type ProposalSheetDraft = { submitted: string; title: string; applicant: string; platformUrl: string; forumUrl: string; status: string; decided: string };
export type ProposalSheetContext = { checkedAt: string; sheetUrl: string; columns: string[]; statuses: string[]; match: { row: number; cells: string[] } | null; matchCount: number };
const normalize = (value: string) => value.trim().replace(/\s+/g, " ");
export function proposalLinkIdentity(value: string): string | null {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    const issue = u.pathname.match(/^\/ZcashCommunityGrants\/zcashcommunitygrants\/issues\/([1-9]\d*)\/?$/i);
    if (u.hostname.toLowerCase() === "github.com" && issue) return `zcg-issue:${issue[1]}`;
    const legacy = u.pathname.match(/^\/proposals\/([1-9]\d*)\/?$/);
    if (u.hostname === "grants-admin.zfnd.org" && legacy) return `zcg-legacy:${legacy[1]}`;
    if (u.hostname === "openzcash.org" && u.pathname === "/zcg/participate" && u.searchParams.get("record")) return `openzcash:${u.searchParams.get("record")}`;
  } catch { /* No identity inferred from titles or malformed links. */ }
  return null;
}
export function readProposalSheet(rows: string[][], sourceUrl: string, sheetUrl: string, checkedAt: string): ProposalSheetContext {
  const header = rows[0] ?? [];
  if (PROPOSAL_SHEET_COLUMNS.some((name,i) => normalize(header[i] ?? "") !== name)) throw new Error("SHEET_LAYOUT_CHANGED");
  const identity = proposalLinkIdentity(sourceUrl);
  const matches = identity ? rows.flatMap((cells,i) => i > 0 && proposalLinkIdentity(cells[3] ?? "") === identity ? [{ row: i+1, cells: cells.slice(0,7) }] : []) : [];
  return { checkedAt, sheetUrl, columns: header.slice(0,7), match: matches.length === 1 ? matches[0] : null, matchCount: matches.length,
    statuses: [...new Set(rows.slice(1).map(row => normalize(row[5] ?? "")).filter(Boolean))].sort() };
}
export function sheetDateToIso(value: string) {
  const raw = value.trim(), iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/), us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!iso && !us) return "";
  const year = iso ? Number(iso[1]) : Number(us![3]) + (us![3].length === 2 ? 2000 : 0), month = Number(iso?.[2] ?? us![1]), day = Number(iso?.[3] ?? us![2]);
  const d = new Date(Date.UTC(year,month-1,day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month-1 && d.getUTCDate() === day ? d.toISOString().slice(0,10) : "";
}
const sheetDate = (value: string) => { const iso = sheetDateToIso(value); if (!iso) return ""; const [y,m,d]=iso.split("-"); return `${Number(m)}/${Number(d)}/${y}`; };
function safeCell(value: string) {
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  // Spreadsheet imports may execute formula-looking text even in quoted CSV cells.
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
export function proposalDraftFromCells(cells: string[]): ProposalSheetDraft {
  return { submitted: sheetDateToIso(cells[0] ?? ""), title: cells[1] ?? "", applicant: cells[2] ?? "", platformUrl: cells[3] ?? "", forumUrl: cells[4] ?? "", status: cells[5] ?? "", decided: sheetDateToIso(cells[6] ?? "") };
}
export function proposalDraftErrors(draft: ProposalSheetDraft) {
  const errors: string[] = [];
  if (!sheetDateToIso(draft.submitted)) errors.push("Add the submission date.");
  if (!draft.title.trim() || !draft.applicant.trim()) errors.push("Add the proposal title and applicant.");
  if (!proposalLinkIdentity(draft.platformUrl)) errors.push("Use the proposal’s ZCG or OpenZcash link.");
  if ([draft.title, draft.applicant].some(value => value.length > 500) || [draft.platformUrl, draft.forumUrl].some(value => value.length > 2048)) errors.push("Shorten the fields before exporting.");
  if (!draft.status.trim()) errors.push("Select the sheet status.");
  if (draft.forumUrl) { try { const u=new URL(draft.forumUrl); if(u.protocol!=="https:" || u.hostname!=="forum.zcashcommunity.com" || !u.pathname.startsWith("/t/") || u.username || u.password || u.port) throw new Error(); } catch { errors.push("Check the Zcash Forum topic link."); } }
  if (["Approved", "Rejected"].includes(draft.status) && !sheetDateToIso(draft.decided)) errors.push("Confirm the committee decision date.");
  if (draft.decided && (!sheetDateToIso(draft.decided) || draft.decided < draft.submitted)) errors.push("The decision date must be on or after submission.");
  return errors;
}
export function proposalSheetCells(draft: ProposalSheetDraft) { return [sheetDate(draft.submitted), draft.title, draft.applicant, draft.platformUrl, draft.forumUrl, draft.status, sheetDate(draft.decided)].map(safeCell); }
export function proposalSheetTsv(draft: ProposalSheetDraft) { return proposalSheetCells(draft).join("\t"); }
export function proposalSheetCsv(draft: ProposalSheetDraft, columns: readonly string[] = PROPOSAL_SHEET_COLUMNS) {
  const line = (cells: readonly string[]) => cells.map(value => `"${safeCell(value).replaceAll('"', '""')}"`).join(",");
  return `${line(columns)}\r\n${line(proposalSheetCells(draft))}\r\n`;
}
