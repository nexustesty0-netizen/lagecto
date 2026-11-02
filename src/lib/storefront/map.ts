export type GeocodedPlace = {
  lat: number;
  lon: number;
  label: string;
};

export function mapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function appleMapsUrl(address: string) {
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

export function osmSearchUrl(address: string) {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
}

export function osmEmbedUrl(lat: number, lon: number, delta = 0.01) {
  const bbox = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lon}`;
}

async function geocodeOnce(query: string, countryCodes = "zw"): Promise<GeocodedPlace | null> {
  try {
    const params = new URLSearchParams({ format: "jsonv2", limit: "1", q: query });
    if (countryCodes) params.set("countrycodes", countryCodes);
    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LaGecto Storefront/1.0 (https://lagecto.co.zw)",
      },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = rows[0];
    const lat = Number(first?.lat);
    const lon = Number(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, label: first.display_name || query };
  } catch {
    return null;
  }
}

export function normalizeShopAddress(address: string) {
  return String(address || "")
    .replace(/\bBulawyo\b/gi, "Bulawayo")
    .replace(/\bByo\b/gi, "Bulawayo")
    .replace(/\bHarere\b/gi, "Harare")
    .replace(/\s+/g, " ")
    .trim();
}

export async function geocodeShopAddress(address: string): Promise<GeocodedPlace | null> {
  const query = normalizeShopAddress(address);
  if (query.length < 4) return null;
  const direct = await geocodeOnce(query);
  if (direct) return direct;
  if (!/zimbabwe|bulawayo|harare/i.test(query)) {
    const biased = await geocodeOnce(`${query}, Zimbabwe`);
    if (biased) return biased;
  }
  return geocodeOnce(query, "");
}

export function mapEmbedSrc(_address: string, place?: GeocodedPlace | null) {
  if (place) return osmEmbedUrl(place.lat, place.lon);
  return null;
}
