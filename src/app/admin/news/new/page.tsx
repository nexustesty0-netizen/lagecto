import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/primitives";
import { NewsEditor } from "@/components/admin/NewsEditor";

export default async function NewNewsPage() {
  await requireRole("admin");
  return (
    <>
      <PageHeader title="New article" />
      <NewsEditor />
    </>
  );
}
