import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";

export default async function CustomerPaymentsPage() {
  await requireRole("customer");
  redirect("/customer/orders");
}
