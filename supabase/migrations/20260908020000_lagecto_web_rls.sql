-- LaGecto Web — RLS policies. Role checks are enforced in the database.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diary_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lagecto_company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users
CREATE POLICY users_select_own ON public.users FOR SELECT
  USING (auth.uid() = id OR public.is_platform_admin());
CREATE POLICY users_update_own ON public.users FOR UPDATE
  USING (auth.uid() = id OR public.is_platform_admin())
  WITH CHECK (auth.uid() = id OR public.is_platform_admin());
CREATE POLICY users_insert_self ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id OR public.is_platform_admin());

-- Shops
CREATE POLICY shops_public_read ON public.shops FOR SELECT
  USING (
    status = 'active'
    OR public.is_platform_admin()
    OR owner_user_id = auth.uid()
    OR lower(COALESCE(owner_email, '')) = lower(COALESCE(public.current_user_email(), ''))
  );
CREATE POLICY shops_owner_manage ON public.shops FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(id));

-- Financial periods
CREATE POLICY financial_periods_owner ON public.financial_periods FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY financial_periods_insert ON public.financial_periods FOR INSERT
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY financial_periods_update ON public.financial_periods FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));

-- Subscriptions
CREATE POLICY plans_public_read ON public.subscription_plans FOR SELECT USING (is_active = TRUE OR public.is_platform_admin());
CREATE POLICY plans_admin ON public.subscription_plans FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY subscriptions_admin ON public.subscriptions FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY subscriptions_owner_read ON public.subscriptions FOR SELECT
  USING (public.user_owns_shop(shop_id));

-- Products / categories / inventory
CREATE POLICY categories_read ON public.product_categories FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id) OR TRUE);
CREATE POLICY categories_manage ON public.product_categories FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE POLICY products_public_read ON public.products FOR SELECT
  USING (
    is_available = TRUE
    OR public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
  );
CREATE POLICY products_owner_manage ON public.products FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE POLICY inventory_owner ON public.inventory_transactions FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

-- Orders
CREATE POLICY orders_read ON public.orders FOR SELECT
  USING (
    customer_id = auth.uid()
    OR public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
  );
CREATE POLICY orders_insert ON public.orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY orders_update ON public.orders FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE POLICY order_items_read ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.customer_id = auth.uid()
          OR public.is_platform_admin()
          OR public.user_owns_shop(o.shop_id)
        )
    )
  );
CREATE POLICY order_items_insert ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
    OR public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
  );

-- Sales / receipts / expenses
CREATE POLICY sales_owner ON public.sales FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY sale_items_owner ON public.sale_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND (public.is_platform_admin() OR public.user_owns_shop(s.shop_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id AND (public.is_platform_admin() OR public.user_owns_shop(s.shop_id))
    )
  );

CREATE POLICY receipts_read ON public.receipts FOR SELECT
  USING (
    customer_id = auth.uid()
    OR public.is_platform_admin()
    OR public.user_owns_shop(shop_id)
  );
CREATE POLICY receipts_write ON public.receipts FOR INSERT
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY receipts_update ON public.receipts FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE POLICY receipt_items_read ON public.receipt_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = receipt_id
        AND (
          r.customer_id = auth.uid()
          OR public.is_platform_admin()
          OR public.user_owns_shop(r.shop_id)
        )
    )
  );
CREATE POLICY receipt_items_write ON public.receipt_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.id = receipt_id AND (public.is_platform_admin() OR public.user_owns_shop(r.shop_id))
    )
  );

CREATE POLICY expenses_owner ON public.shop_expenses FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY employees_owner ON public.employees FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY payroll_owner ON public.payroll_records FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY suppliers_owner ON public.suppliers FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY purchases_owner ON public.purchases FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY crm_customers_owner ON public.customers FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

-- Ratings
CREATE POLICY ratings_public_read ON public.ratings FOR SELECT
  USING (is_hidden = FALSE OR user_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY ratings_insert ON public.ratings FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY ratings_owner_update ON public.ratings FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id) OR user_id = auth.uid());

CREATE POLICY promotions_read ON public.promotions FOR SELECT USING (TRUE);
CREATE POLICY promotions_manage ON public.promotions FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE POLICY saved_shops_own ON public.saved_shops FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_own ON public.notifications FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY shop_notifications_owner ON public.shop_notifications FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY user_settings_own ON public.user_settings FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY shop_settings_owner ON public.shop_settings FOR ALL
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id))
  WITH CHECK (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY updates_read ON public.updates FOR SELECT USING (TRUE);
CREATE POLICY updates_admin ON public.updates FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY shop_reg_insert ON public.shop_registration_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (requester_user_id IS NULL OR requester_user_id = auth.uid()));
CREATE POLICY shop_reg_read ON public.shop_registration_requests FOR SELECT
  USING (requester_user_id = auth.uid() OR public.is_platform_admin());
