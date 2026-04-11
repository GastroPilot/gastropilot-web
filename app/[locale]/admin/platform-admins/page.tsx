"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminImpersonation,
  adminPlatformAdminsApi,
  adminUsersApi,
  type AdminPlatformAdmin,
} from "@/lib/api/admin";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  ShieldCheck,
  Trash2,
  Pencil,
  Plus,
  X,
  Check,
  Ban,
  Loader2,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminPlatformAdminsPage() {
  const queryClient = useQueryClient();
  const { adminUser } = useAdminAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const { data: admins, isLoading } = useQuery({
    queryKey: ["admin", "platform-admins"],
    queryFn: () => adminPlatformAdminsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminPlatformAdminsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] });
      toast.success("Admin erfolgreich gelöscht");
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Löschen"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      adminPlatformAdminsApi.update(id, { is_active }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] });
      toast.success(
        data.is_active ? "Admin aktiviert" : "Admin deaktiviert"
      );
    },
    onError: () => toast.error("Fehler beim Ändern des Status"),
  });

  const roleLabels: Record<string, string> = {
    platform_admin: "Admin",
    platform_support: "Support",
    platform_analyst: "Analyst",
  };

  const handleImpersonate = async (admin: AdminPlatformAdmin) => {
    if (admin.id === adminUser?.id) {
      toast.error("Sie können sich nicht selbst impersonieren");
      return;
    }

    const confirmed = confirm(
      `Benutzer "${admin.first_name} ${admin.last_name}" wirklich impersonieren?\n\nSie übernehmen danach dessen Sitzung.`
    );
    if (!confirmed) return;

    setImpersonatingId(admin.id);
    try {
      const response = await adminUsersApi.impersonate(admin.id);
      adminImpersonation.start(
        response.impersonation_token,
        response.user_id,
        response.user_name
      );
      toast.success(`Impersonation gestartet: ${response.user_name}`);
      window.location.href = "/admin";
    } catch (error) {
      console.error("Fehler bei der User-Impersonation:", error);
      const message =
        error instanceof Error ? error.message : "Impersonation fehlgeschlagen";
      toast.error(message);
      setImpersonatingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zugangsverwaltung</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Admin
        </Button>
      </div>

      {showCreate && (
        <CreateAdminForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["admin", "platform-admins"] });
          }}
        />
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">E-Mail</th>
              <th className="px-4 py-3 text-left font-medium">Rolle</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Letzter Login</th>
              <th className="px-4 py-3 text-left font-medium">Erstellt</th>
              <th className="px-4 py-3 text-right font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : !admins?.length ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={ShieldCheck}
                    title="Keine Admins vorhanden"
                    description="Erstellen Sie einen neuen Platform-Admin."
                  />
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="border-b hover:bg-muted/30">
                  {editingId === admin.id ? (
                    <EditAdminRow
                      admin={admin}
                      onClose={() => setEditingId(null)}
                      onSuccess={() => {
                        setEditingId(null);
                        queryClient.invalidateQueries({
                          queryKey: ["admin", "platform-admins"],
                        });
                      }}
                    />
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">
                        {admin.first_name} {admin.last_name}
                        {admin.id === adminUser?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(Sie)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {admin.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {roleLabels[admin.role] || admin.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={admin.is_active ? "default" : "destructive"}>
                          {admin.is_active ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {admin.last_login_at
                          ? new Date(admin.last_login_at).toLocaleString("de-DE")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {admin.created_at
                          ? new Date(admin.created_at).toLocaleDateString("de-DE")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(admin.id)}
                            title="Bearbeiten"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {admin.id !== adminUser?.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleImpersonate(admin)}
                                disabled={impersonatingId === admin.id}
                                title="Impersonieren"
                              >
                                {impersonatingId === admin.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <LogIn className="h-4 w-4 text-primary" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleActiveMutation.mutate({
                                    id: admin.id,
                                    is_active: !admin.is_active,
                                  })
                                }
                                title={admin.is_active ? "Deaktivieren" : "Aktivieren"}
                              >
                                {admin.is_active ? (
                                  <Ban className="h-4 w-4 text-orange-500" />
                                ) : (
                                  <Check className="h-4 w-4 text-green-600" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Admin "${admin.first_name} ${admin.last_name}" wirklich löschen?`
                                    )
                                  ) {
                                    deleteMutation.mutate(admin.id);
                                  }
                                }}
                                className="text-destructive hover:text-destructive"
                                title="Löschen"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAdminForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });

  const createMutation = useMutation({
    mutationFn: () => adminPlatformAdminsApi.create(form),
    onSuccess: () => {
      toast.success("Admin erstellt");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Erstellen"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="mb-6 rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Neuen Platform-Admin anlegen</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Vorname *</Label>
            <Input
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>Nachname *</Label>
            <Input
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>E-Mail *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label>Passwort (min. 8 Zeichen) *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={8}
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Erstelle..." : "Admin erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditAdminRow({
  admin,
  onClose,
  onSuccess,
}: {
  admin: AdminPlatformAdmin;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    first_name: admin.first_name,
    last_name: admin.last_name,
    email: admin.email || "",
    password: "",
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {};
      if (form.first_name !== admin.first_name) payload.first_name = form.first_name;
      if (form.last_name !== admin.last_name) payload.last_name = form.last_name;
      if (form.email !== (admin.email || "")) payload.email = form.email;
      if (form.password) payload.password = form.password;
      return adminPlatformAdminsApi.update(admin.id, payload);
    },
    onSuccess: () => {
      toast.success("Admin aktualisiert");
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message || "Fehler beim Speichern"),
  });

  return (
    <>
      <td className="px-4 py-2">
        <Input
          value={form.first_name}
          onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          className="h-8"
          placeholder="Vorname"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="h-8"
          placeholder="E-Mail"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          value={form.last_name}
          onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          className="h-8"
          placeholder="Nachname"
        />
      </td>
      <td className="px-4 py-2" colSpan={2}>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="h-8"
          placeholder="Neues Passwort (leer = unverändert)"
        />
      </td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Check className="h-4 w-4 text-green-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </>
  );
}
