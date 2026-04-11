"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTenant } from "@/lib/api/admin";
import {
  billingApi,
  type Subscription,
  type SubscriptionPlan,
} from "@/lib/api/billing";
import {
  getRestaurantAccessToken,
  listAccessibleRestaurants,
  withOptionalAccessToken,
} from "@/lib/admin-tenant-context";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tierOrder = ["free", "starter", "professional", "enterprise"];

export default function AdminBillingPage() {
  const searchParams = useSearchParams();
  const adminRole = useAdminAuth((state) => state.adminUser?.role ?? null);
  const [restaurants, setRestaurants] = useState<AdminTenant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const selectedRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === selectedRestaurantId) ?? null,
    [restaurants, selectedRestaurantId]
  );

  const getTenantAccessToken = useCallback(async (restaurantId: string) => {
    return getRestaurantAccessToken(adminRole, restaurantId);
  }, [adminRole]);

  const loadRestaurants = useCallback(async () => {
    if (!adminRole) {
      setRestaurants([]);
      setSelectedRestaurantId("");
      setLoadingRestaurants(false);
      return;
    }

    setLoadingRestaurants(true);
    try {
      const list = await listAccessibleRestaurants(adminRole);
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
  }, [adminRole]);

  const loadBilling = useCallback(
    async (restaurantId: string) => {
      if (!restaurantId) {
        setPlans([]);
        setSubscription(null);
        return;
      }

      setLoadingBilling(true);
      try {
        const accessToken = await getTenantAccessToken(restaurantId);
        const requestOptions = withOptionalAccessToken(accessToken);
        const [plansData, subscriptionData] = await Promise.all([
          billingApi.getPlans(requestOptions),
          billingApi.getSubscription(requestOptions),
        ]);
        setPlans(plansData);
        setSubscription(subscriptionData);
      } catch (error) {
        console.error("Fehler beim Laden der Billing-Daten:", error);
        toast.error("Abonnementdaten konnten nicht geladen werden");
      } finally {
        setLoadingBilling(false);
      }
    },
    [getTenantAccessToken]
  );

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    loadBilling(selectedRestaurantId);
  }, [selectedRestaurantId, loadBilling]);

  useEffect(() => {
    if (searchParams?.get("success") === "true") {
      toast.success("Abonnement erfolgreich abgeschlossen");
    }
    if (searchParams?.get("canceled") === "true") {
      toast.info("Checkout wurde abgebrochen");
    }
  }, [searchParams]);

  const currentTier = subscription?.plan || "free";
  const isActive = subscription?.status === "active";

  const handleCheckout = async (planId: string) => {
    if (!selectedRestaurantId) return;
    setCheckoutLoading(planId);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      const base = window.location.origin;
      const { checkout_url } = await billingApi.createCheckout(
        planId,
        {
          success_url: `${base}/admin/billing?success=true`,
          cancel_url: `${base}/admin/billing?canceled=true`,
        },
        withOptionalAccessToken(accessToken)
      );
      window.location.href = checkout_url;
    } catch (error) {
      console.error("Fehler beim Erstellen des Checkouts:", error);
      toast.error("Checkout konnte nicht gestartet werden");
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!selectedRestaurantId) return;
    setPortalLoading(true);
    try {
      const accessToken = await getTenantAccessToken(selectedRestaurantId);
      const { url } = await billingApi.openPortal(withOptionalAccessToken(accessToken));
      window.location.href = url;
    } catch (error) {
      console.error("Fehler beim Öffnen des Billing-Portals:", error);
      toast.error("Billing-Portal konnte nicht geöffnet werden");
      setPortalLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-muted/40" />

      <div className="space-y-6">
        <Card className="overflow-hidden border-border/70 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl tracking-tight">Abonnement</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Plan wählen, Checkout starten und Billing verwalten
                  </p>
                </div>
              </div>

              {isActive && subscription?.plan !== "free" ? (
                <Button
                  variant="outline"
                  onClick={handlePortal}
                  disabled={portalLoading || !selectedRestaurantId}
                >
                  {portalLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Billing verwalten
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="max-w-sm space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Restaurant
              </label>
              {loadingRestaurants ? (
                <Skeleton className="h-10 w-full rounded-md" />
              ) : (
                <Select
                  value={selectedRestaurantId}
                  onValueChange={setSelectedRestaurantId}
                  disabled={restaurants.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Restaurant auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                        {restaurant.is_suspended ? " (deaktiviert)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
          <>
            <Card className="border-border/70 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg">Aktueller Plan</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBilling ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                  </div>
                ) : subscription ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <p className="text-2xl font-bold capitalize">{currentTier}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {isActive ? "Aktiv" : subscription.status}
                      </span>
                      {subscription.current_period_end ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Nächste Abrechnung:{" "}
                          {new Date(subscription.current_period_end).toLocaleDateString("de-DE")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Keine Abonnementdaten verfügbar.
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {loadingBilling
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="border-border/70 bg-card/80">
                      <CardContent className="space-y-3 p-5">
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))
                : plans.map((plan) => {
                    const isCurrent = currentTier === plan.id;
                    const isUpgrade =
                      tierOrder.indexOf(plan.id) > tierOrder.indexOf(currentTier);
                    const isDowngrade =
                      tierOrder.indexOf(plan.id) < tierOrder.indexOf(currentTier);

                    return (
                      <Card
                        key={plan.id}
                        className={`border-border/70 bg-card/80 ${
                          isCurrent ? "ring-1 ring-primary/60" : ""
                        }`}
                      >
                        <CardContent className="flex h-full flex-col p-5">
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold">{plan.name}</h3>
                            <p className="mt-1 text-3xl font-bold">
                              {plan.price === 0 ? "Kostenlos" : `€${plan.price.toFixed(0)}`}
                              {plan.price > 0 ? (
                                <span className="ml-1 text-sm font-normal text-muted-foreground">
                                  /Monat
                                </span>
                              ) : null}
                            </p>
                          </div>

                          <ul className="mb-4 flex-1 space-y-2">
                            {plan.features.map((feature) => (
                              <li key={feature} className="flex items-start gap-2 text-sm">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                                <span className="text-muted-foreground">{feature}</span>
                              </li>
                            ))}
                          </ul>

                          {isCurrent ? (
                            <Button variant="outline" disabled className="w-full">
                              Aktueller Plan
                            </Button>
                          ) : plan.id === "free" ? (
                            <Button variant="outline" disabled={isDowngrade} className="w-full">
                              {isDowngrade ? "Downgrade" : "Kostenlos"}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleCheckout(plan.id)}
                              disabled={checkoutLoading === plan.id || isDowngrade}
                              className="w-full"
                            >
                              {checkoutLoading === plan.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Wird geladen...
                                </>
                              ) : isUpgrade ? (
                                "Upgrade"
                              ) : (
                                "Auswählen"
                              )}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
