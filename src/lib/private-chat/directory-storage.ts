/** Node-only storage for the directory service, never imported by the browser. */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { constants as fsConstants, fstatSync, closeSync } from "node:fs";
import { mkdir, lstat, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { sodiumReady } from "./identity";
import { decodeKey, encodeKey } from "./keys";
import { PresenceStore, type PresenceStoreOptions } from "./presence-store";

const AAD = Buffer.from("OpenZcash directory storage v1");
const MAX_FILE = 1_500_000;
export class DirectoryStorage {
  constructor(readonly directory: string, private key: Uint8Array) {
    if (key.length !== 32) throw new Error("Invalid storage key");
  }
  async prepare() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
        (process.getuid && stat.uid !== process.getuid()))
      throw new Error("Directory data permissions must be 0700 and owner-only");
  }
  async inheritedLock(value: string | undefined): Promise<() => Promise<void>> {
    if (!value || !/^[0-9]+$/.test(value) || Number(value) < 3)
      throw new Error("Use the directory lock launcher");
    const fd = Number(value), info = fstatSync(fd);
    const path = await lstat(join(this.directory, "runtime.lock"));
    if (!info.isFile() || path.isSymbolicLink() || info.ino !== path.ino ||
        info.dev !== path.dev || (info.mode & 0o077))
      throw new Error("Invalid inherited directory lock");
    return async () => { closeSync(fd); };
  }
  async read(name: "identity" | "presence" | "binding"): Promise<unknown | null> {
    let file;
    try { file = await open(join(this.directory, name + ".sealed"), fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    let plain: Buffer | undefined;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > MAX_FILE || stat.size < 30 ||
          (stat.mode & 0o077) || (process.getuid && stat.uid !== process.getuid()))
        throw new Error("Invalid stored file");
      const data = await file.readFile();
      if (data[0] !== 1) throw new Error("Unsupported storage version");
      const decrypt = createDecipheriv("aes-256-gcm", this.key, data.subarray(1, 13));
      decrypt.setAAD(Buffer.concat([AAD, Buffer.from(name)]));
      decrypt.setAuthTag(data.subarray(13, 29));
      plain = Buffer.concat([decrypt.update(data.subarray(29)), decrypt.final()]);
      return JSON.parse(plain.toString("utf8"));
    } finally { plain?.fill(0); await file.close(); }
  }
  async write(name: "identity" | "presence" | "binding", value: unknown): Promise<void> {
    const plain = Buffer.from(JSON.stringify(value));
    const temp = join(this.directory, name + "." + randomBytes(8).toString("hex") + ".tmp");
    try {
      if (plain.length > MAX_FILE - 29) throw new Error("Snapshot exceeds storage limit");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.key, iv);
      cipher.setAAD(Buffer.concat([AAD, Buffer.from(name)]));
      const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
      const file = await open(temp, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
      try {
        await file.writeFile(Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]));
        await file.sync();
      } finally { await file.close(); }
      await rename(temp, join(this.directory, name + ".sealed"));
      const directory = await open(this.directory, fsConstants.O_RDONLY);
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { plain.fill(0); await rm(temp, { force: true }); }
  }
  async identity(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
    const stored = await this.read("identity");
    const sodium = await sodiumReady();
    if (stored !== null) {
      const value = stored as { publicKey?: string; secretKey?: string };
      const secret = typeof value.secretKey === "string" ? decodeKey(value.secretKey) : null;
      if (!secret || typeof value.publicKey !== "string" ||
          encodeKey(sodium.crypto_scalarmult_base(secret)) !== value.publicKey) {
        secret?.fill(0); throw new Error("Invalid directory identity");
      }
      return { publicKey: value.publicKey, secretKey: secret };
    }
    const pair = sodium.crypto_box_keypair();
    const identity = { publicKey: encodeKey(pair.publicKey), secretKey: new Uint8Array(pair.privateKey) };
    try { await this.write("identity", { publicKey: identity.publicKey, secretKey: encodeKey(identity.secretKey) }); }
    catch (error) { identity.secretKey.fill(0); throw error; }
    finally { sodium.memzero(pair.privateKey); }
    return identity;
  }
  /** The native Nym address and application key must survive as one public descriptor.
   * A lost or replaced native identity must never silently publish a new address.
   */
  async bindDescriptor(address: string, publicKey: string): Promise<void> {
    const value = { address, publicKey, replyMode: "surb" };
    const bound = await this.read("binding");
    if (bound !== null) {
      if (!sameDescriptor(bound, value)) throw new Error("Directory identity changed");
    } else {
      // Persist the encrypted binding first. A crash before publishing the public
      // descriptor can then be resumed only with the same native identity.
      const existing = await this.readDescriptor();
      if (existing !== null && !sameDescriptor(existing, value))
        throw new Error("Directory identity changed");
      await this.write("binding", value);
    }
    const existing = await this.readDescriptor();
    if (existing !== null) {
      if (!sameDescriptor(existing, value)) throw new Error("Directory descriptor changed");
      return;
    }
    const temp = join(this.directory, "descriptor." + randomBytes(8).toString("hex") + ".tmp");
    try {
      const file = await open(temp, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
      try { await file.writeFile(JSON.stringify(value)); await file.sync(); }
      finally { await file.close(); }
      await rename(temp, join(this.directory, "descriptor.json"));
      const directory = await open(this.directory, fsConstants.O_RDONLY);
      try { await directory.sync(); } finally { await directory.close(); }
    } finally { await rm(temp, { force: true }); }
  }
  private async readDescriptor(): Promise<unknown | null> {
    let file;
    try { file = await open(join(this.directory, "descriptor.json"), fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size < 2 || stat.size > 1024 || (stat.mode & 0o077) ||
          (process.getuid && stat.uid !== process.getuid())) throw new Error("Invalid directory descriptor");
      return JSON.parse(await file.readFile({ encoding: "utf8" }));
    } finally { await file.close(); }
  }
  destroy() { this.key.fill(0); }
}

function sameDescriptor(value: unknown, expected: { address: string; publicKey: string; replyMode: string }): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return Object.keys(candidate).length === 3 && candidate.address === expected.address &&
    candidate.publicKey === expected.publicKey && candidate.replyMode === expected.replyMode;
}

/** An acknowledgment is released only after the corresponding state is durable.
 * Failed persistence poisons the instance: it cannot later acknowledge volatile state.
 */
export class PersistentPresenceStore extends PresenceStore {
  private pending: Promise<void> = Promise.resolve();
  private failed = false;
  constructor(private storage: DirectoryStorage, options: PresenceStoreOptions) { super(options); }
  async initialize() {
    const snapshot = await this.storage.read("presence");
    if (snapshot !== null) await this.restore(snapshot);
  }
  override async apply(value: unknown, now = Date.now()): Promise<number> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.pending;
    this.pending = previous.then(() => next);
    await previous;
    try {
      if (this.failed) throw new Error("Directory storage unavailable");
      const status = await super.apply(value, now);
      if (status === 200) {
        try { await this.storage.write("presence", this.snapshot(now)); }
        catch (error) { this.failed = true; throw error; }
      }
      return status;
    } finally { release(); }
  }
  async flush(now = Date.now()) {
    let release!: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    const previous = this.pending;
    this.pending = previous.then(() => next);
    await previous;
    try {
      if (this.failed) throw new Error("Directory storage unavailable");
      await this.storage.write("presence", this.snapshot(now));
    } catch (error) { this.failed = true; throw error; }
    finally { release(); }
  }
}
