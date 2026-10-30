export const BRAND = {
  name: "LaGecto",
  tagline: "Smart Shopping, Khula Nathi Mhlobo",
  description:
    "LaGecto is a smart digital marketplace connecting customers with businesses while helping entrepreneurs grow.",
  location: "Bulawayo, Zimbabwe",
} as const;

export const CONTACT = {
  phoneDisplay: "+263 71 503 4314",
  phoneTel: "263715034314",
  email: "lagecto@outlook.com",
  whatsappUrl: "https://wa.me/263715034314",
  website: "https://lagecto.co.zw",
} as const;

export const COLORS = {
  primary: "#0B6E4F",
  secondary: "#2E8B57",
  accent: "#D4AF37",
  background: "#F7F3E3",
  surface: "#FFFFFF",
  text: "#1E1E1E",
  textLight: "#6B7280",
  error: "#EF4444",
  success: "#10B981",
  warning: "#FF9800",
} as const;

export const GENERIC_AUTH_ERROR =
  "Sign in failed. Check your details and try again.";
export const GENERIC_REGISTER_ERROR =
  "Unable to create this account. Please try again.";
export const ACCOUNT_LOCKED_ERROR =
  "This account is locked. Contact LaGecto support to restore access.";
export const RATE_LIMIT_ERROR =
  "Too many attempts. Please wait a few minutes and try again.";

export const PLATFORM_ADMIN_EMAIL = CONTACT.email;

export function isPlatformOwnerEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase();
}

export function toWhatsAppNumber(raw?: string | null) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `263${digits.slice(1)}`;
  if (digits.length === 9) digits = `263${digits}`;
  return digits;
}

export function whatsappMessageUrl(phone: string | null | undefined, text: string) {
  const number = toWhatsAppNumber(phone) || CONTACT.phoneTel;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function shopWhatsAppUrl(phone: string | null | undefined, text: string) {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export const SHOP_CATEGORIES = [
  { slug: "food", label: "Food" },
  { slug: "grocery", label: "Grocery" },
  { slug: "restaurant", label: "Restaurant" },
  { slug: "bakery", label: "Bakery" },
  { slug: "butchery", label: "Butchery" },
  { slug: "fashion", label: "Fashion" },
  { slug: "beauty", label: "Beauty" },
  { slug: "salon", label: "Salon" },
  { slug: "spa", label: "Spa" },
  { slug: "health", label: "Health" },
  { slug: "pharmacy", label: "Pharmacy" },
  { slug: "electronics", label: "Electronics" },
  { slug: "phones", label: "Phones" },
  { slug: "computers", label: "Computers" },
  { slug: "software", label: "Software" },
  { slug: "graphic_design", label: "Graphic design" },
  { slug: "photography", label: "Photography" },
  { slug: "videography", label: "Videography" },
  { slug: "printing", label: "Printing" },
  { slug: "marketing", label: "Marketing" },
  { slug: "home", label: "Home" },
  { slug: "furniture", label: "Furniture" },
  { slug: "hardware", label: "Hardware" },
  { slug: "construction", label: "Construction" },
  { slug: "plumbing", label: "Plumbing" },
  { slug: "electrical", label: "Electrical" },
  { slug: "farming", label: "Farming" },
  { slug: "gardening", label: "Gardening" },
  { slug: "automotive", label: "Automotive" },
  { slug: "transport", label: "Transport" },
  { slug: "logistics", label: "Logistics" },
  { slug: "education", label: "Education" },
  { slug: "sports", label: "Sports" },
  { slug: "fitness", label: "Fitness" },
  { slug: "music", label: "Music" },
  { slug: "jewelry", label: "Jewelry" },
  { slug: "books", label: "Books" },
  { slug: "stationery", label: "Stationery" },
  { slug: "pets", label: "Pets" },
  { slug: "baby", label: "Baby" },
  { slug: "toys", label: "Toys" },
  { slug: "crafts", label: "Crafts" },
  { slug: "events", label: "Events" },
  { slug: "catering", label: "Catering" },
  { slug: "cleaning", label: "Cleaning" },
  { slug: "laundry", label: "Laundry" },
  { slug: "repairs", label: "Repairs" },
  { slug: "security", label: "Security" },
  { slug: "internet", label: "Internet" },
  { slug: "real_estate", label: "Real estate" },
  { slug: "travel", label: "Travel" },
  { slug: "hospitality", label: "Hospitality" },
  { slug: "legal", label: "Legal" },
  { slug: "accounting", label: "Accounting" },
  { slug: "consulting", label: "Consulting" },
  { slug: "services", label: "Services" },
  { slug: "other", label: "Other" },
] as const;

export type ShopCategorySlug = (typeof SHOP_CATEGORIES)[number]["slug"];

export function getShopCategory(slug?: string | null) {
  const key = String(slug || "other").toLowerCase();
  return SHOP_CATEGORIES.find((category) => category.slug === key) || SHOP_CATEGORIES[SHOP_CATEGORIES.length - 1];
}

export function categoryLabel(slug?: string | null) {
  return getShopCategory(slug).label;
}

export const SHOP_PROVIDER_TYPES = [
  { value: "products", label: "Products only" },
  { value: "services", label: "Services only" },
  { value: "both", label: "Products and services" },
] as const;
