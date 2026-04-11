"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Search,
  Store,
  Tag,
  Trash2,
  UtensilsCrossed,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { adminTenantsApi, type AdminTenant } from "@/lib/api/admin";
import {
  menuManagementApi,
  type MenuCategory,
  type MenuItem,
} from "@/lib/api/menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EU_14_ALLERGENS = [
  { code: "gluten", label: "Gluten" },
  { code: "krebstiere", label: "Krebstiere" },
  { code: "eier", label: "Eier" },
  { code: "fisch", label: "Fisch" },
  { code: "erdnüsse", label: "Erdnüsse" },
  { code: "soja", label: "Soja" },
  { code: "milch", label: "Milch" },
  { code: "schalenfrüchte", label: "Schalenfrüchte" },
  { code: "sellerie", label: "Sellerie" },
  { code: "senf", label: "Senf" },
  { code: "sesam", label: "Sesam" },
  { code: "schwefeldioxid", label: "Schwefeldioxid" },
  { code: "lupinen", label: "Lupinen" },
  { code: "weichtiere", label: "Weichtiere" },
];

function sortCategories(data: MenuCategory[]) {
  return [...data].sort((a, b) => {
    const orderDelta = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return a.name.localeCompare(b.name, "de");
  });
}

function sortItems(data: MenuItem[]) {
  return [...data].sort((a, b) => {
    const orderDelta = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    return a.name.localeCompare(b.name, "de");
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export default function AdminMenuPage() {
  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loadingMenu, setLoadingMenu] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState(0);
  const [categoryIsActive, setCategoryIsActive] = useState(true);

  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState(0);
  const [itemCategoryId, setItemCategoryId] = useState<string | null>(null);
  const [itemIsAvailable, setItemIsAvailable] = useState(true);
  const [itemSortOrder, setItemSortOrder] = useState(0);
  const [itemAllergens, setItemAllergens] = useState<string[]>([]);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories]
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategoryId && item.category_id !== selectedCategoryId) return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [items, selectedCategoryId, searchQuery]);

  const categoryById = useMemo(() => {
    const map = new Map<string, MenuCategory>();
    for (const category of categories) {
      map.set(category.id, category);
    }
    return map;
  }, [categories]);

  const categoryItemCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.category_id) continue;
      counts.set(item.category_id, (counts.get(item.category_id) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const maxCategoryItemCount = useMemo(() => {
    if (categories.length === 0) return 1;
    return Math.max(
      ...categories.map((category) => categoryItemCount.get(category.id) ?? 0),
      1
    );
  }, [categories, categoryItemCount]);

  const loadRestaurants = useCallback(async () => {
    setLoadingRestaurants(true);
    try {
      const list = await adminTenantsApi.list();
      setRestaurants(list);
      setSelectedRestaurantId((currentId) => {
        if (currentId && list.some((restaurant) => restaurant.id === currentId)) {
          return currentId;
        }
        return list[0]?.id ?? "";
      });
    } catch (error) {
      console.error("Fehler beim Laden der Restaurants:", error);
      toast.error("Restaurants konnten nicht geladen werden");
    } finally {
      setLoadingRestaurants(false);
    }
  }, []);

  const getTenantAccessToken = useCallback(async (restaurantId: string) => {
    const session = await adminTenantsApi.impersonate(restaurantId);
    return session.impersonation_token;
  }, []);

  const loadMenu = useCallback(async (restaurantId: string) => {
    if (!restaurantId) {
      setCategories([]);
      setItems([]);
      return;
    }

    setLoadingMenu(true);
    try {
      const accessToken = await getTenantAccessToken(restaurantId);
      const [allCategories, allItems] = await Promise.all([
        menuManagementApi.listCategories({ accessToken }),
        menuManagementApi.listItems({}, { accessToken }),
      ]);

      setCategories(sortCategories(allCategories));
      setItems(sortItems(allItems));
    } catch (error) {
      console.error("Fehler beim Laden des Menüs:", error);
      toast.error("Menüdaten konnten nicht geladen werden");
    } finally {
      setLoadingMenu(false);
    }
  }, [getTenantAccessToken]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    loadMenu(selectedRestaurantId);
  }, [selectedRestaurantId, loadMenu]);

  useEffect(() => {
    if (!selectedCategoryId) return;
    if (!categories.some((category) => category.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const openCategoryDialog = (category: MenuCategory | null = null) => {
    setEditingCategory(category);
    if (category) {
      setCategoryName(category.name);
      setCategoryDescription(category.description ?? "");
      setCategorySortOrder(category.sort_order ?? 0);
      setCategoryIsActive(category.is_active);
    } else {
      setCategoryName("");
      setCategoryDescription("");
      setCategorySortOrder(categories.length + 1);
      setCategoryIsActive(true);
    }
    setCategoryDialogOpen(true);
  };

  const openItemDialog = (item: MenuItem | null = null) => {
    setEditingItem(item);
    if (item) {
      setItemName(item.name);
      setItemDescription(item.description ?? "");
      setItemPrice(item.price);
      setItemCategoryId(item.category_id);
      setItemIsAvailable(item.is_available);
      setItemSortOrder(item.sort_order ?? 0);
      setItemAllergens(item.allergens ?? []);
    } else {
      setItemName("");
      setItemDescription("");
      setItemPrice(0);
      setItemCategoryId(selectedCategoryId);
      setItemIsAvailable(true);
      setItemSortOrder(items.length + 1);
      setItemAllergens([]);
    }
    setItemDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!selectedRestaurantId) {
      toast.error("Bitte wählen Sie zuerst ein Restaurant");
      return;
    }

    if (!categoryName.trim()) {
      toast.error("Bitte geben Sie einen Kategorienamen ein");
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      if (editingCategory) {
        await menuManagementApi.updateCategory(editingCategory.id, {
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          sort_order: categorySortOrder,
          is_active: categoryIsActive,
        }, { accessToken });
        toast.success("Kategorie aktualisiert");
      } else {
        await menuManagementApi.createCategory({
          restaurant_id: selectedRestaurantId,
          name: categoryName.trim(),
          description: categoryDescription.trim() || null,
          sort_order: categorySortOrder,
          is_active: categoryIsActive,
        }, { accessToken });
        toast.success("Kategorie erstellt");
      }
      setCategoryDialogOpen(false);
      await loadMenu(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Speichern der Kategorie:", error);
      toast.error("Kategorie konnte nicht gespeichert werden");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category: MenuCategory) => {
    const hasItems = items.some((item) => item.category_id === category.id);
    if (hasItems) {
      toast.error("Kategorie enthält noch Artikel und kann nicht gelöscht werden");
      return;
    }

    if (!confirm(`Kategorie "${category.name}" wirklich löschen?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      await menuManagementApi.deleteCategory(category.id, { accessToken });
      toast.success("Kategorie gelöscht");
      setCategoryDialogOpen(false);
      await loadMenu(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Löschen der Kategorie:", error);
      toast.error("Kategorie konnte nicht gelöscht werden");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveItem = async () => {
    if (!selectedRestaurantId) {
      toast.error("Bitte wählen Sie zuerst ein Restaurant");
      return;
    }

    if (!itemName.trim() || itemPrice <= 0) {
      toast.error("Bitte Name und gültigen Preis angeben");
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      if (editingItem) {
        await menuManagementApi.updateItem(editingItem.id, {
          name: itemName.trim(),
          description: itemDescription.trim() || null,
          price: itemPrice,
          category_id: itemCategoryId,
          is_available: itemIsAvailable,
          sort_order: itemSortOrder,
          allergens: itemAllergens,
        }, { accessToken });
        toast.success("Artikel aktualisiert");
      } else {
        await menuManagementApi.createItem({
          restaurant_id: selectedRestaurantId,
          name: itemName.trim(),
          description: itemDescription.trim() || null,
          price: itemPrice,
          category_id: itemCategoryId,
          is_available: itemIsAvailable,
          sort_order: itemSortOrder,
          allergens: itemAllergens,
        }, { accessToken });
        toast.success("Artikel erstellt");
      }
      setItemDialogOpen(false);
      await loadMenu(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Speichern des Artikels:", error);
      toast.error("Artikel konnte nicht gespeichert werden");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Artikel "${item.name}" wirklich löschen?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      await menuManagementApi.deleteItem(item.id, { accessToken });
      toast.success("Artikel gelöscht");
      setItemDialogOpen(false);
      await loadMenu(selectedRestaurantId);
    } catch (error) {
      console.error("Fehler beim Löschen des Artikels:", error);
      toast.error("Artikel konnte nicht gelöscht werden");
    } finally {
      setSubmitting(false);
    }
  };

  const restaurantOptions = useMemo(
    () =>
      restaurants.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name,
        suspended: restaurant.is_suspended,
      })),
    [restaurants]
  );

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/40" />

      <div className="space-y-6">
        <Card className="overflow-hidden border-border/70 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
                  <UtensilsCrossed className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Menü verwalten</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kategorien und Artikel für das ausgewählte Restaurant pflegen
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <Button
                  variant="outline"
                  onClick={() => openCategoryDialog(null)}
                  disabled={!selectedRestaurantId || loadingMenu}
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Kategorie hinzufügen
                </Button>
                <Button onClick={() => openItemDialog(null)} disabled={!selectedRestaurantId || loadingMenu}>
                  <Plus className="mr-2 h-4 w-4" />
                  Artikel hinzufügen
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Restaurant
                </label>
                {loadingRestaurants ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : (
                  <Select
                    value={selectedRestaurantId}
                    onValueChange={setSelectedRestaurantId}
                    disabled={restaurantOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Restaurant auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurantOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                          {option.suspended ? " (deaktiviert)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Suche
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Artikel nach Name oder Beschreibung suchen"
                    className="pl-9"
                    disabled={!selectedRestaurantId}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selectedCategoryId === null
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                Alle Kategorien
              </button>
              {activeCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    selectedCategoryId === category.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {!selectedRestaurantId && !loadingRestaurants ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Store className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Kein Restaurant verfügbar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Erstellen Sie zuerst in der Restaurantverwaltung ein Restaurant.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {selectedRestaurant ? (
          <div className="grid gap-6 xl:grid-cols-[2.2fr_1fr]">
            <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    Artikel
                    <span className="ml-2 text-base font-medium text-muted-foreground">
                      ({filteredItems.length})
                    </span>
                  </CardTitle>
                  {loadingMenu && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingMenu ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-36 rounded-xl" />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center">
                    <p className="font-medium text-foreground">Keine passenden Artikel gefunden</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {searchQuery || selectedCategoryId
                        ? "Filter anpassen oder Artikel neu anlegen."
                        : "Legen Sie den ersten Artikel für dieses Restaurant an."}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredItems.map((item) => {
                      const category = item.category_id ? categoryById.get(item.category_id) : null;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openItemDialog(item)}
                          className="group rounded-xl border border-border/80 bg-background/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{item.name}</p>
                                {item.is_available ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-rose-500" />
                                )}
                              </div>
                              {category ? (
                                <p className="mt-1 text-xs text-muted-foreground">{category.name}</p>
                              ) : null}
                              {item.description ? (
                                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                                  {item.description}
                                </p>
                              ) : null}
                            </div>
                            <Badge variant={item.is_available ? "default" : "secondary"}>
                              {item.is_available ? "Verfügbar" : "Ausverkauft"}
                            </Badge>
                          </div>

                          {item.allergens?.length ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {item.allergens.map((allergenCode) => (
                                <span
                                  key={allergenCode}
                                  className="rounded-full border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive"
                                >
                                  {EU_14_ALLERGENS.find((entry) => entry.code === allergenCode)?.label ??
                                    allergenCode}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3">
                            <span className="text-lg font-bold">{formatCurrency(item.price)}</span>
                            <span className="text-xs text-muted-foreground">
                              Sortierung: {item.sort_order ?? 0}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">
                  Kategorien
                  <span className="ml-2 text-base font-medium text-muted-foreground">
                    ({categories.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingMenu ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Noch keine Kategorien vorhanden.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((category) => {
                      const amount = categoryItemCount.get(category.id) ?? 0;
                      const barWidth = Math.max(
                        0,
                        Math.min(100, (amount / maxCategoryItemCount) * 100)
                      );
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => openCategoryDialog(category)}
                          className="relative overflow-hidden flex w-full items-start justify-between rounded-xl border border-border/80 bg-background/70 px-3 py-2.5 text-left transition-colors hover:border-primary/60"
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10"
                            style={{ width: `${barWidth}%` }}
                          />
                          <div>
                            <p className="relative z-10 font-medium">{category.name}</p>
                            {category.description ? (
                              <p className="relative z-10 mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                {category.description}
                              </p>
                            ) : null}
                            <p className="relative z-10 mt-1 text-xs font-medium text-muted-foreground">
                              {amount} Artikel zugewiesen
                            </p>
                          </div>
                          <div className="relative z-10 flex flex-col items-end gap-1.5">
                            <Badge variant={category.is_active ? "default" : "secondary"}>
                              {category.is_active ? "Aktiv" : "Inaktiv"}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground">{amount}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent
          className="max-w-xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={() => setCategoryDialogOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Kategorie bearbeiten" : "Neue Kategorie"}</DialogTitle>
            <DialogDescription>
              Strukturieren Sie Ihr Menü klar nach Bereichen wie Vorspeisen, Hauptgerichte oder Getränke.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-2 md:px-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
              <Input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="z. B. Vorspeisen"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Beschreibung</label>
              <textarea
                value={categoryDescription}
                onChange={(event) => setCategoryDescription(event.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Kurze Beschreibung dieser Kategorie"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Sortierreihenfolge
                </label>
                <Input
                  type="number"
                  value={categorySortOrder}
                  onChange={(event) => setCategorySortOrder(Number(event.target.value) || 0)}
                  disabled={submitting}
                />
              </div>

              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={categoryIsActive}
                    onChange={(event) => setCategoryIsActive(event.target.checked)}
                    disabled={submitting}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Kategorie aktiv
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="items-center">
            {editingCategory ? (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => handleDeleteCategory(editingCategory)}
                disabled={submitting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            ) : null}

            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={submitting}>
              <X className="mr-2 h-4 w-4" />
              Abbrechen
            </Button>
            <Button onClick={handleSaveCategory} disabled={submitting || !categoryName.trim()}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent
          className="max-w-2xl border-border/70 bg-card/95 backdrop-blur-xl"
          onClose={() => setItemDialogOpen(false)}
        >
          <DialogHeader>
            <DialogTitle>{editingItem ? "Artikel bearbeiten" : "Neuer Artikel"}</DialogTitle>
            <DialogDescription>
              Legen Sie Namen, Preis, Kategorie und Allergene fest, damit Gäste alle Infos direkt sehen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-4 pb-2 md:px-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
              <Input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="z. B. Pasta al Tartufo"
                disabled={submitting}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Beschreibung</label>
              <textarea
                value={itemDescription}
                onChange={(event) => setItemDescription(event.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Kurze Beschreibung des Artikels"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Preis (EUR)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemPrice || ""}
                  onChange={(event) => setItemPrice(Number(event.target.value) || 0)}
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Kategorie</label>
                <Select
                  value={itemCategoryId ?? "__none__"}
                  onValueChange={(value) => setItemCategoryId(value === "__none__" ? null : value)}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Keine Kategorie</SelectItem>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Sortierreihenfolge
                </label>
                <Input
                  type="number"
                  value={itemSortOrder}
                  onChange={(event) => setItemSortOrder(Number(event.target.value) || 0)}
                  disabled={submitting}
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={itemIsAvailable}
                    onChange={(event) => setItemIsAvailable(event.target.checked)}
                    disabled={submitting}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Artikel verfügbar
                </label>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">
                Allergene (EU-14)
              </label>
              <div className="flex flex-wrap gap-2">
                {EU_14_ALLERGENS.map((allergen) => {
                  const selected = itemAllergens.includes(allergen.code);
                  return (
                    <button
                      key={allergen.code}
                      type="button"
                      onClick={() =>
                        setItemAllergens((current) =>
                          selected
                            ? current.filter((entry) => entry !== allergen.code)
                            : [...current, allergen.code]
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        selected
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                      disabled={submitting}
                    >
                      {allergen.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="items-center">
            {editingItem ? (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => handleDeleteItem(editingItem)}
                disabled={submitting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Löschen
              </Button>
            ) : null}

            <Button variant="outline" onClick={() => setItemDialogOpen(false)} disabled={submitting}>
              <X className="mr-2 h-4 w-4" />
              Abbrechen
            </Button>
            <Button onClick={handleSaveItem} disabled={submitting || !itemName.trim() || itemPrice <= 0}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
