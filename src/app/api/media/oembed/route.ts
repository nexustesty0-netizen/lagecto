import { NextResponse } from "next/server";
import { resolveFacebookPlayer } from "@/lib/meta-oembed";
import { parseMediaEmbed } from "@/lib/media";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") || "";
  const media = parseMediaEmbed(url);
  if (!media || media.provider !== "facebook") {
    return NextResponse.json({ error: "Use a Facebook video URL." }, { status: 400 });
  }
  const plan = await resolveFacebookPlayer(url);
  if (!plan) return NextResponse.json({ mode: "link", href: media.href });
  return NextResponse.json(plan, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
