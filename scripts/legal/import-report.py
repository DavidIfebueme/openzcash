"""Import a Portuguese or English edition following the Brazil report's DOCX layout."""
import argparse
import hashlib
import json
import re
import struct
import subprocess
from pathlib import Path
from tempfile import NamedTemporaryFile
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def import_edition(filename):
    intro, sections, assets = [], [], {}
    with ZipFile(filename) as doc:
        relationships = ET.fromstring(doc.read("word/_rels/document.xml.rels"))
        targets = {item.get("Id"): item.get("Target") for item in relationships}
        body = ET.fromstring(doc.read("word/document.xml")).find("w:body", NS)
        for element in body:
            if element.tag == "{%s}sectPr" % NS["w"]:
                continue
            if element.tag != "{%s}p" % NS["w"]:
                raise ValueError("Expected paragraphs and inline figures. Check the source layout.")
            text = "".join(node.text or "" for node in element.findall(".//w:t", NS)).strip()
            if re.match(r"^[IVXLCDM]+\s*[-–]\s*\S", text):
                sections.append({"heading": text, "blocks": []})
            elif text and sections:
                sections[-1]["blocks"].append(text)
            elif text:
                intro.append(text)

            for image in element.findall(".//a:blip", NS):
                target = targets[image.attrib["{%s}embed" % NS["r"]]]
                data = doc.read("word/" + target)
                if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ValueError("The report template uses PNG figures.")
                blocks = sections[-1]["blocks"] if sections else []
                if not blocks or not isinstance(blocks[-1], str) or not re.match(r"^(Gráfico|Quadro|Chart|Box) \d+", blocks[-1]):
                    raise ValueError("Place the numbered figure caption directly before its image.")
                name = hashlib.sha256(data).hexdigest()[:20] + ".webp"
                width, height = struct.unpack(">II", data[16:24])
                blocks[-1] = {"image": "/legal/brasil/" + name, "caption": blocks[-1], "width": width, "height": height}
                assets[name] = data
    if len(intro) != 2 or not sections:
        raise ValueError("Expected a title, subtitle and numbered sections.")
    return {"title": intro[0], "subtitle": intro[1], "sections": sections}, assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("docx", type=Path)
    parser.add_argument("edition", help="Catalog key, e.g. brasil.pt or brasil.en")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9-]+\.(pt|en)", args.edition):
        parser.error("Use a lowercase slug and .pt or .en.")
    report, assets = import_edition(args.docx)
    directory = ROOT / "public/legal/brasil"
    for name, data in assets.items():
        output = directory / name
        if not output.exists():
            with NamedTemporaryFile(dir=directory) as temp:
                subprocess.run(["cwebp", "-quiet", "-lossless", "-o", temp.name, "--", "-"], input=data, check=True)
                output.write_bytes(Path(temp.name).read_bytes())
    dest = ROOT / "data/legal/reports" / (args.edition + ".json")
    with NamedTemporaryFile(mode="w", encoding="utf-8", dir=dest.parent, delete=False) as temp:
        json.dump(report, temp, ensure_ascii=False, indent=2)
        temp.write("\n")
    Path(temp.name).replace(dest)


if __name__ == "__main__":
    main()
