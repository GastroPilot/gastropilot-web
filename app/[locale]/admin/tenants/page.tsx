"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { adminTenantsApi, type AdminTenant, type AdminTenantCreate } from "@/lib/api/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Store,
  Pencil,
  Trash2,
  Plus,
  Power,
  PowerOff,
  X,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminTenantsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: tenants, isLoading } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminTenantsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminTenantsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast.success("Restaurant erfolgreich gelöscht");
    },
    onError: () => toast.error("Fehler beim Löschen"),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, is_suspended }: { id: string; is_suspended: boolean }) =>
      adminTenantsApi.toggleSuspension(id, is_suspended),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      toast.success(
        data.is_suspended ? "Restaurant deaktiviert" : "Restaurant aktiviert"
      );
    },
    onError: () => toast.error("Fehler beim Ändern des Status"),
  });
  const tenantList = tenants ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Restaurantverwaltung</h1>
        <Button onClick={() => setShowCreate(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Neues Restaurant
        </Button>
      </div>

      {showCreate && (
        <CreateTenantForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-md border p-4 md:hidden">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-2 h-4 w-56" />
              <Skeleton className="mt-3 h-10 w-full" />
            </div>
          ))}
          <div className="hidden overflow-x-auto rounded-md border md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Abo</th>
                  <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-24" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tenantList.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Keine Restaurants vorhanden"
          description="Erstellen Sie ein neues Restaurant, um loszulegen."
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {tenantList.map((tenant) => (
              <div key={tenant.id} className="rounded-md border p-4">
                <button
                  onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                  className="text-left font-semibold text-primary-contrast hover:underline"
                >
                  {tenant.name}
                </button>
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  <p>Slug: {tenant.slug || "—"}</p>
                  <p>{tenant.email || "Keine E-Mail"}</p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant={tenant.is_suspended ? "destructive" : "default"}>
                    {tenant.is_suspended ? "Deaktiviert" : "Aktiv"}
                  </Badge>
                  <Badge variant="secondary">{tenant.subscription_tier || "free"}</Badge>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Erstellt:{" "}
                  {tenant.created_at
                    ? new Date(tenant.created_at).toLocaleDateString("de-DE")
                    : "—"}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      suspendMutation.mutate({
                        id: tenant.id,
                        is_suspended: !tenant.is_suspended,
                      })
                    }
                  >
                    {tenant.is_suspended ? (
                      <Power className="mr-1.5 h-4 w-4 text-green-600" />
                    ) : (
                      <PowerOff className="mr-1.5 h-4 w-4 text-orange-500" />
                    )}
                    {tenant.is_suspended ? "Aktivieren" : "Deaktivieren"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          `Restaurant "${tenant.name}" wirklich löschen? Alle zugehörigen Daten werden unwiderruflich gelöscht.`
                        )
                      ) {
                        deleteMutation.mutate(tenant.id);
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
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Abo</th>
                  <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                  <th className="px-4 py-3 text-right font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {tenantList.map((tenant) => (
                  <tr key={tenant.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                        className="font-medium text-primary-contrast hover:underline"
                      >
                        {tenant.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tenant.slug || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tenant.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tenant.is_suspended ? "destructive" : "default"}>
                        {tenant.is_suspended ? "Deaktiviert" : "Aktiv"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {tenant.subscription_tier || "free"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tenant.created_at
                        ? new Date(tenant.created_at).toLocaleDateString("de-DE")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            suspendMutation.mutate({
                              id: tenant.id,
                              is_suspended: !tenant.is_suspended,
                            })
                          }
                          title={tenant.is_suspended ? "Aktivieren" : "Deaktivieren"}
                        >
                          {tenant.is_suspended ? (
                            <Power className="h-4 w-4 text-green-600" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-orange-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                `Restaurant "${tenant.name}" wirklich löschen? Alle zugehörigen Daten werden unwiderruflich gelöscht.`
                              )
                            ) {
                              deleteMutation.mutate(tenant.id);
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
    </div>
  );
}

function CreateTenantForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<AdminTenantCreate>({
    name: "",
    slug: "",
    address: "",
    phone: "",
    email: "",
    owner_first_name: "",
    owner_last_name: "",
    owner_email: "",
    owner_password: "",
    owner_operator_number: "",
    owner_pin: "",
  });

  const createMutation = useMutation({
    mutationFn: () => adminTenantsApi.create(form),
    onSuccess: (data) => {
      toast.success(
        `Restaurant "${data.tenant_name}" erstellt (Owner: ${data.owner_operator_number})`
      );
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Erstellen"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const set = (key: keyof AdminTenantCreate) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="mb-6 rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Neues Restaurant anlegen</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Restaurant-Name *</Label>
            <Input value={form.name} onChange={set("name")} required />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={form.slug} onChange={set("slug")} placeholder="mein-restaurant" />
          </div>
          <div>
            <Label>Adresse</Label>
            <Input value={form.address} onChange={set("address")} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={form.phone} onChange={set("phone")} />
          </div>
          <div className="sm:col-span-2">
            <Label>E-Mail</Label>
            <Input type="email" value={form.email} onChange={set("email")} />
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Owner-Benutzer</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Vorname *</Label>
              <Input value={form.owner_first_name} onChange={set("owner_first_name")} required />
            </div>
            <div>
              <Label>Nachname *</Label>
              <Input value={form.owner_last_name} onChange={set("owner_last_name")} required />
            </div>
            <div>
              <Label>Owner E-Mail (Web-Login) *</Label>
              <Input
                type="email"
                value={form.owner_email}
                onChange={set("owner_email")}
                required
              />
            </div>
            <div>
              <Label>Owner Passwort (min. 8 Zeichen) *</Label>
              <Input
                type="password"
                value={form.owner_password}
                onChange={set("owner_password")}
                minLength={8}
                required
              />
            </div>
            <div>
              <Label>Bediener-Nr. (4 Ziffern) *</Label>
              <Input
                value={form.owner_operator_number}
                onChange={set("owner_operator_number")}
                maxLength={4}
                pattern="\d{4}"
                placeholder="0001"
                required
              />
            </div>
            <div>
              <Label>PIN (6-8 Ziffern) *</Label>
              <Input
                type="password"
                value={form.owner_pin}
                onChange={set("owner_pin")}
                minLength={6}
                maxLength={8}
                pattern="\d{6,8}"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Erstelle..." : "Restaurant erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
