import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { money } from "@/lib/format";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ReviewForm } from "@/components/customer/ReviewForm";
import { BookingForm, RequestForm, SaveShopButton } from "@/components/customer/ShopActions";
import { MessageShopButton } from "@/components/chat/MessageShopButton";
import { storefrontPath } from "@/lib/storefront/paths";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { getPublicShop, getPublicShopProducts } from "@/lib/public-catalog";

export default async function ShopDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireRole("customer");
  const shop = await getPublicShop(id);
  if (!shop) notFound();
  if (shop.slug) redirect(storefrontPath(shop.slug));
  const supabase = await createServerSupabase();
  const [products, { data: reviews }, { data: saved }] = await Promise.all([
    getPublicShopProducts(shop.id),
    supabase.from("ratings").select("id, rating, review, reviewer_name, created_at").eq("shop_id", shop.id).eq("is_hidden", false).order("created_at", { ascending: false }).limit(10),
    supabase.from("saved_shops").select("shop_id").eq("user_id", profile.id).eq("shop_id", shop.id).maybeSingle(),
  ]);
  const services = products.filter((row) => row.type === "service").map((row) => ({ id: row.id, name: row.name }));

  return (
    <>
      <PageHeader
        title={shop.name}
        subtitle={shop.about || shop.category}
        action={
          <div className="flex flex-wrap gap-2">
            <SaveShopButton shopId={shop.id} saved={Boolean(saved)} />
            <MessageShopButton shopId={shop.id} shopName={shop.name} loggedIn />
          </div>
        }
      />
      <div className="mb-6 grid gap-3 rounded-2xl bg-white p-5 text-sm text-[#6B7280] sm:grid-cols-2">
        <p>{shop.address || "No address listed"}</p>
        <p>{shop.phone || shop.email}</p>
        <p>Pickup: {shop.is_pickup_only ? "Pickup only" : shop.delivery_time}</p>
        <p>
          <VerifiedBadge verified={shop.verification_status === "verified"} />
        </p>
      </div>
      <h2 className="mb-3 text-lg font-semibold">Products & services</h2>
      {!products.length ? (
        <EmptyState title="Nothing listed yet" body="This shop has not published products or services." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article key={product.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm text-[#6B7280]">{product.description}</p>
              <p className="mt-2 font-semibold text-[#0B6E4F]">{money(product.price)}</p>
              <AddToCartButton
                product={{
                  productId: product.id,
                  shopId: shop.id,
                  shopName: shop.name,
                  name: product.name,
                  price: Number(product.price),
                  image: product.image,
                  type: product.type === "service" ? "service" : "product",
                  availability: product.availability === "on_order" ? "on_order" : "available",
                  stock: product.stock,
                }}
              />
              <div className="mt-3">
                <MessageShopButton
                  shopId={shop.id}
                  shopName={shop.name}
                  productId={product.id}
                  productName={product.name}
                  loggedIn
                  nextPath={`/customer/shops/${shop.id}`}
                />
              </div>
            </article>
          ))}
        </div>
      )}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Book a service</h2>
      <BookingForm shopId={shop.id} services={services} />
      <h2 className="mb-3 mt-8 text-lg font-semibold">Custom request</h2>
      <RequestForm shopId={shop.id} />
      <h2 className="mb-3 mt-8 text-lg font-semibold">Reviews</h2>
      <ReviewForm shopId={shop.id} defaultName={profile.name || ""} />
      <div className="mt-4 grid gap-3">
        {reviews?.map((review) => (
          <article key={review.id} className="rounded-2xl bg-white p-4">
            <p className="font-semibold">{review.reviewer_name || "Guest"} · {review.rating}/5</p>
            <p className="text-sm text-[#6B7280]">{review.review}</p>
          </article>
        ))}
      </div>
    </>
  );
}
