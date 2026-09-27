/** Read a small JSON body with an absolute deadline, including slow chunked uploads. */
export async function readBoundedJson(request: Request, maxBytes: number, timeoutMs = 5_000): Promise<unknown> {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") ?? "")) throw new Error("INVALID_REQUEST");
  if (Number(request.headers.get("content-length")) > maxBytes) throw new Error("BODY_TOO_LARGE");
  request.signal.throwIfAborted();
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  let failure: Error | undefined;
  const stop = (reason: string) => {
    failure ??= new Error(reason);
    void reader.cancel(failure).catch(() => {});
  };
  const abort = () => stop("REQUEST_ABORTED");
  const deadline = setTimeout(() => stop("BODY_READ_TIMEOUT"), timeoutMs);
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0, text = "";
  let complete = false;
  try {
    while (true) {
      if (failure) throw failure;
      const { value, done } = await reader.read();
      if (failure) throw failure;
      if (done) { complete = true; break; }
      size += value.byteLength;
      if (size > maxBytes) throw new Error("BODY_TOO_LARGE");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    clearTimeout(deadline);
    request.signal.removeEventListener("abort", abort);
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
