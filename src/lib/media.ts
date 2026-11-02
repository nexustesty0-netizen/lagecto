const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXT = new Set(["mp4", "webm"]);

export const MAX_IMAGE_BYTES = 1 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
export const IMAGE_SIZE_HINT = "Images must be 1MB or smaller.";

const PRIVATE_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.0\.0\.0|\[::1\]|169\.254\.)/i;

export type MediaKind = "image" | "video";

export function extensionOf(name: string) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

export function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const tag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (tag === "WEBP") return "image/webp";
  }
  if (bytes.length >= 6) {
    const gif = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
    if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12) {
    const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    if (box === "ftyp") return "video/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}

export function validateUpload(file: File, kind: MediaKind) {
  const max = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0 || file.size > max) {
    return { ok: false as const, error: kind === "video" ? "Video must be 40MB or smaller." : "Image must be 1MB or smaller." };
  }
  const ext = extensionOf(file.name);
  const allowedExt = kind === "video" ? VIDEO_EXT : IMAGE_EXT;
  if (!allowedExt.has(ext)) {
    return { ok: false as const, error: "That file type is not allowed." };
  }
  return { ok: true as const, ext };
}

export function validateSniffedUpload(bytes: Uint8Array, declaredType: string, kind: MediaKind) {
  const sniffed = sniffMime(bytes);
  const allowed = kind === "video" ? VIDEO_MIMES : IMAGE_MIMES;
  if (!sniffed || !allowed.has(sniffed)) {
    return { ok: false as const, error: "The file contents do not match a supported image or video type." };
  }
  if (declaredType && declaredType !== "application/octet-stream" && declaredType !== sniffed) {
    if (!(declaredType === "image/jpg" && sniffed === "image/jpeg")) {
      return { ok: false as const, error: "The file type does not match its contents." };
    }
  }
  return { ok: true as const, mime: sniffed };
}

export function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  return PRIVATE_HOSTS.test(host);
}

export function parsePublicHttpsUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false as const, error: "Enter a valid URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false as const, error: "Only HTTPS URLs are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false as const, error: "URLs cannot include credentials." };
  }
  if (isPrivateHostname(url.hostname)) {
    return { ok: false as const, error: "That host is not allowed." };
  }
  return { ok: true as const, url };
}

const YT_ID = /^[a-zA-Z0-9_-]{11}$/;
const IG_CODE = /^[A-Za-z0-9_-]+$/;
const TIKTOK_ID = /^\d{5,}$/;

export type MediaProvider = "youtube" | "vimeo" | "instagram" | "tiktok" | "facebook" | "file";
export type MediaAspect = "landscape" | "portrait" | "post" | "auto";

export type ParsedMedia = {
  provider: MediaProvider;
  href: string;
  embed: string | null;
  media: "image" | "video";
  aspect: MediaAspect;
};

export type VideoSource =
  | { kind: "youtube"; href: string; embed: string }
  | { kind: "vimeo"; href: string; embed: string }
  | { kind: "instagram"; href: string; embed: string }
  | { kind: "tiktok"; href: string; embed: string }
  | { kind: "facebook"; href: string; embed: string }
  | { kind: "file"; href: string };

function hostOf(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function pathParts(url: URL) {
  return url.pathname.split("/").filter(Boolean);
}

function youtubeId(url: URL): string | null {
  const host = hostOf(url);
  if (host === "youtu.be") {
    const id = pathParts(url)[0] || "";
    return YT_ID.test(id) ? id : null;
  }
  if (
    host !== "youtube.com" &&
    host !== "m.youtube.com" &&
    host !== "music.youtube.com" &&
    host !== "youtube-nocookie.com"
  ) {
    return null;
  }
  const fromQuery = url.searchParams.get("v") || "";
  if (YT_ID.test(fromQuery)) return fromQuery;
  const parts = pathParts(url);
  if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
    const id = (parts[1] || "").split("?")[0];
    return YT_ID.test(id) ? id : null;
  }
  return null;
}

function youtubeEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

