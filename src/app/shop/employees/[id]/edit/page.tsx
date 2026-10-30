import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { EmployeeForm } from "@/components/shop/EmployeeForm";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "employees");
  if (locked) return <FeatureLocked feature="employees" reason={locked} />;
  const supabase = await createServerSupabase();
  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!employee) notFound();
  return (
    <>
      <PageHeader title={`Edit ${employee.name}`} subtitle="Changes are checked on the server for this shop only." />
      <EmployeeForm employee={employee} />
    </>
  );
}
