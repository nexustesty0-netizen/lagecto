import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth/session";

export default async function AppRedirectPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "shop_owner") redirect("/shop");
  redirect("/customer");
}
