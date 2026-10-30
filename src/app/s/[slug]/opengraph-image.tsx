import { ImageResponse } from "next/og";
import { BRAND, CONTACT } from "@/lib/brand";
import { getStorefrontOgShop, imageDataUrl, storefrontOgDescription } from "@/lib/storefront/og";
import { titleCase } from "@/lib/format";

export const alt = "Shop on LaGecto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getStorefrontOgShop(slug);
  const name = shop?.name || "Shop";
  const description = shop ? storefrontOgDescription(shop) : `Find shops on ${BRAND.name}.`;
  const kicker = shop?.category ? titleCase(shop.category) : "Storefront";
  const [banner, logo] = await Promise.all([imageDataUrl(shop?.banner_url), imageDataUrl(shop?.logo_url)]);
  const host = CONTACT.website.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          background: "linear-gradient(135deg, #04180F 0%, #0B6E4F 48%, #2E8B57 100%)",
          color: "#FFFFFF",
        }}
      >
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            src={banner}
            width={1200}
            height={630}
            style={{ position: "absolute", left: 0, top: 0, width: 1200, height: 630, objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            background: banner
              ? "linear-gradient(90deg, rgba(4,24,15,0.88) 0%, rgba(11,110,79,0.58) 58%, rgba(4,24,15,0.28) 100%)"
              : "transparent",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 72,
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                src={logo}
                width={88}
                height={88}
                style={{ width: 88, height: 88, borderRadius: 24, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: 88,
                  height: 88,
                  borderRadius: 24,
                  background: "#D4AF37",
                  color: "#04180F",
                  fontSize: 40,
                  fontWeight: 700,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div
              style={{
                display: "flex",
                marginLeft: 24,
                fontSize: 26,
                letterSpacing: 5,
                fontWeight: 700,
                color: "#D4AF37",
              }}
            >
              {BRAND.name.toUpperCase()}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 940 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
            {description ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  fontSize: 28,
                  lineHeight: 1.35,
                  color: "rgba(255,255,255,0.9)",
                  maxWidth: 860,
                }}
              >
                {description}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                fontSize: 22,
              }}
            >
              {kicker}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.82)" }}>{host}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
