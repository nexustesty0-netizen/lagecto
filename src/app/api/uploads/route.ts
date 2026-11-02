import { NextResponse } from "next/server";
import { clientIp } from "@/lib/format";
import { requireApiProfile, requireApiShopManage } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/service";
import { getShopSubscription } from "@/lib/entitlements";
import { catalogDeviceImageLimit, catalogDeviceImageMessage } from "@/lib/packages";
import {
  allowsCatalogDeviceImageUpload,
  countStoredCatalogImages,
  extensionOf,
  safeFileStem,
  validateSniffedUpload,
  validateUpload,
  type MediaKind,
} from "@/lib/media";

const BUCKETS = {
  logo: "shop-media",
  cover: "shop-media",
  product: "product-media",
  media: "storefront-media",
  video: "storefront-media",
  blog: "storefront-media",
  ad: "storefront-media",
  news: "storefront-media",
} as const;

type Purpose = keyof typeof BUCKETS;

function folderFor(purpose: Purpose, shopId: string) {
  if (purpose === "logo") return `${shopId}/logo`;
  if (purpose === "cover") return `${shopId}/cover`;
  if (purpose === "product") return `${shopId}/products`;
  if (purpose === "blog") return `${shopId}/blog`;
  if (purpose === "ad") return `ads/${shopId}`;
  if (purpose === "news") return `news/${shopId}`;
  if (purpose === "video") return `${shopId}/videos`;
  return `${shopId}/gallery`;
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Upload a file." }, { status: 400 });
  const admin = createServiceSupabase();
  const allowed = await admin.rpc("check_auth_rate_limit", {
    p_bucket_key: `upload:${clientIp(request.headers) || "unknown"}`,
    p_max_hits: 30,
    p_window_seconds: 10 * 60,
  });
  if (allowed.data === false) {
    return NextResponse.json({ error: "Too many uploads. Please wait a moment." }, { status: 429 });
  }
  const purpose = String(form.get("purpose") || "") as Purpose;
  if (!BUCKETS[purpose]) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });
  if (purpose === "video") {
    return NextResponse.json(
      { error: "Videos must be added as a Facebook, Instagram, YouTube, or TikTok URL." },
      { status: 400 },
    );
  }
  if (purpose === "blog") {
    return NextResponse.json(
      { error: "Blog and vlog media must be an image URL or a Facebook, Instagram, YouTube, or TikTok URL." },
      { status: 400 },
    );
  }

  const kind: MediaKind = "image";
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });

  const sizeCheck = validateUpload(file, kind);
  if (!sizeCheck.ok) return NextResponse.json({ error: sizeCheck.error }, { status: 400 });

  const buffer = new Uint8Array(await file.arrayBuffer());
  const sniffed = validateSniffedUpload(buffer, file.type, kind);
  if (!sniffed.ok) return NextResponse.json({ error: sniffed.error }, { status: 400 });

  let shopId = "";
  if (purpose === "ad" || purpose === "news") {
    const auth = await requireApiProfile("admin");
    if (!auth.ok) return auth.error;
    shopId = "platform";
  } else {
    const auth = await requireApiShopManage();
    if (!auth.ok) return auth.error;
    shopId = auth.shop.id;
  }

  if (purpose === "product") {
    const subscription = await getShopSubscription(shopId, { expire: false });
    const limit = catalogDeviceImageLimit(subscription.packageKey);
    const { data: rows } = await admin.from("products").select("image").eq("shop_id", shopId);
    const withinQuota = allowsCatalogDeviceImageUpload({
      limit,
      used: countStoredCatalogImages((rows || []).map((row) => row.image)),
      currentUrl: String(form.get("currentUrl") || ""),
    });
    if (!withinQuota) {
      return NextResponse.json({ error: catalogDeviceImageMessage(subscription.packageKey) }, { status: 403 });
    }
  }

  const ext = sniffed.mime === "image/jpeg" ? "jpg" : sniffed.mime.split("/")[1] || extensionOf(file.name) || "bin";
  const path = `${folderFor(purpose, shopId)}/${safeFileStem()}.${ext}`;
  const { error } = await admin.storage.from(BUCKETS[purpose]).upload(path, buffer, {
    contentType: sniffed.mime,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: "Unable to store this file." }, { status: 400 });

  const { data } = admin.storage.from(BUCKETS[purpose]).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path, mime: sniffed.mime });
}
