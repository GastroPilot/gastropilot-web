import type { AdminTenant } from "@/lib/api/admin";

const ADMIN_RESTAURANT_COOKIE_NAME = "gp_admin_restaurant_id";
const ADMIN_RESTAURANT_EVENT = "gp-admin-restaurant-changed";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function parseCookie(cookieName: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${cookieName}=`;
  const rawParts = document.cookie.split(";");

  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;

    const value = trimmed.slice(prefix.length);
    if (!value) return null;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function dispatchPreferenceChange(restaurantId: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<string | null>(ADMIN_RESTAURANT_EVENT, {
      detail: restaurantId,
    })
  );
}

export function getPreferredAdminRestaurantId(): string | null {
  return parseCookie(ADMIN_RESTAURANT_COOKIE_NAME);
}

export function setPreferredAdminRestaurantId(restaurantId: string | null): void {
  if (typeof document === "undefined") return;

  if (!restaurantId) {
    document.cookie = `${ADMIN_RESTAURANT_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    dispatchPreferenceChange(null);
    return;
  }

  document.cookie = `${ADMIN_RESTAURANT_COOKIE_NAME}=${encodeURIComponent(restaurantId)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  dispatchPreferenceChange(restaurantId);
}

export function resolvePreferredRestaurantId(
  restaurants: AdminTenant[],
  currentId?: string | null
): string {
  if (restaurants.length === 0) return "";

  if (currentId && restaurants.some((restaurant) => restaurant.id === currentId)) {
    return currentId;
  }

  const preferredId = getPreferredAdminRestaurantId();
  if (preferredId && restaurants.some((restaurant) => restaurant.id === preferredId)) {
    return preferredId;
  }

  return restaurants[0].id;
}

export function onPreferredAdminRestaurantChange(
  handler: (restaurantId: string | null) => void
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<string | null>;
    handler(customEvent.detail ?? null);
  };

  window.addEventListener(ADMIN_RESTAURANT_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener(ADMIN_RESTAURANT_EVENT, listener as EventListener);
  };
}
