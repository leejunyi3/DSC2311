/**
 * Hardened fetch wrapper (§6, §28): timeout via AbortController, limited retries
 * with exponential backoff, and rate-limit awareness. Raw provider errors are
 * never surfaced to callers verbatim — they might contain credentials — so we
 * throw a sanitised {@link SafeFetchError} instead.
 */

export interface SafeFetchOptions {
  timeoutMs?: number;
  retries?: number;
  backoffBaseMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class SafeFetchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const DEFAULTS = {
  timeoutMs: 8000,
  retries: 2,
  backoffBaseMs: 400,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL and parse JSON, with retries. Only http/https absolute URLs are
 * permitted — this closes off unrestricted server-side URL fetching (§6).
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<T> {
  assertAllowedUrl(url);
  const cfg = { ...DEFAULTS, ...options };

  let lastError: SafeFetchError | null = null;

  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    // If the caller aborts, abort our controller too.
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const res = await fetch(url, {
        headers: options.headers,
        signal: controller.signal,
      });

      if (res.status === 429) {
        lastError = new SafeFetchError(
          "RATE_LIMITED",
          "Upstream rate limit reached.",
          429,
        );
      } else if (res.status >= 500) {
        lastError = new SafeFetchError(
          "UPSTREAM_ERROR",
          `Upstream returned ${res.status}.`,
          res.status,
        );
      } else if (!res.ok) {
        // 4xx (other than 429) will not succeed on retry.
        throw new SafeFetchError(
          "REQUEST_FAILED",
          `Request failed with status ${res.status}.`,
          res.status,
        );
      } else {
        return (await res.json()) as T;
      }
    } catch (err) {
      if (err instanceof SafeFetchError && err.code === "REQUEST_FAILED") {
        throw err; // do not retry non-retryable client errors
      }
      lastError =
        err instanceof DOMException && err.name === "AbortError"
          ? new SafeFetchError("TIMEOUT", "Request timed out.")
          : new SafeFetchError("NETWORK_ERROR", "Network request failed.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    }

    if (attempt < cfg.retries) {
      await sleep(cfg.backoffBaseMs * 2 ** attempt);
    }
  }

  throw lastError ?? new SafeFetchError("UNKNOWN", "Request failed.");
}

function assertAllowedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SafeFetchError("BAD_URL", "Malformed request URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new SafeFetchError("BAD_URL", "Only http/https URLs are permitted.");
  }
}
