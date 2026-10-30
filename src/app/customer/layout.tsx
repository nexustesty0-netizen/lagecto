import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Customer",
};

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRole("customer");
  return <AppShell profile={profile}>{children}</AppShell>;
}
