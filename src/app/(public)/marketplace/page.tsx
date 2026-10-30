import type { Metadata } from "next";
import { MarketplaceSearch } from "@/components/public/MarketplaceSearch";
import { ProductGrid, CatalogEmpty } from "@/components/public/ProductCard";
import { searchCatalog, type CatalogSort } from "@/lib/marketplace/discovery";
import { titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Marketplace" };

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    type?: string;
    sort?: string;
    min?: string;
    max?: string;
    sale?: string;
  }>;
}) {
  const { q, category, type, sort, min, max, sale } = await searchParams;
  const products = await searchCatalog({
    q,
    category,
    type: type === "service" || type === "product" ? type : "all",
    sort: (sort as CatalogSort) || "relevance",
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
    onSale: sale === "1",
    limit: 48,
  });
  const heading = category && category !== "all" ? titleCase(category) : "Marketplace";

  return (
    <>
      <MarketplaceSearch q={q} category={category} />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <form className="mb-6 grid gap-3 rounded-[22px] border border-[var(--lagecto-border)] bg-white/70 p-4 sm:grid-cols-5">
          {q ? <input type="hidden" name="q" value={q} /> : null}
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <select name="type" defaultValue={type || "all"} className="min-h-11 rounded-xl border px-3 py-2">
            <option value="all">Products & services</option>
            <option value="product">Products</option>
            <option value="service">Services</option>
          </select>
          <select name="sort" defaultValue={sort || "relevance"} className="min-h-11 rounded-xl border px-3 py-2">
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="popular">Popular</option>
          </select>
          <input name="min" type="number" min={0} defaultValue={min} placeholder="Min price" className="min-h-11 rounded-xl border px-3 py-2" />
          <input name="max" type="number" min={0} defaultValue={max} placeholder="Max price" className="min-h-11 rounded-xl border px-3 py-2" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sale" value="1" defaultChecked={sale === "1"} />
            On promotion
          </label>
          <button className="min-h-11 rounded-xl bg-[#0B6E4F] px-4 py-2 text-sm font-semibold text-white sm:col-span-5">Apply filters</button>
        </form>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{heading}</h1>
            <p className="mt-1 text-sm text-[#6B7280]">{q ? `Results for “${q}”` : "Browse live products and services from LaGecto shops"}</p>
          </div>
          <p className="text-sm text-[#6B7280]">{products.length} items</p>
        </div>
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <CatalogEmpty title="No matching items" body="Try another search or clear filters. Empty results are shown instead of placeholder products." />
        )}
      </section>
    </>
  );
}
