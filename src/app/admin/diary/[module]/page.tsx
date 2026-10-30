import { DiaryScreen } from "@/components/diary/DiaryScreen";

export default async function AdminDiaryModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <DiaryScreen role="admin" moduleSlug={module} />;
}
