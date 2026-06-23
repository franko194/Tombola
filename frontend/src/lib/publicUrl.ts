const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

export function getPublicAppUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return stripTrailingSlash(configuredUrl);

  return window.location.origin;
}

export function buildJudgeUrl(token?: string, fallbackUrl?: string) {
  if (!token) return fallbackUrl ?? "";
  return `${getPublicAppUrl()}/judge/${encodeURIComponent(token)}`;
}

export function isLocalUrl(url: string) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function buildQrCodeUrl(data: string, size: number) {
  if (!data) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&format=png&data=${encodeURIComponent(data)}`;
}
