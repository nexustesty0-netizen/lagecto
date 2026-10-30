import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { AdminPosClient } from "@/components/admin/AdminPosClient";

export default async function AdminPosPage() {
  await requireRole("admin");
  return (
    <>
      <PageHeader
        title="Point of sale"
        subtitle="Record a payment and generate a LaGecto receipt for the customer."
      />
      <AdminPosClient />
    </>
  );
}
