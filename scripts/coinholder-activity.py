#!/usr/bin/env python3
"""Rebuild Q3 cast activity from public vote-chain blocks and successful events.

Read-only, fixed official provider; no wallet, secrets, broadcasts, or extra deps.
Raw proof bytes are decoded in memory and never saved. Cache compact verified
block records outside the repository with --cache to resume interrupted runs.
"""
import argparse
import base64
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

ROUND = "2cba66eb16c7581a1692cb0b033785da0131059f645a0d2fb4dc2a5131505e01"
ROUND_BYTES = bytes.fromhex(ROUND)
CHAIN = "zvote-1"
BASE = "https://zvote.zfnd.org"
SDK_PIN = "4dbe05aad847513300e632ab1be48ae08662b240"
MAX_BYTES = 64 * 1024 * 1024
KINDS = {2: "MsgDelegateVote", 3: "MsgCastVote", 6: "MsgCastVoteBatch", 7: "MsgDelegateAndCastVoteBatch"}


def get_json(path):
    url = BASE + path
    last = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "ZDAO-Coinholder-Activity/1.0"})
            with urllib.request.urlopen(request, timeout=35) as response:
                raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError("Provider response exceeds 64 MiB")
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("Expected JSON object")
            return data
        except urllib.error.HTTPError as error:
            if error.code == 422:
                return json.loads(error.read())
            last = error
        except (TimeoutError, OSError, ValueError) as error:
            last = error
        if attempt < 3:
            time.sleep(0.6 * (2 ** attempt))
    raise RuntimeError("Public read failed: " + url) from last


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, separators=(",", ":")) + "\n")
    tmp.replace(path)


def varint(raw, cursor):
    value = 0
    for shift in range(0, 70, 7):
        if cursor >= len(raw):
            raise ValueError("Truncated protobuf varint")
        byte = raw[cursor]
        cursor += 1
        value |= (byte & 127) << shift
        if not byte & 128:
            return value, cursor
    raise ValueError("Oversized protobuf varint")


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
        elif wire in (1, 5):
            length = 8 if wire == 1 else 4
            if cursor + length > len(raw):
                raise ValueError("Truncated protobuf fixed field")
            value = raw[cursor:cursor + length]
            cursor += length
        else:
            raise ValueError("Unsupported protobuf wire type")
        result[number].append(value)
    return result


def one(message, number, default=None):
    values = message.get(number, [])
    if len(values) > 1:
        raise ValueError("Unexpected repeated field")
    return values[0] if values else default


def cast(raw):
    message = fields(raw)
    if one(message, 6) != ROUND_BYTES:
        return None
    commitment = one(message, 3)
    van = one(message, 2)
    proposal = one(message, 4)
    if not isinstance(commitment, bytes) or len(commitment) != 32 or not isinstance(van, bytes) or len(van) != 32:
        raise ValueError("Invalid cast commitments")
    if not isinstance(proposal, int) or not 1 <= proposal <= 37:
        raise ValueError("Unexpected Q3 proposal")
    return {"typeUrl": "/svote.v1.MsgCastVote", "proposalId": proposal,
            "commitment": commitment.hex(), "anchorHeight": one(message, 7, 0),
            "proofBytes": len(one(message, 5, b"")), "_van": van.hex()}


def decode(raw):
    tag = raw[0] if raw else 0
    if tag not in KINDS:
        return None
    message = fields(raw[1:])
    if tag == 2:
        if one(message, 9) != ROUND_BYTES:
            return None
        van = one(message, 6)
        if not isinstance(van, bytes) or len(van) != 32:
            raise ValueError("Invalid delegation commitment")
        return {"kind": KINDS[tag], "messages": [], "expectedLeaves": [van.hex()]}
    if tag == 3:
        c = cast(raw[1:])
        if c is None:
            return None
        return {"kind": KINDS[tag], "messages": [c], "expectedLeaves": [c["_van"], c["commitment"]]}
    if tag == 7:
        delegation = fields(one(message, 1, b""))
        if one(delegation, 9) != ROUND_BYTES:
            return None
        message = fields(one(message, 2, b""))
    cs = [cast(value) for value in message.get(1, [])]
    if not cs or any(c is None for c in cs):
        if any(c is not None for c in cs):
            raise ValueError("Mixed round batch")
        return None
    return {"kind": KINDS[tag], "messages": cs,
            "expectedLeaves": [cs[-1]["_van"]] + [c["commitment"] for c in cs]}


