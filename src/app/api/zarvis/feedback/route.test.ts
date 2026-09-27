import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { feedbackTicket, metricsSnapshot, resetMetricsForTests } from "@/lib/zarvis/metrics";
import { POST } from "./route";
const request = (body: unknown, origin = "https://openzcash.org") => new Request("https://openzcash.org/api/zarvis/feedback", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => resetMetricsForTests());
describe("Anonymous answer feedback", () => {
  it("accepts one vote with no conversation text", async () => {
    const ticket = feedbackTicket(); expect((await POST(request({ ticket, helpful: true }))).status).toBe(204);
    expect((await POST(request({ ticket, helpful: false }))).status).toBe(409); expect(metricsSnapshot().helpful).toBe(1);
  });
  it("rejects forged, foreign-origin and oversized votes", async () => {
    expect((await POST(request({ ticket: "forged", helpful: true }))).status).toBe(409);
    expect((await POST(request({ ticket: feedbackTicket(), helpful: true }, "https://elsewhere.example"))).status).toBe(403);
    expect((await POST(request({ ticket: "x".repeat(1500), helpful: true }))).status).toBe(400);
    expect((await POST(request({ ticket: feedbackTicket(), helpful: true, message: "Private text" }))).status).toBe(400);
  });
});
