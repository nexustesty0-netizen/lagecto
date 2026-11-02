export type SettingsTab = { id: string; label: string };

export function pickSettingsTab(tabs: SettingsTab[], raw?: string | null) {
  const id = String(raw || "").trim();
  if (tabs.some((tab) => tab.id === id)) return id;
  return tabs[0]?.id || "profile";
}

export function customerSettingTabs(): SettingsTab[] {
  return [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Account security" },
    { id: "notifications", label: "Notifications" },
    { id: "privacy", label: "Privacy" },
    { id: "preferences", label: "Preferences" },
    { id: "account", label: "Account management" },
  ];
}

export function shopSettingTabs(): SettingsTab[] {
  return [
    { id: "profile", label: "Shop profile" },
    { id: "contact", label: "Contact and location" },
    { id: "hours", label: "Business hours" },
    { id: "catalogue", label: "Catalogue" },
    { id: "selling", label: "Selling" },
    { id: "people", label: "People" },
    { id: "notifications", label: "Notifications" },
    { id: "subscription", label: "Subscription" },
    { id: "account", label: "Account security" },
  ];
}

export type ShopSettingsLink = { href: string; title: string; hint: string };

export function shopCatalogueLinks(providerType?: string | null): ShopSettingsLink[] {
  const type = String(providerType || "both");
  const links: ShopSettingsLink[] = [];
  if (type !== "services") {
    links.push({ href: "/shop/products", title: "Products", hint: "Names, prices, photos, and visibility." });
    links.push({ href: "/shop/inventory", title: "Inventory", hint: "Stock counts and movement history." });
  }
  if (type !== "products") {
    links.push({ href: "/shop/services", title: "Services", hint: "Offerings and availability." });
  }
  return links;
}

export function shopSellingLinks(): ShopSettingsLink[] {
  return [
    { href: "/shop/storefront", title: "Logo and storefront", hint: "Logo, cover image, colours, and public page." },
    { href: "/shop/pos", title: "Point of sale", hint: "Walk-in till. There is no separate POS configuration page." },
    { href: "/shop/receipts/settings", title: "Receipts", hint: "Template, header, and footer." },
    { href: "/shop/quotations", title: "Quotations", hint: "Estimates and proposals." },
    { href: "/shop/promotions", title: "Promotions", hint: "Included on Free." },
  ];
}

export function shopPeopleLinks(): ShopSettingsLink[] {
  return [{ href: "/shop/employees", title: "Employees", hint: "Cashiers, managers, and what each person can open." }];
}

export function adminSettingTabs(superAdmin: boolean): SettingsTab[] {
  const tabs: SettingsTab[] = [
    { id: "profile", label: "Profile" },
    { id: "support", label: "Support information" },
    { id: "people", label: "Admin users" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "notifications", label: "Notifications" },
  ];
  if (superAdmin) {
    tabs.splice(1, 0, { id: "platform", label: "Platform" }, { id: "branding", label: "Branding" });
    tabs.push({ id: "security", label: "Security" });
  }
  return tabs;
}

export function adminSettingsLinks(superAdmin: boolean): Record<string, ShopSettingsLink[]> {
  return {
    people: [{ href: "/admin/users", title: "Admin users and permissions", hint: "Roles for Admin, Manager, and Super Admin." }],
    subscriptions: [{ href: "/admin/subscriptions", title: "Shop packages", hint: "Thabi, Kristen, Sandra, and Free. Prices stay as published." }],
    notifications: [{ href: "/admin/notifications", title: "Send an update", hint: "Platform announcements to shops or customers." }],
    branding: superAdmin
      ? [{ href: "/admin/company", title: "Company profile", hint: "Public LaGecto name and identity on the website." }]
      : [],
    security: superAdmin
      ? [{ href: "/admin/security", title: "Audit logs", hint: "Locked accounts and administrative events." }]
      : [],
  };
}