def normalize_at(value):
    # Python 3.9 accepts microseconds, whereas CometBFT emits nanoseconds.
    normalized = re.sub(r"(\.\d{6})\d+", r"\1", value)
    stamp = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    return stamp.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def verify_block(leaf_block, cache):
    height = leaf_block["height"]
    leaf_hash = hashlib.sha256(json.dumps(leaf_block, sort_keys=True).encode()).hexdigest()
    cache_file = cache / "blocks" / (str(height) + ".json")
    if cache_file.exists():
        old = json.loads(cache_file.read_text())
        if old.get("schemaVersion") == 1 and old.get("leafHash") == leaf_hash:
            return old
    block_reply = get_json("/cosmos/base/tendermint/v1beta1/blocks/" + str(height))
    block = block_reply["block"]
    header = block["header"]
    if header["chain_id"] != CHAIN or int(header["height"]) != height:
        raise ValueError("Mismatched chain/block")
    at = normalize_at(header["time"])
    remaining = Counter(base64.b64decode(x, validate=True).hex() for x in leaf_block["leaves"])
    records = []
    discarded = 0
    for tx in block["data"].get("txs", []):
        raw = base64.b64decode(tx, validate=True)
        decoded = decode(raw)
        if decoded is None:
            continue
        tx_hash = hashlib.sha256(raw).hexdigest().upper()
        status = get_json("/shielded-vote/v1/tx/" + tx_hash)
        if int(status.get("height", -1)) != height:
            raise ValueError("Transaction height mismatch")
        if status.get("code") != 0:
            discarded += 1
            continue
        expected = Counter(decoded["expectedLeaves"])
        if any(remaining[k] < n for k, n in expected.items()):
            raise ValueError("Successful transaction outputs missing from round commitment index")
        remaining.subtract(expected)
        for message in decoded["messages"]:
            message.pop("_van")
        records.append({"txHash": tx_hash, "height": height, "at": at,
                        "kind": decoded["kind"], "typeUrl": "/svote.v1." + decoded["kind"],
                        "proposalIds": [m["proposalId"] for m in decoded["messages"]],
                        "castCount": len(decoded["messages"]), "messages": decoded["messages"],
                        "txBytes": len(raw), "sourceUrl": BASE + "/shielded-vote/v1/tx/" + tx_hash})
    if any(n != 0 for n in remaining.values()):
        raise ValueError("Unexplained round commitments at block " + str(height))
    result = {"schemaVersion": 1, "leafHash": leaf_hash, "height": height, "at": at,
              "blockHash": base64.b64decode(block_reply["block_id"]["hash"]).hex().upper(),
              "leaves": len(leaf_block["leaves"]), "records": records, "discarded": discarded}
    write_json(cache_file, result)
    return result


