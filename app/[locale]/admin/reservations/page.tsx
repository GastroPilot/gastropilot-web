"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminReservationsApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["", "pending", "confirmed", "seated", "completed", "canceled", "no_show"];
const STATUS_LABELS: Record<string, string> = {
  "": "Alle",
  pending: "Ausstehend",
  confirmed: "Bestätigt",
  seated: "Platziert",
  completed: "Abgeschlossen",
  canceled: "Storniert",
  no_show: "No-Show",
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  confirmed: "default",
  seated: "default",
  completed: "secondary",
  canceled: "destructive",
  no_show: "destructive",
};

export default function AdminReservationsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reservations", page, statusFilter],
    queryFn: () =>
      adminReservationsApi.list({
        page,
        per_page: 50,
        status: statusFilter || undefined,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, canceled_reason }: { id: string; status: string; canceled_reason?: string }) =>
      adminReservationsApi.updateStatus(id, { status, canceled_reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reservations"] });
      toast.success("Status aktualisiert");
    },
    onError: () => toast.error("Fehler beim Ändern des Status"),
  });

  const handleStatusChange = (id: string, newStatus: string) => {
    let canceled_reason: string | undefined;
    if (newStatus === "canceled") {
      canceled_reason = prompt("Stornierungsgrund (optional):") || undefined;
    }
    statusMutation.mutate({ id, status: newStatus, canceled_reason });
  };

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;
  const reservations = data?.items ?? [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Reservierungen</h1>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            {STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-md border p-4 md:hidden">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-52" />
              <Skeleton className="mt-3 h-10 w-full" />
            </div>
          ))}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Restaurant</th>
                  <th className="px-4 py-3 text-left font-medium">Gast</th>
                  <th className="px-4 py-3 text-left font-medium">Personen</th>
                  <th className="px-4 py-3 text-left font-medium">Datum</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-6 w-24" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : reservations.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Keine Reservierungen gefunden"
          description="Es liegen keine Reservierungen mit den aktuellen Filtern vor."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {reservations.map((r) => (
              <div key={r.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{r.restaurant_name}</div>
                    <div className="text-sm text-muted-foreground">{r.guest_name || "—"}</div>
                    {r.guest_email ? (
                      <div className="text-xs text-muted-foreground">{r.guest_email}</div>
                    ) : null}
                  </div>
                  <Badge variant={STATUS_COLORS[r.status] || "secondary"}>
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Personen</p>
                    <p className="font-medium">{r.party_size}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Datum</p>
                    <p className="font-medium">
                      {r.start_at
                        ? new Date(r.start_at).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs text-muted-foreground">Status ändern</label>
                  <select
                    className="mt-1 w-full rounded border bg-background px-2 py-2 text-sm"
                    value={r.status}
                    onChange={(e) => handleStatusChange(r.id, e.target.value)}
                    disabled={statusMutation.isPending}
                  >
                    {STATUSES.filter((s) => s !== "").map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Restaurant</th>
                  <th className="px-4 py-3 text-left font-medium">Gast</th>
                  <th className="px-4 py-3 text-left font-medium">Personen</th>
                  <th className="px-4 py-3 text-left font-medium">Datum</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.restaurant_name}</td>
                    <td className="px-4 py-3">
                      <div>{r.guest_name || "—"}</div>
                      {r.guest_email ? (
                        <div className="text-xs text-muted-foreground">{r.guest_email}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{r.party_size}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.start_at
                        ? new Date(r.start_at).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[r.status] || "secondary"}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        className="rounded border bg-background px-2 py-1 text-xs"
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        disabled={statusMutation.isPending}
                      >
                        {STATUSES.filter((s) => s !== "").map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Seite {page} von {totalPages} ({data?.total} Reservierungen)
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
