"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function StatusPatch({
  table,
  id,
  field = "status",
  options,
}: {
  table: string;
  id: string;
  field?: string;
  options: string[];
}) {
  const router = useRouter();
  async function onChange(value: string) {
    const supabase = createBrowserSupabase();
    await supabase.from(table).update({ [field]: value }).eq("id", id);
    router.refresh();
  }
  return (
    <select className="rounded-lg border px-2 py-1 text-sm" defaultValue="" onChange={(event) => event.target.value && onChange(event.target.value)}>
      <option value="">Update</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
