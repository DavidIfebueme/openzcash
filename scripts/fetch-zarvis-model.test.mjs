import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MODEL, fetchModel, modelPresent, verified } from "./fetch-zarvis-model.mjs";

const hash = (text) => createHash("sha256").update(text).digest("hex");
/** A fake hub: the expected bytes for every pinned file, no network. */
const expectedFor = (name) => `file:${name}`;
const pinnedModel = { ...MODEL, files: Object.fromEntries(Object.keys(MODEL.files).map((name) => [name, hash(expectedFor(name))])) };
const quick = { attempts: 2, delayMs: 0 };
const fakeFetch = (served) => async (url) => { const name = url.split(`/resolve/${MODEL.revision}/`)[1]; const body = served(name); return body === undefined ? new Response("", { status: 404 }) : new Response(body, { status: 200 }); };

test("pins the model files with full SHA-256 hashes and a commit revision", () => {
  assert.match(MODEL.revision, /^[0-9a-f]{40}$/);
  assert.deepEqual(Object.keys(MODEL.files).sort(), ["config.json", "onnx/model_int8.onnx", "tokenizer.json", "tokenizer_config.json"]);
  for (const digest of Object.values(MODEL.files)) assert.match(digest, /^[0-9a-f]{64}$/);
});
test("downloads only what is missing, verifies every byte and leaves no partial file behind", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zarvis-model-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const original = MODEL.files; Object.assign(MODEL, { files: pinnedModel.files }); t.after(() => Object.assign(MODEL, { files: original }));
  const first = await fetchModel(dir, fakeFetch(expectedFor), quick);
  assert.deepEqual(first.sort(), Object.keys(MODEL.files).sort());
  assert.equal(await modelPresent(dir), true);
  assert.deepEqual(await fetchModel(dir, async () => { throw new Error("NETWORK"); }, quick), []);
  fs.writeFileSync(path.join(dir, MODEL.id, "config.json"), "tampered");
  assert.equal(await verified(path.join(dir, MODEL.id, "config.json"), MODEL.files["config.json"]), false);
  assert.deepEqual(await fetchModel(dir, fakeFetch(expectedFor), quick), ["config.json"]);
  fs.rmSync(path.join(dir, MODEL.id, "tokenizer.json"));
  await assert.rejects(fetchModel(dir, fakeFetch((name) => name === "tokenizer.json" ? "wrong bytes" : expectedFor(name)), quick), { message: "MODEL_HASH_MISMATCH" });
  assert.equal(fs.existsSync(path.join(dir, MODEL.id, "tokenizer.json")), false);
  assert.equal(fs.existsSync(path.join(dir, MODEL.id, "tokenizer.json.tmp")), false);
  await assert.rejects(fetchModel(dir, fakeFetch(() => undefined), quick), { message: "MODEL_SOURCE_UNAVAILABLE" });
});
