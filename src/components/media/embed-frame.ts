import type { MediaAspect, MediaProvider } from "@/lib/media";

export function socialEmbedFrameClass(
  provider: MediaProvider,
  cover: boolean,
  kind: "photo" | "video" = "video",
  aspect: MediaAspect = "landscape",
  locked = true,
) {
  const lock = locked ? "pointer-events-none " : "";
  if (cover && (provider === "instagram" || provider === "tiktok")) {
    return `${lock}absolute left-1/2 top-[42%] h-[177.78vw] min-h-[calc(100%+7rem)] w-[56.25vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0`;
  }
  if (cover) {
    return `${lock}absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0`;
  }
  if (provider === "instagram" && kind === "photo") {
    // Instagram's post card is 540px wide. Scale it to the 4:5 frame so the photo fills edge to edge.
    return `${lock}absolute left-1/2 w-[540px] max-w-none origin-top border-0 [top:calc(-3.75rem*100cqw/540px)] [height:calc(540px*5/4+9.5rem)] [transform:translateX(-50%)_scale(calc(100cqw/540px))]`;
  }
  if (kind === "video" && aspect === "portrait") {
    // Fill the 16:9 player from the top of the reel so likes and "View more on Instagram" stay below the crop.
    return `${lock}absolute left-1/2 -top-12 w-full min-w-full aspect-[9/16] -translate-x-1/2 border-0`;
  }
  return `${lock}absolute inset-0 h-full w-full border-0`;
}
