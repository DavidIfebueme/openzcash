export const dynamic = "force-dynamic";

/**
 * Top-level public API index. `/api/zcg` documents the grants endpoints only,
 * so anyone typing the root URL used to land on a 404: this lists everything
 * the site exposes, grouped by subject, and points at the per-area indexes.
 */
export async function GET() {
  return Response.json(
    {
      name: "OpenZcash public API",
      readOnly: true,
      docs: "https://openzcash.org/zcg/methodology",
      endpoints: {
        grants: {
          "/api/zcg": "Grants API index, with the filters each endpoint takes.",
          "/api/zcg/data/grants":
            "Per-grant aggregation: milestones, paid, status. ?format=csv supported.",
          "/api/zcg/data/disbursements":
            "Budget and payment ledger, with sourceUrl, one-based sourceRow and importedAt for each record. Filters: sheet, grant, category, type, search, limit. ?format=csv supported.",
          "/api/zcg/data/recipients":
            "Per-recipient budgets and recorded payments: usd is budgeted; usdPaid and zecPaid count settled entries. ?internal=1 includes internal costs. ?format=csv supported.",
          "/api/zcg/office": "Proposals currently under review.",
          "/api/zcg/coinholder/round":
            "Dated Coinholder round archive: proposals, published outcomes, tallies and recorded payouts. Check round.label and round.status.",
          "/api/coinholders/proposals":
            "Current Coinholder submissions, FPF review decisions for hidden applications, announced schedule and source freshness. Requested amounts are in USD cents, not awards or payments.",
        },
        zechub: {
          "/api/zechub/treasury":
            "ZecHub DAO treasury: dated balances, allocations and payouts. valuation contains indicative USD values at a separately dated market quote; other USD fields retain the spreadsheet's recorded values.",
        },
        chain: {
          "/api/chain-tip": "Current Zcash block height.",
        },
        feeds: {
          "/api/feeds/zcg.xml": "ZCG activity as RSS.",
          "/api/feeds/zechub.xml": "ZecHub treasury payouts as RSS.",
          "/api/feeds/meetings.ics":
            "Committee meetings as an iCalendar subscription.",
          "/api/feeds/calendar.ics":
            "The Zcash calendar from News (governance polls, Coinholder Grants rounds, ZCG meetings and elections, Arborist Calls) as an iCalendar subscription.",
        },
      },
      notes: [
        "Read-only and unauthenticated. Amounts are in USD (dollars) and ZEC.",
        "Grant figures mirror the public ZCG spreadsheet: `usd` is budgeted and `zec` is the quantity recorded as disbursed by the source, not an independent on-chain verification.",
        "Recipient `usdPaid` is the budgeted USD value of settled entries, not today's market value. Default payment counts and dates exclude internal costs. Payment is not proof of delivery.",
        "Disbursement `importedAt` records collection, not source publication. Source links open the current spreadsheet row, not an immutable snapshot.",
        "List endpoints return { count, total, data }: when total exceeds count the response was capped, so raise ?limit.",
      ],
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
