const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

export function getPublicAppUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configuredUrl) return stripTrailingSlash(configuredUrl);

  const devLanUrl = import.meta.env.VITE_DEV_LAN_APP_URL?.trim();
  if (devLanUrl && LOCAL_HOSTS.has(window.location.hostname)) {
    return stripTrailingSlash(devLanUrl);
  }

  return window.location.origin;
}

export function buildJudgeUrl(token?: string, fallbackUrl?: string) {
  if (!token) return fallbackUrl ?? "";
  return `${getPublicAppUrl()}/judge/${encodeURIComponent(token)}`;
}

export function isJudgeUrl(url: string) {
  try {
    return /^\/judge\/[^/]+$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export function isLocalUrl(url: string) {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
