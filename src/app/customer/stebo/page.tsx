import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { SteboChat } from "@/components/stebo/SteboChat";

export default async function CustomerSteboPage() {
  await requireRole("customer");
  return (
    <>
      <PageHeader title="Stebo" subtitle="Your personal LaGecto companion." />
      <SteboChat mode="personal" title="Stebo Personal" />
    </>
  );
}
