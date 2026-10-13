import { z } from "zod/v3";

export const ARCHIVE_SCHEMA = "ZVOICE_ARCHIVE_V1";
export const MAX_PACKAGE_BYTES = 8 * 1024 * 1024;
export const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const archiveIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/);
export const archiveNetworkSchema = z.enum(["testnet", "mainnet"]);
export type ArchiveNetwork = z.infer<typeof archiveNetworkSchema>;
const pathSchema = z.string().max(200).regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-z0-9]+$/);
const fileSchema = z.object({ path: pathSchema, bytes: z.number().int().min(1).max(2 * 1024 * 1024), mediaType: z.enum(["text/markdown", "application/json", "application/pdf", "image/png", "image/jpeg"]), sha256: digestSchema }).strict();
const manifestBaseSchema = z.object({
  schema: z.literal(ARCHIVE_SCHEMA), recordId: archiveIdSchema, revision: z.number().int().min(1).max(10000),
  previousManifestHash: digestSchema.nullable(), title: z.string().min(1).max(300),
  capturedAt: z.string().datetime(), sources: z.array(z.string().url().startsWith("https://")).min(1).max(20),
  files: z.array(fileSchema).min(1).max(32)
}).strict();
export const REVIEW_ARCHIVE_SCOPE = "Public application metadata at capture time; committee decision pending. Original application and attachments are linked, not reproduced.";
export const NATIVE_ARCHIVE_SCOPE = "Complete author-submitted Markdown and application fields. Pilot publication, not an official committee submission or decision. External links are not archived.";
export const PUBLIC_NATIVE_ARCHIVE_SCOPE = "Complete author-submitted Markdown and application fields published on OpenZcash. Not an official committee submission or decision. External links are not archived.";
export const SOURCE_ARCHIVE_SCOPE = "Complete public application Markdown and source metadata at capture time. Linked files and external discussions are not archived. Review status is a dated source observation, not a pilot decision.";
export const archiveManifestSchema = z.discriminatedUnion("kind", [
  manifestBaseSchema.extend({
    kind: z.literal("HISTORICAL_SUMMARY"), originalDecisionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scope: z.literal("Editorial summary with published committee positions; original proposal and attachments are linked, not reproduced.")
  }),
  manifestBaseSchema.extend({
    kind: z.literal("REVIEW_SNAPSHOT"), originalDecisionDate: z.null(), submittedAt: z.string().datetime(),
    scope: z.literal(REVIEW_ARCHIVE_SCOPE)
  }),
  manifestBaseSchema.extend({
    kind: z.literal("NATIVE_PROPOSAL"), originalDecisionDate: z.null(), submittedAt: z.string().datetime(),
    sources: z.array(z.string().url().startsWith("https://")).max(20),
    scope: z.enum([NATIVE_ARCHIVE_SCOPE, PUBLIC_NATIVE_ARCHIVE_SCOPE])
  }),
  manifestBaseSchema.extend({
    kind: z.literal("SOURCE_PROPOSAL"), originalDecisionDate: z.null(), submittedAt: z.string().datetime(),
    scope: z.literal(SOURCE_ARCHIVE_SCOPE)
  })
]).superRefine((value, ctx) => {
  if (new Set(value.files.map(f => f.path)).size !== value.files.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate file path" });
  if ((value.revision === 1) !== (value.previousManifestHash === null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid revision link" });
});
export const archivePackageSchema = z.object({
  schema: z.literal(ARCHIVE_SCHEMA), manifest: z.string().min(1).max(32000),
  files: z.array(z.object({ path: pathSchema, encoding: z.literal("base64"), data: z.string().max(2_800_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/) }).strict()).min(1).max(32)
}).strict();
export type ArchiveManifest = z.infer<typeof archiveManifestSchema>;
export type ArchivePackage = z.infer<typeof archivePackageSchema>;

/** V1 canonical JSON: sorted UTF-16 keys, array order preserved, safe integers only, trailing LF. */
export function canonicalJson(value: unknown): string {
  function sort(input: unknown): unknown {
    if (input === null || typeof input === "string" || typeof input === "boolean") return input;
    if (typeof input === "number" && Number.isSafeInteger(input)) return input;
    if (Array.isArray(input)) return input.map(sort);
    if (input && Object.getPrototypeOf(input) === Object.prototype) return Object.fromEntries(Object.keys(input).sort().map(key => [key, sort((input as Record<string, unknown>)[key])]));
    throw new Error("Unsupported canonical value");
  }
  return JSON.stringify(sort(value)) + "\n";
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("");
}
export const utf8 = (value: string) => new TextEncoder().encode(value);
export function decodeFile(file: ArchivePackage["files"][number]): Uint8Array {
  const bytes = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
  if (bytes.length > 2 * 1024 * 1024) throw new Error("File too large");
  return bytes;
}

/** Expected hash comes from the selected published revision, never from the uploaded file. */
export async function verifyArchivePackage(input: unknown, expectedHash: string) {
  digestSchema.parse(expectedHash);
  const bundle = archivePackageSchema.parse(input);
  if (utf8(JSON.stringify(bundle)).length > MAX_PACKAGE_BYTES) throw new Error("Package too large");
  const manifest = archiveManifestSchema.parse(JSON.parse(bundle.manifest));
  if (canonicalJson(manifest) !== bundle.manifest) throw new Error("Non-canonical manifest");
  const manifestHash = await sha256(utf8(bundle.manifest));
  if (manifestHash !== expectedHash) throw new Error("Manifest does not match this published revision");
  if (bundle.files.length !== manifest.files.length || new Set(bundle.files.map(file => file.path)).size !== bundle.files.length) throw new Error("File inventory does not match");
  for (const entry of manifest.files) {
    const file = bundle.files.find(file => file.path === entry.path);
    if (!file) throw new Error("A committed file is missing");
    const bytes = decodeFile(file);
    if (bytes.length !== entry.bytes || await sha256(bytes) !== entry.sha256) throw new Error(`File does not match: ${entry.path}`);
  }
  return { bundle, manifest, manifestHash };
}

export function archiveMemo(manifest: Pick<ArchiveManifest, "recordId" | "revision">, manifestHash: string, network: ArchiveNetwork) {
  archiveIdSchema.parse(manifest.recordId); digestSchema.parse(manifestHash); archiveNetworkSchema.parse(network);
  if (!Number.isSafeInteger(manifest.revision) || manifest.revision < 1) throw new Error("Invalid revision");
  const memo = `ZVOICE|ARCHIVE|v1|${network}|${manifest.recordId}|r${manifest.revision}|sha256:${manifestHash}`;
  if (utf8(memo).length > 512) throw new Error("Memo too long");
  return memo;
}
