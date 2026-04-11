"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { adminImpersonation } from "@/lib/api/admin";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { useDashboardUrl } from "@/lib/dashboard-url";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  UserCog,
  CalendarDays,
  Star,
  LogOut,
  Store,
  ShieldCheck,
  CreditCard,
  Settings,
  UtensilsCrossed,
  Undo2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Restaurants", icon: Store },
  { href: "/admin/tenant-settings", label: "Restaurant-Einstellungen", icon: Settings },
  { href: "/admin/menu", label: "Menü verwalten", icon: UtensilsCrossed },
  { href: "/admin/billing", label: "Abonnement", icon: CreditCard },
  { href: "/admin/operators", label: "Bedienerverwaltung", icon: UserCog },
  { href: "/admin/platform-admins", label: "Zugänge", icon: ShieldCheck },
  { href: "/admin/guests", label: "Gäste", icon: Users },
  { href: "/admin/reservations", label: "Reservierungen", icon: CalendarDays },
  { href: "/admin/reviews", label: "Bewertungen", icon: Star },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dashboardUrl = useDashboardUrl();
  const { isAdmin, isLoading, adminUser, logout } = useAdminAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatingUserName, setImpersonatingUserName] = useState<string | null>(null);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const normalizedPathname = pathname.replace(/^\/(de|en)(?=\/|$)/, "") || "/";

  const isNavItemActive = (href: string) =>
    normalizedPathname === href ||
    (href !== "/admin" && normalizedPathname.startsWith(href));

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push("/auth/login");
    }
  }, [isLoading, isAdmin, router]);

  useEffect(() => {
    setIsImpersonating(adminImpersonation.isActive());
    setImpersonatingUserName(adminImpersonation.getUserName());
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const handleStopImpersonation = () => {
    setStoppingImpersonation(true);
    try {
      adminImpersonation.stop();
      window.location.href = "/admin/platform-admins";
    } finally {
      setStoppingImpersonation(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
        <div className="flex h-16 items-center border-b px-6">
          <span className="text-lg font-bold text-primary">Admin</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t p-4">
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 inline-flex w-full items-center justify-between rounded-md border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            Restaurant-Dashboard
            <ExternalLink className="h-4 w-4" />
          </a>
          <div className="mb-2 truncate text-sm text-muted-foreground">
            {adminUser?.first_name} {adminUser?.last_name}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:hidden">
          <span className="text-lg font-bold text-primary">Admin</span>
          <nav className="flex items-center gap-2">
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-2 text-primary"
              aria-label="Restaurant-Dashboard öffnen"
              title="Restaurant-Dashboard öffnen"
            >
              <ExternalLink className="h-5 w-5" />
            </a>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md p-2",
                  isNavItemActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
              </Link>
            ))}
            <button onClick={handleLogout} className="rounded-md p-2 text-destructive">
              <LogOut className="h-5 w-5" />
            </button>
          </nav>
        </header>
        <main className="flex-1 p-4 md:p-8">
          {isImpersonating ? (
            <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium text-amber-200">Impersonation aktiv</p>
                  <p className="text-amber-100/90">
                    Aktiver Benutzer: {impersonatingUserName || "Unbekannt"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleStopImpersonation}
                  disabled={stoppingImpersonation}
                >
                  {stoppingImpersonation ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Undo2 className="mr-2 h-4 w-4" />
                  )}
                  Impersonation beenden
                </Button>
              </div>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
