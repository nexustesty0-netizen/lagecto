import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontBySlug, getStorefrontProjects, projectMediaUrl } from "@/lib/storefront/load";
import { mediaFrameClass } from "@/lib/media";
import { storefrontPath } from "@/lib/storefront/paths";
import { MediaPreview } from "@/components/media/MediaPreview";
import { TechHero } from "@/components/storefront/tech/TechHero";
import { showsStorefrontProjects, techHeroImage, techHeroPosition, techPageTitle } from "@/lib/storefront/template";
import { storefrontOgDescription } from "@/lib/storefront/og";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data || !showsStorefrontProjects(data.shop.provider_type)) return { title: "Projects" };
  return {
    title: techPageTitle(data.shop, "projects"),
    description: storefrontOgDescription({
      name: data.shop.name,
      meta_description: data.shop.meta_description,
      tagline: data.config?.tagline,
      about: data.shop.about,
    }),
  };
}

export default async function StorefrontProjectsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStorefrontBySlug(slug);
  if (!data || !showsStorefrontProjects(data.shop.provider_type)) notFound();
  const projects = await getStorefrontProjects(data.shop.id);
  const base = storefrontPath(data.shop.slug);

  return (
    <>
      <TechHero
        image={techHeroImage("projects", data.shop, data.config)}
        kicker="Projects"
        title="Projects"
        subtitle={`Work completed by ${data.shop.name}.`}
        objectPosition={techHeroPosition("projects", data.config)}
      />
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        {!projects.length ? (
          <div className="sf-panel p-10 text-center">
            <p className="text-lg font-semibold">No projects published yet</p>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-muted)" }}>
              When {data.shop.name} adds completed work, it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article key={project.id} className="sf-panel overflow-hidden">
                {projectMediaUrl(project) ? (
                  <MediaPreview
                    url={projectMediaUrl(project) || ""}
                    title={project.title}
                    playing
                    className={mediaFrameClass(projectMediaUrl(project) || "")}
                  />
                ) : (
                  <div className="h-36" style={{ background: "color-mix(in srgb, var(--sf-primary) 10%, white)" }} />
                )}
                <Link href={`${base}/projects/${project.id}`} className="block p-5">
                  <h2 className="text-xl font-semibold">{project.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "var(--sf-muted)" }}>
                    {project.summary || "View this project"}
                  </p>
                  <span className="mt-4 inline-block text-sm font-semibold text-[var(--sf-primary)]">View project</span>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
