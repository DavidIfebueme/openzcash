"""Financial/source gates for Editorial 4.0, independent of PDF composition.

The private evidence packet binds complete source captures, normalized ledger
records and reviewed display bindings. It must never be committed with the site.
Visual review and the two-PDF importer are additional, separate gates.
"""
import argparse
import calendar
import hashlib
import json
from collections import Counter
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

ROLES = ["cover", "zf", "shielded-labs", "tachyon", "zakura", "wallets",
         "hardware", "supporting-stack", "products", "highlights-handoff"]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def at(value, path):
    for key in path:
        value = value[key]
    return value


def validate(content, evidence, root):
    errors = []

    def check(ok, code):
        if not ok:
            errors.append(code)

    issue = content["issue"]
    start = date.fromisoformat(issue["periodStart"])
    end = date.fromisoformat(issue["periodEnd"])
    check(start.day == 1 and end.day == calendar.monthrange(start.year, start.month)[1]
          and start.strftime("%Y-%m") == end.strftime("%Y-%m")
          == issue["financialMonth"] == issue["month"], "period.closed-month")
    check(date.fromisoformat(issue["reviewedAt"]) > end, "period.review-date")
    pages = content["pages"]
    check(set(pages) == {"monthly", "operations"}, "publications.pair")
    check([p["role"] for p in pages["monthly"]] == ROLES, "monthly.order")
    source_map = {s["id"]: s for s in evidence["sources"]}
    check(bool(source_map) and len(source_map) == len(evidence["sources"]), "sources.identity")
    now = datetime.now(timezone.utc)
    for source in source_map.values():
        path = (root / source["file"]).resolve()
        inside = path.is_relative_to(root.resolve()) and path.is_file()
        check(inside, "sources.path")
        if not inside:
            continue
        check(digest(path) == source["sha256"], "sources.hash")
        captured = datetime.fromisoformat(source["capturedAt"].replace("Z", "+00:00"))
        check(end < captured.date() <= now.date(), "sources.freshness")
        check(source["status"] == 200, "sources.http")
    financial = evidence["financial"]
    check(financial["authority"] == "Google Sheets", "financial.authority")
    check(financial["apiSheetAudit"]["status"] == "passed"
          and financial["apiSheetAudit"]["errors"] == []
          and financial["apiSheetAudit"]["checks"] > 0, "financial.reconciliation")
    for period, streams in financial["periods"].items():
        for stream, record in streams.items():
            rows = record["rows"]
            check(len(rows) == record["rowCount"], "ledger.count")
            check(len({r["id"] for r in rows}) == len(rows), "ledger.duplicate")
            check(all(r["isPaid"] and r["paidOutDate"].startswith(period)
                      and r["sourceSheet"] == stream for r in rows), "ledger.window-state")
            check(sum((Decimal(str(r["amountUsd"])) for r in rows), Decimal(0))
                  == Decimal(record["usd"]), "ledger.usd")
            check(sum((Decimal(str(r["zec"])) for r in rows if r["zec"] is not None), Decimal(0))
                  == Decimal(record["recordedZec"]), "ledger.zec")
            check(sum(r["zec"] is None for r in rows) == record["rowsWithoutZec"], "ledger.missing-zec")
    current = financial["periods"][issue["financialMonth"]]
    for role, stream in [("zcg-payments", "grants_disbursed"), ("coinholder-payments", "coinholder_grants")]:
        displayed = [r for p in pages["operations"] if p["role"] == role for r in p["rows"]]
        expected = current[stream]["rows"]
        check(Counter(r["url"] for r in displayed) == Counter(r["sourceUrl"] for r in expected), "ledger.display-universe")
        by_url = {r["sourceUrl"]: r for r in expected}
        for row in displayed:
            if row["url"] not in by_url:
                continue
            value = Decimal(row["cells"][1].replace("$", "").replace(",", ""))
            check(value == Decimal(str(by_url[row["url"]]["amountUsd"])), "ledger.display-amount")
    for binding in evidence["displayBindings"]:
        try:
            value = at(content, binding["path"])
            check(value == binding["expected"], "display.stale")
            check(all(s in source_map for s in binding["sources"]), "display.source")
        except (KeyError, IndexError, TypeError):
            errors.append("display.path")
    for key, universe in evidence["registers"].items():
        check(Counter(r["url"] for r in content[key]) == Counter(universe), "register." + key)
    wallets = pages["monthly"][5]
    check(wallets["layout"] == "wallets"
          and [w["name"] for w in wallets["rows"]] == ["ZODL", "Zingo", "Vizor", "Zkool"], "wallets.roster")
    for wallet, proof in zip(wallets["rows"], evidence["wallets"]):
        if proof.get("noVerifiedUpdate"):
            check(wallet["state"] == "No verified update" and wallet["version"] in [None, "—", "-"], "wallets.unavailable")
            continue
        releases = json.loads((root / source_map[proof["source"]]["file"]).read_text())
        matches = [r for r in releases if r["tag_name"] == proof["tag"]]
        check(len(matches) == 1, "wallets.source")
        if not matches:
            continue
        release = matches[0]
        check(wallet["version"] in release["tag_name"] and wallet["url"] == release["html_url"], "wallets.version")
        check((wallet["state"] == "Prerelease") == release["prerelease"], "wallets.prerelease")
        check(start <= date.fromisoformat(release["published_at"][:10]) <= end, "wallets.date")
    for kind, document in pages.items():
        for page in document:
            if page.get("layout") == "chart":
                check(all(r["value"] >= 0 for r in page["rows"]), "chart.negative")
    return {"status": "failed" if errors else "passed", "errors": sorted(set(errors)),
            "sourceCount": len(source_map), "financialRows": sum(r["rowCount"] for r in current.values())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--evidence", type=Path, required=True)
    args = parser.parse_args()
    result = validate(json.loads(args.content.read_text()), json.loads(args.evidence.read_text()), args.evidence.parent)
    print(json.dumps(result))
    raise SystemExit(result["status"] != "passed")
