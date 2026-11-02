import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { getOwnedShop } from "@/lib/auth/session";
import { getShopFeatureState } from "@/lib/entitlements";
import { ErrorBanner } from "@/components/ui/primitives";
import { StaffRouteGuard } from "@/components/shop/StaffRouteGuard";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Shop",
};

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { profile, shop, staffRole } = await getOwnedShop();
  const features = shop ? await getShopFeatureState(shop.id) : null;
  return (
    <AppShell
      profile={profile}
      shopName={shop?.name}
      shopProviderType={shop?.provider_type}
      staffRole={staffRole}
      shopFeatures={features ? [...features.features] : undefined}
      shopDisabledFeatures={features?.disabled}
    >
      <StaffRouteGuard role={staffRole} />
      {!shop ? (
        <ErrorBanner message="No shop is assigned to this account. Contact LaGecto Support." />
      ) : null}
      <div className="shop-os">{children}</div>
    </AppShell>
  );
}
