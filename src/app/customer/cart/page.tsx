import { PageHeader } from "@/components/ui/primitives";
import { CartClient } from "@/components/cart/CartClient";

export default function CartPage() {
  return (
    <>
      <PageHeader title="Cart" subtitle="Checkout via WhatsApp. You can order without an account if you add your name." />
      <CartClient />
    </>
  );
}
