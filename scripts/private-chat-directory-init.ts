/** One-time operator initialization. Never run automatically during service startup. */
import { lstat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { DirectoryStorage } from "../src/lib/private-chat/directory-storage";
import { decodeKey } from "../src/lib/private-chat/keys";
import { isNymAddress } from "../src/lib/private-chat/nym-address";

async function main() {
  if (process.env.NODE_ENV !== "production") throw new Error("Production mode required");
  const directory = process.env.PRIVATE_CHAT_DIRECTORY_DATA || "";
  const address = process.env.PRIVATE_CHAT_DIRECTORY_ADDRESS || "";
  const storageKey = decodeKey(process.env.PRIVATE_CHAT_DIRECTORY_STORAGE_KEY || "");
  if (!isAbsolute(directory) || !isNymAddress(address) || !storageKey)
    throw new Error("Invalid initialization configuration");
  const storage = new DirectoryStorage(directory, storageKey);
  let unlock: (() => Promise<void>) | undefined;
  let secretKey: Uint8Array | undefined;
  try {
    await storage.prepare();
    unlock = await storage.inheritedLock(process.env.PRIVATE_CHAT_DIRECTORY_LOCK_FD);
    const existingIdentity = await storage.read("identity");
    const existingBinding = await storage.read("binding");
    if ((existingIdentity === null) !== (existingBinding === null))
      throw new Error("Incomplete directory state; restore the volume");
    if (existingIdentity === null) {
      if (await storage.read("presence") !== null) throw new Error("Incomplete directory state");
      try { await lstat(join(directory, "descriptor.json")); throw new Error("Incomplete directory state"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    const identity = await storage.identity();
    secretKey = identity.secretKey;
    await storage.bindDescriptor(address, identity.publicKey);
    process.stdout.write("Directory initialized. Read descriptor.json and pin its address and public key in the pilot service.\n");
  } finally {
    secretKey?.fill(0);
    storage.destroy();
    await unlock?.();
  }
}

main().catch(() => {
  // Avoid printing keys, room identifiers, native addresses or storage paths.
  process.stderr.write("Directory initialization failed. Check private configuration and storage.\n");
  process.exitCode = 1;
});
