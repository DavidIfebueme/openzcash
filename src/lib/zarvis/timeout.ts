import "server-only";
/** Stop waiting on public readers when the request is cancelled or a source stalls. */
export async function boundedRead<T>(read: () => Promise<T>, signal: AbortSignal, ms = 12_000): Promise<T> {
  signal.throwIfAborted();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("PUBLIC_READ_TIMEOUT")), ms);
      abort = () => reject(new Error("REQUEST_ABORTED"));
      signal.addEventListener("abort", abort, { once: true });
    })]);
  } finally {
    clearTimeout(timeout);
    if (abort) signal.removeEventListener("abort", abort);
  }
}
