import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  isEssentialNotice,
  isQuietHoursWindow,
  notificationOpenHref,
  notificationRelatedHref,
  noticeCategory,
  noticePreview,
  orderNumberFromNotice,
  relatedRecordLabel,
  staffMaySeeNotice,
} from "./notifications.ts";

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

test("order and enquiry notifications open a readable page", () => {
  assert.equal(orderNumberFromNotice("Order LG-1042 was placed. Arrange payment with the customer on WhatsApp."), "LG-1042");
  const order = { id: "n1", title: "New order", message: "Order LG-1042 was placed.", type: "order", created_at: "" };
  assert.equal(notificationOpenHref(order, "shop"), "/shop/notifications/n1");
  assert.equal(notificationRelatedHref(order, "shop"), "/shop/orders");
  assert.equal(
    notificationRelatedHref({ ...order, reference_id: "ord-1" }, "shop"),
    "/shop/orders/ord-1",
  );
  assert.equal(
    notificationRelatedHref({ ...order, reference_id: "ord-1" }, "customer"),
    "/customer/orders/ord-1",
  );
  const enquiry = { id: "n2", title: "Storefront enquiry", message: "Ada: Website quote", type: "enquiry", reference_id: "req-1", created_at: "" };
  assert.equal(notificationOpenHref(enquiry, "shop"), "/shop/notifications/n2");
  assert.equal(notificationRelatedHref(enquiry, "shop"), "/shop/service-requests/req-1");
  assert.equal(relatedRecordLabel("enquiry"), "View enquiry");
  const inbox = source("../components/notifications/NotificationInbox.tsx");
  assert.match(inbox, /notificationOpenHref/);
  assert.match(inbox, /View/);
  const shopPage = source("../app/shop/notifications/[id]/page.tsx");
  assert.match(shopPage, /whitespace-pre-wrap/);
  assert.match(shopPage, /View order|View enquiry|relatedHref/);
  const contact = source("../app/api/shops/[id]/contact/route.ts");
  assert.match(contact, /referenceId/);
  assert.match(contact, /\/shop\/service-requests\//);
  assert.match(contact, /sent you a message/);
  assert.doesNotMatch(contact, /message: details/);
});

test("cashiers only see shop notices they are allowed to open", () => {
  assert.equal(staffMaySeeNotice("cashier", "order"), true);
  assert.equal(staffMaySeeNotice("cashier", "message"), true);
  assert.equal(staffMaySeeNotice("cashier", "stock"), false);
  assert.equal(staffMaySeeNotice("cashier", "billing"), false);
  assert.equal(staffMaySeeNotice("manager", "stock"), true);
  assert.equal(staffMaySeeNotice("owner", "subscription"), true);
  assert.equal(noticeCategory("receipt"), "order");
  assert.equal(noticeCategory("support"), "support");
  assert.equal(noticePreview("A longer shop message that should be shortened for the popup preview window."), "A longer shop message that should be shortened for the popup preview window.");
});

test("quiet hours skip popups while security alerts stay visible", () => {
  assert.equal(isQuietHoursWindow("22:00", "07:00", new Date(2026, 0, 1, 23, 0)), true);
  assert.equal(isQuietHoursWindow("22:00", "07:00", new Date(2026, 0, 1, 8, 0)), false);
  assert.equal(isEssentialNotice("security"), true);
  assert.equal(isEssentialNotice("account"), true);
  assert.equal(isEssentialNotice("message"), false);
  const prefs = source("./notification-prefs.ts");
  assert.match(prefs, /isQuietHoursWindow/);
  assert.match(prefs, /isEssentialNotice\(type\)/);
});

test("realtime delivery stays on the existing notification tables", () => {
  const sql = source("../../supabase/migrations/20261102150000_notification_realtime.sql");
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications/);
  assert.match(sql, /ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_notifications/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public.notify_user/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public.notify_shop/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.notify_user/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public.notify_admins/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public.notify_user[\s\S]*TO service_role/);
  assert.match(sql, /PERFORM public.notify_user/);
  assert.match(sql, /Low stock/);
  assert.match(sql, /New shop registration/);
  const center = source("../components/notifications/NotificationCenter.tsx");
  assert.match(center, /postgres_changes/);
  assert.match(center, /shop_notifications/);
  assert.doesNotMatch(center, /window\.alert|alert\(/);
  assert.match(center, /lg-toast-stack/);
  const api = source("../app/api/notifications/route.ts");
  assert.match(api, /staffRole/);
  assert.match(api, /CASHIER_NOTICE_TYPES/);
  assert.match(api, /prefs/);
});
