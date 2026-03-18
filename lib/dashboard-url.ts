/**
 * Gibt die Dashboard-URL basierend auf dem aktuellen Hostname zurück.
 * test.gpilot.app → test-dashboard.gpilot.app
 * gpilot.app → dashboard.gpilot.app
 * localhost → localhost:3001
 */
export function getDashboardUrl(): string {
  if (typeof window === "undefined") return "https://dashboard.gpilot.app";
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1")
    return "http://localhost:3001";
  if (hostname === "gpilot.app" || hostname === "www.gpilot.app")
    return "https://dashboard.gpilot.app";
  const envMatch = hostname.match(/^([^.]+)\.gpilot\.app$/);
  if (envMatch) return `https://${envMatch[1]}-dashboard.gpilot.app`;
  return "https://dashboard.gpilot.app";
}
