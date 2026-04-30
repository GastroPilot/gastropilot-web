"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { adminGuestsApi } from "@/lib/api/admin";
import { listAccessibleRestaurants } from "@/lib/admin-tenant-context";
import {
  onPreferredAdminRestaurantChange,
  resolvePreferredRestaurantId,
  setPreferredAdminRestaurantId,
} from "@/lib/admin-restaurant-preference";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Trash2, Pencil, ChevronLeft, ChevronRight, Search, KeyRound, Users } from "lucide-react";
import { toast } from "sonner";

export default function AdminGuestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const adminRole = useAdminAuth((state) => state.adminUser?.role ?? null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const { data: restaurants = [], isLoading: isLoadingRestaurants } = useQuery({
    queryKey: ["admin", "guests", "restaurants", adminRole],
    queryFn: () => listAccessibleRestaurants(adminRole),
    enabled: !!adminRole,
  });

  useEffect(() => {
    setSelectedRestaurantId((currentId) => resolvePreferredRestaurantId(restaurants, currentId));
  }, [restaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    setPreferredAdminRestaurantId(selectedRestaurantId);
  }, [selectedRestaurantId]);

  useEffect(() => {
    return onPreferredAdminRestaurantChange((restaurantId) => {
      if (!restaurantId) return;
      if (!restaurants.some((restaurant) => restaurant.id === restaurantId)) return;
      setSelectedRestaurantId(restaurantId);
      setPage(1);
    });
  }, [restaurants]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "guests", page, search, selectedRestaurantId],
    queryFn: () =>
      adminGuestsApi.list({
        page,
        per_page: 50,
        search,
        restaurant_id: selectedRestaurantId,
      }),
    enabled: !!selectedRestaurantId && !isLoadingRestaurants,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminGuestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "guests"] });
      toast.success("Gast erfolgreich gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen des Gastes"),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;
  const guests = data?.items ?? [];
  const showLoading = isLoading || isLoadingRestaurants || !selectedRestaurantId;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Gäste-Verwaltung</h1>

      <form
        onSubmit={handleSearch}
        className="mb-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Name oder E-Mail suchen..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="outline" className="w-full self-end lg:w-auto">
          Suchen
        </Button>
      </form>

      {showLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-md border p-4 md:hidden">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-56" />
              <Skeleton className="mt-3 h-9 w-full" />
            </div>
          ))}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Telefon</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : guests.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Keine Gäste gefunden"
          description="Es wurden keine Gäste mit den aktuellen Filtern gefunden."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {guests.map((guest) => (
              <div key={guest.id} className="rounded-md border p-4">
                <button
                  onClick={() => router.push(`/admin/guests/${guest.id}`)}
                  className="text-left font-semibold text-primary-contrast hover:underline"
                >
                  {guest.first_name} {guest.last_name}
                </button>
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  <p>{guest.email || "Keine E-Mail"}</p>
                  <p>{guest.phone || "Kein Telefon"}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant={guest.email_verified ? "default" : "secondary"}>
                    {guest.email_verified ? "Verifiziert" : "Nicht verifiziert"}
                  </Badge>
                  {guest.has_password ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" />
                      Passwort gesetzt
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Erstellt:{" "}
                  {guest.created_at
                    ? new Date(guest.created_at).toLocaleDateString("de-DE")
                    : "—"}
                </p>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/admin/guests/${guest.id}`)}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      if (confirm("Gast wirklich löschen?")) {
                        deleteMutation.mutate(guest.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Löschen
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Telefon</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <tr key={guest.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/admin/guests/${guest.id}`)}
                        className="font-medium text-primary-contrast hover:underline"
                      >
                        {guest.first_name} {guest.last_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {guest.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {guest.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={guest.email_verified ? "default" : "secondary"}>
                          {guest.email_verified ? "Verifiziert" : "Nicht verifiziert"}
                        </Badge>
                        {guest.has_password ? (
                          <span title="Hat Passwort">
                            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {guest.created_at
                        ? new Date(guest.created_at).toLocaleDateString("de-DE")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/guests/${guest.id}`)}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Gast wirklich löschen?")) {
                              deleteMutation.mutate(guest.id);
                            }
                          }}
                          className="text-destructive hover:text-destructive"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Seite {page} von {totalPages} ({data?.total} Gäste)
          </span>
          <div className="flex gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
