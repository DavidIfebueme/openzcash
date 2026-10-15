import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONNECT_TIMEOUT_MS,
  NYM_WORKER_URL,
  SEND_TIMEOUT_MS,
  createNymTransport,
  type TransportEvent,
} from "./transport";

const ADDRESS =
  "DguTcdkWWtDyUFLvQxRdcA8qZhardhE1ZXy1YCC7Zfmq.Dxreouj5RhQqMb3ZaAxgXFdGkmfbDKwk457FdeHGKmQQ@4kjgWmFU1tcGAZYRZR57yFuVAexjLbJ5M7jvo3X5Hkcf";

class FakeWorker {
  static latest: FakeWorker | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: unknown[] = [];
  terminated = false;
  constructor(
    readonly url: string,
    readonly options?: { type?: string },
  ) {
    FakeWorker.latest = this;
  }
  postMessage(data: unknown) {
    this.sent.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  emit(data: unknown) {
    this.onmessage?.({ data });
  }
}

function connectMessage(worker: FakeWorker) {
  return worker.sent.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      (item as { type?: string }).type === "connect",
  ) as { generation: number; storagePassphrase: string };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.latest = null;
});

describe("Nym transport", () => {
  it("connects only with a valid address and ignores a retired worker", () => {
    vi.stubGlobal("Worker", FakeWorker);
    const events: TransportEvent[] = [];
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const transport = createNymTransport((event) => events.push(event));
    transport.connect({
      clientId: "client-id",
      storagePassphrase: "phrase-not-logged",
    });
    const worker = FakeWorker.latest!;
    expect(worker.url).toBe(NYM_WORKER_URL);
    expect(worker.options).toEqual({ type: "module" });
    const handshake = connectMessage(worker);
    expect(handshake.storagePassphrase).toBe("phrase-not-logged");
    expect(log).not.toHaveBeenCalled();
    worker.emit({
      type: "connected",
      generation: handshake.generation,
      address: "not-an-address",
    });
    expect(events.at(-1)).toEqual({
      type: "status",
      status: "failed",
      reason: "no-address",
    });
    expect(worker.terminated).toBe(true);

    transport.connect({
      clientId: "client-id",
      storagePassphrase: "phrase-not-logged",
    });
    const next = FakeWorker.latest!;
    const generation = connectMessage(next).generation;
    next.emit({ type: "connected", generation, address: ADDRESS });
    expect(events.at(-1)).toMatchObject({
      type: "status",
      status: "connected",
      address: ADDRESS,
    });
    transport.disconnect();
    next.emit({ type: "connected", generation, address: ADDRESS });
    expect(
      events.filter(
        (event) => event.type === "status" && event.status === "connected",
      ),
    ).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "status", status: "disconnected" });
    log.mockRestore();
  });

  it("times out without pretending the connection succeeded", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const events: TransportEvent[] = [];
    const transport = createNymTransport((event) => events.push(event));
    transport.connect({
      clientId: "client-id",
      storagePassphrase: "phrase-not-logged",
    });
    const worker = FakeWorker.latest!;
    vi.advanceTimersByTime(CONNECT_TIMEOUT_MS);
    expect(events.at(-1)).toEqual({
      type: "status",
      status: "failed",
      reason: "timeout",
    });
    expect(worker.terminated).toBe(true);
    worker.emit({
      type: "connected",
      generation: connectMessage(worker).generation,
      address: ADDRESS,
    });
    expect(
      events.some(
        (event) => event.type === "status" && event.status === "connected",
      ),
    ).toBe(false);
  });

  it("reports submission failure without treating it as delivery", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const events: TransportEvent[] = [];
    const transport = createNymTransport((event) => events.push(event));
    transport.send({
      id: "early",
      recipient: ADDRESS,
      bytes: new Uint8Array([1]),
    });
    expect(events.at(-1)).toEqual({
      type: "submit-failed",
      id: "early",
      reason: "not-connected",
    });
    transport.connect({
      clientId: "client-id",
      storagePassphrase: "phrase-not-logged",
    });
    const worker = FakeWorker.latest!;
    const generation = connectMessage(worker).generation;
    worker.emit({ type: "connected", generation, address: ADDRESS });
    transport.send({
      id: "m1",
      recipient: ADDRESS,
      bytes: new Uint8Array([9]),
    });
    worker.emit({
      type: "submit-failed",
      generation,
      id: "m1",
      reason: "super-secret-passphrase",
    });
    expect(events.at(-1)).toEqual({
      type: "submit-failed",
      id: "m1",
      reason: "submit-failed",
    });
    expect(events.some((event) => event.type === "bytes")).toBe(false);
    transport.send({
      id: "m2",
      recipient: ADDRESS,
      bytes: new Uint8Array([2]),
    });
    vi.advanceTimersByTime(SEND_TIMEOUT_MS);
    expect(events.at(-1)).toEqual({
      type: "submit-failed",
      id: "m2",
      reason: "timeout",
    });
    expect(
      events.some(
        (event) => event.type === "status" && event.status === "failed",
      ),
    ).toBe(false);
  });
});
