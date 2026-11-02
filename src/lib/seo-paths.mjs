export const NOINDEX_PATH_PREFIXES = [
  "/customer",
  "/shop",
  "/admin",
  "/app",
  "/api",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/403",
  "/cart",
];

export const SITEMAP_PATHS = [
  "",
  "/marketplace",
  "/shops",
  "/news",
  "/plans",
  "/support",
  "/support/faqs",
  "/support/about",
  "/support/terms",
  "/support/privacy",
  "/support/rules",
  "/about",
  "/how-it-works",
  "/features",
  "/for-customers",
  "/for-shops",
  "/help",
  "/contact",
  "/register-shop",
];

export function isNoindexPath(pathname) {
  return NOINDEX_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
