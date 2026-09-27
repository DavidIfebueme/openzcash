import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compile, publicText, routes } from "./build-zarvis-knowledge.mjs";
test("only explicitly allowed public pages are compiled", () => {
  for (const route of routes) assert.doesNotMatch(route, /\/(?:admin|viewing-keys|invites|login|projects)(?:\/|$)/);
  const index = compile();
  assert.equal(index.sourceFiles, 54);
  assert.ok(index.documents.length > 40);
  assert.deepEqual(index, JSON.parse(fs.readFileSync(new URL("../src/lib/zarvis/public-content.json", import.meta.url), "utf8")));
});
test("extracts visible copy without executing code, importing modules or copying credentials", () => {
  const source = `import token from './.env'; const apiKey = "secret-sentinel"; const x = {password:"private",title:"Public title"}; export default function Page(){return <p>Public text &amp; sources</p>}`;
  const output = publicText(source, "page.tsx");
  assert.match(output, /Public title/); assert.match(output, /Public text & sources/);
  assert.doesNotMatch(output, /secret-sentinel|private|apiKey|password|import/);
});
