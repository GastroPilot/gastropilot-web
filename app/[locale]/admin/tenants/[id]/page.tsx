"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useParams } from "next/navigation";
import { adminTenantsApi } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Power, PowerOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminTenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const tenantId = params.id as string;

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["admin", "tenants", tenantId],
    queryFn: () => adminTenantsApi.get(tenantId),
  });

  const [form, setForm] = useState({
    name: "",
    slug: "",
    address: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        slug: tenant.slug || "",
        address: tenant.address || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
      });
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: () => adminTenantsApi.update(tenantId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast.success("Restaurant aktualisiert");
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Speichern"),
  });

  const suspendMutation = useMutation({
    mutationFn: (is_suspended: boolean) =>
      adminTenantsApi.toggleSuspension(tenantId, is_suspended),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast.success(
        data.is_suspended ? "Restaurant deaktiviert" : "Restaurant aktiviert"
      );
    },
    onError: () => toast.error("Fehler beim Ändern des Status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminTenantsApi.delete(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast.success("Restaurant gelöscht");
      router.push("/admin/tenants");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tenant) {
    return <div className="text-muted-foreground">Restaurant nicht gefunden.</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/tenants")}
          className="mb-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <Badge variant={tenant.is_suspended ? "destructive" : "default"}>
            {tenant.is_suspended ? "Deaktiviert" : "Aktiv"}
          </Badge>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Stammdaten</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <Label>Adresse</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Informationen</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">ID:</span>{" "}
            <span className="font-mono text-xs">{tenant.id}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Abo-Tier:</span>{" "}
            {tenant.subscription_tier || "free"}
          </div>
          <div>
            <span className="text-muted-foreground">Abo-Status:</span>{" "}
            {tenant.subscription_status || "inactive"}
          </div>
          <div>
            <span className="text-muted-foreground">Erstellt:</span>{" "}
            {tenant.created_at
              ? new Date(tenant.created_at).toLocaleString("de-DE")
              : "—"}
          </div>
          {tenant.updated_at && (
            <div>
              <span className="text-muted-foreground">Aktualisiert:</span>{" "}
              {new Date(tenant.updated_at).toLocaleString("de-DE")}
            </div>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      <div className="rounded-lg border border-destructive/20 bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-destructive">Gefahrenzone</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => suspendMutation.mutate(!tenant.is_suspended)}
            disabled={suspendMutation.isPending}
          >
            {tenant.is_suspended ? (
              <>
                <Power className="mr-2 h-4 w-4" />
                Restaurant aktivieren
              </>
            ) : (
              <>
                <PowerOff className="mr-2 h-4 w-4" />
                Restaurant deaktivieren
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (
                confirm(
                  `Restaurant "${tenant.name}" und ALLE zugehörigen Daten (Benutzer, Tische, Reservierungen, Bestellungen etc.) unwiderruflich löschen?`
                )
              ) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Restaurant löschen
          </Button>
        </div>
      </div>
    </div>
  );
}
