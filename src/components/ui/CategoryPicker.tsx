"use client";

import { useState } from "react";
import { SHOP_CATEGORIES } from "@/lib/brand";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export function CategoryPicker({
  name,
  defaultValue = "other",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="col-span-full min-w-0">
      <p className="mb-2 text-sm font-medium">Category</p>
      <input type="hidden" name={name} value={value} />
      <div className="flex max-h-56 flex-wrap gap-2 overflow-auto rounded-2xl border border-[#E5E7EB] bg-white p-3">
        {SHOP_CATEGORIES.map((category) => {
          const active = value === category.slug;
          return (
            <button
              key={category.slug}
              type="button"
              onClick={() => setValue(category.slug)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                active ? "bg-[#0B6E4F] text-white" : "border border-[#E5E7EB] text-[#1E1E1E] hover:border-[#0B6E4F]/40"
              }`}
            >
              <CategoryIcon slug={category.slug} className="h-3.5 w-3.5" />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
