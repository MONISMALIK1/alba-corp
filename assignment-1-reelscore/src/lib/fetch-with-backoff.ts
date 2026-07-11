export class UpstreamError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

interface BackoffOptions {
  retries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps fetch with exponential backoff + jitter on 429/5xx and network
 * errors. Respects Retry-After when the upstream sends one. Every TMDB and
 * Deezer call in this app goes through this — it's the retry/backoff half of
 * the BFF requirement, not just a defensive utility.
 */
export async function fetchWithBackoff(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } },
  options: BackoffOptions = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 300 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) {
          throw new UpstreamError(`Upstream returned ${res.status}`, res.status);
        }
        const retryAfter = res.headers.get("retry-after");
        const delay = retryAfter
          ? Number(retryAfter) * 1000
          : baseDelayMs * 2 ** attempt + Math.random() * 100;
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 100;
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetchWithBackoff failed");
}
