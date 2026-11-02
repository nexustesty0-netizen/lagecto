"use client";

import { useMemo, useState } from "react";
import { filterAdminProducts } from "@/lib/admin/control-centre";
import { money } from "@/lib/format";

export type AdminListedProduct = {
  id: string;
  name: string;
  price: number;
  stock: number | null;
  type: string | null;
  category: string | null;
  shops: { name?: string | null } | null;
};

export function AdminProductsTable({ products }: { products: AdminListedProduct[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const rows = useMemo(
    () =>
      filterAdminProducts(
        products.map((product) => ({
          id: product.id,
          name: product.name,
          type: product.type,
          category: product.category,
          shop_name: product.shops?.name || "",
        })),
        query,
        type,
      ),
    [products, query, type],
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 md:grid-cols-[1fr_10rem]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product or shop" className="rounded-xl border px-3 py-2" />
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border px-3 py-2">
          <option value="all">All types</option>
          <option value="product">Products</option>
          <option value="service">Services</option>
        </select>
      </div>
      <div className="app-table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Shop</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const product = byId.get(row.id);
              return (
                <tr key={row.id}>
                  <td>
                    <p>{row.name}</p>
                    <p className="text-xs text-[#6B7280]">{row.category || row.type}</p>
                  </td>
                  <td>{row.shop_name || "—"}</td>
                  <td>{money(product?.price)}</td>
                  <td>{product?.type === "service" ? "Service" : product?.stock ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="text-sm text-[#6B7280]">No listed items match this search.</p> : null}
    </div>
  );
}
