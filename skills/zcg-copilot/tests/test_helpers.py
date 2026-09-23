import contextlib
from decimal import Decimal
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("zcg", Path(__file__).parents[1] / "scripts/zcg.py")
zcg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(zcg)


class HelpersTest(unittest.TestCase):
    def output(self, func, *args):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            func(*args)
        return out.getvalue()

    def test_failure_payload_is_not_an_empty_dataset(self):
        for payload in ({"error": "Unavailable"}, [], {"data": []}, {"data": [], "count": 0, "total": 2}):
            with self.assertRaises(ValueError):
                zcg.rows_from(payload, "grants")
        self.assertEqual(zcg.rows_from({"data": [], "count": 0, "total": 0}, "grants"), [])

    def test_caps_prevent_false_complete_totals(self):
        rows = [{"recipient": "Team", "isPaid": True}] * 2000
        with self.assertRaisesRegex(ValueError, "cap"):
            zcg.rows_from({"data": rows, "count": 2000, "total": 2000}, "payments")
        with self.assertRaisesRegex(ValueError, "cap"):
            zcg.rows_from({"proposals": [{"title": "Proposal"}] * 100}, "queue")

    def test_unknown_amounts_remain_unknown(self):
        self.assertEqual(zcg.amount(None), "unavailable")
        self.assertEqual(zcg.total([{"amount": None}], "amount"), "unavailable (1 amounts missing)")
        self.assertEqual(zcg.total([{"amount": Decimal("10.25")}, {"amount": None}], "amount"), "$10.25 known; 1 amounts missing")
        for invalid in (True, "100", float("nan")):
            with self.assertRaises(ValueError):
                zcg.number(invalid)

    def test_refunds_reduce_net_totals(self):
        self.assertEqual(zcg.total([{"usd": 10000}, {"usd": -4000}], "usd"), "$6,000.00")
        self.assertEqual(zcg.amount(-4000), "-$4,000.00")

    def test_recipient_uses_authoritative_paid_fields(self):
        result = self.output(zcg.recipient, [{"recipient": "Team", "usd": 1000, "usdPaid": 300, "zecPaid": 2}], "team")
        self.assertIn("$1,000.00 budgeted", result)
        self.assertIn("$300.00 recorded USD paid", result)
        self.assertIn("2.00000000 ZEC paid", result)

    def test_search_never_counts_unpaid_as_paid(self):
        data = {"grants": [], "queue": [], "payments": [
            {"recipient": "wallet", "isPaid": True, "amountUsd": 10, "zec": 1},
            {"recipient": "wallet", "isPaid": False, "amountUsd": 500, "zec": None},
        ]}
        result = self.output(zcg.search, data, ["wallet"])
        self.assertIn("1 paid; $10.00 recorded USD paid", result)
        self.assertIn("UNPAID", result)
        self.assertIn("unavailable", result)

    def test_external_control_sequences_are_sanitized(self):
        result = zcg.clean("team\x1b[2J\n\u202eseed")
        self.assertNotIn("\x1b", result)
        self.assertNotIn("\u202e", result)
        self.assertNotIn("\n", result)

    def test_source_failure_prints_no_partial_financial_report(self):
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(zcg, "fetch", side_effect=OSError("offline")), patch("sys.argv", ["zcg.py", "summary"]):
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                code = zcg.main()
        self.assertEqual(code, 1)
        self.assertEqual(output.getvalue(), "")
        self.assertIn("No report generated", errors.getvalue())

    def test_recipient_fetches_only_recipient_aggregates(self):
        with patch.object(zcg, "fetch", return_value=[]) as fetch, patch("sys.argv", ["zcg.py", "recipient", "team"]):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(zcg.main(), 0)
        fetch.assert_called_once_with("recipients")


if __name__ == "__main__":
    unittest.main()
