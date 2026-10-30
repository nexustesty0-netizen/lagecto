import type { CSSProperties } from "react";

export const DEFAULT_STOREFRONT_THEME = {
  primary: "#0B6E4F",
  secondary: "#2E8B57",
  accent: "#D4AF37",
  background: "#FFFDF8",
} as const;

const HEX = /^#([0-9A-Fa-f]{6})$/;

export function isHexColor(value?: string | null): value is string {
  return Boolean(value && HEX.test(value.trim()));
}

export function normalizeHex(value?: string | null, fallback: string = String(DEFAULT_STOREFRONT_THEME.primary)) {
  const raw = String(value || "").trim();
  if (HEX.test(raw)) return raw.toUpperCase();
  if (HEX.test(`#${raw}`)) return `#${raw}`.toUpperCase();
  return fallback.toUpperCase();
}

function channel(hex: string, index: number) {
  const n = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string) {
  const value = normalizeHex(hex);
  return 0.2126 * channel(value, 0) + 0.7152 * channel(value, 1) + 0.0722 * channel(value, 2);
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

export function bestTextOn(background: string) {
  const white = contrastRatio("#FFFFFF", background);
  const dark = contrastRatio("#12241C", background);
  return white >= dark ? "#FFFFFF" : "#12241C";
}

export function ensureContrast(foreground: string, background: string, minimum = 4.5) {
  if (contrastRatio(foreground, background) >= minimum) return normalizeHex(foreground);
  return bestTextOn(background);
}

export type StorefrontColors = {
  primary?: string | null;
  secondary?: string | null;
  accent?: string | null;
  background?: string | null;
};

export type ResolvedStorefrontTheme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  onPrimary: string;
  onSecondary: string;
  onAccent: string;
  buttonBg: string;
  buttonText: string;
  navBg: string;
  navText: string;
  card: string;
  cssVars: CSSProperties;
};

export function resolveStorefrontTheme(colors?: StorefrontColors | null): ResolvedStorefrontTheme {
  const primary = normalizeHex(colors?.primary, DEFAULT_STOREFRONT_THEME.primary);
  const secondary = normalizeHex(colors?.secondary, DEFAULT_STOREFRONT_THEME.secondary);
  const accent = normalizeHex(colors?.accent, DEFAULT_STOREFRONT_THEME.accent);
  const background = normalizeHex(colors?.background, DEFAULT_STOREFRONT_THEME.background);
  const text = ensureContrast("#12241C", background, 4.5);
  const muted = ensureContrast("#5A6A62", background, 3);
  const onPrimary = bestTextOn(primary);
  const onSecondary = bestTextOn(secondary);
  const onAccent = bestTextOn(accent);
  const buttonBg = contrastRatio(onPrimary, primary) >= 4.5 ? primary : ensureContrast(primary, background, 3);
  const buttonText = bestTextOn(buttonBg);
  const navBg = contrastRatio("#FFFFFF", background) >= 1.2 ? mixToward(background, "#FFFFFF", 0.72) : mixToward(background, "#000000", 0.08);
  const navText = ensureContrast(text, navBg, 4.5);
  const card = mixToward(background, "#FFFFFF", 0.55);

  return {
    primary,
    secondary,
    accent,
    background,
    text,
    muted,
    onPrimary,
    onSecondary,
    onAccent,
    buttonBg,
    buttonText,
    navBg,
    navText,
    card,
    cssVars: {
      ["--sf-primary" as string]: primary,
      ["--sf-secondary" as string]: secondary,
      ["--sf-accent" as string]: accent,
      ["--sf-bg" as string]: background,
      ["--sf-text" as string]: text,
      ["--sf-muted" as string]: muted,
      ["--sf-on-primary" as string]: onPrimary,
      ["--sf-on-secondary" as string]: onSecondary,
      ["--sf-on-accent" as string]: onAccent,
      ["--sf-button" as string]: buttonBg,
      ["--sf-button-text" as string]: buttonText,
      ["--sf-nav" as string]: navBg,
      ["--sf-nav-text" as string]: navText,
      ["--sf-card" as string]: card,
    },
  };
}

function mixToward(hex: string, toward: string, amount: number) {
  const a = normalizeHex(hex);
  const b = normalizeHex(toward);
  const mix = (i: number) => {
    const av = parseInt(a.slice(1 + i * 2, 3 + i * 2), 16);
    const bv = parseInt(b.slice(1 + i * 2, 3 + i * 2), 16);
    return Math.round(av + (bv - av) * amount)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(0)}${mix(1)}${mix(2)}`.toUpperCase();
}
