import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { FloatingSupport } from "@/components/public/FloatingSupport";
import { PublicJsonLd } from "@/components/public/JsonLd";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <PublicJsonLd />
      <PublicHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
      <FloatingSupport />
    </div>
  );
}
