import { adminTenantsApi, type AdminTenant } from "@/lib/api/admin";
import { adminRestaurantsApi, type AdminRestaurant } from "@/lib/api/admin-restaurants";
import { isPlatformAdminRole } from "@/lib/admin-access";

function toAdminTenantShape(restaurant: AdminRestaurant): AdminTenant {
  return {
    id: restaurant.id,
    name: restaurant.name,
    slug: restaurant.slug,
    address: restaurant.address,
    phone: restaurant.phone,
    email: restaurant.email,
    description: restaurant.description,
    is_suspended: false,
    subscription_status: null,
    subscription_tier: null,
    settings: restaurant.settings,
    created_at: null,
    updated_at: null,
  };
}

export async function listAccessibleRestaurants(
  role: string | null | undefined
): Promise<AdminTenant[]> {
  if (!role) return [];

  if (isPlatformAdminRole(role)) {
    return adminTenantsApi.list();
  }

  const restaurants = await adminRestaurantsApi.list();
  return restaurants.map(toAdminTenantShape);
}

export async function getRestaurantAccessToken(
  role: string | null | undefined,
  restaurantId: string
): Promise<string | undefined> {
  if (!isPlatformAdminRole(role)) {
    return undefined;
  }

  const session = await adminTenantsApi.impersonate(restaurantId);
  return session.impersonation_token;
}

export function withOptionalAccessToken(accessToken: string | undefined): {
  accessToken?: string;
} {
  return accessToken ? { accessToken } : {};
}
