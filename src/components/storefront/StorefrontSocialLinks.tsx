import { shopSocialLinks, type ShopSocialFields } from "@/lib/storefront/socials";

export function StorefrontSocialLinks({
  shop,
  className = "",
}: {
  shop: ShopSocialFields;
  className?: string;
}) {
  const links = shopSocialLinks(shop);
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border px-3 py-1.5 text-sm font-medium"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
