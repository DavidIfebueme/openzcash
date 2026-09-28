"""Refresh selectable text from the explicitly published PDF corpus. ZIPs use sync-zarvis-zips.ts. No crawling, secrets or private routes.
Run on a maintainer/CI machine with Python 3 and pdftotext. Deployment reads the
committed corpus; it never fetches or parses PDFs during a chat request.
"""
import hashlib, json, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "src/lib/zarvis/reference-content.json"
def digest(data): return hashlib.sha256(data).hexdigest()
def sync():
    old = json.loads(TARGET.read_text()) if TARGET.exists() else {"sources": []}
    previous = {s["id"]: s for s in old["sources"]}
    now = datetime.now(timezone.utc).isoformat()
    sources = []
    sets = json.loads((ROOT / "src/lib/monthly/reading-sets.json").read_text())
    for edition in sets:
        for kind, document in edition["documents"].items():
            relative = document["pdf"]
            if not re.fullmatch(r"/monthly/editions/[A-Za-z0-9_./-]+\.pdf", relative) or ".." in relative: raise ValueError("Invalid public PDF path")
            path = ROOT / "public" / relative.lstrip("/")
            binary = path.read_bytes()
            if len(binary) > 30_000_000: raise ValueError("Public PDF too large")
            ident = f"monthly:{edition['id']}:{kind}"
            prior = previous.get(ident)
            if prior and prior["sha256"] == digest(binary):
                sources.append(prior); continue
            result = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, check=True, timeout=30)
            text = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in result.stdout.decode().splitlines() if line.strip())
            if not text: raise ValueError(f"No selectable PDF text: {ident}")
            sources.append({"id": ident, "title": document.get("title", f"OpenZcash {kind} {edition['id']}"), "url": "https://openzcash.org" + relative,
                "text": text, "retrievedAt": now, "sourceUpdatedOn": edition.get("evidenceCutoff"), "sha256": digest(binary),
                "localPath": "public" + relative, "note": "Extracted text of a published PDF, not OCR. Evidence cutoff is the report period, not today's state."})
    corpus = {"version": 1, "sources": sources}
    temp = TARGET.with_suffix(".tmp")
    temp.write_text(json.dumps(corpus, ensure_ascii=False, indent=2) + "\n")
    temp.replace(TARGET)
    print(f"Saved {len(sources)} public sources ({sum(len(s['text']) for s in sources):,} characters).")
if __name__ == "__main__":
    try: sync()
    except Exception as error:
        print(f"Reference refresh failed ({type(error).__name__}); the prior corpus was preserved.", file=sys.stderr)
        sys.exit(1)
