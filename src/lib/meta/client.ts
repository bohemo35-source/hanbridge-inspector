// @agent:   muse-code
// @project: hanbridge-inspector
// @purpose: Single Meta API client: Bearer auth, timeout, 1 retry, duration log without body/key
// @created: 2026-10-27

export class MetaApiError extends Error {
  code: string;
  status?: number;
  constructor(code: string, message?: string, status?: number) {
    super(message ?? code);
    this.name = "MetaApiError";
    this.code = code;
    this.status = status;
  }
}

const BASE = "https://api.meta.ai/v1";

type MetaFetchInit = RequestInit & { timeoutMs?: number; retries?: number; model?: string };

async function once(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const key = process.env.META_API_KEY;
  if (!key) throw new MetaApiError("missing_api_key", "META_API_KEY is not set");
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

export async function metaFetch(path: string, init: MetaFetchInit = {}): Promise<Response> {
  const { timeoutMs = 30000, retries = 1, model, ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const res = await once(path, rest, timeoutMs);
      console.log(JSON.stringify({ model: model ?? null, path, ms: Date.now() - start, status: res.status }));
      if (res.status >= 500 && attempt < retries) continue;
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new MetaApiError("http_error", `Meta API ${res.status}: ${text.slice(0, 300)}`, res.status);
      }
      return res;
    } catch (e) {
      if (e instanceof MetaApiError) throw e;
      lastErr = e;
      console.log(JSON.stringify({ model: model ?? null, path, ms: Date.now() - start, status: 0 }));
      if (attempt >= retries) break;
    }
  }
  throw new MetaApiError("network_error", lastErr instanceof Error ? lastErr.message : "network error");
}
