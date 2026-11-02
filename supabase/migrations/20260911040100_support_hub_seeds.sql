-- Support Hub content: FAQ categories, help articles, about, safety, legal drafts.
-- FAQ rows live in existing faq_entries. Legal text is a working draft for human review.

INSERT INTO public.faq_categories (slug, name, description, audience, sort_order) VALUES
  ('account', 'Account', 'Sign-in, profile and usernames', 'all', 1),
  ('shopping', 'Shopping', 'Finding shops, cart, orders and reviews', 'customer', 2),
  ('payments', 'Payments', 'Cash, cards and EcoCash', 'all', 3),
  ('shops', 'Shops', 'Registering and running a shop', 'shop_owner', 4),
  ('loyalty', 'Loyalty & Rewards', 'Badges, rewards and promo codes', 'all', 5),
  ('stebo', 'Stebo', 'LaGecto assistant', 'all', 6),
  ('security', 'Security', 'Account safety and reporting', 'all', 7),
  ('technical', 'Technical Support', 'Bugs and loading problems', 'all', 8)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sort_order = EXCLUDED.sort_order;

INSERT INTO public.faq_entries (section, audience, question, answer, sort_order, featured, is_published)
SELECT v.section, v.audience, v.question, v.answer, v.sort_order, v.featured, TRUE
FROM (VALUES
  ('account', 'all', 'How do I create a LaGecto account?', 'Open Sign up, enter your name, email and a password, then confirm. Customers can browse shops without an account; checkout in the app requires sign-in. Guest WhatsApp orders still use the shop’s listed prices.', 1, TRUE),
  ('account', 'all', 'How do I change my username?', 'Signed-in customers can change username from Settings. Usernames must be unique and can be changed once every 14 days.', 2, FALSE),
  ('account', 'all', 'What happens if I enter the wrong password too many times?', 'After several failed attempts the account is locked. Contact LaGecto Support. An administrator can unlock it from Security. Do not share your password while you wait.', 3, TRUE),
  ('account', 'all', 'How do I update my profile?', 'Open Settings (or your profile) while signed in. Name, phone, address and username are stored on your account. Completing your profile can count toward loyalty rewards when that programme is active.', 4, FALSE),
  ('account', 'all', 'How do I log in?', 'Customers and admins use email or username plus password. Shop owners sign in with their Shop ID (for example gectotech@lg23) and password.', 5, TRUE),
  ('shopping', 'customer', 'How do I find a shop?', 'Use Marketplace or Shops, search by name, or open a category. You can also save shops to return later.', 1, TRUE),
  ('shopping', 'customer', 'How do I purchase a product?', 'Open a shop or product, add it to your cart, then checkout. Signed-in customers can pay in the app with a method the shop accepts. Guests can confirm the same cart on the shop’s WhatsApp.', 2, TRUE),
  ('shopping', 'customer', 'How does the cart work?', 'Your cart is stored on this device. Items are grouped by shop. Displayed totals are estimates; checkout uses the shop’s live prices, including any valid sale price or promo code.', 3, FALSE),
  ('shopping', 'customer', 'How do I track my order?', 'Signed-in customers open Orders. Status moves from pending through confirmed to completed, or to cancelled/refunded. The shop updates the order from their dashboard.', 4, FALSE),
  ('shopping', 'customer', 'How do I leave a review?', 'After you have a completed order with a shop, open that shop and submit a rating and optional comments. Hidden or abusive reviews can be moderated.', 5, FALSE),
  ('shopping', 'customer', 'Can I cancel an order?', 'Pending orders can be cancelled by the shop. Contact the shop or LaGecto Support if you need help. Cancelled and refunded orders do not keep purchase loyalty rewards.', 6, FALSE),
  ('payments', 'all', 'What payment methods are supported?', 'Each shop chooses which methods it accepts. Common options are cash, EcoCash and card processors the platform has configured. Always use LaGecto checkout — do not send PINs or passwords to anyone claiming to be support.', 1, TRUE),
  ('payments', 'all', 'How does card payment work?', 'If the shop accepts card, checkout creates a payment with the configured provider and returns the next step (redirect or instructions). The order total comes from the server, not from figures typed in the browser.', 2, FALSE),
  ('payments', 'all', 'How does EcoCash payment work?', 'If the shop accepts EcoCash, enter the EcoCash number that should receive the prompt. Follow the prompt on your phone. If it fails, the order may still exist as unpaid — contact the shop or Support with the order number.', 3, FALSE),
  ('payments', 'all', 'Can I pay cash?', 'Yes, when the shop enables cash. Pay the shop using their stated process. The shop confirms cash on their side; LaGecto does not collect cash on their behalf.', 4, FALSE),
  ('payments', 'all', 'What happens if a payment fails?', 'A failed or cancelled payment does not complete the order. You can retry from Payments, or contact the shop. Refunded payments reverse related loyalty awards where those were granted.', 5, FALSE),
  ('shops', 'shop_owner', 'How do I register my shop?', 'Open Register a shop and submit your business details, or ask an administrator to create the shop. During an active Founding Users campaign, newly created shops may receive a time-limited complimentary listing. That offer has start and end dates.', 1, TRUE),
  ('shops', 'shop_owner', 'What is a shop ID?', 'Administrators (or shop creation) generate a login identifier such as shopname@lg23. That ID is how shop owners sign in. It is not a password and should not be posted as a payment reference.', 2, TRUE),
  ('shops', 'shop_owner', 'How do I create my storefront?', 'From the shop dashboard open Storefront. Add a logo, banner, about text and theme. Publish the storefront so customers can visit /s/your-slug.', 3, FALSE),
  ('shops', 'shop_owner', 'How do I add products or services?', 'Use Products or Services in the shop dashboard. Set price, availability and images. Customers only see items marked available.', 4, FALSE),
  ('shops', 'shop_owner', 'How do promotions work?', 'Shop Promotions set sale prices on your products. Promo codes are created under Customer loyalty and apply only to your shop. Expired promotions never apply at checkout.', 5, FALSE),
  ('shops', 'shop_owner', 'How do I start a new financial period?', 'Open Financials and choose Start New Financial Period. The current period is archived. Nothing is permanently deleted.', 6, FALSE),
  ('loyalty', 'all', 'How do I earn badges?', 'Customer badges unlock when the server confirms real activity such as completed orders, reviews or visits. There are 100 customer badges. You cannot award them from the browser.', 1, TRUE),
  ('loyalty', 'all', 'How do I unlock rewards?', 'Open Loyalty or Rewards. Claim buttons call the server, which checks requirements. Claimed promo codes are generated for you; discount values cannot be edited in the app.', 2, FALSE),
  ('loyalty', 'all', 'How do promo codes work?', 'Enter a code at checkout. LaGecto checks that it is active, in date, eligible and under its usage limits, then calculates the discount on the server. Shop codes cannot be used at another shop.', 3, TRUE),
  ('loyalty', 'all', 'How does shop loyalty work?', 'Each shop has its own points balance, separate from LaGecto platform loyalty. Shop owners can create rewards and codes only for their shop.', 4, FALSE),
  ('stebo', 'all', 'What is Stebo?', 'Stebo is LaGecto’s in-app assistant for shopping help, diary notes and (for shops and admins) operational questions based on recorded activity.', 1, TRUE),
  ('stebo', 'all', 'What can Stebo help me with?', 'Customers can ask about shops and how to use LaGecto. Shop owners can ask about their dashboard figures. Admins can ask about platform operations. Stebo uses existing LaGecto data; it does not invent sales.', 2, FALSE),
  ('stebo', 'all', 'How is my information handled?', 'Stebo replies are generated for your signed-in session. Do not paste passwords, PINs or full card numbers into the chat. See the Privacy Policy for how account data is stored.', 3, FALSE),
  ('security', 'all', 'How does LaGecto protect my account?', 'Passwords are handled by the authentication service. Accounts lock after repeated failed logins. Role checks and database policies limit who can see orders, chats and loyalty data. No system can promise that it is impossible to attack.', 1, TRUE),
  ('security', 'all', 'What should I do if I suspect suspicious activity?', 'Do not share passwords or payment PINs. Use official LaGecto checkout. Report the shop from Help & Support or the shop page, and contact Support. We review reports; we do not automatically suspend a shop from a single report.', 2, FALSE),
  ('security', 'all', 'How do I report a shop?', 'Open Help & Support → Report a Shop, or Report shop on a storefront. Choose a reason and describe what happened. False or abusive reports may be reviewed.', 3, TRUE),
  ('technical', 'all', 'What should I do if the app is not loading?', 'Check your connection, refresh the page, try another browser, then sign out and in. If it still fails, open Technical Issues or Report a Bug and tell us the page and what you saw.', 1, TRUE),
  ('technical', 'all', 'What should I do if I find a bug?', 'Use Report a Bug. Describe what happened, what you were trying to do, and the steps. A screenshot helps. Do not include passwords or full card numbers.', 2, FALSE),
  ('technical', 'all', 'What information should I provide when reporting a problem?', 'The page or feature, what you expected, what you saw, the time, and an order number if it involves a purchase. Optional: browser name. Never send PINs or recovery codes.', 3, FALSE)
) AS v(section, audience, question, answer, sort_order, featured)
WHERE NOT EXISTS (
  SELECT 1 FROM public.faq_entries e WHERE e.question = v.question
);

