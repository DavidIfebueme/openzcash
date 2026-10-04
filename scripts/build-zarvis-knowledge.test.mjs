import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compile, publicText, publicSections, routes } from "./build-zarvis-knowledge.mjs";
test("only explicitly allowed public pages are compiled", () => {
  for (const route of routes) assert.doesNotMatch(route, /\/(?:admin|viewing-keys|invites|login|projects)(?:\/|$)/);
  const index = compile();
  assert.equal(index.sourceFiles, 55);
  assert.ok(index.documents.length > 40);
  assert.deepEqual(index, JSON.parse(fs.readFileSync(new URL("../src/lib/zarvis/public-content.json", import.meta.url), "utf8")));
});
test("extracts visible copy without executing code, importing modules or copying credentials", () => {
  const source = `import token from './.env'; const apiKey = "secret-sentinel"; const x = {password:"private",title:"Public title"}; export default function Page(){return <p>Public text &amp; sources</p>}`;
  const output = publicText(source, "page.tsx");
  assert.match(output, /Public title/); assert.match(output, /Public text & sources/);
  assert.doesNotMatch(output, /secret-sentinel|private|apiKey|password|import/);
  assert.equal(publicText("const page = <p>Visible reference</p>", "reference.tsx", true), "Visible reference");
});

test("the indexed PDF snapshots still match the published files", async () => {
  const { createHash } = await import("node:crypto");
  const corpus = JSON.parse(fs.readFileSync(new URL("../src/lib/zarvis/reference-content.json", import.meta.url), "utf8"));
  assert.ok(corpus.sources.length >= 4);
  for (const source of corpus.sources) {
    assert.ok(source.retrievedAt); assert.ok(source.note); assert.ok(source.sha256);
    assert.match(source.url, /^https:\/\/(zips.z.cash|openzcash.org)\//);
    if (source.localPath) {
      assert.match(source.localPath, /^public\/monthly\/editions\/[a-zA-Z0-9_./-]+\.pdf$/);
      const binary = fs.readFileSync(new URL("../" + source.localPath, import.meta.url));
      assert.equal(createHash("sha256").update(binary).digest("hex"), source.sha256, "Run knowledge:sync when a public report changes");
    }
  }
});


test("preserves each person's role, pseudonym and disclosure date without mixing neighboring records", () => {
  const source = `export const PEOPLE = [
    {name:"Edward Snowden",knownAs:"John Dobbertin",role:"Witness",public:"April 2022",password:"secret-sentinel"},
    {name:"Zooko Wilcox",knownAs:null,role:"Denver station",public:"October 26, 2016"}
  ]; executePrivateCode();`;
  const records = publicSections(source, "people.ts");
  assert.equal(records.length, 2);
  assert.match(records[0].text, /John Dobbertin/); assert.match(records[0].text, /April 2022/);
  assert.doesNotMatch(records[0].text, /Denver|secret-sentinel|executePrivateCode/);
  assert.match(records[1].text, /Role: Denver station/); assert.match(records[1].text, /Identity publicly disclosed: October 26, 2016/); assert.doesNotMatch(records[1].text, /Snowden/);
});

test("retains chapter names and eras when a long narrative spans several chunks", () => {
  const records = compile().documents.filter(d => d.id.startsWith("src/lib/ceremony/story.ts:"));
  const satoshi = records.filter(d => d.title.includes("2009–2010 · The problem Satoshi left open"));
  assert.ok(satoshi.length >= 2);
  assert.ok(satoshi.some(d => d.text.includes("Tahoe-LAFS")));
  assert.ok(records.some(d => d.text.includes("2023–2024 · New stewards")));
});


test("mixed reference layouts preserve archives and their names alongside dated follow-up events", () => {
  const docs = compile().documents.filter(d => d.id.startsWith("src/lib/ceremony/record.ts:"));
  assert.ok(docs.some(d => d.title.includes("Denver station, three cameras") && d.text.includes("720p")));
  assert.ok(docs.some(d => d.title.includes("May 31, 2022") && d.text.includes("Orchard")));
  const mixed = publicSections('const x = [{title:"Recognized",text:"Body"},{caption:"Public remainder",password:"secret-sentinel"}];', "reference.ts");
  assert.ok(mixed.some(d => d.text.includes("Public remainder")));
  assert.doesNotMatch(JSON.stringify(mixed), /secret-sentinel/);
});
