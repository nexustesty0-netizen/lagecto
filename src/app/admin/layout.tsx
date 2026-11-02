import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AdminRouteGuard } from "@/components/admin/AdminRouteGuard";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Admin",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("admin");
  return (
    <AppShell profile={profile}>
      <AdminRouteGuard profile={profile} />
      {children}
    </AppShell>
  );
}
