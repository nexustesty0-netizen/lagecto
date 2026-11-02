"use client";

import { createBrowserSupabase } from "@/lib/supabase/browser";

const OPTIONAL = ["tags", "priority", "category", "target_date", "milestones", "entry_type", "mood", "due_date"];

export async function insertDiary(table: string, row: Record<string, unknown>) {
  const supabase = createBrowserSupabase();
  const first = await supabase.from(table).insert(row);
  if (!first.error) return { ok: true as const };
  const fallback = { ...row };
  for (const key of OPTIONAL) delete fallback[key];
  const retry = await supabase.from(table).insert(fallback);
  if (retry.error) return { ok: false as const, error: "Unable to save this diary item." };
  return { ok: true as const };
}

export async function updateDiary(table: string, id: string, patch: Record<string, unknown>) {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) return { ok: false as const, error: "Unable to update this diary item." };
  return { ok: true as const };
}

export async function deleteDiary(table: string, id: string) {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { ok: false as const, error: "Unable to remove this diary item." };
  return { ok: true as const };
}
