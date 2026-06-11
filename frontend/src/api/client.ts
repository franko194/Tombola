function resolveApiBase() {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (!configuredUrl) return "/api";

  try {
    const configuredHost = new URL(configuredUrl).hostname;
    const browserHost = window.location.hostname;
    const configuredIsLocal = configuredHost === "localhost" || configuredHost === "127.0.0.1" || configuredHost === "::1";
    const browserIsLocal = browserHost === "localhost" || browserHost === "127.0.0.1" || browserHost === "::1";

    if (configuredIsLocal && !browserIsLocal) {
      return "/api";
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
}

const API_BASE = resolveApiBase();

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
