import { useState, useEffect } from "react";

/**
 * Hook: Gibt die Dashboard-URL basierend auf dem aktuellen Hostname zurück.
 * test.gpilot.app → test-dashboard.gpilot.app
 * gpilot.app → dashboard.gpilot.app
 * localhost → localhost:3001
 */
export function useDashboardUrl(): string {
  const [url, setUrl] = useState("https://dashboard.gpilot.app");

  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      setUrl("http://localhost:3001");
    } else if (hostname === "gpilot.app" || hostname === "www.gpilot.app") {
      setUrl("https://dashboard.gpilot.app");
    } else {
      const envMatch = hostname.match(/^([^.]+)\.gpilot\.app$/);
      if (envMatch) {
        setUrl(`https://${envMatch[1]}-dashboard.gpilot.app`);
      }
    }
  }, []);

  return url;
}
