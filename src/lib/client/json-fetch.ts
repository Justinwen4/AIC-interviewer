/** Browser fetch with credentials + consistent JSON error handling for API routes. */
export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 200) || `Request failed (${res.status})`,
    };
  }
  const obj = parsed as { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: obj.error ?? `Request failed (${res.status})`,
    };
  }
  return { ok: true, data: parsed as T };
}
