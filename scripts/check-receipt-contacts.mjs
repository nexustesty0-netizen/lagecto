import { uniqueShopContacts, formatReceiptDate } from "../src/lib/receipts.ts";
import { buildReceiptHtml } from "../src/lib/receipts/templates.ts";

const shop = {
  name: "Your Company Inc.",
  address: "1234 Company St, Company Town, ST 12345",
  phone: "(555) 987-6543",
  email: "support@example.com",
  whatsapp: "+1 555 987 6543",
  website: "https://example.com",
  template: "classic",
  show_contact: true,
};

const contact = uniqueShopContacts(shop);
if (contact.whatsapp) throw new Error("WhatsApp should never print as its own contact");
if (contact.phone !== "(555) 987-6543") throw new Error("Phone should be the unlabeled number");
if (contact.website !== "https://example.com") throw new Error("Website missing from contacts");

const receipt = {
  receipt_number: "0000457",
  created_at: "2025-11-04T10:00:00.000Z",
  customer_name: "Customer Name",
  customer_email: "customer@example.com",
  customer_phone: "555-0100",
  payment_method: "cash",
  payment_status: "paid",
  subtotal: 240,
  discount: 0,
  tax: 12,
  total: 252,
  shop_details: shop,
  items: [{ product_name: "Custom product/service A", quantity: 2, unit_price: 45, total_price: 90 }],
};

for (const template of ["classic", "modern", "minimal", "premium", "compact"]) {
  const html = buildReceiptHtml({ ...receipt, shop_details: { ...shop, template } });
  const phoneCount = (html.match(/\(555\) 987-6543/g) || []).length;
  const emailCount = (html.match(/support@example.com/g) || []).length;
  const websiteCount = (html.match(/https:\/\/example.com/g) || []).length;
  const date = formatReceiptDate(receipt.created_at);
  if (html.match(/WhatsApp/i)) throw new Error(`${template} still labels WhatsApp`);
  if (!html.includes(date)) throw new Error(`${template} missing formatted date ${date}`);
  if (phoneCount !== 1) throw new Error(`${template} phone count ${phoneCount}`);
  if (emailCount !== 1) throw new Error(`${template} email count ${emailCount}`);
  if (websiteCount !== 1) throw new Error(`${template} website count ${websiteCount}`);
  console.log(template, "ok", "date=", date, "phone=", phoneCount, "email=", emailCount, "website=", websiteCount);
}
console.log("receipts unlabeled number + website ok");
