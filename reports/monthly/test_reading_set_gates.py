"""Exercise actual report failure modes against a private, current evidence packet."""
import argparse
import copy
from datetime import date, timedelta
import json
from pathlib import Path
import sys
import unittest

from validate_reading_set import validate

parser = argparse.ArgumentParser()
parser.add_argument("--issue-dir", type=Path, required=True)
args, rest = parser.parse_known_args()
ROOT = args.issue_dir.resolve()
CONTENT = json.loads((ROOT / "issue-content.json").read_text())
EVIDENCE = json.loads((ROOT / "reading-set-evidence.json").read_text())


class ReadingSetGates(unittest.TestCase):
    def setUp(self):
        self.content = copy.deepcopy(CONTENT)
        self.evidence = copy.deepcopy(EVIDENCE)

    def errors(self):
        return validate(self.content, self.evidence, ROOT)["errors"]

    def payment(self):
        return next(p for p in self.content["pages"]["operations"] if p["role"] == "zcg-payments")

    def test_current_evidence_passes(self):
        self.assertEqual(self.errors(), [])

    def test_changed_payment_is_rejected(self):
        self.payment()["rows"][0]["cells"][1] = "$1"
        self.assertIn("ledger.display-amount", self.errors())

    def test_missing_payment_is_rejected(self):
        self.payment()["rows"].pop()
        self.assertIn("ledger.display-universe", self.errors())

    def test_duplicate_payment_is_rejected(self):
        self.payment()["rows"].append(self.payment()["rows"][0])
        self.assertIn("ledger.display-universe", self.errors())

    def test_changed_source_hash_is_rejected(self):
        self.evidence["sources"][0]["sha256"] = "0" * 64
        self.assertIn("sources.hash", self.errors())

    def test_missing_community_is_rejected(self):
        self.content["communities"].pop()
        self.assertIn("register.communities", self.errors())

    def test_missing_proposal_is_rejected(self):
        self.content["zcg"].pop()
        self.assertIn("register.zcg", self.errors())

    def test_prerelease_cannot_be_stable(self):
        self.content["pages"]["monthly"][5]["rows"][1]["state"] = "Stable"
        self.assertIn("wallets.prerelease", self.errors())

    def test_wrong_wallet_version_is_rejected(self):
        self.content["pages"]["monthly"][5]["rows"][0]["version"] = "999.0"
        self.assertIn("wallets.version", self.errors())

    def test_wallet_page_cannot_move(self):
        pages = self.content["pages"]["monthly"]
        pages[6], pages[7] = pages[7], pages[6]
        self.assertIn("monthly.order", self.errors())

    def test_bad_financial_sum_is_rejected(self):
        period = self.content["issue"]["financialMonth"]
        self.evidence["financial"]["periods"][period]["grants_disbursed"]["usd"] = "1"
        self.assertIn("ledger.usd", self.errors())

    def test_stale_capture_is_rejected(self):
        self.evidence["sources"][0]["capturedAt"] = "2026-09-01T00:00:00Z"
        self.assertIn("sources.freshness", self.errors())

    def test_paid_row_outside_window_is_rejected(self):
        period = self.content["issue"]["financialMonth"]
        before = date.fromisoformat(self.content["issue"]["periodStart"]) - timedelta(days=1)
        self.evidence["financial"]["periods"][period]["grants_disbursed"]["rows"][0]["paidOutDate"] = before.isoformat()
        self.assertIn("ledger.window-state", self.errors())

    def test_partial_month_cannot_be_closed(self):
        self.content["issue"]["periodEnd"] = self.content["issue"]["periodEnd"][:8] + "15"
        self.assertIn("period.closed-month", self.errors())


unittest.main(argv=[sys.argv[0], *rest])
