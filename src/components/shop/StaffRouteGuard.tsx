"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { staffHome, staffPathAllowed, type ShopStaffRole } from "@/lib/shop/staff";

export function StaffRouteGuard({ role }: { role: ShopStaffRole | null | undefined }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!role || role === "owner" || role === "admin") return;
    if (staffPathAllowed(role, pathname)) return;
    router.replace(staffHome(role));
  }, [pathname, role, router]);

  return null;
}
