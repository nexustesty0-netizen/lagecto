import { DiaryScreen } from "@/components/diary/DiaryScreen";

export default async function ShopDiaryModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return <DiaryScreen role="shop_owner" moduleSlug={module} />;
}
