import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("Nym worker connection failures", () => {
  it("reports a rejected pinned gateway without disclosing its identity or the error", async () => {
    const postMessage = vi.fn();
    const worker: { onmessage?: (event: { data: unknown }) => Promise<void>; postMessage: typeof postMessage } = { postMessage };
    const source = readFileSync(new URL("../../../scripts/private-chat-nym-worker.js", import.meta.url), "utf8")
      .replace('import init, { NymClient } from "./nym_client_wasm.js";', "");
    runInNewContext(source, {
      self: worker,
      init: async () => undefined,
      NymClient: class { constructor() { throw new Error("experienced an issue with internal client components: no gateway with id: synthetic-private-id"); } },
    });
    await worker.onmessage!({ data: { type: "connect", generation: 1, clientId: "synthetic-session", storagePassphrase: "do-not-log" } });
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: "failed", generation: 1, reason: "gateway-unavailable" });
  });
});
