const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

type RequestOptions = RequestInit & {
  json?: unknown;
};

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body;

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Error inesperado" }));
    throw new Error(error.detail ?? "Error inesperado");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
