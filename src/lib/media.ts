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
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

function instagramEmbed(url: URL): string | null {
  const host = hostOf(url);
  if (host !== "instagram.com" && host !== "instagr.am") return null;
  const parts = pathParts(url);
  const type = parts[0];
  const code = parts[1];
  if (!code || !IG_CODE.test(code)) return null;
  if (type === "p") return `https://www.instagram.com/p/${code}/embed/`;
  if (type === "reel" || type === "reels") return `https://www.instagram.com/reel/${code}/embed/`;
  if (type === "tv") return `https://www.instagram.com/tv/${code}/embed/`;
  return null;
}

function tiktokId(url: URL): string | null {
  const host = hostOf(url);
  if (host !== "tiktok.com" && host !== "m.tiktok.com" && !host.endsWith(".tiktok.com")) return null;
  const parts = pathParts(url);
  const videoAt = parts.indexOf("video");
  if (videoAt >= 0 && TIKTOK_ID.test(parts[videoAt + 1] || "")) return parts[videoAt + 1];
  if (parts[0] === "embed" && parts[1] === "v2" && TIKTOK_ID.test(parts[2] || "")) return parts[2];
  if (parts[0] === "embed" && TIKTOK_ID.test(parts[1] || "")) return parts[1];
  if (parts[0] === "player" && parts[1] === "v1" && TIKTOK_ID.test(parts[2] || "")) return parts[2];
  return null;
}

function isFacebookHost(host: string) {
  return host === "facebook.com" || host === "m.facebook.com" || host === "web.facebook.com" || host === "fb.com" || host === "fb.watch";
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
    path.includes("/share/v/") ||
    path.includes("/share/r/") ||
    url.searchParams.has("v")
  );
}

function facebookEmbed(url: URL) {
  const href = encodeURIComponent(url.toString());
  if (isFacebookVideo(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&t=0`;
  }
  return `https://www.facebook.com/plugins/post.php?href=${href}&show_text=false`;
}

export function parseMediaEmbed(raw: string): ParsedMedia | null {
  const parsed = parsePublicHttpsUrl(raw);
  if (!parsed.ok) return null;
  const url = parsed.url;
  const href = url.toString();
  const host = hostOf(url);

  const yt = youtubeId(url);
  if (yt) {
    return { provider: "youtube", href, embed: youtubeEmbed(yt), media: "video", aspect: "landscape" };
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
    return { provider: "instagram", href, embed: ig, media: "video", aspect: "portrait" };
  }

  const tk = tiktokId(url);
  if (tk) {
    return {
      provider: "tiktok",
      href,
      embed: `https://www.tiktok.com/embed/v2/${tk}`,
      media: "video",
      aspect: "portrait",
    };
  }

  if (isFacebookHost(host)) {
    return {
      provider: "facebook",
      href,
      embed: facebookEmbed(url),
      media: "video",
      aspect: isFacebookVideo(url) ? "landscape" : "post",
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
  if (host.includes("tiktok.com") || host.includes("instagram.com") || host === "instagr.am") {
    return { ok: false, error: "Use the full post or video URL, not a profile or shortened share link." };
  }
  if (host.includes("youtube") || host === "youtu.be") {
    return { ok: false, error: "Use a YouTube video or Shorts URL." };
  }
  if (host.includes("vimeo.com")) {
    return { ok: false, error: "Use a Vimeo video URL." };
  }
  return { ok: false, error: "Use a YouTube, Instagram, TikTok, Facebook, Vimeo, or direct HTTPS MP4/WEBM URL." };
}

export function safeFileStem() {
  return crypto.randomUUID();
}
