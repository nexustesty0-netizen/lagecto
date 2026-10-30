import { MediaPreview } from "@/components/media/MediaPreview";
import { parseMediaEmbed } from "@/lib/media";

export function StorefrontVideo({ title, url }: { title: string; url: string }) {
  if (!parseMediaEmbed(url)) return null;
  return (
    <figure className="sf-card overflow-hidden">
      <MediaPreview url={url} title={title} />
      <figcaption className="p-3 text-sm font-medium">{title}</figcaption>
    </figure>
  );
}
