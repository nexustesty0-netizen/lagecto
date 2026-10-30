import { redirect } from "next/navigation";

export default function SandboxPaymentPage() {
  redirect("/customer/orders");
}
