"""Refresh an explicit public corpus. No crawling, secrets or private routes.
Run on a maintainer/CI machine with Python 3 and pdftotext. Deployment reads the
committed corpus; it never fetches or parses PDFs during a chat request.
"""
import hashlib, json, re, subprocess, sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / "src/lib/zarvis/reference-content.json"
ZIPS = [200, 208, 214, 224, 244, 302, 308, 310, 316, 317]
class PublicHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip = [], 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav"): self.skip += 1
        if tag in ("p", "h1", "h2", "h3", "h4", "li", "tr", "pre", "br"): self.parts.append("\n")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav"): self.skip = max(0, self.skip - 1)
        if tag in ("p", "h1", "h2", "h3", "h4", "li", "tr", "pre"): self.parts.append("\n")
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)
    def text(self):
        return "\n".join(re.sub(r"\s+", " ", line).strip() for line in "".join(self.parts).splitlines() if line.strip())

def digest(data): return hashlib.sha256(data).hexdigest()
def sync():
    old = json.loads(TARGET.read_text()) if TARGET.exists() else {"sources": []}
    previous = {s["id"]: s for s in old["sources"]}
    now = datetime.now(timezone.utc).isoformat()
    sources = []
    for number in ZIPS:
        ident = f"zip-{number:04d}"
        url = f"https://zips.z.cash/{ident}"
        # No redirects; fixed HTTPS URLs only. Limit both transfer size and duration.
        result = subprocess.run(["curl", "--fail", "--silent", "--show-error", "--max-time", "20", "--max-filesize", "2000000", "--proto", "=https", url], capture_output=True, check=True, timeout=25)
        parser = PublicHTML(); parser.feed(result.stdout.decode("utf-8"))
        text = parser.text()
        if len(text) < 200 or not re.search(rf"ZIP:?\s+{number}\b", text): raise ValueError(f"Invalid public ZIP: {ident}")
        content_hash = digest(text.encode())
        title = re.search(r"Title:\s*(.+)", text)
        updated = re.search(r"Last-Updated:\s*([0-9-]+)", text)
        sources.append({"id": ident, "title": f"ZIP {number}: {title.group(1) if title else ident}", "url": url, "text": text,
            "retrievedAt": now, "sourceUpdatedOn": updated.group(1) if updated else None, "sha256": content_hash,
            "note": "Official document snapshot, not independent proof of activation. Verify current status when requested."})
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
