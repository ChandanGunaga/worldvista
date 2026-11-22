export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

/** Browser-side API call (same-origin via Next rewrite, cookie included). */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    ...rest,
    credentials: "include",
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    let msg = data?.error ?? `Request failed (${res.status})`;
    const fieldErrors = data?.details?.fieldErrors as Record<string, string[]> | undefined;
    if (fieldErrors) {
      const first = Object.entries(fieldErrors).find(([, v]) => v?.length);
      if (first) msg = `${first[0]}: ${first[1][0]}`;
    }
    throw new ApiError(res.status, msg, data ?? undefined);
  }
  return data as T;
}

/** Server-side fetch for public pages. */
export async function serverApi<T = unknown>(path: string, revalidate = 60): Promise<T | null> {
  const base = process.env.API_URL || "http://localhost:4000";
  try {
    const res = await fetch(`${base}/api${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const money = (v: number | string, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Number(v) % 1 ? 2 : 0 }).format(Number(v));

export const fmtDate = (d?: string | Date | null, withTime = false) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }) : "—";
