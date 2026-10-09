"""Offline correctness checks for the public-history decoder and UTC buckets."""
import base64
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("activity", Path(__file__).with_name("coinholder-activity.py"))
activity = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(activity)


def uint(value):
    out = bytearray()
    while value > 127:
        out.append((value & 127) | 128)
        value >>= 7
    out.append(value)
    return bytes(out)


def field(number, value):
    if isinstance(value, int):
        return uint(number << 3) + uint(value)
    return uint(number << 3 | 2) + uint(len(value)) + value


def cast(proposal=1, commitment=b"c" * 32, van=b"v" * 32, round_id=activity.ROUND_BYTES):
    return b"".join(field(n, v) for n, v in [(2, van), (3, commitment), (4, proposal), (5, b"proof"), (6, round_id), (7, 123)])


class DecoderTests(unittest.TestCase):
    def test_single_cast_retains_public_inputs(self):
        decoded = activity.decode(b"\x03" + cast())
        self.assertEqual(decoded["messages"][0]["proposalId"], 1)
        self.assertEqual(decoded["messages"][0]["proofBytes"], 5)
        self.assertEqual(decoded["messages"][0]["anchorHeight"], 123)
        self.assertEqual(len(decoded["expectedLeaves"]), 2)
        self.assertNotIn("weight", decoded["messages"][0])
        self.assertNotIn("choice", decoded["messages"][0])

    def test_batch_counts_inner_casts_and_only_final_authority_leaf(self):
        batch = field(1, cast()) + field(1, cast(2, b"d" * 32, b"w" * 32))
        decoded = activity.decode(b"\x06" + batch)
        self.assertEqual([m["proposalId"] for m in decoded["messages"]], [1, 2])
        self.assertEqual(decoded["expectedLeaves"], [(b"w" * 32).hex(), (b"c" * 32).hex(), (b"d" * 32).hex()])

    def test_composite_delegation_batch_uses_same_cast_count(self):
        delegation = field(6, b"a" * 32) + field(9, activity.ROUND_BYTES)
        raw = b"\x07" + field(1, delegation) + field(2, field(1, cast()))
        self.assertEqual(len(activity.decode(raw)["messages"]), 1)

    def test_other_round_and_reveals_excluded(self):
        self.assertIsNone(activity.decode(b"\x03" + cast(round_id=b"x" * 32)))
        self.assertIsNone(activity.decode(b"\x04" + cast()))

    def test_mixed_round_batch_fails(self):
        with self.assertRaisesRegex(ValueError, "Mixed round"):
            activity.decode(b"\x06" + field(1, cast()) + field(1, cast(round_id=b"x" * 32)))

    def test_invalid_lengths_and_unknown_proposals_fail(self):
        for raw in [b"\x03" + cast(commitment=b"short"), b"\x03" + cast(proposal=38), b"\x03\x32\xff"]:
            with self.assertRaises(ValueError):
                activity.decode(raw)

    def test_nanosecond_timestamp_and_utc_boundary(self):
        self.assertEqual(activity.normalize_at("2026-09-17T17:16:02.274372511Z"), "2026-09-17T17:16:02.274Z")
        records = [{"at": "2026-09-17T23:59:59.999Z", "castCount": 2, "proposalIds": [1, 2]},
                   {"at": "2026-09-18T00:00:00.000Z", "castCount": 1, "proposalIds": [1]}]
        self.assertEqual([p["count"] for p in activity.bucket(records, 60)], [2, 1])
        self.assertEqual([p["cumulative"] for p in activity.bucket(records, 3600, 1)], [1, 2])

    def test_only_successful_transactions_reconcile_leaves(self):
        raw = b"\x03" + cast()
        block = {"block_id": {"hash": base64.b64encode(b"h" * 32).decode()},
                 "block": {"header": {"chain_id": activity.CHAIN, "height": "9", "time": "2026-09-17T17:16:02Z"},
                           "data": {"txs": [base64.b64encode(raw).decode()]}}}
        leaves = {"height": 9, "leaves": [base64.b64encode(b"v" * 32).decode(), base64.b64encode(b"c" * 32).decode()]}
        with tempfile.TemporaryDirectory() as cache, patch.object(activity, "get_json", side_effect=[block, {"height": "9", "code": 0}]):
            result = activity.verify_block(leaves, Path(cache))
            self.assertEqual(result["records"][0]["castCount"], 1)
        with tempfile.TemporaryDirectory() as cache, patch.object(activity, "get_json", side_effect=[block, {"height": "9", "code": 5}]):
            with self.assertRaisesRegex(ValueError, "Unexplained"):
                activity.verify_block(leaves, Path(cache))

    def test_wrong_chain_is_rejected(self):
        block = {"block": {"header": {"chain_id": "wrong", "height": "9"}}}
        with tempfile.TemporaryDirectory() as cache, patch.object(activity, "get_json", return_value=block):
            with self.assertRaisesRegex(ValueError, "Mismatched"):
                activity.verify_block({"height": 9, "leaves": []}, Path(cache))


if __name__ == "__main__":
    unittest.main()
