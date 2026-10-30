import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/service";
import { requireApiProfile } from "@/lib/auth/session";

export async function GET(request: Request) {
  const auth = await requireApiProfile();
  if (!auth.ok) return auth.error;
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!path || path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    return NextResponse.json({ error: "Invalid file." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: rows } = await supabase
    .from("support_cases")
    .select("id, reporter_user_id, attachments")
    .contains("attachments", [{ path }]);
  const match = (rows || []).find((row) => {
    const files = Array.isArray(row.attachments) ? row.attachments : [];
    return files.some((file: { path?: string }) => file?.path === path);
  });
  if (!match) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (auth.profile.role !== "admin" && match.reporter_user_id !== auth.profile.id) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = createServiceSupabase();
  const { data, error } = await admin.storage.from("support-uploads").createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "File unavailable." }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