function instagramEmbed(url: URL): string | null {
  const host = hostOf(url);
  if (host !== "instagram.com" && host !== "instagr.am" && host !== "m.instagram.com") return null;
  const parts = pathParts(url);
  const typeAt = parts.findIndex((part) => ["p", "reel", "reels", "tv", "share"].includes(part));
  if (typeAt < 0) return null;
  const type = parts[typeAt];
  const next = parts[typeAt + 1] || "";
  const after = parts[typeAt + 2] || "";
  if (type === "share") {
    if (["reel", "reels", "r"].includes(next) && IG_CODE.test(after)) {
      return `https://www.instagram.com/reel/${after}/embed/?hidecaption=1`;
    }
    if (next === "p" && IG_CODE.test(after)) {
      return `https://www.instagram.com/p/${after}/embed/?hidecaption=1`;
    }
    return null;
  }
  if (!IG_CODE.test(next)) return null;
  if (type === "p") return `https://www.instagram.com/p/${next}/embed/?hidecaption=1`;
  if (type === "reel" || type === "reels") return `https://www.instagram.com/reel/${next}/embed/?hidecaption=1`;
  if (type === "tv") return `https://www.instagram.com/tv/${next}/embed/?hidecaption=1`;
  return null;
}

function tiktokId(url: URL): string | null {
  const host = hostOf(url);
  if (host !== "tiktok.com" && host !== "m.tiktok.com" && !host.endsWith(".tiktok.com")) return null;
  const fromQuery = url.searchParams.get("item_id") || "";
  if (TIKTOK_ID.test(fromQuery)) return fromQuery;
  const parts = pathParts(url);
  const videoAt = parts.indexOf("video");
  if (videoAt >= 0 && TIKTOK_ID.test(parts[videoAt + 1] || "")) return parts[videoAt + 1];
  if (parts[0] === "embed" && parts[1] === "v2" && TIKTOK_ID.test(parts[2] || "")) return parts[2];
  if (parts[0] === "embed" && TIKTOK_ID.test(parts[1] || "")) return parts[1];
  if (parts[0] === "player" && parts[1] === "v1" && TIKTOK_ID.test(parts[2] || "")) return parts[2];
  return null;
}

function isFacebookHost(host: string) {
  return host === "facebook.com" || host.endsWith(".facebook.com") || host === "fb.com" || host === "fb.watch";
}

function isFacebookVideo(url: URL) {
  const host = hostOf(url);
  const path = url.pathname.toLowerCase();
  if (host === "fb.watch") return true;
  return (
    path.includes("/videos/") ||
    path.includes("/reel/") ||
    path.includes("/reels/") ||
    path.includes("/watch") ||
    path.includes("/share/") ||
    url.searchParams.has("v") ||
    url.searchParams.has("story_fbid")
  );
}

const FACEBOOK_TRACKING = new Set(["mibextid", "fbclid", "rdid", "share_url", "sfnsn", "ref", "refsrc", "locale"]);

function facebookCleanUrl(url: URL) {
  const clean = new URL(url.toString());
  const host = hostOf(clean);
  if (host !== "fb.watch") clean.hostname = "www.facebook.com";
  for (const key of [...clean.searchParams.keys()]) {
    if (FACEBOOK_TRACKING.has(key)) clean.searchParams.delete(key);
  }
  return clean;
}

export function facebookPermalink(raw: string) {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return raw.trim();
  return facebookPermalinkFromUrl(parsed.url);
}

function facebookPermalinkFromUrl(url: URL) {
  const path = url.pathname.toLowerCase();
  if (path.includes("/plugins/video.php") || path.includes("/plugins/post.php")) {
    return url.toString();
  }
  const clean = facebookCleanUrl(url);
  const host = hostOf(clean);
  if (host === "fb.watch") return clean.toString();
  const parts = pathParts(clean);
  const videosAt = parts.indexOf("videos");
  const videoId = videosAt >= 0 ? parts[videosAt + 1] || "" : "";
  if (/^\d{5,}$/.test(videoId)) {
    const page = videosAt > 0 ? parts[videosAt - 1] : "";
    return page
      ? `https://www.facebook.com/${page}/videos/${videoId}/`
      : `https://www.facebook.com/watch/?v=${videoId}`;
  }
  const reelAt = parts.findIndex((part) => part === "reel" || part === "reels");
  if (reelAt >= 0 && parts[reelAt + 1]) {
    return `https://www.facebook.com/reel/${parts[reelAt + 1]}/`;
  }
  const watchId = clean.searchParams.get("v") || clean.searchParams.get("story_fbid") || "";
  if (/^\d{5,}$/.test(watchId)) {
    return `https://www.facebook.com/watch/?v=${watchId}`;
  }
  if (parts[0] === "share" && parts[1] && parts[2]) {
    return `https://www.facebook.com/share/${parts[1]}/${parts[2]}/`;
  }
  return clean.toString();
}

