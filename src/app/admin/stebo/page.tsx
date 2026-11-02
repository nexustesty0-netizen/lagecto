import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdminLevel } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { SteboAdminClient } from "@/components/admin/SteboAdminClient";
import { SteboChat } from "@/components/stebo/SteboChat";
import { WeeklyGenerate } from "@/components/admin/WeeklyGenerate";

export default async function AdminSteboPage() {
  await requireAdminLevel("admin");
  const supabase = await createServerSupabase();
  const [{ data: knowledge }, { data: examples }, { data: industries }, { data: personality }, { data: weekly }] = await Promise.all([
    supabase.from("stebo_knowledge").select("*").order("created_at", { ascending: false }),
    supabase.from("stebo_training_examples").select("*").order("created_at", { ascending: false }),
    supabase.from("stebo_industries").select("*").order("name"),
    supabase.from("stebo_personality_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("stebo_weekly_reports")
      .select("id, week_start, title, body")
      .eq("scope", "platform")
      .order("week_start", { ascending: false })
      .limit(6),
  ]);
  return (
    <>
      <PageHeader title="Stebo Intelligence Center" subtitle="Knowledge, training, personality, and platform weekend analytics. Shop GMV is excluded." />
      <div className="mb-8">
        <SteboChat mode="admin" title="Admin assistant" />
      </div>
      <WeeklyGenerate />
      {weekly?.length ? (
        <div className="mb-8 grid gap-3">
          {weekly.map((row) => (
            <article key={row.id} className="rounded-2xl bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-[#D4AF37]">Week of {row.week_start}</p>
              <p className="mt-1 font-semibold">{row.title}</p>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6">{row.body}</pre>
            </article>
          ))}
        </div>
      ) : null}
      <SteboAdminClient
        knowledge={knowledge || []}
        examples={examples || []}
        industries={industries || []}
        personality={personality}
      />
    </>
  );
}