UPDATE public.faq_entries SET section = 'shopping' WHERE section IN ('ordering', 'delivery') AND question NOT IN (SELECT question FROM public.faq_entries WHERE section = 'shopping');
UPDATE public.faq_entries SET section = 'shops' WHERE section = 'shop_owners';

INSERT INTO public.help_articles (slug, kind, title, summary, body, category, audience, is_published, sort_order)
SELECT v.slug, v.kind, v.title, v.summary, v.body, v.category, v.audience, TRUE, v.sort_order
FROM (VALUES
  ('refresh-and-connection', 'troubleshooting', 'Page will not load', 'Try a refresh and check your connection before contacting support.',
   $b$1. Confirm you have internet access.
2. Refresh the page.
3. Try another browser or a private window.
4. Sign out and sign in again.
5. If it still fails, open Technical Issues and tell us the page URL and what you saw.

Do not install unknown “repair” apps or send your password to anyone.$b$, 'technical', 'all', 1),
  ('checkout-problems', 'troubleshooting', 'Checkout or payment trouble', 'Totals come from the shop. Retry only through LaGecto checkout.',
   $b$1. Confirm the shop is still open and the items are in stock.
2. Refresh checkout so the server quote is current.
3. If you used a promo code, check that it is still valid for that shop.
4. For EcoCash, confirm the phone number that should receive the prompt.
5. Never pay a stranger off-platform because they claimed to be LaGecto.

Still stuck? Contact Support with the order number if you have one.$b$, 'payments', 'all', 2),
  ('login-lock', 'troubleshooting', 'Cannot sign in', 'Locked accounts need Support. Do not keep guessing the password.',
   $b$1. Check Caps Lock and that you are on the official LaGecto site.
2. Shop owners must use their Shop ID, not a personal email, unless that is how the account was created.
3. After several failures the account locks. Stop trying and contact Support.
4. An administrator can unlock the account. We will not ask for your password.$b$, 'account', 'all', 3),
  ('using-promo-codes', 'article', 'Using a promo code', 'Codes are checked on the server at checkout.',
   $b$Open your cart, enter the code, and apply it. You should see the validated discount or a reason it cannot be used (expired, ineligible, wrong shop, below minimum). The order total is calculated by LaGecto, not by the browser.

Shop-owner codes only work at that shop. Platform codes may apply more widely depending on how they were configured.$b$, 'loyalty', 'all', 4),
  ('shop-storefront-guide', 'article', 'Publishing your storefront', 'Logo, about text and products make a shop easier to find.',
   $b$From the shop dashboard open Storefront. Add a logo and banner, write a short about section, then publish. Add products or services with prices. Customers reach you at your public slug. Sale prices belong under Promotions; loyalty codes belong under Customer loyalty.$b$, 'shops', 'shop_owner', 5)
) AS v(slug, kind, title, summary, body, category, audience, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.help_articles a WHERE a.slug = v.slug);

