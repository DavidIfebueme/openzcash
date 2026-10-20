"""Synthetic, opt-in live audit on an existing loopback preview; model calls may incur charges.
No credentials are loaded. Completion is a transport check, not a semantic pass: review every answer against the case rubric.
"""
import argparse
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


def main():
    cases = json.loads((Path(__file__).resolve().parent.parent / "docs/zarvis-expertise-cases.json").read_text())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:4237")
    parser.add_argument("--confirm-paid", action="store_true")
    parser.add_argument("--cases", nargs="+", choices=[case["id"] for case in cases], default=[case["id"] for case in cases[:5]])
    parser.add_argument("--output", default="/tmp/zarvis-expertise-live.json")
    args = parser.parse_args()
    target = urlparse(args.url)
    if not args.confirm_paid:
        parser.error("Pass --confirm-paid to use the preview's configured provider.")
    if target.scheme != "http" or target.hostname not in ("localhost", "127.0.0.1", "::1") or target.username or target.password or target.path not in ("", "/") or target.query or target.fragment:
        parser.error("Only a plain loopback preview origin is allowed.")
    origin = args.url.rstrip("/")
    selected = [case for case in cases if case["id"] in args.cases]
    for case in selected:
        if case.get("follows") and case["follows"] not in args.cases:
            parser.error(f"Include {case['follows']} before {case['id']}.")
    results, contexts = [], {}
    for case in selected:
        history, session = contexts.get(case.get("follows"), ([], {}))
        history = history + [{"role": "user", "content": case["question"]}]
        request = urllib.request.Request(origin + "/api/zarvis", data=json.dumps({"messages": history, "session": session}).encode(), headers={"Origin": origin, "Content-Type": "application/json"})
        started, text, done = time.monotonic(), "", None
        result = {"id": case["id"], "question": case["question"], "review": case["review"], "completed": False}
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                for line in response:
                    event = json.loads(line)
                    if event["type"] == "replace": text = event["text"]
                    elif event["type"] == "delta": text += event["text"]
                    elif event["type"] == "session": session = event["session"]
                    elif event["type"] == "done": done = event
                    elif event["type"] == "error": result["error"] = event["message"]
            result.update(completed=bool(done and text.strip()), answer=text, sources=done.get("sources", []) if done else [], provenance=done.get("provenance") if done else None)
        except urllib.error.HTTPError as error:
            result.update(httpStatus=error.code, error="Preview refused the request", retryAfter=error.headers.get("Retry-After"))
        except Exception as error:
            result["error"] = type(error).__name__
        result["seconds"] = round(time.monotonic() - started, 2)
        results.append(result)
        Path(args.output).write_text(json.dumps({"at": datetime.now(timezone.utc).isoformat(), "origin": origin, "semanticReview": "required", "results": results}, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({key: value for key, value in result.items() if key in ("id", "completed", "seconds", "error", "httpStatus", "retryAfter")}), flush=True)
        if not result["completed"]:
            break  # Respect quotas and service errors; no automatic retry or cap override.
        contexts[case["id"]] = (history + [{"role": "assistant", "content": text}], session)
    print(f"{sum(row['completed'] for row in results)}/{len(selected)} completed. Review content separately. {args.output}", flush=True)


if __name__ == "__main__":
    main()
