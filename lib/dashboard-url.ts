/**
 * Gibt die Dashboard-URL basierend auf dem aktuellen Hostname zurück.
 * test.gpilot.app → test-dashboard.gpilot.app
 * gpilot.app → dashboard.gpilot.app
 * localhost → localhost:3001
 */

let _cache: string | null = null;

export function getDashboardUrl(): string {
  if (typeof window === "undefined") return "#";
  if (_cache) return _cache;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    _cache = "http://localhost:3001";
  } else if (hostname === "gpilot.app" || hostname === "www.gpilot.app") {
    _cache = "https://dashboard.gpilot.app";
  } else {
    const envMatch = hostname.match(/^([^.]+)\.gpilot\.app$/);
    _cache = envMatch
      ? `https://${envMatch[1]}-dashboard.gpilot.app`
      : "https://dashboard.gpilot.app";
  }
  return _cache;
}