CREATE POLICY shop_reg_admin ON public.shop_registration_requests FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY verification_owner ON public.verification_requests FOR SELECT
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY verification_insert ON public.verification_requests FOR INSERT
  WITH CHECK (public.user_owns_shop(shop_id));
CREATE POLICY verification_admin ON public.verification_requests FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY bookings_read ON public.service_bookings FOR SELECT
  USING (customer_id = auth.uid() OR public.is_platform_admin() OR public.user_owns_shop(shop_id));
CREATE POLICY bookings_insert ON public.service_bookings FOR INSERT
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY bookings_update ON public.service_bookings FOR UPDATE
  USING (public.is_platform_admin() OR public.user_owns_shop(shop_id));

CREATE POLICY diary_journal_own ON public.diary_journal_entries FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_tasks_own ON public.diary_tasks FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY diary_goals_own ON public.diary_goals FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY faq_public ON public.faq_entries FOR SELECT USING (is_published = TRUE OR public.is_platform_admin());
CREATE POLICY faq_admin ON public.faq_entries FOR ALL
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY company_public ON public.lagecto_company_profile FOR SELECT USING (TRUE);
CREATE POLICY company_admin ON public.lagecto_company_profile FOR UPDATE
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY security_admin_read ON public.security_events FOR SELECT
  USING (public.is_platform_admin());
CREATE POLICY login_attempts_admin ON public.login_attempts FOR SELECT
  USING (public.is_platform_admin());
CREATE POLICY rate_limits_service ON public.auth_rate_limits FOR ALL
  USING (FALSE);

INSERT INTO public.faq_entries (section, audience, question, answer, sort_order) VALUES
('ordering', 'customer', 'How do I place an order?', 'Browse shops, add products to your cart, then check out. The shop confirms the order and you can track it from Orders.', 1),
('ordering', 'customer', 'Can I cancel an order?', 'Pending orders can be cancelled by the shop. Contact the shop or LaGecto Support if you need help.', 2),
('payments', 'all', 'How do payments work?', 'LaGecto supports cash and shop-configured payment methods. Totals always come from the shop''s product prices, not from figures typed in the browser.', 1),
('delivery', 'customer', 'Do shops deliver?', 'Each shop sets pickup or delivery details on its profile. Check the shop page before you order.', 1),
('account', 'all', 'How do I log in?', 'Customers and admins use email or username plus password. Shop owners sign in with their Shop ID (for example gectotech@lg23) and password.', 1),
('account', 'all', 'What happens after 5 failed logins?', 'The account is locked. Contact LaGecto Support. An administrator can unlock the account from Security.', 2),
('account', 'all', 'How often can I change my username?', 'Usernames must be unique. You can change yours once every 14 days.', 3),
('shop_owners', 'shop_owner', 'How do I start a new financial period?', 'Open Financials and choose Start New Financial Period. The current period is archived. Nothing is permanently deleted.', 1),
('shop_owners', 'shop_owner', 'Where do receipts come from?', 'Receipts are generated from completed orders and POS sales using the stored totals.', 2),
('shop_owners', 'shop_owner', 'How do I get a Shop ID?', 'Administrators create shops. The system generates a unique Shop ID such as shopname@lg23. That ID is the shop-owner login identifier, not a password.', 3),
('general', 'all', 'How do I contact LaGecto Support?', 'Phone +263 71 503 4314 or email lagecto@outlook.com. You can also open WhatsApp from Help & Support.', 1),
('diary', 'all', 'What is Smart Diary?', 'Smart Diary lets you keep a private journal, tasks and goals inside LaGecto. Entries belong only to your account.', 1);

INSERT INTO public.subscription_plans (name, slug, price, billing_period, features) VALUES
('Basic', 'basic', 0, 'monthly', '["Shop profile","Product listing","Orders"]'::jsonb),
('Growth', 'growth', 15, 'monthly', '["Everything in Basic","POS","Reports","Receipts"]'::jsonb),
('Premium', 'premium', 35, 'monthly', '["Everything in Growth","Promotions","Financial archives"]'::jsonb);
