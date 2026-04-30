"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Store } from "lucide-react";
import type { AdminTenant } from "@/lib/api/admin";
import { listAccessibleRestaurants } from "@/lib/admin-tenant-context";
import {
  onPreferredAdminRestaurantChange,
  resolvePreferredRestaurantId,
  setPreferredAdminRestaurantId,
} from "@/lib/admin-restaurant-preference";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AdminRestaurantSwitcher() {
  const adminRole = useAdminAuth((state) => state.adminUser?.role ?? null);
  const isAdmin = useAdminAuth((state) => state.isAdmin);

  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const loadRestaurants = useCallback(async () => {
    if (!adminRole || !isAdmin) {
      setRestaurants([]);
      setSelectedRestaurantId("");
      return;
    }

    setIsLoading(true);
    try {
      const list = await listAccessibleRestaurants(adminRole);
      setRestaurants(list);
      const resolvedId = resolvePreferredRestaurantId(list);
      setSelectedRestaurantId(resolvedId);
      setPreferredAdminRestaurantId(resolvedId || null);
    } catch {
      setRestaurants([]);
      setSelectedRestaurantId("");
    } finally {
      setIsLoading(false);
    }
  }, [adminRole, isAdmin]);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    return onPreferredAdminRestaurantChange((restaurantId) => {
      if (!restaurantId) return;
      setSelectedRestaurantId((current) => {
        if (current === restaurantId) return current;
        if (!restaurants.some((restaurant) => restaurant.id === restaurantId)) return current;
        return restaurantId;
      });
    });
  }, [restaurants]);

  if (!isAdmin) return null;
  if (!isLoading && restaurants.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1">
      <Store className="h-4 w-4 text-primary-contrast" />
      <Select
        value={selectedRestaurantId}
        onValueChange={(value) => {
          setSelectedRestaurantId(value);
          setPreferredAdminRestaurantId(value || null);
        }}
        disabled={isLoading}
      >
        <SelectTrigger className="h-8 min-w-[220px] rounded-full border-primary/20 bg-background/85 text-[13px] font-medium">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Restaurants laden...</span>
            </div>
          ) : (
            <SelectValue placeholder="Restaurant wählen">
              {selectedRestaurant ? selectedRestaurant.name : "Restaurant wählen"}
            </SelectValue>
          )}
        </SelectTrigger>
        <SelectContent>
          {restaurants.map((restaurant) => (
            <SelectItem key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
