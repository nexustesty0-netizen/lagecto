import Link from "next/link";
import { Bug, Headphones, LifeBuoy, MessageCircle, ShieldAlert, Sparkles } from "lucide-react";

export function SupportCards({ basePath }: { basePath: string }) {
  const cards = [
    { href: `${basePath}/contact`, icon: Headphones, title: "Contact Support", body: "Need help? Talk to LaGecto Support." },
    { href: `${basePath}/bug`, icon: Bug, title: "Report a Bug", body: "Something isn't working correctly? Tell us what happened." },
    { href: `${basePath}/technical`, icon: LifeBuoy, title: "Technical Issue", body: "Problems with the app, account, checkout or another feature?" },
    { href: `${basePath}/report-shop`, icon: ShieldAlert, title: "Report a Shop", body: "See suspicious or potentially fraudulent activity? Let us know." },
    { href: `${basePath}/feedback`, icon: Sparkles, title: "Send Feedback", body: "Help us make LaGecto better." },
    { href: `${basePath}/faqs`, icon: MessageCircle, title: "FAQs", body: "Find quick answers to common questions." },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="lg-support-card group">
          <card.icon className="h-6 w-6 text-[#0B6E4F]" aria-hidden />
          <h2 className="mt-3 font-semibold">{card.title}</h2>
          <p className="mt-1 text-sm text-[var(--lagecto-muted)]">{card.body}</p>
          <span className="mt-4 inline-block text-sm font-semibold text-[#0B6E4F]">Open</span>
        </Link>
      ))}
    </div>
  );
}
