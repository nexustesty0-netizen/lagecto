import { BRAND, CONTACT } from "./brand";

const CONTACT_BLOCK = `LaGecto Support
${CONTACT.phoneDisplay}
${CONTACT.email}
${BRAND.location}`;

export const FALLBACK_TERMS = `1. About these terms
LaGecto (${CONTACT.website}) is a marketplace and shop operating system based in ${BRAND.location}. These terms apply when you use the LaGecto website, shop dashboards, and related services.

2. The marketplace
Customers browse shops, products and services. Checkout is arranged on WhatsApp with the shop. LaGecto records the order as pending. Payment is between the customer and the shop. LaGecto does not collect card or Paynow payments on marketplace checkout.

3. Accounts
You must provide accurate details when you create an account. Shop owners are responsible for their catalogue, stock, prices, opening hours and the WhatsApp number on their profile. Employees may only use tools their shop owner has granted.

4. Acceptable use
Do not list illegal goods, mislead buyers, or use another shop's identity. LaGecto may suspend shops or accounts that break these rules or that fail to pay after a paid plan ends, including the published grace period.

5. Orders, refunds and delivery
Refunds, cancellations, delivery and collection are agreed with the shop that took the order. If you cannot reach the shop, contact Support with the order or Shop ID. LaGecto is not the seller of shop catalogue items.

6. Contact
${CONTACT_BLOCK}`;

export const FALLBACK_PRIVACY = `1. Who we are
LaGecto operates a marketplace and shop software from ${BRAND.location}. This policy explains how account, shop and support information is used on the website.

2. Information we store
LaGecto stores account, shop, order, receipt and support information in a dedicated Supabase project so the website can run. We use that information to sign you in, show your shops and orders, complete POS and WhatsApp checkout records, and reply to support requests.

3. Cookies and sessions
Session cookies keep you signed in. They are required for login, carts that sync after sign-in, and shop or admin dashboards.

4. How shop and customer data is shared
We do not sell customer lists. Shop data stays with that shop: owners and staff see their own shop, customers see their own orders, and admins see platform records needed to operate LaGecto.

5. Your requests
You can ask Support to correct or close an account. Some records, including receipts, completed sales and legal holds, may be kept because the shop or the law requires them.

6. Contact
${CONTACT.email} · ${CONTACT.phoneDisplay}`;

export const FALLBACK_MARKETPLACE_RULES = `1. Listing shops
Only active, listed shops appear in Shops and the marketplace.

2. Catalogue honesty
Product and service photos, names and prices must match what the shop will honour on WhatsApp.

3. Reviews
Reviews must come from real purchases or visits. Fake ratings are not allowed.

4. Promotions
Promotions must show the real selling price. Expired offers must not be shown as live.

5. Fulfilment
Collection and delivery are the shop's responsibility unless the shop says otherwise.

6. Conduct
Report a problem from Support. Do not harass shops or customers.

7. Shop-owner terms
You start on Free. Paid packages (Thabi, Kristen, Sandra) are requested on WhatsApp and activated by LaGecto after payment. Prices on /plans are the live package prices. After a paid or founding period ends you have the published grace window to pay. After that the shop can be delisted. Keep your Shop ID, staff logins and WhatsApp number under your control.

8. Refunds and cancellation
Marketplace orders: refunds are with the shop. Package fees paid to LaGecto: contact Support. Activation is manual after payment. This page does not promise a cooling-off period.`;

export const FALLBACK_ABOUT = `${BRAND.name} is a digital marketplace and shop operating system in ${BRAND.location}. ${BRAND.tagline}.

Customers browse local shops, add items to a cart, and check out on WhatsApp with the shop. Shop owners run catalogue, POS, orders, inventory and reports from their dashboard.

${CONTACT_BLOCK}`;

export function fallbackLegal(slug: string) {
  if (slug === "privacy") return { title: "Privacy Policy", content: FALLBACK_PRIVACY };
  if (slug === "terms") return { title: "Terms & Conditions", content: FALLBACK_TERMS };
  if (slug === "rules") return { title: "Marketplace rules", content: FALLBACK_MARKETPLACE_RULES };
  if (slug === "about") return { title: "About LaGecto", content: FALLBACK_ABOUT };
  return null;
}
