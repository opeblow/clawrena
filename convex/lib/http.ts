const DEFAULT_TIMEOUT_MS = 8_000;

export async function getJson<T>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json", ...extraHeaders },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}