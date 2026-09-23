#!/usr/bin/env python3
"""Read-only public ZCG queries. Standard library only; no keys or local file reads."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import gzip
import io
import json
import re
import sys
import unicodedata
from urllib.request import Request, urlopen

BASE = "https://openzcash.org"
URLS = {
    "grants": BASE + "/api/zcg/data/grants",
    "recipients": BASE + "/api/zcg/data/recipients",
    "payments": BASE + "/api/zcg/data/disbursements?limit=2000",
    "queue": BASE + "/api/zcg/office",
}
MAX_BYTES = 8 * 1024 * 1024


def clean(value):
    """Public text is data, including terminal control and bidi characters."""
    return "".join(c if not unicodedata.category(c).startswith("C") else " "
                   for c in str(value if value is not None else "unavailable"))[:1000]


def number(value):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        raise ValueError("Unexpected numeric field; refusing to compute totals")
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError("Invalid amount; refusing to compute totals")
    return result


def amount(value, unit="USD"):
    n = number(value)
    if n is None:
        return "unavailable"
    return (("-" if n < 0 else "") + f"${abs(n):,.2f}") if unit == "USD" else f"{n:,.8f} ZEC"


def total(rows, field, unit="USD"):
    values = [number(row.get(field)) for row in rows]
    known = [v for v in values if v is not None]
    missing = len(values) - len(known)
    if missing and not known:
        return f"unavailable ({missing} amounts missing)"
    result = amount(sum(known, Decimal(0)), unit)
    return result + (f" known; {missing} amounts missing" if missing else "")


def rows_from(payload, key):
    field = "proposals" if key == "queue" else "data"
    if not isinstance(payload, dict) or not isinstance(payload.get(field), list):
        raise ValueError(f"Unexpected {key} response; not an empty dataset")
    rows = payload[field]
    if any(not isinstance(row, dict) for row in rows):
        raise ValueError(f"Invalid {key} rows")
    if key != "queue":
        count, full = payload.get("count"), payload.get("total")
        if type(count) is not int or type(full) is not int or count != len(rows) or full != count:
            raise ValueError(f"Incomplete {key} response; totals cannot be verified")
    if (key == "payments" and len(rows) >= 2000) or (key == "queue" and len(rows) >= 100):
        raise ValueError(f"{key} reached the API cap; narrow the query before reporting totals")
    required = {"grants": "grant", "recipients": "recipient", "payments": "recipient", "queue": "title"}[key]
    if any(not isinstance(row.get(required), str) for row in rows):
        raise ValueError(f"Missing {key} identity")
    if key == "payments" and any(type(row.get("isPaid")) is not bool for row in rows):
        raise ValueError("Payment status missing; refusing to count unpaid rows as paid")
    return rows


def fetch(key):
    req = Request(URLS[key], headers={"Accept": "application/json", "Accept-Encoding": "gzip",
                                     "User-Agent": "OpenZcash-ZCG-Copilot/1.0"})
    with urlopen(req, timeout=15) as response:
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Response exceeds the download limit")
        if response.headers.get("Content-Encoding") == "gzip":
            with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
                raw = stream.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Response exceeds the expanded size limit")
    return rows_from(json.loads(raw, parse_float=Decimal), key)


def sources(keys):
    print("\nFetched: " + datetime.now(timezone.utc).isoformat(timespec="seconds"))
    for key in keys:
        print("Source: " + URLS[key])
    print("Published snapshots may lag. Review queue follows D-1 publication.")
    print("USD paid = recorded USD amount on paid rows, not current ZEC market value.")
    print("Totals retain negative ledger adjustments and returned funds.")


def recipient(rows, query):
    matches = [r for r in rows if query.casefold() in r["recipient"].casefold()]
    print(f"# Recipient matches: {len(matches)} (ecosystem funding; operations excluded)")
    for r in matches[:25]:
        print(f"- {clean(r['recipient'])}: {amount(r.get('usd'))} budgeted | "
              f"{amount(r.get('usdPaid'))} recorded USD paid | {amount(r.get('zecPaid'), 'ZEC')} paid | "
              f"{clean(r.get('grants'))} ledger projects | last paid {clean(r.get('lastPaid'))}")
    if len(matches) > 25:
        print("Showing 25 matches; refine the name to see the rest.")
    print("Names are matched separately. Ledger projects can include cancelled or unpaid grants.")


def summary(data):
    grants, recipients, queue = (data[k] for k in ("grants", "recipients", "queue"))
    print("# ZCG funding snapshot")
    print(f"- {len(grants)} grant ledger entries | {total(grants, 'usd')} budgeted | {total(grants, 'zec', 'ZEC')} paid")
    print(f"- {len(recipients)} ecosystem recipients; operations excluded")
    print("- Top 5 ecosystem recipients by recorded USD paid:")
    known = [r for r in recipients if number(r.get("usdPaid")) is not None]
    ranked = sorted(known, key=lambda r: number(r["usdPaid"]), reverse=True)
    for r in ranked[:5]:
        print(f"  - {clean(r['recipient'])}: {amount(r.get('usdPaid'))} paid | {amount(r.get('usd'))} budgeted")
    if len(known) != len(recipients):
        print(f"  {len(recipients) - len(known)} recipients excluded from ranking: paid amount unavailable")
    print(f"- Published review queue: {len(queue)} proposals | {total(queue, 'amount')} requested")


def search(data, terms):
    patterns = [re.compile(r"\b" + re.escape(term), re.IGNORECASE) for term in terms]
    def hit(row, fields):
        return any(p.search(" ".join(str(row.get(f) or "") for f in fields)) for p in patterns)
    grants = [r for r in data["grants"] if hit(r, ("grant", "grantee", "category"))]
    payments = [r for r in data["payments"] if hit(r, ("recipient", "project", "milestone"))]
    queue = [r for r in data["queue"] if hit(r, ("title", "applicant"))]
    print("# Topic search: " + clean(" OR ".join(terms)))
    print(f"\n## Ledger grants: {len(grants)} matches (may include unpaid/cancelled grants)")
    for r in grants[:25]:
        print(f"- {clean(r['grant'])} — {clean(r.get('grantee'))} | {clean(r.get('program'))} | "
              f"{clean(r.get('status'))} | {amount(r.get('usd'))} budgeted | {amount(r.get('zec'), 'ZEC')} paid")
    if len(grants) > 25:
        print("Showing 25 grants; refine the keywords to see the rest.")
    paid = [r for r in payments if r["isPaid"]]
    print(f"\n## Matching ledger rows: {len(payments)}; {len(paid)} paid; {total(paid, 'amountUsd')} recorded USD paid")
    for r in sorted(payments, key=lambda r: r.get("paidOutDate") or "")[-12:]:
        print(f"- {'PAID' if r['isPaid'] else 'UNPAID'} | {clean(r.get('paidOutDate'))} | "
              f"{clean(r['recipient'])} | {clean(r.get('project') or r.get('milestone'))} | "
              f"{amount(r.get('amountUsd'))} recorded USD | {amount(r.get('zec'), 'ZEC')}")
    if len(payments) > 12:
        print(f"Showing 12 of {len(payments)} matching rows; totals cover all matches.")
    print(f"\n## Published review queue: {len(queue)} matches")
    for r in queue:
        issue = r.get("number")
        if type(issue) is not int or issue <= 0:
            raise ValueError("Invalid proposal issue number")
        print(f"- #{issue} {clean(r['title'])} — {clean(r.get('applicant'))} | {amount(r.get('amount'))} requested | "
              f"https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/{issue}")
    print("A pending application does not imply the team has no prior funding. Keyword matching may miss synonyms.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("search", "recipient", "summary"))
    parser.add_argument("terms", nargs="*")
    args = parser.parse_args()
    if args.command != "summary" and not args.terms:
        parser.error("provide a keyword or recipient name")
    if args.command == "summary" and args.terms:
        parser.error("summary does not take search terms")
    keys = {"search": ("grants", "payments", "queue"), "recipient": ("recipients",),
            "summary": ("grants", "recipients", "queue")}[args.command]
    try:
        with ThreadPoolExecutor(max_workers=len(keys)) as pool:
            data = dict(zip(keys, pool.map(fetch, keys)))
        # Buffer the report so a malformed later field cannot leave partial totals.
        from contextlib import redirect_stdout
        output = io.StringIO()
        with redirect_stdout(output):
            if args.command == "search":
                search(data, args.terms)
            elif args.command == "recipient":
                recipient(data["recipients"], " ".join(args.terms))
            else:
                summary(data)
            sources(keys)
        print(output.getvalue(), end="")
        return 0
    except (OSError, ValueError, InvalidOperation) as error:
        print("Could not verify the public data: " + clean(error) + ". No report generated.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
