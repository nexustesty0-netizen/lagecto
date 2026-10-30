import { getOwnedShop } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";

export default async function ShopPaymentsPage() {
  await getOwnedShop();
  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="LaGecto does not collect customer checkout payments. Payment is arranged directly with the customer on WhatsApp."
      />
      <article className="lg-card p-5">
        <p className="font-semibold">Checkout via WhatsApp</p>
        <p className="mt-2 text-sm text-[#6B7280]">
          When a customer places an order, they are sent to your shop WhatsApp number with the order details. Confirm
          the order there and tell them how to pay. In-person till sales remain cash only under Point of sale.
        </p>
        <p className="mt-3 text-sm text-[#6B7280]">
          Online card collection can be added later without rebuilding orders. Keep your WhatsApp number up to date in
          Settings.
        </p>
      </article>
    </>
  );
}
