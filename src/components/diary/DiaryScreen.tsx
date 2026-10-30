import { createServerSupabase } from "@/lib/supabase/server";
import { getOwnedShop, requireRole } from "@/lib/auth/session";
import { getShopFeatures } from "@/lib/entitlements";
import { ADVANCED_DIARY, diaryBasePath, diaryModeForRole } from "@/lib/diary";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { DiaryApp } from "@/components/diary/DiaryApp";
import type { UserRole } from "@/lib/types";

export async function loadDiaryData(userId: string) {
  const supabase = await createServerSupabase();
  const [
    journal,
    tasks,
    goals,
    habits,
    events,
    mood,
    vision,
    memories,
    briefings,
    reflections,
    weekly,
    budget,
  ] = await Promise.all([
    supabase.from("diary_journal_entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(80),
    supabase.from("diary_tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("diary_goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("diary_habits").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("diary_events").select("*").eq("user_id", userId).order("event_at", { ascending: false }).limit(30),
    supabase.from("diary_mood_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    supabase.from("diary_vision_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("diary_memories").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    supabase.from("diary_briefings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("diary_reflections").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("diary_weekly_reviews").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("diary_budget_entries").select("*").eq("user_id", userId).order("entry_date", { ascending: false }).limit(30),
  ]);
  return {
    journal: journal.data || [],
    tasks: tasks.data || [],
    goals: goals.data || [],
    habits: habits.data || [],
    events: events.data || [],
    mood: mood.data || [],
    vision: vision.data || [],
    memories: memories.data || [],
    briefings: briefings.data || [],
    reflections: reflections.data || [],
    weekly: weekly.data || [],
    budget: budget.data || [],
  };
}

export async function DiaryScreen({ role, moduleSlug = "hub" }: { role: UserRole; moduleSlug?: string }) {
  const slug = moduleSlug || "hub";
  let profile;
  let shopId: string | null = null;
  if (role === "shop_owner") {
    const owned = await getOwnedShop();
    profile = owned.profile;
    shopId = owned.shop?.id || null;
  } else {
    profile = await requireRole(role);
  }
  const features = role === "shop_owner" ? await getShopFeatures(shopId) : new Set(["smart_diary_full"]);
  const allowAdvanced = role !== "shop_owner" || features.has("smart_diary_full");
  if (ADVANCED_DIARY.has(slug) && !allowAdvanced) {
    return <FeatureLocked feature="smart_diary_full" />;
  }
  const data = await loadDiaryData(profile.id);
  return (
    <DiaryApp
      basePath={diaryBasePath(role)}
      mode={diaryModeForRole(role)}
      moduleSlug={slug}
      userId={profile.id}
      userName={profile.name || profile.username}
      allowAdvanced={allowAdvanced}
      data={data}
    />
  );
}
