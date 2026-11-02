import "server-only";
import { createServiceSupabase } from "@/lib/supabase/service";

type NotifyArgs = {
  title: string;
  message: string;
  type?: string;
  href?: string | null;
  referenceId?: string | null;
};

function rpcArgs(args: NotifyArgs) {
  return {
    p_title: args.title,
    p_message: args.message,
    p_type: args.type || "general",
    p_href: args.href || null,
    p_reference_id: args.referenceId || null,
  };
}

export async function notifyUser(userId: string, args: NotifyArgs) {
  try {
    const admin = createServiceSupabase();
    const result = await admin.rpc("notify_user", { p_user_id: userId, ...rpcArgs(args) });
    if (result.error) {
      await admin.from("notifications").insert({
        user_id: userId,
        title: args.title,
        message: args.message,
        type: args.type || "general",
        href: args.href || null,
        reference_id: args.referenceId || null,
      });
    }
  } catch {
    // Keep the originating action if notification delivery is unavailable.
  }
}

export async function notifyShop(shopId: string, args: NotifyArgs) {
  try {
    const admin = createServiceSupabase();
    const result = await admin.rpc("notify_shop", { p_shop_id: shopId, ...rpcArgs(args) });
    if (result.error) {
      await admin.from("shop_notifications").insert({
        shop_id: shopId,
        title: args.title,
        message: args.message,
        type: args.type || "general",
        href: args.href || null,
        reference_id: args.referenceId || null,
      });
    }
  } catch {
    // Keep the originating action if notification delivery is unavailable.
  }
}

export async function notifyAdmins(args: NotifyArgs) {
  try {
    const admin = createServiceSupabase();
    await admin.rpc("notify_admins", rpcArgs(args));
  } catch {
    // Super Admin inboxes stay unchanged if the RPC is not applied yet.
  }
}
