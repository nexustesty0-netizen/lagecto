import { shopSocialLinks, type ShopSocialFields } from "@/lib/storefront/socials";
import { SOCIAL_BRAND } from "@/components/storefront/StorefrontBrandIcons";

export function StorefrontSocialLinks({
  shop,
  className = "",
  compact = false,
}: {
  shop: ShopSocialFields;
  className?: string;
  compact?: boolean;
}) {
  const links = shopSocialLinks(shop);
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {links.map((link) => {
        const brand = SOCIAL_BRAND[link.key as keyof typeof SOCIAL_BRAND];
        const Icon = brand?.Icon;
        return (
          <a
            key={link.key}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
            title={link.label}
            className={`sf-social-3d grid place-items-center rounded-full text-white shadow-sm ${compact ? "h-9 w-9" : "h-11 w-11"}`}
            style={{ background: brand?.color || "var(--sf-primary)" }}
          >
            {Icon ? <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} title={link.label} /> : <span className="text-xs font-semibold">{link.label.slice(0, 1)}</span>}
          </a>
        );
      })}
    </div>
  );
}
