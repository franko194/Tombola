import { translateApiError } from "./errors";

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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }

  if (!response.ok) {
    // An expired organizer cookie sends the app back to the login screen. Login attempts are excluded.
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    const error = await response.json().catch(() => ({ detail: "Error inesperado" }));
    throw new ApiError(translateApiError(error.detail), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
