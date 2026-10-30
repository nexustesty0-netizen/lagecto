import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireApiProfile } from "@/lib/auth/session";
import { canSeeAdminLogs } from "@/lib/admin-access";

export async function POST(request: Request) {
  try {
    const auth = await requireApiProfile("admin");
    if (!auth.ok) return auth.error;
    const adminProfile = auth.profile;
    const body = await request.json();
    const action = String(body.action || "");
    const supabase = await createServerSupabase();

    if (action === "unlock_account") {
      if (!canSeeAdminLogs(adminProfile)) {
        return NextResponse.json({ error: "Managers cannot access security logs or unlock from this screen." }, { status: 403 });
      }
      const userId = String(body.userId || "");
      const { data, error } = await supabase.rpc("admin_unlock_account", {
        p_user_id: userId,
      });
      if (error) return NextResponse.json({ error: "Unable to unlock this account." }, { status: 400 });
      if (data?.ok === false) return NextResponse.json({ error: data.error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (action === "create_shop") {
      return NextResponse.json(
        { error: "Shops are created from Manage users by assigning a user as shop owner." },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
}
