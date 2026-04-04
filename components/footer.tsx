"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const APP_VERSION_RAW = (process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0").trim();
const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? (() => { const d = new Date(); return d.toISOString().slice(0, 10).replace(/-/g, "") + "-" + d.toTimeString().slice(0, 8).replace(/:/g, ""); })();

function formatVersion(raw: string): string {
  const bare = raw.startsWith("v") ? raw.slice(1) : raw;
  if (/^[0-9a-f]{40}$/i.test(bare)) {
    return `v${bare.slice(0, 7)}`;
  }
  return raw.startsWith("v") ? raw : `v${raw}`;
}

const APP_VERSION = formatVersion(APP_VERSION_RAW);

function getEnvironment(): string {
  if (typeof window === "undefined") return "prod";
  const hostname = window.location.hostname;

  if (hostname === "localhost" || hostname === "127.0.0.1") return "dev";

  const envMatch = hostname.match(/^([^.]+)\.gpilot\.app$/);
  if (envMatch) {
    const sub = envMatch[1].toLowerCase();
    if (["test", "stage", "staging", "demo"].includes(sub)) return sub;
  }

  return "prod";
}

export function Footer() {
  const [environment, setEnvironment] = useState("prod");

  useEffect(() => {
    setEnvironment(getEnvironment());
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="text-[15px] font-bold tracking-tight">
              GastroPilot
            </Link>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              Restaurants entdecken, nach Allergenen filtern und online reservieren.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-10 text-[14px]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground/60">Gäste</p>
              <ul className="mt-4 space-y-2.5 text-muted-foreground">
                <li><Link href="/restaurants" className="transition-colors hover:text-foreground">Restaurants</Link></li>
                <li><Link href="/auth/register" className="transition-colors hover:text-foreground">Registrieren</Link></li>
                <li><Link href="/auth/login" className="transition-colors hover:text-foreground">Anmelden</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground/60">Restaurants</p>
              <ul className="mt-4 space-y-2.5 text-muted-foreground">
                <li><Link href="/fuer-restaurants" className="transition-colors hover:text-foreground">Übersicht</Link></li>
                <li><Link href="/fuer-restaurants/features" className="transition-colors hover:text-foreground">Features</Link></li>
                <li><Link href="/fuer-restaurants/pricing" className="transition-colors hover:text-foreground">Preise</Link></li>
                <li><Link href="/kontakt" className="transition-colors hover:text-foreground">Kontakt</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[2px] text-muted-foreground/60">Rechtliches</p>
              <ul className="mt-4 space-y-2.5 text-muted-foreground">
                <li><Link href="/datenschutz" className="transition-colors hover:text-foreground">Datenschutz</Link></li>
                <li><Link href="/impressum" className="transition-colors hover:text-foreground">Impressum</Link></li>
                <li><Link href="/agb" className="transition-colors hover:text-foreground">AGB</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center gap-2 border-t pt-6 text-[12px] text-muted-foreground/50">
          <span className={`font-medium ${
            environment === "dev" ? "text-[#F95100]" :
            environment === "test" ? "text-yellow-500" :
            environment === "stage" || environment === "staging" ? "text-orange-500" :
            environment === "demo" ? "text-purple-500" :
            "text-muted-foreground"
          }`}>
            {APP_VERSION}-{environment} ({BUILD_DATE})
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="font-semibold">Servecta @ {currentYear}</span>
        </div>
      </div>
    </footer>
  );
}
