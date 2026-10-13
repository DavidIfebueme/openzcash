import { afterEach, expect, it, vi } from "vitest";
import { emailFetch, emailRetryAfter } from "./email-client";

afterEach(() => vi.unstubAllGlobals());
it.each([17, 17.4])("preserves a server resend cooldown of %s seconds", async retryAfter => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "EMAIL_RATE_LIMITED", retryAfter }) }));
  const error = await emailFetch("/api/account/email-code", { action: "add", label: "Phone" }).catch(cause => cause);
  expect(error instanceof Error ? error.message : "").toBe("EMAIL_RATE_LIMITED");
  expect(emailRetryAfter(error)).toBe(Math.ceil(retryAfter));
});
it("uses the Retry-After header when the body omits timing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, headers: new Headers({ "Retry-After": "29" }), json: async () => ({ error: "EMAIL_RATE_LIMITED" }) }));
  const error = await emailFetch("/api/account/email-code", {}).catch(cause => cause);
  expect(emailRetryAfter(error)).toBe(29);
});
it.each([-1, "invalid", null])("does not invent a negative or invalid cooldown from %s", async retryAfter => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "EMAIL_RATE_LIMITED", retryAfter }) }));
  const error = await emailFetch("/api/account/email-code", {}).catch(cause => cause);
  expect(emailRetryAfter(error)).toBe(0);
});
