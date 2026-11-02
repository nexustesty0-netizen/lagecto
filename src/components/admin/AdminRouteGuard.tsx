"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { adminPathAllowed } from "@/lib/admin-access";
import type { Profile } from "@/lib/types";

export function AdminRouteGuard({ profile }: { profile: Pick<Profile, "admin_role" | "email"> }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (adminPathAllowed(profile, pathname)) return;
    router.replace("/403");
  }, [pathname, profile, router]);

  return null;
}