export function isCanonicalFacebookVideoUrl(raw: string) {
  try {
    const url = new URL(raw);
    const path = url.pathname.toLowerCase();
    const parts = pathParts(url);
    if (path.includes("/share/") || hostOf(url) === "fb.watch") return false;
    if (parts.includes("videos") && /^\d{5,}$/.test(parts[parts.indexOf("videos") + 1] || "")) return true;
    if ((parts[0] === "reel" || parts[0] === "reels") && parts[1]) return true;
    const watchId = url.searchParams.get("v") || "";
    return path.includes("/watch") && /^\d{5,}$/.test(watchId);
  } catch {
    return false;
  }
}

export function facebookPluginSrc(permalink: string) {
  if (permalink.includes("/plugins/video.php") || permalink.includes("/plugins/post.php")) {
    return permalink;
  }
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(permalink)}&show_text=false&width=560&height=315&t=0`;
}

export function canonicalFacebookUrlFromOembedHtml(html: string) {
  const text = html
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const cite =
    text.match(/cite="(https:\/\/(?:www\.)?facebook\.com\/[^"]+\/videos\/\d+\/?)"/i) ||
    text.match(/cite="(https:\/\/(?:www\.)?facebook\.com\/reel\/[^"]+)"/i) ||
    text.match(/cite="(https:\/\/(?:www\.)?facebook\.com\/watch\/\?v=\d+[^"]*)"/i);
  if (cite?.[1]) return facebookPermalink(cite[1]);
  const dataHref = text.match(/data-href="(https:\/\/[^"]+)"/i);
  if (dataHref?.[1] && isCanonicalFacebookVideoUrl(dataHref[1])) {
    return facebookPermalink(dataHref[1]);
  }
  return null;
}

function facebookEmbed(url: URL) {
  const path = url.pathname.toLowerCase();
  if (path.includes("/plugins/video.php") || path.includes("/plugins/post.php")) {
    return url.toString();
  }
  const permalink = facebookPermalinkFromUrl(url);
  if (!isFacebookVideo(url)) {
    return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(permalink)}&show_text=false&width=500`;
  }
  return facebookPluginSrc(permalink);
}

export function embedPlaybackUrl(
  embed: string,
  provider: MediaProvider,
  playing: boolean,
  muted = playing,
  background = false,
) {
  try {
    const url = new URL(embed);
    if (provider === "youtube") {
      url.searchParams.set("rel", "0");
      url.searchParams.set("modestbranding", "1");
      url.searchParams.set("iv_load_policy", "3");
      url.searchParams.set("playsinline", "1");
      if (playing) {
        url.searchParams.set("autoplay", "1");
        url.searchParams.set("loop", "1");
        url.searchParams.set("enablejsapi", "1");
        const id = url.pathname.split("/").filter(Boolean).pop();
        if (id) url.searchParams.set("playlist", id);
      }
      if (background) {
        url.searchParams.set("controls", "0");
        url.searchParams.set("disablekb", "1");
        url.searchParams.set("fs", "0");
      }
      if (muted) url.searchParams.set("mute", "1");
    }
    if (provider === "vimeo") {
      if (playing) {
        url.searchParams.set("autoplay", "1");
        url.searchParams.set("loop", "1");
        url.searchParams.set("playsinline", "1");
        if (background) url.searchParams.set("background", "1");
      }
      if (muted) url.searchParams.set("muted", "1");
    }
    if (provider === "tiktok") {
      url.searchParams.set("music_info", "0");
      url.searchParams.set("description", "0");
      url.searchParams.set("rel", "0");
      if (playing) {
        url.searchParams.set("autoplay", "1");
        url.searchParams.set("loop", "1");
      }
      if (background) {
        url.searchParams.set("controls", "0");
        url.searchParams.set("play_button", "0");
        url.searchParams.set("progress_bar", "0");
        url.searchParams.set("volume_control", "0");
        url.searchParams.set("fullscreen_button", "0");
        url.searchParams.set("timestamp", "0");
      }
      if (muted) {
        url.searchParams.set("force_muted", "1");
        url.searchParams.set("mute", "1");
        url.searchParams.set("muted", "1");
        url.searchParams.set("volume", "0");
      }
    }
    if (provider === "facebook") {
      url.searchParams.set("show_text", "false");
      if (playing) url.searchParams.set("autoplay", "true");
      if (muted) {
        url.searchParams.set("mute", "1");
        url.searchParams.set("muted", "true");
      }
    }
    if (provider === "instagram") {
      url.searchParams.set("hidecaption", "1");
      url.searchParams.set("cr", "1");
      if (playing) url.searchParams.set("autoplay", "1");
      if (muted) {
        url.searchParams.set("muted", "1");
        url.searchParams.set("mute", "1");
      }
    }
    return url.toString();
  } catch {
    return embed;
  }
}

