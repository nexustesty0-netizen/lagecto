import { featureLockReason, loadOwnedShopWithFeatures } from "@/lib/entitlements";
import { PageHeader } from "@/components/ui/primitives";
import { FeatureLocked } from "@/components/shop/FeatureLocked";
import { EmployeeForm } from "@/components/shop/EmployeeForm";

export default async function NewEmployeePage() {
  const { shop, features, disabledFeatures } = await loadOwnedShopWithFeatures();
  if (!shop) return null;
  const locked = featureLockReason(features, disabledFeatures, "employees");
  if (locked) return <FeatureLocked feature="employees" reason={locked} />;
  return (
    <>
      <PageHeader title="Add employee" subtitle="Only this shop can see this record." />
      <EmployeeForm submitLabel="Add employee" />
    </>
  );
}
