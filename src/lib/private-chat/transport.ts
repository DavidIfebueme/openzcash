import { isNymAddress } from "./nym-address";

export const CONNECT_TIMEOUT_MS = 45_000;
export const SEND_TIMEOUT_MS = 20_000;
export const NYM_WORKER_URL = "/private-chat-nym/worker.js";

const FAILURE_REASONS = new Set([
  "csp",
  "wasm",
  "network",
  "gateway-unavailable",
  "no-address",
  "connect-failed",
  "worker-error",
  "not-connected",
  "submit-failed",
  "timeout",
]);

function knownReason(value: unknown, fallback: string) {
  return typeof value === "string" && FAILURE_REASONS.has(value)
    ? value
    : fallback;
}

export type TransportStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "failed";

export type TransportEvent =
  | {
      type: "status";
      status: TransportStatus;
      address?: string;
      reason?: string;
    }
  | { type: "bytes"; bytes: Uint8Array }
  | { type: "submitted"; id: string }
  | { type: "submit-failed"; id: string; reason: string };

export type NymTransport = {
  connect(input: { clientId: string; storagePassphrase: string }): void;
  send(input: { id: string; recipient: string; bytes: Uint8Array; anonymous?: boolean }): void;
  disconnect(): void;
};

type WorkerLike = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

/**
 * One worker per connection. A resolved send is submission, not delivery.
 * Events from a retired worker are ignored.
 */
export function createNymTransport(
  listener: (event: TransportEvent) => void,
  workerUrl = NYM_WORKER_URL,
): NymTransport {
  let generation = 0;
  let worker: WorkerLike | null = null;
  let status: TransportStatus = "disconnected";
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  const sendTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearConnectTimer() {
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  }

  function clearSendTimers() {
    for (const timer of sendTimers.values()) clearTimeout(timer);
    sendTimers.clear();
  }

  function retireWorker() {
    generation += 1;
    clearConnectTimer();
    clearSendTimers();
    const current = worker;
    worker = null;
    if (!current) return;
    try {
      current.postMessage({ type: "disconnect" });
    } catch {
      // The worker may already be gone.
    }
    current.terminate();
  }

  function fail(reason: string) {
    retireWorker();
    status = "failed";
    listener({ type: "status", status: "failed", reason });
  }

  return {
    connect(input) {
      retireWorker();
      const ticket = generation;
      let created: WorkerLike;
      try {
        created = new Worker(workerUrl, { type: "module" }) as WorkerLike;
      } catch {
        fail("worker-error");
        return;
      }
      worker = created;
      status = "connecting";
      created.onmessage = (event) => {
        if (ticket !== generation) return;
        const data = event.data;
        if (!data || typeof data !== "object") return;
        const message = data as Record<string, unknown>;
        if (message.generation !== ticket) return;
        if (
          message.type === "connected" &&
          typeof message.address === "string"
        ) {
          if (!isNymAddress(message.address)) {
            fail("no-address");
            return;
          }
          clearConnectTimer();
          status = "connected";
          listener({
            type: "status",
            status: "connected",
            address: message.address,
          });
          return;
        }
        if (message.type === "failed") {
          fail(knownReason(message.reason, "connect-failed"));
          return;
        }
        if (message.type === "bytes" && message.payload instanceof Uint8Array) {
          listener({ type: "bytes", bytes: new Uint8Array(message.payload) });
          return;
        }
        if (message.type === "submitted" && typeof message.id === "string") {
          const timer = sendTimers.get(message.id);
          if (timer) clearTimeout(timer);
          sendTimers.delete(message.id);
          listener({ type: "submitted", id: message.id });
          return;
        }
        if (
          message.type === "submit-failed" &&
          typeof message.id === "string"
        ) {
          const timer = sendTimers.get(message.id);
          if (timer) clearTimeout(timer);
          sendTimers.delete(message.id);
          listener({
            type: "submit-failed",
            id: message.id,
            reason: knownReason(message.reason, "submit-failed"),
          });
        }
      };
      created.onerror = () => {
        if (ticket === generation) fail("worker-error");
      };
      try {
        created.postMessage({
          type: "connect",
          generation: ticket,
          clientId: input.clientId,
          storagePassphrase: input.storagePassphrase,
          preferredGateway: process.env.NEXT_PUBLIC_PRIVATE_CHAT_GATEWAY_ID || undefined,
        });
      } catch {
        fail("worker-error");
        return;
      }
      listener({ type: "status", status: "connecting" });
      connectTimer = setTimeout(() => {
        if (ticket === generation) fail("timeout");
      }, CONNECT_TIMEOUT_MS);
    },
    send(input) {
      const ticket = generation;
      if (status !== "connected" || !worker) {
        listener({
          type: "submit-failed",
          id: input.id,
          reason: "not-connected",
        });
        return;
      }
      try {
        worker.postMessage({
          type: "send",
          generation: ticket,
          id: input.id,
          recipient: input.recipient,
          bytes: input.bytes,
          anonymous: input.anonymous === true,
        });
      } catch {
        listener({
          type: "submit-failed",
          id: input.id,
          reason: "worker-error",
        });
        return;
      }
      sendTimers.set(
        input.id,
        setTimeout(() => {
          if (ticket !== generation) return;
          sendTimers.delete(input.id);
          listener({ type: "submit-failed", id: input.id, reason: "timeout" });
        }, SEND_TIMEOUT_MS),
      );
    },
    disconnect() {
      if (status === "disconnected" && !worker) return;
      retireWorker();
      status = "disconnected";
      listener({ type: "status", status: "disconnected" });
    },
  };
}
