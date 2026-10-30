import { createServerSupabase } from "@/lib/supabase/server";

export type DashboardPeriod = "current" | "today" | "yesterday" | "week" | "last_week" | "month" | "last_month" | "year" | "custom";

export type ExpenseCategoryTotal = { category: string; amount: number };

export type ShopDashboardStats = {
  ok: boolean;
  timezone: string;
  period: string;
  current_period_id: string | null;
  revenue: number;
  expenses: number;
  payroll: number;
  cogs: number;
  profit: number;
  result: "profit" | "loss" | "break_even";
  calculation: string;
  calculation_label: string;
  expense_categories: ExpenseCategoryTotal[];
  paid_volume: number;
  refunded_volume: number;
  net_paid: number;
  pending_orders: number;
  completed_orders: number;
  products: number;
  services: number;
  customers: number;
  inventory_units: number;
  low_stock: number;
  active_promotions: number;
  completed_refunds: number;
  employee_count: number;
};

function asStats(value: unknown): ShopDashboardStats | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.ok === false) return null;
  return {
    ok: true,
    timezone: String(row.timezone || "Africa/Harare"),
    period: String(row.period || "current"),
    current_period_id: (row.current_period_id as string) || null,
    revenue: Number(row.revenue || 0),
    expenses: Number(row.expenses || 0),
    payroll: Number(row.payroll || 0),
    cogs: Number(row.cogs || 0),
    profit: Number(row.profit || 0),
    result: row.result === "loss" || row.result === "break_even" ? row.result : Number(row.profit || 0) > 0 ? "profit" : Number(row.profit || 0) < 0 ? "loss" : "break_even",
    calculation: String(row.calculation || "simplified_operating_profit"),
    calculation_label: String(row.calculation_label || "Completed sales − operating expenses − paid payroll"),
    expense_categories: Array.isArray(row.expense_categories)
      ? (row.expense_categories as ExpenseCategoryTotal[]).map((item) => ({
          category: String(item.category || "other"),
          amount: Number(item.amount || 0),
        }))
      : [],
    paid_volume: Number(row.paid_volume || 0),
    refunded_volume: Number(row.refunded_volume || 0),
    net_paid: Number(row.net_paid || 0),
    pending_orders: Number(row.pending_orders || 0),
    completed_orders: Number(row.completed_orders || 0),
    products: Number(row.products || 0),
    services: Number(row.services || 0),
    customers: Number(row.customers || 0),
    inventory_units: Number(row.inventory_units || 0),
    low_stock: Number(row.low_stock || 0),
    active_promotions: Number(row.active_promotions || 0),
    completed_refunds: Number(row.completed_refunds || 0),
    employee_count: Number(row.employee_count || 0),
  };
}

export function getShopSales(stats: ShopDashboardStats | null) {
  return stats?.revenue || 0;
}
export function getShopExpenses(stats: ShopDashboardStats | null) {
  return stats?.expenses || 0;
}
export function getShopPayroll(stats: ShopDashboardStats | null) {
  return stats?.payroll || 0;
}
export function getShopProfitLoss(stats: ShopDashboardStats | null) {
  return {
    amount: stats?.profit || 0,
    result: stats?.result || "break_even",
    label: stats?.calculation_label || "Completed sales − operating expenses − paid payroll",
  };
}

/**
 * Single source of truth for shop dashboard figures.
 * Delegates to public.shop_dashboard_stats so every surface uses the same
 * completed-sales / paid-payments / refund rules.
 */
export async function getShopDashboardStats(
  shopId: string,
  options?: { period?: DashboardPeriod; from?: string; to?: string },
) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("shop_dashboard_stats", {
    p_shop_id: shopId,
    p_period: options?.period || "current",
    p_from: options?.from || null,
    p_to: options?.to || null,
  });
  if (error) return null;
  return asStats(data);
}
