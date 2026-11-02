import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getStorefrontBySlug, projectMediaUrl } from "@/lib/storefront/load";
import { storefrontPath } from "@/lib/storefront/paths";
import { MediaPreview } from "@/components/media/MediaPreview";
import { mediaFrameClass } from "@/lib/media";
import { showsStorefrontProjects } from "@/lib/storefront/template";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; projectId: string }> }): Promise<Metadata> {
  const { slug, projectId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data || !showsStorefrontProjects(data.shop.provider_type)) return { title: "Project" };
  const supabase = await createServerSupabase();
  const { data: project } = await supabase
    .from("storefront_projects")
    .select("title, summary")
    .eq("id", projectId)
    .eq("shop_id", data.shop.id)
    .eq("is_published", true)
    .maybeSingle();
  return {
    title: project?.title ? `${project.title} · ${data.shop.name}` : `Project · ${data.shop.name}`,
    description: project?.summary || `A project from ${data.shop.name}.`,
  };
}

export default async function StorefrontProjectPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data || !showsStorefrontProjects(data.shop.provider_type)) notFound();
  const supabase = await createServerSupabase();
  const { data: project } = await supabase
    .from("storefront_projects")
    .select("*")
    .eq("id", projectId)
    .eq("shop_id", data.shop.id)
    .eq("is_published", true)
    .maybeSingle();
  if (!project) notFound();
  const base = storefrontPath(data.shop.slug);
  const media = projectMediaUrl(project);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <nav className="flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--sf-muted)" }} aria-label="Breadcrumb">
        <Link href={base} className="hover:underline">
          {data.shop.name}
        </Link>
        <span aria-hidden>/</span>
        <Link href={`${base}/projects`} className="hover:underline">
          Projects
        </Link>
        <span aria-hidden>/</span>
        <span>{project.title}</span>
      </nav>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-primary)]">Projects</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{project.title}</h1>
      {project.summary ? (
        <p className="mt-4 text-lg leading-8" style={{ color: "var(--sf-muted)" }}>
          {project.summary}
        </p>
      ) : null}
      {media ? (
        <MediaPreview url={media} title={project.title} playing className={`${mediaFrameClass(media)} mt-8 rounded-[28px]`} />
      ) : null}
      {project.body ? <div className="mt-8 whitespace-pre-wrap text-base leading-8">{project.body}</div> : null}
    </article>
  );
}
