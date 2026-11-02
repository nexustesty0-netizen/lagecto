export type AdminShopRow = {
  id: string;
  name: string;
  login_shop_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  status?: string | null;
  verification_status?: string | null;
  category?: string | null;
  provider_type?: string | null;
};

export type AdminCustomerRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  account_status?: string | null;
  created_at?: string | null;
};

export type AdminProductRow = {
  id: string;
  name: string;
  type?: string | null;
  category?: string | null;
  shop_name?: string | null;
};

export type AdminSubscriptionRow = {
  shop_id?: string | null;
  package_key?: string | null;
  plan?: string | null;
  status?: string | null;
};

function harareDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function packageKeyOf(value?: string | null) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "thabi" || key === "kristen" || key === "sandra" || key === "free") return key;
  return "other";
}

export function filterAdminShops<T extends AdminShopRow>(shops: T[], query: string, status = "all", verification = "all") {
  const q = query.trim().toLowerCase();
  return shops.filter((shop) => {
    if (status !== "all" && String(shop.status || "") !== status) return false;
    if (verification !== "all" && String(shop.verification_status || "") !== verification) return false;
    if (!q) return true;
    return [shop.name, shop.login_shop_id, shop.owner_name, shop.owner_email, shop.category]
      .some((value) => String(value || "").toLowerCase().includes(q));
  });
}

export function filterAdminCustomers<T extends AdminCustomerRow>(customers: T[], query: string, status = "all", includeEmail = true) {
  const q = query.trim().toLowerCase();
  return customers.filter((customer) => {
    if (status !== "all" && String(customer.account_status || "active") !== status) return false;
    if (!q) return true;
    const hay = [customer.name, customer.username];
    if (includeEmail) hay.push(customer.email);
    return hay.some((value) => String(value || "").toLowerCase().includes(q));
  });
}

export function publicCustomerContact(email?: string | null, allowed = false) {
  if (!allowed) return null;
  const value = String(email || "").trim();
  return value || null;
}

export function filterAdminProducts(products: AdminProductRow[], query: string, type = "all") {
  const q = query.trim().toLowerCase();
  return products.filter((product) => {
    if (type !== "all" && String(product.type || "product") !== type) return false;
    if (!q) return true;
    return [product.name, product.category, product.shop_name].some((value) => String(value || "").toLowerCase().includes(q));
  });
}

export function subscriptionBreakdown(shopCount: number, rows: AdminSubscriptionRow[]) {
  const counts: Record<string, number> = { thabi: 0, kristen: 0, sandra: 0, free: 0, other: 0 };
  const shops = new Set<string>();
  for (const row of rows) {
    const status = String(row.status || "").toLowerCase();
    if (status !== "active" && status !== "trial") continue;
    const id = String(row.shop_id || "");
    if (id) shops.add(id);
    counts[packageKeyOf(row.package_key || row.plan)] += 1;
  }
  return {
    counts,
    withPackage: shops.size,
    withoutPackage: Math.max(0, shopCount - shops.size),
  };
}

export function registrationGrowth(rows: { created_at?: string | null }[], now = new Date(), days = 7) {
  const keys: string[] = [];
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(now.getTime() - i * 86400000);
    keys.push(harareDay(day));
    labels.push(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", weekday: "short" }).format(day));
  }
  const totals = Object.fromEntries(keys.map((key) => [key, 0]));
  for (const row of rows) {
    if (!row.created_at) continue;
    const key = harareDay(row.created_at);
    if (key in totals) totals[key] += 1;
  }
  return keys.map((key, index) => ({ label: labels[index], value: totals[key] }));
}

export function categoryCounts(rows: { category?: string | null }[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row.category || "").trim().toLowerCase() || "uncategorised";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: key === "uncategorised" ? "Uncategorised" : key,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
