import { createServerSupabase } from "@/lib/supabase/server";
import { catalogPricesFromPlans, emptyCatalogPrices } from "@/lib/packages";

export async function loadLivePackagePrices() {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("subscription_plans")
      .select("package_key, duration_key, duration_months, price, promo_price, is_active")
      .eq("is_active", true);
    if (error) return emptyCatalogPrices();
    return catalogPricesFromPlans(data || []);
  } catch {
    return emptyCatalogPrices();
  }
}
