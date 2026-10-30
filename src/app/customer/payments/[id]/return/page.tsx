import { redirect } from "next/navigation";

export default function PaymentReturnPage() {
  redirect("/customer/orders");
}
