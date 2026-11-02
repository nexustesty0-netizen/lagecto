import { MapPin } from "lucide-react";
import { appleMapsUrl, geocodeShopAddress, mapEmbedSrc, mapsSearchUrl, osmSearchUrl } from "@/lib/storefront/map";

export async function StorefrontLocation({
  address,
  shopName,
  phone,
  email,
  embedded = false,
}: {
  address?: string | null;
  shopName: string;
  phone?: string | null;
  email?: string | null;
  embedded?: boolean;
}) {
  const place = address ? await geocodeShopAddress(address) : null;
  const embed = address ? mapEmbedSrc(address, place) : null;
  return (
    <section className={embedded ? "mt-8" : "mx-auto max-w-6xl px-4 pb-16"}>
      <div className="sf-card overflow-hidden">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--sf-primary)" }}>
              Find us
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Visit {shopName}</h2>
            <p className="mt-3 flex items-start gap-2 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
              <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: "var(--sf-primary)" }} />
              <span>{address || "Address not listed yet"}</span>
            </p>
            {phone ? <p className="mt-2 text-sm">{phone}</p> : null}
            {email ? <p className="mt-1 text-sm">{email}</p> : null}
            {address ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={mapsSearchUrl(address)} target="_blank" rel="noreferrer" className="sf-btn text-sm">
                  Open in Google Maps
                </a>
                <a href={appleMapsUrl(address)} target="_blank" rel="noreferrer" className="sf-btn-ghost text-sm">
                  Apple Maps
                </a>
                <a href={osmSearchUrl(address)} target="_blank" rel="noreferrer" className="sf-btn-ghost text-sm">
                  OpenStreetMap
                </a>
              </div>
            ) : null}
          </div>
          {embed ? (
            <div className="min-h-[260px] bg-[color-mix(in_srgb,var(--sf-primary)_8%,transparent)] lg:min-h-[320px]">
              <iframe
                title={`${shopName} map`}
                src={embed}
                className="h-full min-h-[260px] w-full border-0 lg:min-h-[320px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="grid min-h-[220px] place-items-center p-8 text-sm" style={{ color: "var(--sf-muted)" }}>
              {address ? "Open the map links to get directions." : "Add an address to show a live map preview here."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
