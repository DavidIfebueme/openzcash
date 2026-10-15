/** Development-only Nym directory. Real mixnet; ephemeral IndexedDB adapter.
 * No HTTP server, no user addresses, no request/payload logging. See docs.
 */
import "fake-indexeddb/auto";
import { readFile, writeFile, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import init, { NymClient } from "@nymproject/nym-client-wasm";
import { DirectoryProvider } from "../src/lib/private-chat/directory-provider";
import {
  createDeviceIdentity,
  wipeIdentity,
} from "../src/lib/private-chat/identity";

if (process.env.NODE_ENV === "production")
  throw new Error("Use a reviewed production directory deployment");
// WASM expects the web global and IndexedDB. Storage here is process memory only.
Object.defineProperty(globalThis, "self", {
  value: globalThis,
  configurable: true,
});
// Nym's development logs contain routing metadata; do not persist or print it.
for (const level of ["log", "info", "debug", "warn", "error"] as const)
  console[level] = () => {};
const identity = await createDeviceIdentity();
const provider = new DirectoryProvider(identity);
const descriptor = join(process.cwd(), "tmp/private-chat-directory.json");
let client: NymClient | null = null;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await rm(descriptor, { force: true });
  wipeIdentity(identity);
  try {
    client?.free();
  } catch {
    /* Runtime is shutting down. */
  }
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
try {
  await init({
    module_or_path: await readFile(
      new URL(
        "../node_modules/@nymproject/nym-client-wasm/nym_client_wasm_bg.wasm",
        import.meta.url,
      ),
    ),
  });
  client = await new NymClient(
    (message: Uint8Array) => {
      if (stopping || !(message instanceof Uint8Array)) return;
      void provider
        .handle(new Uint8Array(message))
        .then(async (reply) => {
          if (reply && typeof reply.recipient === "string" && !stopping)
            await client?.send_regular_message(reply.bytes, reply.recipient);
        })
        .catch(() => {
          /* Fail closed; requester times out over Nym. */
        });
    },
    {
      clientId: `oz-directory-${crypto.randomUUID()}`,
      storagePassphrase: crypto.randomUUID(),
      nymApiUrl: "https://validator.nymtech.net/api",
      forceTls: true,
      clientOverride: { statsReporting: { enabled: false } },
    },
  );
  await mkdir(join(process.cwd(), "tmp"), { recursive: true });
  await writeFile(
    `${descriptor}.new`,
    JSON.stringify({
      address: client.selfAddress(),
      publicKey: identity.publicKey,
      replyMode: "address",
    }),
    { mode: 0o600 },
  );
  await rename(`${descriptor}.new`, descriptor);
  process.stdout.write(
    "Discover provider connected through Nym. Public descriptor ready.\n",
  );
} catch {
  await rm(descriptor, { force: true });
  wipeIdentity(identity);
  process.stderr.write(
    "Nym directory startup failed. Discover remains closed.\n",
  );
  process.exit(1);
}
