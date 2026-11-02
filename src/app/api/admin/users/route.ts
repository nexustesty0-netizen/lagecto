import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireApiAdminLevel, requireApiProfile } from "@/lib/auth/session";
import { isPlatformOwnerEmail } from "@/lib/brand";
import { isManager, isSuperAdmin, normalizeAdminRole } from "@/lib/admin-access";

async function targetIsPlatformOwner(supabase: Awaited<ReturnType<typeof createServerSupabase>>, userId: string) {
  const { data } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
  return isPlatformOwnerEmail(data?.email);
}

const PLATFORM_OWNER_ERROR =
  "lagecto@outlook.com is platform admin only and cannot be staff or a shop.";

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile("admin");
    if (!auth.ok) return auth.error;
    const body = await request.json();
    const action = String(body.action || "");
    const supabase = await createServerSupabase();
    const userId = String(body.userId || "");

    if (userId && (await targetIsPlatformOwner(supabase, userId))) {
      if (action === "set_role" || action === "promote_shop_owner" || action === "assign_staff") {
        return NextResponse.json({ error: PLATFORM_OWNER_ERROR }, { status: 400 });
      }
    }

    if (action === "set_role") {
      if (userId === auth.profile.id && body.role !== "admin") {
        return NextResponse.json({ error: "You cannot demote your own admin account." }, { status: 400 });
      }
      if (isManager(auth.profile) && String(body.role || "") !== "shop_owner") {
        return NextResponse.json({ error: "Managers can only assign shop owner roles." }, { status: 403 });
      }
      const nextRole = String(body.role || "");
      const requestedAdmin = body.adminRole ? normalizeAdminRole(String(body.adminRole)) : null;
      if (nextRole === "admin" && requestedAdmin === "super_admin" && !isSuperAdmin(auth.profile)) {
        return NextResponse.json({ error: "Only a super admin can assign super admins." }, { status: 403 });
      }
      const { data, error } = await supabase.rpc("admin_set_user_role", {
        p_user_id: userId,
        p_role: nextRole,
        p_admin_role: body.adminRole || null,
      });
      if (error) return NextResponse.json({ error: "Unable to update this role." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      if (nextRole === "customer") {
        const { data: target } = await supabase.from("users").select("email").eq("id", userId).maybeSingle();
        await supabase
          .from("shops")
          .update({ status: "inactive", is_open: false, updated_at: new Date().toISOString() })
          .eq("owner_user_id", userId);
        if (target?.email) {
          await supabase
            .from("shops")
            .update({ status: "inactive", is_open: false, updated_at: new Date().toISOString() })
            .eq("owner_email", target.email);
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "promote_shop_owner") {
      if (userId === auth.profile.id) {
        return NextResponse.json({ error: "You cannot change your own role this way." }, { status: 400 });
      }
      if (body.shopId) {
        return NextResponse.json(
          { error: "Linking an existing shop is not allowed. Assign the user as shop owner to create their shop." },
          { status: 400 },
        );
      }
      const providerType = String(body.providerType || "both");
      if (!["products", "services", "both"].includes(providerType)) {
        return NextResponse.json({ error: "Choose products, services, or both." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("admin_promote_shop_owner", {
        p_user_id: userId,
        p_shop_id: null,
        p_shop_name: body.shopName ? String(body.shopName) : null,
        p_provider_type: providerType,
        p_category: body.category ? String(body.category) : "other",
      });
      if (error) return NextResponse.json({ error: "Unable to assign this shop owner." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({
        ok: true,
        shop_id: data?.shop_id,
        login_shop_id: data?.login_shop_id,
        provider_type: data?.provider_type,
        shop_name: data?.shop_name,
      });
    }

    if (action === "delete") {
      const deleter = await requireApiAdminLevel("super_admin");
      if (!deleter.ok) return deleter.error;
      if (!userId) return NextResponse.json({ error: "User is required." }, { status: 400 });
      if (userId === deleter.profile.id) {
        return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
      }
      if (await targetIsPlatformOwner(supabase, userId)) {
        return NextResponse.json({ error: "The platform owner account cannot be deleted." }, { status: 400 });
      }
      const { data, error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
      if (error) {
        const missing = /could not find|does not exist|schema cache/i.test(error.message || "");
        return NextResponse.json(
          { error: missing ? "Run the latest admin delete SQL in Supabase first." : "Unable to delete this user." },
          { status: 400 },
        );
      }
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      try {
        await createServiceSupabase().auth.admin.deleteUser(userId);
      } catch {
        // Public row is already gone; auth cleanup is best-effort.
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "assign_staff") {
      if (isManager(auth.profile)) {
        return NextResponse.json({ error: "Managers can only assign shop owner roles." }, { status: 403 });
      }
      const { data, error } = await supabase.rpc("admin_assign_shop_staff", {
        p_shop_id: String(body.shopId || ""),
        p_user_id: userId,
        p_role_name: String(body.roleName || "staff"),
      });
      if (error) return NextResponse.json({ error: "Unable to assign staff." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
