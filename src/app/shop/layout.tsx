import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { getOwnedShop } from "@/lib/auth/session";
import { ErrorBanner } from "@/components/ui/primitives";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Shop",
};

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { profile, shop } = await getOwnedShop();
  return (
    <AppShell profile={profile} shopName={shop?.name} shopProviderType={shop?.provider_type}>
      {!shop ? (
        <ErrorBanner message="No shop is assigned to this account. Contact LaGecto Support." />
      ) : null}
      {children}
    </AppShell>
  );
}
