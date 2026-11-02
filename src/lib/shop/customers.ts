const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function publicDisplayName(value: unknown, fallback: string) {
  const name = String(value || "").trim();
  if (!name || name.includes("@") || UUID_RE.test(name)) return fallback;
  return name.slice(0, 80);
}

export type ShopCustomerSource = {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  total?: number | null;
  created_at?: string | null;
  kind?: "order" | "sale" | "enquiry";
  title?: string | null;
  status?: string | null;
  id?: string;
};

export type ShopCustomer = {
  key: string;
  customerId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  orders: number;
  sales: number;
  enquiries: number;
  spent: number;
  lastAt: string | null;
  history: Array<{ id: string; kind: "order" | "sale" | "enquiry"; title: string; total: number | null; status: string | null; at: string | null }>;
};

function emailOf(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function phoneOf(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export function shopCustomerKey(row: ShopCustomerSource) {
  const id = String(row.customer_id || "").trim();
  if (UUID_RE.test(id)) return `id_${id}`;
  const email = emailOf(row.customer_email);
  if (email) return `em_${email}`;
  const phone = phoneOf(row.customer_phone);
  if (phone.length >= 7) return `ph_${phone}`;
  const name = publicDisplayName(row.customer_name, "").toLowerCase();
  if (name) return `nm_${name}`;
  return "";
}

export function groupShopCustomers(rows: ShopCustomerSource[]): ShopCustomer[] {
  const map = new Map<string, ShopCustomer>();
  for (const row of rows) {
    const key = shopCustomerKey(row);
    if (!key) continue;
    const current = map.get(key) || {
      key,
      customerId: row.customer_id || null,
      name: publicDisplayName(row.customer_name, "Customer"),
      email: emailOf(row.customer_email) || null,
      phone: String(row.customer_phone || "").trim() || null,
      orders: 0,
      sales: 0,
      enquiries: 0,
      spent: 0,
      lastAt: row.created_at || null,
      history: [],
    };
    if (!current.customerId && row.customer_id) current.customerId = row.customer_id;
    if (!current.email && emailOf(row.customer_email)) current.email = emailOf(row.customer_email);
    if (!current.phone && row.customer_phone) current.phone = String(row.customer_phone).trim();
    if (row.customer_name) current.name = publicDisplayName(row.customer_name, current.name);
    const kind = row.kind || "order";
    if (kind === "order") current.orders += 1;
    if (kind === "sale") current.sales += 1;
    if (kind === "enquiry") current.enquiries += 1;
    if (kind !== "enquiry") current.spent += Number(row.total || 0);
    if (row.created_at && (!current.lastAt || row.created_at > current.lastAt)) current.lastAt = row.created_at;
    if (row.id) {
      current.history.push({
        id: row.id,
        kind,
        title: String(row.title || (kind === "sale" ? "Sale" : kind === "enquiry" ? "Enquiry" : "Order")),
        total: kind === "enquiry" ? null : Number(row.total || 0),
        status: row.status || null,
        at: row.created_at || null,
      });
    }
    map.set(key, current);
  }
  return [...map.values()]
    .map((row) => ({
      ...row,
      history: row.history.sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 20),
    }))
    .sort((a, b) => String(b.lastAt || "").localeCompare(String(a.lastAt || "")));
}