INSERT INTO public.about_content (slug, title, body, status)
VALUES
('about-lagecto', 'About LaGecto',
 $b$LaGecto is a digital marketplace and business platform connecting customers with local shops.

It exists so businesses can present products and services online, and so customers can discover, order, pay, review and return — including loyalty rewards and promotions where those programmes are enabled.

Customers can browse shops, save favourites, use a cart, place orders, pay with methods each shop accepts, keep receipts, message shops, and follow news. Shop owners can manage a storefront, catalogue, orders, POS, inventory, promotions, customer loyalty, employees, expenses and reports according to their package. LaGecto provides the marketplace, accounts, payments coordination, and platform tools such as Stebo.

LaGecto
Smart shopping, khula nathi mhlobo

Operated with Gecto Tech branding in this product. Location: Bulawayo, Zimbabwe.

This page describes features that exist in the current application. It is not a promise of future products.$b$,
 'published'),
('safety-security', 'Safety & Security',
 $b$Use LaGecto in a way that keeps your account and money safer.

Never share your password or payment PINs. LaGecto Support will not ask for them.

Be careful with unexpected discounts or messages that rush you to pay outside checkout.

Verify shop names, addresses and contact details on the storefront.

Use the official cart and checkout so prices and promo codes are validated on the server.

Report shops or messages that look fraudulent from Help & Support. A report is a request for review, not an automatic ban.

If something feels wrong, stop, keep your records, and contact Support on +263 71 503 4314 or lagecto@outlook.com.

LaGecto uses signed-in access checks, role permissions and database policies. That reduces risk; it does not make abuse impossible.$b$,
 'published')
ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, status = 'published', updated_at = NOW();

