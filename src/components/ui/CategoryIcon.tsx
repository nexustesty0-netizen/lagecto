import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Brush,
  Building2,
  Cake,
  Calculator,
  Camera,
  Car,
  Code,
  Droplets,
  Dumbbell,
  Flame,
  Flower2,
  Gamepad2,
  Gem,
  GraduationCap,
  Hammer,
  HardHat,
  HeartPulse,
  Home,
  Hotel,
  Laptop,
  LayoutGrid,
  Megaphone,
  Mic,
  Package,
  Palette,
  PawPrint,
  PenTool,
  Phone,
  Pill,
  Plane,
  Printer,
  Scale,
  Scissors,
  Shield,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Trees,
  Truck,
  Utensils,
  UtensilsCrossed,
  Video,
  Wheat,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import { SHOP_CATEGORIES, getShopCategory } from "@/lib/brand";

const ICONS: Record<string, LucideIcon> = {
  food: Utensils,
  grocery: ShoppingBasket,
  restaurant: UtensilsCrossed,
  bakery: Cake,
  butchery: Flame,
  fashion: Shirt,
  beauty: Sparkles,
  salon: Scissors,
  spa: Flower2,
  health: HeartPulse,
  pharmacy: Pill,
  electronics: Smartphone,
  phones: Phone,
  computers: Laptop,
  software: Code,
  graphic_design: PenTool,
  photography: Camera,
  videography: Video,
  printing: Printer,
  marketing: Megaphone,
  home: Home,
  furniture: Armchair,
  hardware: Wrench,
  construction: HardHat,
  plumbing: Droplets,
  electrical: Zap,
  farming: Wheat,
  gardening: Trees,
  automotive: Car,
  transport: Truck,
  logistics: Package,
  education: GraduationCap,
  sports: Dumbbell,
  fitness: Bike,
  music: Mic,
  jewelry: Gem,
  books: BookOpen,
  stationery: Brush,
  pets: PawPrint,
  baby: Baby,
  toys: Gamepad2,
  crafts: Palette,
  events: Megaphone,
  catering: Utensils,
  cleaning: Sparkles,
  laundry: Shirt,
  repairs: Hammer,
  security: Shield,
  internet: Wifi,
  real_estate: Building2,
  travel: Plane,
  hospitality: Hotel,
  legal: Scale,
  accounting: Calculator,
  consulting: Briefcase,
  services: Briefcase,
  other: LayoutGrid,
  all: LayoutGrid,
};

export function resolveCategoryIconSlug(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "other";
  if (ICONS[raw]) return raw;
  const compact = raw.replace(/[\s-]+/g, "_");
  if (ICONS[compact]) return compact;
  const match = SHOP_CATEGORIES.find((category) => category.slug === raw || category.label.toLowerCase() === raw);
  return match?.slug || "other";
}

export function CategoryIcon({
  slug,
  className = "h-4 w-4",
}: {
  slug?: string | null;
  className?: string;
}) {
  const Icon = ICONS[resolveCategoryIconSlug(slug)] || LayoutGrid;
  return <Icon className={className} aria-hidden />;
}

export function ServiceIconPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="grid max-h-48 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
      {SHOP_CATEGORIES.map((category) => {
        const active = resolveCategoryIconSlug(value) === category.slug && Boolean(value);
        return (
          <button
            key={category.slug}
            type="button"
            title={category.label}
            onClick={() => onChange(category.slug)}
            className={`grid h-11 place-items-center rounded-xl border ${
              active ? "border-[#0B6E4F] bg-[#0B6E4F] text-white" : "border-[var(--lagecto-border)] bg-white text-[#0B6E4F]"
            }`}
          >
            <CategoryIcon slug={category.slug} className="h-5 w-5" />
            <span className="sr-only">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CategorySelect({
  name,
  defaultValue = "other",
  className = "rounded-xl border px-3 py-2",
}: {
  name: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={className}>
      {SHOP_CATEGORIES.map((category) => (
        <option key={category.slug} value={category.slug}>
          {category.label}
        </option>
      ))}
    </select>
  );
}

export function CategoryChips({
  name,
  value,
  defaultValue = "other",
  onChange,
  hrefFor,
  activeSlug,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (slug: string) => void;
  hrefFor?: (slug: string) => string;
  activeSlug?: string;
}) {
  const selected = value || activeSlug || defaultValue;
  return (
    <div className="flex flex-wrap gap-2">
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      {SHOP_CATEGORIES.map((category) => {
        const active = selected === category.slug;
        const className = `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
          active ? "bg-[#0B6E4F] text-white" : "border border-[#E5E7EB] bg-white text-[#1E1E1E] hover:border-[#0B6E4F]/40"
        }`;
        const content = (
          <>
            <CategoryIcon slug={category.slug} className="h-3.5 w-3.5" />
            {category.label}
          </>
        );
        if (hrefFor) {
          return (
            <a key={category.slug} href={hrefFor(category.slug)} className={className}>
              {content}
            </a>
          );
        }
        return (
          <button
            key={category.slug}
            type="button"
            className={className}
            onClick={() => onChange?.(category.slug)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export function categoryDisplay(slug?: string | null) {
  return getShopCategory(slug).label;
}
