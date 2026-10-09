#!/usr/bin/env python3
"""Reconstruct Q3 revealed-share counts from archived state at UTC boundaries.

Reads fixed official public endpoints only. Never fetches all reveal proofs,
submits transactions, or infers ZEC weights from revealed-share counts.
"""
import argparse
import base64
from bisect import bisect_left
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import threading
import tempfile
import os
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

ROUND = "2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01"
CHAIN = "zvote-1"
RPC = "https://prod.explorer-rpc.valargroup.org"
SUMMARY_URL = "https://zvote.zfnd.org/shielded-vote/v1/vote-summary/" + ROUND
SUMMARY_HASH = "9b858326b8149de92ea6788314a714b521fb2f57215e3742ec9b35b67c6639b5"
SDK = "4dbe05aad847513300e632ab1be48ae08662b240"
CREATION_HEIGHT = 7201411
PINNED_HEIGHT = 8550050
MAX_REQUESTS = 260
MAX_RESPONSE = 1024 * 1024
LOCK = threading.Lock()
REQUESTS = 0


def utc(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z", value):
        raise ValueError("Expected an ISO timestamp in UTC")
    return datetime.fromisoformat(re.sub(r"(\.\d{6})\d+", r"\1", value).replace("Z", "+00:00"))


def iso(value):
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        handle.write(json.dumps(data, separators=(",", ":")) + "\n")
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def fetch(url, cache, refresh=False):
    global REQUESTS
    if not (url.startswith(RPC + "/") or url == SUMMARY_URL):
        raise ValueError("Unexpected provider URL")
    path = cache / (hashlib.sha256(url.encode()).hexdigest() + ".json")
    if path.exists() and not refresh:
        saved = json.loads(path.read_text())
        if saved["url"] != url:
            raise ValueError("Cached response URL mismatch")
        return saved["body"], saved["sha256"]
    for attempt in range(3):
        try:
            with LOCK:
                REQUESTS += 1
                if REQUESTS > MAX_REQUESTS:
                    raise RuntimeError("Request budget exceeded")
            request = Request(url, headers={"User-Agent": "ZDAO-Public-Reveal-Audit/1.0"})
            with urlopen(request, timeout=20) as response:
                if response.url != url:
                    raise ValueError("Unexpected redirect")
                raw = response.read(MAX_RESPONSE + 1)
            if len(raw) > MAX_RESPONSE:
                raise ValueError("Response too large")
            body = json.loads(raw)
            if not isinstance(body, dict) or body.get("error"):
                raise ValueError("RPC returned an error: " + str(body.get("error")))
            digest = hashlib.sha256(raw).hexdigest()
            write(path, {"url": url, "sha256": digest, "body": body})
            return body, digest
        except (OSError, ValueError) as error:
            if attempt == 2:
                raise RuntimeError("Read failed: " + url) from error
            time.sleep(0.5 * (attempt + 1))


def varint(raw, cursor):
    value = 0
    for shift in range(0, 70, 7):
        if cursor >= len(raw):
            raise ValueError("Truncated protobuf integer")
        byte = raw[cursor]
        cursor += 1
        value |= (byte & 127) << shift
        if not byte & 128:
            return value, cursor
    raise ValueError("Oversized protobuf integer")


def fields(raw):
    result = defaultdict(list)
    cursor = 0
    while cursor < len(raw):
        key, cursor = varint(raw, cursor)
        number, wire = key >> 3, key & 7
        if not number:
            raise ValueError("Invalid protobuf field")
        if wire == 0:
            value, cursor = varint(raw, cursor)
        elif wire == 2:
            length, cursor = varint(raw, cursor)
            if cursor + length > len(raw):
                raise ValueError("Truncated protobuf bytes")
            value = raw[cursor:cursor + length]
            cursor += length
        else:
            raise ValueError("Unexpected protobuf wire type")
        result[number].append(value)
    return result


def one(message, key, default=None):
    values = message.get(key, [])
    if len(values) > 1:
        raise ValueError("Repeated scalar")
    return values[0] if values else default


def decode_summary(raw):
    top = fields(raw)
    if one(top, 1) != bytes.fromhex(ROUND):
        raise ValueError("Wrong round")
    status = one(top, 2, 0)
    if status not in (1, 2, 3, 4):
        raise ValueError("Unexpected round status")
    counts, weights = {}, {}
    for raw_proposal in top.get(5, []):
        proposal = fields(raw_proposal)
        proposal_id = one(proposal, 1, 0)
        if proposal_id not in range(1, 38) or proposal_id in counts:
            raise ValueError("Wrong or duplicate proposal")
        options = {}
        option_weights = {}
        for raw_option in proposal.get(4, []):
            option = fields(raw_option)
            index = one(option, 1, 0)
            if index not in range(4) or index in options:
                raise ValueError("Wrong or duplicate option")
            # Missing scalar means protobuf zero; missing option fails below.
            count, weight = one(option, 3, 0), one(option, 4, 0)
            if not isinstance(count, int) or not isinstance(weight, int):
                raise ValueError("Wrong count/value type")
            if status != 3 and weight != 0:
                raise ValueError("Weighted result before finalization")
            options[index] = count
            option_weights[index] = weight
        if set(options) != set(range(4)):
            raise ValueError("Incomplete options")
        counts[proposal_id] = [options[i] for i in range(4)]
        option_weights = [option_weights[i] for i in range(4)]
        # Active raw defaults are unavailable weights, not measured zero ZEC.
        weights[proposal_id] = option_weights if status == 3 else None
    if set(counts) != set(range(1, 38)):
        raise ValueError("Incomplete proposals")
    return status, counts, weights


def header(height, cache):
    url = RPC + "/blockchain?" + urlencode({"minHeight": height, "maxHeight": height})
    result, digest = fetch(url, cache)
    metas = result["result"]["block_metas"]
    if len(metas) != 1:
        raise ValueError("Expected one block metadata record")
    meta = metas[0]
    head = meta["header"]
    if head["chain_id"] != CHAIN or int(head["height"]) != height:
        raise ValueError("Wrong block or chain")
    return {"height": height, "at": head["time"], "blockHash": meta["block_id"]["hash"],
            "appHash": head["app_hash"], "sourceUrl": url, "responseSha256": digest}


def summary(height, cache):
    url = RPC + "/abci_query?" + urlencode({"path": '"/svote.v1.Query/VoteSummary"',
                "data": "0x0a20" + ROUND, "height": height, "prove": "false"})
    result, digest = fetch(url, cache)
    response = result["result"]["response"]
    if response["code"] != 0 or int(response["height"]) != height:
        raise ValueError("Historical state unavailable or wrong height")
    raw = base64.b64decode(response["value"], validate=True)
    status, counts, weights = decode_summary(raw)
    return {"height": height, "status": status, "counts": counts, "weights": weights,
            "total": sum(sum(v) for v in counts.values()), "sourceUrl": url,
            "responseSha256": digest, "protobufSha256": hashlib.sha256(raw).hexdigest()}


def boundary(target, candidates, cache):
    times = [utc(row["at"]) for row in candidates]
    index = bisect_left(times, target)
    if index == 0 or index == len(candidates):
        raise ValueError("UTC boundary is not bracketed")
    low = candidates[index - 1]["height"]
    high = candidates[index]["height"]
    while high - low > 1:
        middle = (low + high) // 2
        if utc(header(middle, cache)["at"]) < target:
            low = middle
        else:
            high = middle
    before, after = header(low, cache), header(high, cache)
    if after["height"] != before["height"] + 1 or not utc(before["at"]) < target <= utc(after["at"]):
        raise ValueError("UTC boundary proof failed")
    state = summary(low, cache)
    print(f"Verified {iso(target)}: height {low:,}; {state['total']:,} revealed shares", flush=True)
    return {"boundaryAt": iso(target), "before": before, "after": after, "state": state}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_official(path):
    raw = path.read_bytes()
    require(hashlib.sha256(raw).hexdigest() == SUMMARY_HASH, "Pinned summary hash mismatch")
    official = json.loads(raw)
    require(base64.b64decode(official["vote_round_id"], validate=True).hex() == ROUND,
            "Wrong official round")
    require(official["status"] == 3, "Official round is not finalized")
    return official


def verify_archive(data, official):
    """Offline internal reconciliation, not independent verification of state proofs."""
    require(type(data["schemaVersion"]) is int and data["schemaVersion"] == 1 and data["complete"] is True,
            "Wrong schema or incomplete archive")
    require(data["roundId"] == ROUND and data["chainId"] == CHAIN, "Wrong round or chain")
    require(data["unit"] == "revealed shares" and data["interval"] == "UTC day", "Wrong units")
    require(data["optionIndices"] == [0, 1, 2, 3] and data["optionLabels"] ==
            ["Accept", "Reject", "Reject with lower amount", "Abstain"], "Wrong option mapping")
    source = data["source"]
    require(source["rpc"] == RPC and source["summaryUrl"] == SUMMARY_URL and
            source["summarySha256"] == SUMMARY_HASH and source["sdkRevision"] == SDK,
            "Wrong source provenance")
    expected = {str(proposal["id"]): [option.get("ballot_count", 0) for option in
                sorted(proposal["options"], key=lambda option: option.get("index", 0))]
                for proposal in official["proposals"]}

    def matrix(counts):
        require(set(counts) == {str(i) for i in range(1, 38)}, "Missing or extra proposal")
        require(all(len(row) == 4 and all(type(value) is int and 0 <= value <= 2**53 - 1
                    for value in row) for row in counts.values()), "Invalid option counts")
        return sum(map(sum, counts.values()))

    def check_header(head):
        height = head["height"]
        require(type(height) is int and CREATION_HEIGHT <= height <= PINNED_HEIGHT,
                "Invalid archive height")
        utc(head["at"])
        require(head["sourceUrl"] == RPC + "/blockchain?" +
                urlencode({"minHeight": height, "maxHeight": height}), "Wrong header source")
        for key in ("blockHash", "appHash", "responseSha256"):
            require(re.fullmatch(r"[0-9a-fA-F]{64}", head[key]) is not None, "Invalid header hash")

    def check_state(state):
        height = state["height"]
        require(type(height) is int and CREATION_HEIGHT <= height <= PINNED_HEIGHT,
                "Invalid state height")
        require(type(state["status"]) is int and state["status"] in (1, 2, 3, 4), "Invalid state status")
        require(matrix(state["counts"]) == state["total"], "State total mismatch")
        require("weights" not in state, "Historical weights must not be exposed")
        require(state["sourceUrl"] == RPC + "/abci_query?" + urlencode({
            "path": '"/svote.v1.Query/VoteSummary"', "data": "0x0a20" + ROUND,
            "height": height, "prove": "false"}), "Wrong state source")
        for key in ("responseSha256", "protobufSha256"):
            require(re.fullmatch(r"[0-9a-fA-F]{64}", state[key]) is not None, "Invalid state hash")

    baseline, final = data["baseline"], data["final"]
    for frame in (baseline, final):
        check_header(frame["header"])
        check_state(frame["state"])
        require(frame["header"]["height"] == frame["state"]["height"], "Header/state height mismatch")
    require(baseline["state"]["height"] == CREATION_HEIGHT and baseline["state"]["status"] == 4
            and baseline["state"]["total"] == 0, "Invalid zero baseline")
    require(final["state"]["height"] == PINNED_HEIGHT and final["state"]["status"] == 3
            and final["state"]["counts"] == expected, "Final counters differ from official summary")
    require(matrix(expected) == 145_620, "Unexpected canonical total")
    require(len(data["days"]) == len(data["boundaries"]) == 13, "Incomplete UTC days")
    previous = baseline["state"]
    first_day = datetime(2026, 9, 17, tzinfo=timezone.utc)
    status_order = {4: 0, 1: 1, 2: 2, 3: 3}
    for index, (day, edge) in enumerate(zip(data["days"], data["boundaries"])):
        before, after, state = edge["before"], edge["after"], edge["state"]
        check_header(before)
        check_header(after)
        check_state(state)
        start = first_day + timedelta(days=index)
        cutoff = start + timedelta(days=1)
        require(day["at"] == iso(start) and day["until"] == edge["boundaryAt"] == iso(cutoff),
                "Missing, duplicate, reordered or non-UTC day")
        require(after["height"] == before["height"] + 1 and
                utc(before["at"]) < cutoff <= utc(after["at"]), "UTC headers do not bracket boundary")
        require(state["height"] == before["height"] == day["snapshotHeight"] and
                state["height"] > previous["height"], "Wrong snapshot height")
        require(status_order[state["status"]] >= status_order[previous["status"]], "Round status regressed")
        require(matrix(day["counts"]) == day["total"], "Daily total mismatch")
        require(day["cumulative"] == state["counts"] and
                day["cumulativeTotal"] == state["total"], "Cumulative total mismatch")
        require(all(day["counts"][p][i] == state["counts"][p][i] - previous["counts"][p][i]
                    for p in expected for i in range(4)), "Daily option delta mismatch")
        previous = state
    require(previous["status"] == 3 and previous["counts"] == expected,
            "Last daily boundary does not equal final counters")
    coverage = data["coverage"]
    require(coverage["from"] == baseline["header"]["at"] and
            first_day <= utc(coverage["from"]) < first_day + timedelta(days=1) and
            coverage["until"] == data["days"][-1]["until"] and
            coverage["pinnedHeight"] == PINNED_HEIGHT and
            coverage["firstDayBeginsAtRoundCreation"] is True, "Coverage mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", type=Path, default=ROOT / "data/coinholder/q3-2026-summary.json", help="Pinned official summary JSON")
    parser.add_argument("--activity", type=Path, default=ROOT / "data/coinholder/activity-q3-2026-transactions.json", help="Committed cast records used only to bracket header searches")
    parser.add_argument("--cast-cache", type=Path, help="Optional compact activity block-cache directory, in addition to --activity")
    parser.add_argument("--cache", type=Path, default=ROOT.parent / "coinholder-reveal-cache", help="Resumable public response cache; keep outside the repository")
    parser.add_argument("--output", type=Path, default=ROOT / "data/coinholder/q3-2026-reveals.json")
    parser.add_argument("--workers", type=int, choices=range(1, 5), default=2)
    parser.add_argument("--verify-only", action="store_true", help="Check --output against --summary offline; make no network requests or writes")
    args = parser.parse_args()
    official = load_official(args.summary)
    if args.verify_only:
        archive = json.loads(args.output.read_text())
        verify_archive(archive, official)
        print(f"Verified {args.output}: 13 UTC days; 148 final option counts; 145,620 revealed shares; no network requests")
        return
    status, _ = fetch(RPC + "/status", args.cache, refresh=True)
    node = status["result"]
    if node["node_info"]["network"] != CHAIN or int(node["sync_info"]["latest_block_height"]) < PINNED_HEIGHT:
        raise ValueError("Archive chain or coverage mismatch")
    official, official_hash = fetch(SUMMARY_URL, args.cache, refresh=True)
    if official_hash != SUMMARY_HASH or official["status"] != 3:
        raise ValueError("Final official summary changed")
    baseline_header = header(CREATION_HEIGHT, args.cache)
    baseline = summary(CREATION_HEIGHT, args.cache)
    if baseline["total"] != 0:
        raise ValueError("Baseline is not zero")
    final_header = header(PINNED_HEIGHT, args.cache)
    final = summary(PINNED_HEIGHT, args.cache)
    expected_counts, expected_weights = {}, {}
    for proposal in official["proposals"]:
        ordered = sorted(proposal["options"], key=lambda o: o.get("index", 0))
        expected_counts[proposal["id"]] = [o.get("ballot_count", 0) for o in ordered]
        expected_weights[proposal["id"]] = [o.get("total_value", 0) for o in ordered]
    if final["status"] != 3 or final["counts"] != expected_counts or final["weights"] != expected_weights:
        raise ValueError("Final archived state does not match all 148 official counts and weights")
    # Cast records only reduce archive header searches. Every selected UTC
    # boundary is re-established with two adjacent archive headers and state.
    activity = json.loads(args.activity.read_text())
    if activity.get("roundId") != ROUND or activity.get("chainId") != CHAIN or activity.get("complete") is not True:
        raise ValueError("Wrong or incomplete cast activity archive")
    records = list(activity["transactions"])
    if args.cast_cache:
        if not args.cast_cache.is_dir():
            raise ValueError("Cast cache directory does not exist")
        records.extend(json.loads(path.read_text()) for path in args.cast_cache.glob("*.json"))
    by_height = {CREATION_HEIGHT: baseline_header, PINNED_HEIGHT: final_header}
    for record in records:
        height = record["height"]
        if CREATION_HEIGHT < height < PINNED_HEIGHT:
            previous = by_height.get(height)
            if previous and utc(previous["at"]) != utc(record["at"]):
                raise ValueError("Conflicting cached times for one height")
            by_height[height] = {"height": height, "at": record["at"]}
    candidates = sorted(by_height.values(), key=lambda row: row["height"])
    if any(utc(a["at"]) > utc(b["at"]) for a, b in zip(candidates, candidates[1:])):
        raise ValueError("Nonmonotonic cached header times")
    start_day = utc(baseline_header["at"]).replace(hour=0, minute=0, second=0, microsecond=0)
    closing_day = datetime.fromtimestamp(official["vote_end_time"], timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    targets = [start_day + timedelta(days=i + 1) for i in range((closing_day - start_day).days + 1)]
    print(f"Pinned {CHAIN} at {PINNED_HEIGHT:,}; {len(targets)} UTC boundaries; {final['total']:,} final shares", flush=True)
    boundaries = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(boundary, target, candidates, args.cache): target for target in targets}
        for future in as_completed(futures):
            boundaries.append(future.result())
    boundaries.sort(key=lambda row: row["boundaryAt"])
    days, previous = [], baseline
    for edge in boundaries:
        state = edge["state"]
        delta = {p: [a - b for a, b in zip(state["counts"][p], previous["counts"][p])] for p in range(1, 38)}
        if any(value < 0 for option_counts in delta.values() for value in option_counts):
            raise ValueError("A revealed-share counter decreased")
        at = iso(utc(edge["boundaryAt"]) - timedelta(days=1))
        days.append({"at": at, "until": edge["boundaryAt"], "counts": delta,
                     "total": sum(sum(v) for v in delta.values()), "cumulative": state["counts"],
                     "cumulativeTotal": state["total"], "snapshotHeight": state["height"]})
        previous = state
    if previous["status"] != 3 or previous["counts"] != expected_counts or previous["weights"] != expected_weights:
        raise ValueError("Last daily boundary is not the exact finalized state")
    for proposal in range(1, 38):
        if [sum(day["counts"][proposal][i] for day in days) for i in range(4)] != expected_counts[proposal]:
            raise ValueError("Daily option deltas do not reconcile")
    for edge in boundaries:
        edge["state"].pop("weights")
    baseline.pop("weights")
    final.pop("weights")
    output = {"schemaVersion": 1, "roundId": ROUND, "chainId": CHAIN,
              "fetchedAt": iso(datetime.now(timezone.utc)), "complete": True,
              "unit": "revealed shares", "interval": "UTC day", "optionIndices": [0, 1, 2, 3],
              "optionLabels": ["Accept", "Reject", "Reject with lower amount", "Abstain"],
              "coverage": {"from": baseline_header["at"], "until": boundaries[-1]["boundaryAt"],
                           "pinnedHeight": PINNED_HEIGHT, "firstDayBeginsAtRoundCreation": True},
              "source": {"rpc": RPC, "summaryUrl": SUMMARY_URL, "summarySha256": official_hash,
                         "sdkRevision": SDK, "networkRequestsThisRun": REQUESTS,
                         "method": "Archived VoteSummary counters at the last block strictly before each UTC day boundary",
                         "verification": "148 final option counts and weights matched the official summary; nonnegative daily deltas reconcile exactly",
                         "trust": "Public archive provider responses; consensus signatures and cryptographic state proofs not independently verified"},
              "baseline": {"header": baseline_header, "state": baseline},
              "final": {"header": final_header, "state": final}, "boundaries": boundaries, "days": days}
    verify_archive(json.loads(json.dumps(output)), official)
    write(args.output, output)
    print(f"Saved {args.output}: {len(days)} days; {sum(d['total'] for d in days):,} revealed shares; {REQUESTS} requests", flush=True)


if __name__ == "__main__":
    main()