export function parseMediaEmbed(raw: string): ParsedMedia | null {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return null;
  const url = parsed.url;
  const href = url.toString();
  const host = hostOf(url);

  const yt = youtubeId(url);
  if (yt) {
    const short = pathParts(url)[0] === "shorts";
    return { provider: "youtube", href, embed: youtubeEmbed(yt), media: "video", aspect: short ? "portrait" : "landscape" };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = pathParts(url).filter((part) => /^\d+$/.test(part)).pop() || "";
    if (!id) return null;
    return {
      provider: "vimeo",
      href,
      embed: `https://player.vimeo.com/video/${id}`,
      media: "video",
      aspect: "landscape",
    };
  }

  const ig = instagramEmbed(url);
  if (ig) {
    const post = ig.includes("/p/");
    return { provider: "instagram", href, embed: ig, media: "video", aspect: post ? "post" : "portrait" };
  }

  const tk = tiktokId(url);
  if (tk) {
    return {
      provider: "tiktok",
      href,
      embed: `https://www.tiktok.com/player/v1/${tk}`,
      media: "video",
      aspect: "portrait",
    };
  }

  if (isFacebookHost(host)) {
    const permalink = facebookPermalinkFromUrl(url);
    const path = url.pathname.toLowerCase();
    return {
      provider: "facebook",
      href: permalink,
      embed: facebookEmbed(url),
      media: "video",
      aspect: path.includes("/reel/") || path.includes("/reels/") ? "portrait" : isFacebookVideo(url) ? "landscape" : "post",
    };
  }

  const ext = extensionOf(url.pathname);
  if (IMAGE_EXT.has(ext)) {
    return { provider: "file", href, embed: null, media: "image", aspect: "auto" };
  }
  if (VIDEO_EXT.has(ext)) {
    return { provider: "file", href, embed: null, media: "video", aspect: "landscape" };
  }
  return null;
}

export function isSocialMediaUrl(raw: string) {
  const parsed = parseMediaEmbed(raw);
  return Boolean(parsed && parsed.provider !== "file");
}

export function mediaFrameClass(raw: string) {
  const media = parseMediaEmbed(raw);
  if (!media) return "aspect-[4/5] w-full";
  if (media.aspect === "post" || media.media === "image") return "aspect-[4/5] w-full";
  if (media.media === "video") return "aspect-video w-full";
  return "aspect-video w-full";
}

export function mediaSourceLabel(provider: MediaProvider) {
  if (provider === "youtube") return "YouTube";
  if (provider === "facebook") return "Facebook";
  if (provider === "instagram") return "Instagram";
  if (provider === "tiktok") return "TikTok";
  if (provider === "vimeo") return "Vimeo";
  return null;
}

