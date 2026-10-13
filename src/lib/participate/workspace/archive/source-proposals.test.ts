import { expect, it } from "vitest";
// @vitest-environment node
import { buildSourceProposal, buildSourceUpdate, sourceCaptureSummary, verifySourceProposal } from "@/lib/participate/workspace/archive/source-proposals";
import { canonicalJson, decodeFile, sha256, utf8 } from "@/lib/participate/workspace/archive/format";
const capturedAt = "2026-10-10T15:00:00.000Z";
const issue = { number: 99901, html_url: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/99901", title: "Wallet education pilot", user: { login: "applicant" },
  body: "# Exact source\r\n\r\n### Proposal Category\r\n\r\nEducation\r\n\r\n## Budget\r\n$5,000.25\r\n\r\n[Attachment](https://example.test/budget.pdf)\r\n", state: "open", created_at: "2026-10-08T10:00:00.000Z", updated_at: "2026-10-09T12:00:00.000Z",
  labels: [{ name: "📋 Grant Application", color: "BFBF4D", description: null }, { name: "👀 Ready For ZCG Review", color: "105556", description: "Ready" }] };

it("preserves exact Markdown bytes, official label colors and dated status without inventing votes or money", async () => {
  const checked = await buildSourceProposal(issue, issue.number, capturedAt);
  expect(checked.manifest).toMatchObject({ kind: "SOURCE_PROPOSAL", recordId: "zcg-github-99901", revision: 1, previousManifestHash: null });
  expect(new TextDecoder().decode(decodeFile(checked.bundle.files[0]))).toBe(issue.body);
  expect(checked.capture.source.labels[0]).toMatchObject({ name: issue.labels[0].name, color: "bfbf4d" });
  expect(checked.capture.proposal).toMatchObject({ outcome: "under_review", requestedUsd: null, tags: ["education", "wallets"] });
  expect(checked.manifest.scope).toContain("Linked files and external discussions are not archived");
  expect((await verifySourceProposal(checked.bundle, checked.manifestHash)).capture).toEqual(checked.capture);
});
it.each([
  { state: "closed" }, { number: 99902 }, { html_url: "https://github.com/other/repo/issues/99901" }, { body: "" }, { pull_request: {} },
  { labels: [issue.labels[0]] }, { labels: [...issue.labels, { name: "✅ Grant Approved", color: "123456", description: null }] },
  { updated_at: "2026-10-11T12:00:00.000Z" }
])("rejects sources that do not establish the same pending application: %j", async change => {
  await expect(buildSourceProposal({ ...issue, ...change }, issue.number, capturedAt)).rejects.toThrow();
});
it("detects file tampering and links a later capture to the exact previous revision", async () => {
  const first = await buildSourceProposal(issue, issue.number, capturedAt);
  const next = await buildSourceProposal({ ...issue, body: issue.body + "\nNew milestone" }, issue.number, "2026-10-10T16:00:00.000Z", 2, first.manifestHash);
  expect(next.manifest.previousManifestHash).toBe(first.manifestHash);
  expect(next.manifestHash).not.toBe(first.manifestHash);
  const damaged = structuredClone(first.bundle); damaged.files[0].data = Buffer.from("altered body").toString("base64");
  await expect(verifySourceProposal(damaged, first.manifestHash)).rejects.toThrow();
  await expect(buildSourceProposal(issue, issue.number, capturedAt, 2, null)).rejects.toThrow();
});

it.each(["V1", "V2"])("captures the current Category heading on new %s imports", async version => {
  const bridge = { ...issue, title: "Grant Application - Zcash Private Receive Bridge", body: "### Category\n\nInfrastructure\n\n### Project Summary\nLocal block cache." };
  const checked = version === "V1" ? await buildSourceProposal(bridge, issue.number, capturedAt)
    : await buildSourceUpdate(bridge, issue.number, capturedAt, null, { events: [], comments: [] });
  expect(checked.capture.source.category).toBe("Infrastructure");
  expect(checked.capture.proposal.tags).toEqual(["infrastructure"]);
  expect(new TextDecoder().decode(decodeFile(checked.bundle.files[0]))).toBe(bridge.body);
});

it.each(["V1", "V2"])("recovers the display category from a frozen %s capture without modifying its files or recorded metadata", async version => {
  const bridge = { ...issue, title: "Grant Application - Zcash Private Receive Bridge", body: "### Category\r\n\r\nInfrastructure\r\n\r\n### Project Summary\r\nLocal block cache." };
  const generated = version === "V1" ? await buildSourceProposal(bridge, issue.number, capturedAt)
    : await buildSourceUpdate(bridge, issue.number, capturedAt, null, { events: [], comments: [] });
  // Reproduce the old importer: the Markdown was preserved, but it did not recognize Category.
  const legacy = structuredClone(generated.bundle);
  const sourceFile = legacy.files.find(file => file.path === "source.json")!;
  const capture = JSON.parse(new TextDecoder().decode(decodeFile(sourceFile)));
  capture.source.category = null;
  capture.proposal.tags = [];
  const sourceText = canonicalJson(capture);
  sourceFile.data = Buffer.from(sourceText).toString("base64");
  const manifest = JSON.parse(legacy.manifest);
  const sourceEntry = manifest.files.find((file: { path: string }) => file.path === "source.json");
  sourceEntry.bytes = utf8(sourceText).length;
  sourceEntry.sha256 = await sha256(utf8(sourceText));
  legacy.manifest = canonicalJson(manifest);
  const manifestHash = await sha256(utf8(legacy.manifest));
  const before = canonicalJson(legacy);
  const verified = await verifySourceProposal(legacy, manifestHash);
  const summary = sourceCaptureSummary(verified);
  expect(summary.sourceCategory).toBe("Infrastructure");
  expect(summary.sourceCapture.source.category).toBeNull();
  expect(summary.sourceCapture.proposal.tags).toEqual([]);
  expect(summary.sourceCapture.source.labels).toEqual(capture.source.labels);
  expect(canonicalJson(legacy)).toBe(before);
  expect(verified.manifestHash).toBe(manifestHash);
  expect((await verifySourceProposal(legacy, manifestHash)).capture).toEqual(capture);
});
