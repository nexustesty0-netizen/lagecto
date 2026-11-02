import { createServerSupabase } from "@/lib/supabase/server";
import { loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { FeatureLocked, FeatureHint } from "@/components/shop/FeatureLocked";
import { PageHeader } from "@/components/ui/primitives";
import { StorefrontBuilder } from "@/components/shop/StorefrontBuilder";
import { StorefrontStoryForm } from "@/components/shop/StorefrontStoryForm";
import { ReviewsManager, type ShopReviewRow } from "@/components/shop/ReviewsManager";
import { GalleryManager } from "@/components/shop/GalleryManager";
import { VideoManager } from "@/components/shop/VideoManager";
import { BlogManager } from "@/components/shop/BlogManager";
import { ProjectManager } from "@/components/shop/ProjectManager";
import { FaqManager } from "@/components/shop/FaqManager";
import { ShareStorefrontButton } from "@/components/storefront/ShareStorefrontButton";
import Link from "next/link";

export default async function StorefrontPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const { shop, features } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const supabase = await createServerSupabase();
  const [{ data: config }, { data: media }, { data: videos }, { data: posts }, { data: faqs }, reviewResult, projectsResult] = await Promise.all([
    supabase.from("shop_storefront_config").select("*").eq("shop_id", shop.id).maybeSingle(),
    supabase.from("storefront_media").select("*").eq("shop_id", shop.id).order("sort_order"),
    supabase.from("storefront_videos").select("*").eq("shop_id", shop.id).order("sort_order"),
    supabase.from("storefront_blog_posts").select("*").eq("shop_id", shop.id).order("updated_at", { ascending: false }),
    supabase.from("shop_faq_entries").select("*").eq("shop_id", shop.id).order("sort_order"),
    supabase.from("ratings").select("id, rating, review, reply, reviewer_name, is_hidden, created_at").eq("shop_id", shop.id).order("created_at", { ascending: false }).limit(80),
    supabase.from("storefront_projects").select("*").eq("shop_id", shop.id).order("sort_order"),
  ]);
  const reviews =
    reviewResult.data ||
    (reviewResult.error
      ? (
          await supabase
            .from("ratings")
            .select("id, rating, review, reply, is_hidden, created_at")
            .eq("shop_id", shop.id)
            .order("created_at", { ascending: false })
            .limit(80)
        ).data
      : []);
  const current = tab || "appearance";
  const tabs = [
    { id: "appearance", label: "Appearance" },
    { id: "story", label: "Story & links" },
    { id: "reviews", label: "Reviews" },
    { id: "media", label: "Media" },
    { id: "videos", label: "Videos" },
    ...(shop.provider_type !== "products" ? [{ id: "projects", label: "Projects" }] : []),
    { id: "blog", label: "Blog / Vlog" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <>
      <PageHeader
        title="Storefront"
        subtitle="Build your shop’s mini-website. Colors, logo and cover apply only inside your storefront."
        action={
          shop.slug ? (
            <div className="flex flex-wrap items-center gap-2">
              <ShareStorefrontButton slug={shop.slug} shopName={shop.name} />
              <Link href={`/s/${shop.slug}`} className="rounded-full bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white">
                Preview
              </Link>
            </div>
          ) : null
        }
      />
      <div className="mb-4">
        <FeatureHint feature="digital_storefront" />
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Link
            key={item.id}
            href={`/shop/storefront?tab=${item.id}`}
            className={`rounded-full px-4 py-2 text-sm font-medium ${current === item.id ? "bg-[#0B6E4F] text-white" : "border bg-white"}`}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/shop/products" className="rounded-full border bg-white px-4 py-2 text-sm font-medium">
          Products
        </Link>
        <Link href="/shop/services" className="rounded-full border bg-white px-4 py-2 text-sm font-medium">
          Services
        </Link>
        <Link href="/shop/promotions" className="rounded-full border bg-white px-4 py-2 text-sm font-medium">
          Promotions
        </Link>
      </div>
      {current === "appearance" ? <StorefrontBuilder shop={shop} config={config} /> : null}
      {current === "story" ? <StorefrontStoryForm shop={shop} /> : null}
      {current === "reviews" ? <ReviewsManager reviews={(reviews || []) as ShopReviewRow[]} /> : null}
      {current === "faq" ? <FaqManager shopId={shop.id} faqs={faqs || []} /> : null}
      {current === "media" ? <GalleryManager shopId={shop.id} items={media || []} /> : null}
      {current === "videos" ? (
        features.has("advanced_storefront") ? (
          <VideoManager shopId={shop.id} videos={videos || []} />
        ) : (
          <FeatureLocked feature="advanced_storefront" />
        )
      ) : null}
      {current === "projects" && shop.provider_type !== "products" ? (
        <ProjectManager shopId={shop.id} projects={projectsResult.error ? [] : projectsResult.data || []} />
      ) : null}
      {current === "blog" ? (
        features.has("blogs") ? (
          <BlogManager shopId={shop.id} posts={posts || []} />
        ) : (
          <FeatureLocked feature="blogs" />
        )
      ) : null}
    </>
  );
}
