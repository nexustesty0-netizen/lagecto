import { PageHeader } from "@/components/ui/primitives";
import { CartClient } from "@/components/cart/CartClient";

export default function CartPage() {
  return (
    <>
      <PageHeader
        title="Shopping cart"
        subtitle="Review items, then check out with each shop."
      />
      <CartClient />
    </>
  );
}
