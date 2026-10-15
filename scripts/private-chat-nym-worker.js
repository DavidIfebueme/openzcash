// Same-origin worker for the Private Chat preview and explicitly enabled pilot.
// Do not log options, passphrases, addresses, or payloads.
// Address pattern must stay identical to src/lib/private-chat/nym-address.ts.
import init, { NymClient } from "./nym_client_wasm.js";

const ADDRESS =
  /^[1-9A-HJ-NP-Za-km-z]{20,200}(?:\.[1-9A-HJ-NP-Za-km-z]{20,200})?@[1-9A-HJ-NP-Za-km-z]{20,200}$/;
const MAX_PAYLOAD = 16457;

let wasmReady = null;
let client = null;
let generation = 0;

function ensureWasm() {
  if (!wasmReady) wasmReady = init();
  return wasmReady;
}

function copyBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (value && typeof value === "object" && "payload" in value)
    return copyBytes(value.payload);
  return null;
}

function failReason(error) {
  const text = `${error && error.name ? error.name : ""} ${
    error && error.message ? error.message : ""
  }`.toLowerCase();
  if (text.includes("content security") || text.includes("csp")) return "csp";
  if (text.includes("wasm") || text.includes("compile")) return "wasm";
  if (
    text.includes("network") ||
    text.includes("gateway") ||
    text.includes("websocket") ||
    text.includes("fetch")
  )
    return "network";
  return "connect-failed";
}

function post(message) {
  self.postMessage(message);
}

self.onmessage = async (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "disconnect") {
    generation += 1;
    const current = client;
    client = null;
    try {
      current?.free();
    } catch {
      // Already freed.
    }
    self.close();
    return;
  }

  if (data.type === "connect") {
    const ticket = data.generation;
    generation = ticket;
    if (
      typeof data.clientId !== "string" ||
      typeof data.storagePassphrase !== "string"
    ) {
      post({ type: "failed", generation: ticket, reason: "connect-failed" });
      return;
    }
    try {
      await ensureWasm();
      if (ticket !== generation) return;
      const created = await new NymClient(
        (message) => {
          if (ticket !== generation) return;
          const bytes = copyBytes(message);
          if (!bytes || bytes.length < 1 || bytes.length > MAX_PAYLOAD) return;
          post({ type: "bytes", generation: ticket, payload: bytes });
        },
        {
          clientId: data.clientId,
          nymApiUrl: "https://validator.nymtech.net/api",
          storagePassphrase: data.storagePassphrase,
          forceTls: true,
          ...(typeof data.preferredGateway === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(data.preferredGateway)
            ? { preferredGateway: data.preferredGateway } : {}),
          clientOverride: { statsReporting: { enabled: false } },
        },
      );
      if (ticket !== generation) {
        try {
          created?.free();
        } catch {
          // The worker is already shutting down.
        }
        return;
      }
      const address =
        created && typeof created.selfAddress === "function"
          ? created.selfAddress()
          : "";
      if (typeof address !== "string" || !ADDRESS.test(address)) {
        try {
          created?.free();
        } catch {
          // Ignore a failed cleanup.
        }
        post({ type: "failed", generation: ticket, reason: "no-address" });
        return;
      }
      client = created;
      post({ type: "connected", generation: ticket, address });
    } catch (error) {
      if (ticket === generation)
        post({ type: "failed", generation: ticket, reason: failReason(error) });
    }
    return;
  }

  if (data.type === "send") {
    const ticket = data.generation;
    if (ticket !== generation || !client) {
      post({
        type: "submit-failed",
        generation: ticket,
        id: data.id,
        reason: "not-connected",
      });
      return;
    }
    try {
      const bytes = copyBytes(data.bytes);
      if (
        !bytes ||
        bytes.length > MAX_PAYLOAD ||
        typeof data.recipient !== "string" ||
        !ADDRESS.test(data.recipient)
      )
        throw new Error("payload");
      if (data.anonymous === true) {
        await client.send_anonymous_message(bytes, data.recipient, 20);
      } else {
        await client.send_regular_message(bytes, data.recipient);
      }
      if (ticket !== generation) return;
      post({ type: "submitted", generation: ticket, id: data.id });
    } catch {
      if (ticket === generation) {
        post({
          type: "submit-failed",
          generation: ticket,
          id: data.id,
          reason: "submit-failed",
        });
      }
    }
  }
};
