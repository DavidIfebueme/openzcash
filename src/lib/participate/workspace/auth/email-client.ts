const messages: Record<string, string> = {
  EMAIL_NOT_CONFIGURED: "Email sign-in is not available yet. You can still browse proposals.",
  EMAIL_DELIVERY_FAILED: "We couldn’t send your code. Wait a minute and try again.",
  EMAIL_RATE_LIMITED: "Please wait before requesting another code. You can still use your latest code.",
  EMAIL_CODE_INVALID: "That code is invalid or expired. Check it or request a new one.",
  EMAIL_INPUT_INVALID: "Enter a valid email address or a six-digit code.",
  EMAIL_ACCOUNT_REQUIRED: "Sign in with your verified email to manage passkeys. Demo profiles cannot add credentials.",
  EMAIL_ACCOUNT_UNAVAILABLE: "This account is unavailable. Contact the site administrator.",
  EMAIL_UNAVAILABLE: "Sign-in is temporarily unavailable. Please try again.",
  COMMITTEE_ADMIN_REQUIRED: "Committee previews require authorized admin access.",
  DEMO_UNAVAILABLE: "The demo profile is unavailable. Please try again later.",
  DEMO_SIGN_OUT_REQUIRED: "Sign out of your personal account before exploring a demo profile.",
  PASSWORD_SIGN_IN_RETIRED: "Sign in with a code sent to your email.",
  forbidden_origin: "Reload the original site and try again."
};
export function emailErrorMessage(error: unknown) {
  return error instanceof Error && messages[error.message] ? messages[error.message] : "Check your connection and try again.";
}
export class EmailRequestError extends Error {
  constructor(message: string, public readonly retryAfter = 0) { super(message); this.name = "EmailRequestError"; }
}
export function emailRetryAfter(error: unknown): number {
  return error instanceof EmailRequestError ? error.retryAfter : 0;
}
export async function emailFetch<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const seconds = Number(data?.retryAfter ?? response.headers?.get("Retry-After"));
    throw new EmailRequestError(data?.error ?? "EMAIL_UNAVAILABLE", Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0);
  }
  return data as T;
}