INSERT INTO public.legal_documents (slug, title) VALUES
  ('terms', 'Terms & Conditions'),
  ('privacy', 'Privacy Policy')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.legal_document_versions (document_slug, version, effective_on, content, status, published_at)
SELECT 'terms', 1, CURRENT_DATE,
 $b$LaGecto Terms & Conditions

Version 1. Status: published for product display so customers can read how the application currently operates.

1. Who we are
LaGecto is a digital marketplace that lists shops and helps customers discover products and services. Shop owners operate their own businesses. LaGecto is not the seller of shop catalogue items unless a specific LaGecto POS sale says otherwise.

2. Accounts
You must provide accurate sign-in details and keep your password private. Shop owners authenticate with a Shop ID issued for that shop. Accounts may lock after repeated failed logins.

3. Orders and prices
Displayed cart totals are estimates. The authoritative total is calculated when you checkout. Promo codes and sale prices apply only when the server accepts them.

4. Payments
Payment methods depend on each shop’s configuration (for example cash or EcoCash). Failed payments do not complete an order. Refunds follow the shop and payment status already recorded in LaGecto.

5. Loyalty, badges and promotions
Points, badges and codes are granted only after confirmed activity. They can be reversed when an order is cancelled or refunded. Offers such as Founding Users are time-limited campaigns, not permanent entitlements.

6. Acceptable use
Do not attempt to manipulate prices, loyalty balances, badges or another person’s account. Do not submit false shop reports. Do not upload unlawful content.

7. Shops
Shop owners are responsible for their catalogue, fulfilment and customer communication. LaGecto may review reports. One report does not automatically remove a shop.

8. Contact
LaGecto Support: +263 71 503 4314 · lagecto@outlook.com

9. Changes
Updated versions will be published with a version number and effective date. Previous published versions remain in the archive.$b$,
 'published', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.legal_document_versions WHERE document_slug = 'terms' AND version = 1
);

INSERT INTO public.legal_document_versions (document_slug, version, effective_on, content, status, published_at)
SELECT 'privacy', 1, CURRENT_DATE,
 $b$LaGecto Privacy Policy

Version 1. This describes data the current application stores. It is not a claim of certification or “absolute security”.

1. Account information
If you register, LaGecto stores name, email, phone, username, role, address and sign-in related fields needed to operate the account.

2. Shop information
Shop profiles include name, contact details, location, hours, media, catalogue, and subscription/package status.

3. Orders and payments
Orders store items, totals, status, payment method and related identifiers. Payment providers may process card or EcoCash details according to their own terms; LaGecto stores payment status and references, not your PIN.

4. Reviews, messaging and notifications
Ratings, chat messages, support tickets and in-app notifications are stored so the product can function.

5. Loyalty and promotions
Points, badge unlocks, promo redemptions and related campaign enrolments are stored against your account or shop.

6. Stebo
Assistant messages you send in Stebo are processed to generate a reply. Do not send secrets.

7. Technical information
The app uses cookies or local storage for sign-in sessions and the customer cart on this device. Support reports may include optional browser/device notes you submit.

8. Sharing
Shop owners see orders and messages for their shop. Administrators see platform operations they are permitted to manage. We do not sell your account as a product listing. Payment providers receive what is required to process a payment you start.

9. Retention and rights
We keep records while the account or legal/operational need lasts. You may ask Support to review your account information. Shop report reporters are not identified to the reported shop through this product’s shop dashboard.

10. Contact
Questions: lagecto@outlook.com or +263 71 503 4314.

11. Updates
New versions are published with an effective date. History is retained.$b$,
 'published', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.legal_document_versions WHERE document_slug = 'privacy' AND version = 1
);
