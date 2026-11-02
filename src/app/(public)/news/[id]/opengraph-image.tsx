import { ImageResponse } from "next/og";
import { BRAND, CONTACT } from "@/lib/brand";
import { getNewsOgArticle } from "@/lib/news/og";
import { imageDataUrl } from "@/lib/storefront/og";

export const alt = "LaGecto News";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getNewsOgArticle(id);
  const title = article?.title || "LaGecto News";
  const kicker = article?.category || "Journal";
  const cover = await imageDataUrl(article?.cover_image_url);
  const host = CONTACT.website.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0B6E4F",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 600,
            height: 630,
            padding: 56,
            background: "#0B6E4F",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", letterSpacing: 6, fontSize: 22, fontWeight: 700, color: "#D4AF37" }}>
            {BRAND.name.toUpperCase()} NEWS
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 500 }}>
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: "#D4AF37", textTransform: "uppercase" }}>
              {kicker}
            </div>
            <div style={{ display: "flex", marginTop: 16, fontSize: 44, fontWeight: 700, lineHeight: 1.12 }}>
              {title.length > 90 ? `${title.slice(0, 87)}...` : title}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 20, color: "rgba(255,255,255,0.82)" }}>
            <div style={{ display: "flex" }}>Share this story</div>
            <div style={{ display: "flex" }}>{host}</div>
          </div>
        </div>
        <div style={{ display: "flex", width: 600, height: 630, background: "#0B6E4F" }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={cover} width={600} height={630} style={{ width: 600, height: 630, objectFit: "cover" }} />
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
