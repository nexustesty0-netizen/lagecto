import type { ReactNode } from "react";

type IconProps = { className?: string; title?: string };

function Svg({ className, title, children }: IconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={!title} role={title ? "img" : "presentation"}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function WhatsAppBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.3-1.39c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2m5.79 14.16c-.24.68-1.4 1.26-1.94 1.34-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.66-.61-2.92-1.26-4.82-4.21-4.97-4.41-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.32.02.51-.1.2-.14.32-.28.5-.14.17-.3.39-.42.52-.14.14-.28.3-.12.58.16.29.71 1.17 1.53 1.89 1.05.93 1.94 1.22 2.22 1.36.27.14.43.12.59-.07.16-.2.68-.79.86-1.06.18-.27.36-.22.61-.13.24.08 1.54.73 1.8.86.27.14.44.2.51.31.07.12.07.68-.17 1.36"
      />
    </Svg>
  );
}

export function FacebookBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path fill="currentColor" d="M14.5 8.5V6.7c0-.7.5-1.2 1.2-1.2h1.3V3h-2.3C12.3 3 10.8 4.6 10.8 6.9v1.6H9v2.7h1.8V21h3.1v-9.8h2.2l.4-2.7z" />
    </Svg>
  );
}

export function InstagramBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm9.2 1.2a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2M12 8.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2m0 1.8A2 2 0 1 0 14 12a2 2 0 0 0-2-2"
      />
    </Svg>
  );
}

export function YouTubeBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C18.9 5.4 12 5.4 12 5.4s-6.9 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.9.4 8.8.4 8.8.4s6.9 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6M9.8 15.6V8.8l6.2 3.4z"
      />
    </Svg>
  );
}

export function TikTokBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M14.3 3c.4 2.6 2 4.4 4.6 4.8v2.5c-1.5 0-2.9-.5-4.1-1.3v6.6c0 3.4-2.7 6.1-6.2 6.1S2.4 18.9 2.4 15.5c0-3.1 2.3-5.7 5.3-6.1v2.7c-1.2.3-2.1 1.4-2.1 2.7 0 1.6 1.3 2.8 2.9 2.8s2.9-1.3 2.9-2.8V3z"
      />
    </Svg>
  );
}

export function LinkedInBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M6.5 9.3H3.7V20h2.8zm.2-3.6c0-.9-.7-1.6-1.8-1.6S3.2 4.8 3.2 5.7s.7 1.6 1.8 1.6 1.7-.7 1.7-1.6M20.3 20h-2.8v-5.5c0-1.5-.5-2.5-1.8-2.5-1 0-1.5.7-1.8 1.3-.1.2-.1.5-.1.8V20h-2.8s.1-9.4 0-10.4h2.8v1.6c.4-.7 1.4-1.8 3.4-1.8 2.5 0 4.3 1.6 4.3 5.1z"
      />
    </Svg>
  );
}

export function XBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path fill="currentColor" d="M17.6 3h3.1l-6.8 7.8L22 21h-6.2l-4.8-6.3L5.5 21H2.4l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.6 4.7H5.8z" />
    </Svg>
  );
}

export function WebsiteBrandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2m0 1.8a8.2 8.2 0 0 1 7.7 5.5H15c-.4-2.2-1.2-4-2.1-5.2.4 0 .7-.1 1.1-.3M12 3.8c.9 1.2 1.8 3.1 2.2 5.5H9.8C10.2 6.9 11.1 5 12 3.8M8.1 3.8c-.9 1.2-1.7 3-2.1 5.2H4.3A8.2 8.2 0 0 1 8.1 3.8M3.8 11.1h3.1c-.1.6-.1 1.2-.1 1.9s0 1.3.1 1.9H3.8A8.2 8.2 0 0 1 3.8 11.1m.5 5.6h2.6c.4 2.2 1.2 4 2.1 5.2A8.2 8.2 0 0 1 4.3 16.7M9.8 14.9h4.4c-.4 2.4-1.3 4.3-2.2 5.5-.9-1.2-1.8-3.1-2.2-5.5m5.2 1.8h2.6A8.2 8.2 0 0 1 15 21.9c.9-1.2 1.7-3 2.1-5.2M17.1 11.1h3.1a8.2 8.2 0 0 1 0 3.8h-3.1c.1-.6.1-1.2.1-1.9s0-1.3-.1-1.9m-.8-2.1c-.4-2.2-1.2-4-2.1-5.2a8.2 8.2 0 0 1 4.7 5.2z"
      />
    </Svg>
  );
}

export const SOCIAL_BRAND = {
  website: { color: "var(--sf-primary)", Icon: WebsiteBrandIcon },
  facebook: { color: "#1877F2", Icon: FacebookBrandIcon },
  instagram: { color: "#E4405F", Icon: InstagramBrandIcon },
  youtube: { color: "#FF0000", Icon: YouTubeBrandIcon },
  tiktok: { color: "#111111", Icon: TikTokBrandIcon },
  linkedin: { color: "#0A66C2", Icon: LinkedInBrandIcon },
  x: { color: "#111111", Icon: XBrandIcon },
  whatsapp: { color: "#25D366", Icon: WhatsAppBrandIcon },
} as const;
