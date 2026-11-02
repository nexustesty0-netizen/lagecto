export const PLACEHOLDER_COVER = "/visuals/placeholder-cover.svg";

export function isPlaceholderCover(image?: string | null) {
  return !image || image === PLACEHOLDER_COVER;
}

export function imageForCategory(_category?: string | null) {
  return PLACEHOLDER_COVER;
}

export function hasProductPhoto(image?: string | null) {
  if (!image || isPlaceholderCover(image)) return false;
  return /^(https?:\/\/|\/)/.test(image);
}

export function productImage(image?: string | null, _category?: string | null) {
  if (hasProductPhoto(image)) return image as string;
  return PLACEHOLDER_COVER;
}