export function validateImageUrl(raw: string) {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return parsed;
  const media = parseMediaEmbed(raw);
  if (media) {
    if (media.provider === "file" && media.media === "video") {
      return { ok: false as const, error: "That looks like a video file. Add it under Videos." };
    }
    return { ok: true as const, href: media.href };
  }
  const host = hostOf(parsed.url);
  if (host.includes("tiktok.com") || host.includes("instagram.com") || host === "instagr.am") {
    return {
      ok: false as const,
      error: "Use the full post or video URL, not a profile or shortened share link.",
    };
  }
  if (host.includes("youtube") || host === "youtu.be") {
    return { ok: false as const, error: "Use a YouTube video or Shorts URL." };
  }
  if (host.includes("vimeo.com")) {
    return { ok: false as const, error: "Use a Vimeo video URL." };
  }
  const ext = extensionOf(parsed.url.pathname.toLowerCase());
  if (ext && !IMAGE_EXT.has(ext)) {
    return { ok: false as const, error: "Use an image file, or an Instagram, TikTok, Facebook, or YouTube post URL." };
  }
  return { ok: true as const, href: parsed.url.toString() };
}

function toVideoSource(media: ParsedMedia): VideoSource | null {
  if (media.provider === "file") {
    if (media.media !== "video") return null;
    return { kind: "file", href: media.href };
  }
  if (!media.embed) return null;
  return { kind: media.provider, href: media.href, embed: media.embed };
}

export function validateVideoUrl(raw: string): { ok: true; source: VideoSource } | { ok: false; error: string } {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return parsed;
  const media = parseMediaEmbed(raw);
  if (media) {
    const source = toVideoSource(media);
    if (!source) {
      return { ok: false, error: "That looks like an image. Use the gallery for photos." };
    }
    return { ok: true, source };
  }
  const host = hostOf(parsed.url);
  if (host.includes("tiktok.com")) {
    return { ok: false, error: "Use the full TikTok video link (tiktok.com/@name/video/…), not a profile or vm.tiktok.com short link." };
  }
  if (host.includes("instagram.com") || host === "instagr.am") {
    return { ok: false, error: "Use the full Instagram post or Reel URL, not a profile." };
  }
  if (host.includes("youtube") || host === "youtu.be") {
    return { ok: false, error: "Use a YouTube video or Shorts URL." };
  }
  if (host.includes("facebook.com") || host === "fb.com" || host === "fb.watch") {
    return { ok: false, error: "Use the full Facebook video, Reel, Watch, or share URL." };
  }
  if (host.includes("vimeo.com")) {
    return { ok: false, error: "Use a Vimeo video URL." };
  }
  return { ok: false, error: "Use a Facebook, Instagram, YouTube, or TikTok video URL, or a direct HTTPS MP4/WEBM file." };
}

export function isVideoMediaUrl(raw?: string | null) {
  if (!raw) return false;
  return parseMediaEmbed(raw)?.media === "video";
}

export function stillImageUrl(...candidates: Array<string | null | undefined>) {
  for (const url of candidates) {
    const value = String(url || "").trim();
    if (!value || isVideoMediaUrl(value)) continue;
    return value;
  }
  return null;
}

export function validateHeroUrl(raw: string): { ok: true; href: string } | { ok: false; error: string } {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return parsed;
  const video = validateVideoUrl(raw);
  if (video.ok) return { ok: true, href: video.source.href };
  const image = validateImageUrl(raw);
  if (image.ok) return { ok: true, href: image.href };
  return { ok: false, error: "Use an image URL, or a Facebook, Instagram, YouTube, or TikTok video URL." };
}

export function isStoredCatalogImage(url?: string | null) {
  return /\/storage\/v1\/object\/public\/product-media\//.test(String(url || ""));
}

export function countStoredCatalogImages(urls: Array<string | null | undefined>) {
  return urls.filter((url) => isStoredCatalogImage(url)).length;
}

export function allowsCatalogDeviceImageUpload(opts: {
  limit: number | null;
  used: number;
  currentUrl?: string | null;
}) {
  if (opts.limit == null) return true;
  if (isStoredCatalogImage(opts.currentUrl)) return true;
  return opts.used < opts.limit;
}

export function safeFileStem() {
  return crypto.randomUUID();
}
