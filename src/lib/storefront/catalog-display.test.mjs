import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { catalogDeliveryNote, catalogPriceLabel, catalogTimeframeLabel } from "./catalog-display.ts";
import {
  allowsCatalogDeviceImageUpload,
  canonicalFacebookUrlFromOembedHtml,
  embedPlaybackUrl,
  facebookPermalink,
  isCanonicalFacebookVideoUrl,
  isStoredCatalogImage,
  mediaFrameClass,
  parseMediaEmbed,
  validateHeroUrl,
} from "../media.ts";

test("missing prices and service timeframes use storefront fallbacks", () => {
  assert.equal(catalogPriceLabel(0), "Contact shop for pricing");
  assert.equal(catalogPriceLabel(null), "Contact shop for pricing");
  assert.match(catalogPriceLabel(25), /\$25/);
  assert.equal(catalogTimeframeLabel("service", "5 days"), "Estimated completion: 5 days");
  assert.equal(catalogTimeframeLabel("service", "  ", null), "Timeframe provided on enquiry");
  assert.equal(catalogTimeframeLabel("product", "2 days"), "Average delivery: 2 days");
  const details = readFileSync(new URL("../../components/storefront/CatalogItemDetails.tsx", import.meta.url), "utf8");
  assert.match(details, /CatalogBuyBox/);
  assert.match(details, /Related services/);
  assert.match(details, /Breadcrumb/);
  const page = readFileSync(new URL("../../app/s/[slug]/p/[productId]/page.tsx", import.meta.url), "utf8");
  assert.match(page, /CatalogItemDetails/);
  const hero = readFileSync(new URL("../../components/storefront/HeroBackdrop.tsx", import.meta.url), "utf8");
  assert.match(hero, /prefers-reduced-motion/);
  assert.match(hero, /playing=\{!reduceMotion\}/);
  const catalog = readFileSync(new URL("../../components/shop/CatalogManager.tsx", import.meta.url), "utf8");
  assert.match(catalog, /Leave empty to show “Contact shop for pricing”/);
  assert.match(catalog, /price: Number\(editing.price \|\| 0\)/);
  assert.doesNotMatch(catalog, /price: kind === "product" \? Number\(editing.price/);
});

test("delivery note uses the item delivery, then the shop delivery", () => {
  assert.equal(catalogDeliveryNote(null, "2 days"), "Average delivery: 2 days");
  assert.equal(catalogDeliveryNote("  ", "2 days"), "Average delivery: 2 days");
  assert.equal(catalogDeliveryNote("45 minutes", "2–3 days"), "Average delivery: 45 minutes");
  assert.equal(catalogDeliveryNote("2 days", "3 days", true), "Pickup only");
  assert.equal(catalogDeliveryNote("  ", "  "), null);
  const field = readFileSync(new URL("../../components/media/MediaField.tsx", import.meta.url), "utf8");
  assert.match(field, /purpose === "video"/);
  assert.match(field, /purpose === "blog"/);
  assert.match(field, /canUpload = allowUpload \?\? !urlOnly/);
  assert.doesNotMatch(field, /video\/mp4/);
  const uploads = readFileSync(new URL("../../app/api/uploads/route.ts", import.meta.url), "utf8");
  assert.match(uploads, /purpose === "video"/);
  assert.match(uploads, /purpose === "blog"/);
  assert.match(uploads, /Videos must be added as a Facebook, Instagram, YouTube, or TikTok URL/);
  assert.match(uploads, /Blog and vlog media must be an image URL/);
  const blogManager = readFileSync(new URL("../../components/shop/BlogManager.tsx", import.meta.url), "utf8");
  assert.match(blogManager, /Image URL/);
  assert.match(blogManager, /Video URL/);
  assert.doesNotMatch(blogManager, /type="file"/);
  assert.doesNotMatch(blogManager, /Upload from this device/);
  assert.doesNotMatch(blogManager, /MediaField/);
  const projectManager = readFileSync(new URL("../../components/shop/ProjectManager.tsx", import.meta.url), "utf8");
  assert.match(projectManager, /Image URL/);
  assert.match(projectManager, /Video URL/);
  assert.doesNotMatch(projectManager, /type="file"/);
  assert.doesNotMatch(projectManager, /Upload from this device/);
  assert.doesNotMatch(projectManager, /MediaField/);
  const preview = readFileSync(new URL("../../components/media/MediaPreview.tsx", import.meta.url), "utf8");
  assert.match(preview, /Media unavailable/);
  assert.doesNotMatch(preview, /Open on \$\{label\}/);
  assert.doesNotMatch(preview, /target="_blank"/);
});

test("youtube videos embed on youtube.com so they can play in page", () => {
  const media = parseMediaEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(media?.provider, "youtube");
  assert.ok(media?.embed);
  assert.match(media.embed, /https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ/);
  assert.doesNotMatch(media.embed, /youtube-nocookie/);
  const playing = embedPlaybackUrl(media.embed, "youtube", true, true, true);
  assert.match(playing, /autoplay=1/);
  assert.match(playing, /mute=1/);
  assert.match(playing, /enablejsapi=1/);
  assert.match(playing, /controls=0/);
  const tiktok = embedPlaybackUrl("https://www.tiktok.com/player/v1/7123456789012345678", "tiktok", true, true, true);
  assert.match(tiktok, /autoplay=1/);
  assert.match(tiktok, /force_muted=1/);
  assert.match(tiktok, /controls=0/);
  const facebook = embedPlaybackUrl(
    "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%2F%3Fv%3D1",
    "facebook",
    true,
    true,
  );
  assert.match(facebook, /autoplay=true/);
  assert.match(facebook, /mute=1/);
});

test("storefront video iframes are not sandboxed", () => {
  const preview = readFileSync(new URL("../../components/media/MediaPreview.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(preview, /sandbox=/);
  assert.match(preview, /clipboard-write/);
  const cards = readFileSync(new URL("../../components/storefront/PricedProductCard.tsx", import.meta.url), "utf8");
  assert.match(cards, /catalogTimeframeLabel\(product\.type, product\.duration/);
  assert.doesNotMatch(cards, /money\(product\.duration\)/);
  const hotspot = readFileSync(new URL("../../components/media/MediaClick.tsx", import.meta.url), "utf8");
  assert.match(hotspot, /<Link href=\{href\}/);
  assert.doesNotMatch(hotspot, /target="_blank"/);
});

test("facebook videos use the public video plugin, not a sandboxed post card", () => {
  const media = parseMediaEmbed("https://www.facebook.com/watch/?v=1234567890");
  assert.equal(media?.provider, "facebook");
  assert.match(media?.embed || "", /plugins\/video\.php/);
  assert.match(media?.embed || "", /href=/);
  assert.match(decodeURIComponent(media?.embed || ""), /watch\/\?v=1234567890/);
  const page = parseMediaEmbed("https://m.facebook.com/facebook/videos/10153231379946729/?mibextid=abc");
  assert.equal(page?.href, "https://www.facebook.com/facebook/videos/10153231379946729/");
  assert.match(decodeURIComponent(page?.embed || ""), /facebook\/videos\/10153231379946729/);
});

test("facebook share links wait for a canonical permalink instead of the raw share URL", () => {
  const share = parseMediaEmbed("https://www.facebook.com/share/v/19AbCdEfGh/");
  assert.equal(share?.provider, "facebook");
  assert.equal(share?.href, "https://www.facebook.com/share/v/19AbCdEfGh/");
  assert.equal(isCanonicalFacebookVideoUrl(share?.href || ""), false);
  assert.equal(isCanonicalFacebookVideoUrl("https://www.facebook.com/facebook/videos/10153231379946729/"), true);
  const html =
    '<div class="fb-video" data-href="https://www.facebook.com/share/v/19AbCdEfGh/"><blockquote cite="https://www.facebook.com/facebook/videos/10153231379946729/"></blockquote></div>';
  assert.equal(canonicalFacebookUrlFromOembedHtml(html), "https://www.facebook.com/facebook/videos/10153231379946729/");
  assert.equal(facebookPermalink("https://web.facebook.com/share/v/19AbCdEfGh/?mibextid=wwXIfr"), "https://www.facebook.com/share/v/19AbCdEfGh/");
  const preview = readFileSync(new URL("../../components/media/MediaPreview.tsx", import.meta.url), "utf8");
  assert.match(preview, /FacebookEmbed/);
  assert.doesNotMatch(preview, /sandbox=/);
});

test("tiktok videos use the in-page player", () => {
  const media = parseMediaEmbed("https://www.tiktok.com/@shop/video/7123456789012345678");
  assert.equal(media?.provider, "tiktok");
  assert.match(media?.embed || "", /tiktok\.com\/player\/v1\/7123456789012345678/);
});

test("device catalog photos count stored files and respect package caps", () => {
  assert.equal(
    isStoredCatalogImage("https://example.supabase.co/storage/v1/object/public/product-media/shop/products/a.jpg"),
    true,
  );
  assert.equal(isStoredCatalogImage("https://cdn.example.com/photo.jpg"), false);
  assert.equal(allowsCatalogDeviceImageUpload({ limit: 4, used: 4, currentUrl: null }), false);
  assert.equal(
    allowsCatalogDeviceImageUpload({
      limit: 4,
      used: 4,
      currentUrl: "https://example.supabase.co/storage/v1/object/public/product-media/shop/products/a.jpg",
    }),
    true,
  );
  assert.equal(allowsCatalogDeviceImageUpload({ limit: null, used: 40, currentUrl: null }), true);
});

test("page heroes accept image and video URLs", () => {
  const image = validateHeroUrl("https://cdn.example.com/hero.jpg");
  assert.equal(image.ok, true);
  const youtube = validateHeroUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(youtube.ok, true);
  const tiktok = validateHeroUrl("https://www.tiktok.com/@shop/video/7123456789012345678");
  assert.equal(tiktok.ok, true);
  const fileVideo = validateHeroUrl("https://cdn.example.com/hero.mp4");
  assert.equal(fileVideo.ok, true);
  const bad = validateHeroUrl("not-a-url");
  assert.equal(bad.ok, false);
});

test("instagram reels and facebook share links embed in page", () => {
  const reel = parseMediaEmbed("https://www.instagram.com/reel/DaAOb8LNtAF/?igsh=abc");
  assert.equal(reel?.provider, "instagram");
  assert.equal(reel?.aspect, "portrait");
  assert.match(reel?.embed || "", /instagram\.com\/reel\/DaAOb8LNtAF\/embed/);
  assert.match(reel?.embed || "", /hidecaption=1/);
  const post = parseMediaEmbed("https://www.instagram.com/p/DaAOb8LNtAF/");
  assert.equal(post?.provider, "instagram");
  assert.equal(post?.aspect, "post");
  const playing = embedPlaybackUrl(reel?.embed || "", "instagram", true, true);
  assert.match(playing, /hidecaption=1/);
  const share = parseMediaEmbed("https://www.facebook.com/share/v/19AbCdEfGh/");
  assert.equal(share?.provider, "facebook");
  const shorts = parseMediaEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ");
  assert.equal(shorts?.provider, "youtube");
  assert.equal(shorts?.aspect, "portrait");
  const preview = readFileSync(new URL("../../components/media/embed-frame.ts", import.meta.url), "utf8");
  assert.match(preview, /pointer-events-none/);
  assert.match(preview, /Scale it to the 4:5 frame so the photo fills edge to edge/);
  assert.match(preview, /100cqw\/540px/);
  assert.match(preview, /540px\*5\/4/);
  const mediaShell = readFileSync(new URL("../../components/media/MediaPreview.tsx", import.meta.url), "utf8");
  assert.match(mediaShell, /@container overflow-hidden/);
  assert.match(preview, /from the top of the reel/);
  assert.match(preview, /-top-12 w-full min-w-full aspect-\[9\/16\]/);
  const mediaPreview = readFileSync(new URL("../../components/media/MediaPreview.tsx", import.meta.url), "utf8");
  assert.match(mediaPreview, /object-contain/);
  assert.match(mediaPreview, /aria-label="Play video"/);
  assert.match(mediaPreview, /tapIframe/);
  assert.doesNotMatch(mediaPreview, /inset-y-0 left-1\/2 h-full aspect-\[9\/16\]/);
  assert.match(mediaPreview, /kickEmbedPlayback/);
  assert.match(mediaPreview, /playVideo/);
  assert.match(mediaPreview, /aspect === "post" \|\| media.media === "image"\) return "aspect-\[4\/5\] w-full"/);
  assert.match(mediaPreview, /photoClass\("cover"/);
  assert.doesNotMatch(mediaPreview, /aspect-\[9\/16\] w-full max-h-\[720px\]/);
  assert.match(mediaFrameClass("https://www.instagram.com/reel/DaAOb8LNtAF/"), /aspect-video/);
  assert.match(mediaFrameClass("https://www.youtube.com/shorts/dQw4w9WgXcQ"), /aspect-video/);
  assert.match(mediaFrameClass("https://www.instagram.com/p/DaAOb8LNtAF/"), /4\/5/);
  assert.match(mediaFrameClass("https://cdn.example.com/photo.jpg"), /4\/5/);
  assert.match(mediaFrameClass("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), /aspect-video/);
  const projects = readFileSync(new URL("../../app/s/[slug]/projects/page.tsx", import.meta.url), "utf8");
  assert.match(projects, /mediaFrameClass/);
  assert.doesNotMatch(projects, /h-52 w-full/);
  const blog = readFileSync(new URL("../../app/s/[slug]/blog/page.tsx", import.meta.url), "utf8");
  assert.match(blog, /mediaFrameClass/);
  assert.doesNotMatch(blog, /h-64 w-full/);
  assert.doesNotMatch(blog, /h-48 w-full/);
  const blogPost = readFileSync(new URL("../../app/s/[slug]/blog/[postId]/page.tsx", import.meta.url), "utf8");
  assert.match(blogPost, /mediaFrameClass/);
  const vlog = readFileSync(new URL("../../components/storefront/StorefrontVideo.tsx", import.meta.url), "utf8");
  assert.match(vlog, /mediaFrameClass/);
  const facebookEmbed = readFileSync(new URL("../../components/media/FacebookEmbed.tsx", import.meta.url), "utf8");
  assert.match(facebookEmbed, /absolute inset-0 z-\[3\]/);
  const backdrop = readFileSync(new URL("../../components/storefront/HeroBackdrop.tsx", import.meta.url), "utf8");
  assert.match(backdrop, /playing=\{!reduceMotion\}/);
  assert.match(backdrop, /\bmuted\b/);
  const field = readFileSync(new URL("../../components/media/MediaField.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(field, /isVideo \? "aspect-video/);
});
