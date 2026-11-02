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
                  color: "#0B6E4F",
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
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 500 }}>
            <div style={{ display: "flex", fontSize: 52, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
            {description ? (
              <div
                style={{
                  display: "flex",
                  marginTop: 16,
                  fontSize: 24,
                  lineHeight: 1.35,
                  color: "rgba(255,255,255,0.9)",
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
            <div style={{ display: "flex", fontSize: 20, color: "rgba(255,255,255,0.82)" }}>{host}</div>
          </div>
        </div>
        <div style={{ display: "flex", width: 600, height: 630, background: "#0B6E4F" }}>
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" src={banner} width={600} height={630} style={{ width: 600, height: 630, objectFit: "cover" }} />
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