def bucket(records, period, proposal=None):
    counts = Counter()
    for record in records:
        count = record["castCount"] if proposal is None else record["proposalIds"].count(proposal)
        if count:
            sec = int(datetime.fromisoformat(record["at"].replace("Z", "+00:00")).timestamp())
            counts[sec // period * period] += count
    cumulative = 0
    result = []
    for sec, count in sorted(counts.items()):
        cumulative += count
        result.append({"at": datetime.fromtimestamp(sec, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                       "count": count, "cumulative": cumulative})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/coinholder/activity-q3-2026.json"))
    parser.add_argument("--workers", type=int, default=6, choices=range(1, 9))
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    index_file = args.cache / "index.json"
    if index_file.exists():
        index = json.loads(index_file.read_text())
        if index.get("roundId") != ROUND or index.get("chainId") != CHAIN:
            raise ValueError("Wrong cached round/chain")
    else:
        latest = get_json("/cosmos/base/tendermint/v1beta1/blocks/latest")["block"]["header"]
        if latest["chain_id"] != CHAIN:
            raise ValueError("Wrong chain")
        pinned_height = int(latest["height"])
        round_data = get_json("/shielded-vote/v1/round/" + ROUND)["round"]
        if base64.b64decode(round_data["vote_round_id"]).hex() != ROUND or round_data["status"] != 3:
            raise ValueError("Expected finalized Q3 round")
        blocks = []
        cursor = 0
        while True:
            reply = get_json("/shielded-vote/v1/commitment-tree/" + ROUND + "/leaves?from_height=" + str(cursor) + "&to_height=" + str(pinned_height))
            for b in reply.get("blocks", []):
                if blocks and b["height"] <= blocks[-1]["height"]:
                    raise ValueError("Non-increasing leaf pagination")
                expected_start = sum(len(x["leaves"]) for x in blocks)
                if b.get("start_index", 0) != expected_start:
                    raise ValueError("Commitment index gap")
                blocks.append(b)
            next_cursor = reply.get("next_from_height", 0)
            if not next_cursor:
                break
            if next_cursor <= cursor:
                raise ValueError("Pagination failed to advance")
            cursor = next_cursor
        index = {"roundId": ROUND, "chainId": CHAIN, "toHeight": pinned_height,
                 "fromHeight": round_data["created_at_height"], "blocks": blocks}
        write_json(index_file, index)
    blocks = index["blocks"]
    final_tree = get_json("/shielded-vote/v1/commitment-tree/" + ROUND + "/latest")["tree"]
    indexed_leaves = sum(len(block["leaves"]) for block in blocks)
    if (not blocks or final_tree["next_index"] != indexed_leaves
            or final_tree["height"] != blocks[-1]["height"]
            or final_tree["root"] != blocks[-1]["root"]):
        raise ValueError("Paginated index does not match the final round tree")
    results = []
    errors = []
    print("Indexed", len(blocks), "activity blocks; fetching with", args.workers, "workers", flush=True)
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        jobs = {executor.submit(verify_block, block, args.cache): block["height"] for block in blocks}
        for future in as_completed(jobs):
            try:
                results.append(future.result())
            except Exception as error:
                errors.append({"height": jobs[future], "error": str(error)})
            done = len(results) + len(errors)
            if done % 100 == 0 or done == len(blocks):
                print("Blocks", done, "/", len(blocks), "errors", len(errors), flush=True)
    records = sorted((r for block in results for r in block["records"] if r["castCount"]), key=lambda r: (r["height"], r["txHash"]))
    if len({r["txHash"] for r in records}) != len(records):
        raise ValueError("Duplicate transaction records")
    complete = len(results) == len(blocks) and not errors
    counts = {"transactions": len(records), "castMessages": sum(r["castCount"] for r in records)}
    proposals = [{"id": i, "transactions": sum(i in r["proposalIds"] for r in records),
                  "castMessages": sum(r["proposalIds"].count(i) for r in records),
                  "minutes": bucket(records, 60, i), "hours": bucket(records, 3600, i)} for i in range(1, 38)]
    payload = {"schemaVersion": 1, "roundId": ROUND, "chainId": CHAIN,
               "fetchedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
               "sourceUrls": [BASE + "/shielded-vote/v1/round/" + ROUND,
                              BASE + "/shielded-vote/v1/commitment-tree/" + ROUND + "/leaves",
                              BASE + "/cosmos/base/tendermint/v1beta1/blocks/latest"],
               "unit": "Encrypted vote commitments", "complete": complete,
               "coverage": {"fromHeight": index["fromHeight"], "toHeight": index["toHeight"],
                            "firstAt": records[0]["at"] if records else None,
                            "lastAt": records[-1]["at"] if records else None,
                            "reason": None if complete else "Some activity blocks could not be verified; counts are partial."},
               "totals": counts, "minutes": bucket(records, 60), "hours": bucket(records, 3600),
               "proposals": proposals, "recentTransactions": list(reversed(records[-50:])),
               "evidence": {"activityBlocks": len(blocks), "verifiedBlocks": len(results),
                            "commitmentLeaves": sum(len(b["leaves"]) for b in blocks),
                            "verifiedCommitmentLeaves": sum(b["leaves"] for b in results),
                            "failedTransactionsExcluded": sum(b["discarded"] for b in results),
                            "finalTreeRoot": final_tree["root"],
                            "finalTreeHeight": final_tree["height"],
                            "indexSha256": hashlib.sha256(index_file.read_bytes()).hexdigest(),
                            "verification": ("All indexed round leaves reconciled to raw block messages. " if complete else "Partial index: only successfully verified activity blocks are included. ") + "Successful execution checked by transaction hash. Provider data, not independent consensus proof verification.",
                            "sdkSource": "https://github.com/valargroup/vote-sdk/blob/" + SDK_PIN + "/proto/svote/v1/tx.proto",
                            "errors": errors}}
    write_json(args.output, payload)
    compact = [{k: v for k, v in r.items() if k != "messages"} for r in records]
    write_json(args.output.with_name("activity-q3-2026-transactions.json"), {"roundId": ROUND, "chainId": CHAIN, "complete": complete, "transactions": compact})
    print("Saved", args.output, "complete", complete, counts, flush=True)
    if not complete:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
