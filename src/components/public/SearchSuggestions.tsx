"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { shopHref } from "@/lib/storefront/paths";

const HISTORY_KEY = "lagecto-search-history";

function shopSlug(value: { slug?: string | null } | { slug?: string | null }[] | undefined) {
  return Array.isArray(value) ? value[0]?.slug : value?.slug;
}

export function SearchSuggestions({
  q,
  placeholder,
}: {
  q?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(q || "");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [hits, setHits] = useState<{
    products: { id: string; name: string; shops?: { slug?: string | null } | { slug?: string | null }[] }[];
    shops: { id: string; name: string; slug: string | null }[];
    services: { id: string; name: string; shops?: { slug?: string | null } | { slug?: string | null }[] }[];
  }>({ products: [], shops: [], services: [] });

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setHits({ products: [], shops: [], services: [] });
      return;
    }
    const timer = window.setTimeout(() => {
      fetch(`/api/marketplace/suggest?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then(setHits)
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [value]);

  function remember() {
    const term = value.trim();
    if (term.length < 2) return;
    const next = [term, ...history.filter((item) => item !== term)].slice(0, 6);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  return (
    <div className="relative w-full">
      <input
        id="marketplace-search"
        name="q"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full border-0 bg-transparent px-3 py-3.5 text-base shadow-none outline-none focus:shadow-none"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") remember();
        }}
      />
      {open && (hits.shops.length || hits.products.length || hits.services.length || history.length) ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border bg-white text-left shadow-lg">
          {hits.shops.slice(0, 3).map((shop) => (
            <Link key={shop.id} href={shopHref(shop)} className="block px-4 py-2 text-sm hover:bg-[#F3EEE0]">
              Shop · {shop.name}
            </Link>
          ))}
          {hits.products.slice(0, 3).map((product) => (
            <Link key={product.id} href={shopSlug(product.shops) ? `/s/${shopSlug(product.shops)}/p/${product.id}` : "/marketplace"} className="block px-4 py-2 text-sm hover:bg-[#F3EEE0]">
              Product · {product.name}
            </Link>
          ))}
          {hits.services.slice(0, 3).map((service) => (
            <Link key={service.id} href={shopSlug(service.shops) ? `/s/${shopSlug(service.shops)}/p/${service.id}` : "/marketplace"} className="block px-4 py-2 text-sm hover:bg-[#F3EEE0]">
              Service · {service.name}
            </Link>
          ))}
          {history.slice(0, 4).map((term) => (
            <Link key={term} href={`/marketplace?q=${encodeURIComponent(term)}`} className="block px-4 py-2 text-sm text-[var(--lagecto-muted)] hover:bg-[#F3EEE0]">
              Recent · {term}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
