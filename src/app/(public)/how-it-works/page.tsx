import type { Metadata } from "next";

export const metadata: Metadata = { title: "How LaGecto works" };

export default function HowItWorksPage() {
  const steps = [
    { title: "Browse without an account", body: "Explore shops and add products to your cart before you sign in." },
    { title: "Checkout via WhatsApp", body: "Review your cart and place the order. You can order without an account if you add your name. LaGecto records it as pending. WhatsApp opens with the order details so you can arrange payment directly with the shop." },
    { title: "Track the order", body: "Signed-in customers can follow orders and receipts. Payment stays between you and the shop — LaGecto does not collect it." },
    { title: "Shop owners fulfil", body: "Shop dashboards handle orders, POS, inventory, receipts and finances." },
    { title: "Administrators oversee", body: "Admins create shops, generate Shop IDs, review verification and unlock accounts." },
  ];
  return (
    <article className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-semibold">How LaGecto works</h1>
      <ol className="mt-10 grid gap-4">
        {steps.map((step, index) => (
          <li key={step.title} className="lg-card p-6">
            <p className="text-sm font-semibold text-[#D4AF37]">Step {index + 1}</p>
            <h2 className="mt-1 text-xl font-semibold">{step.title}</h2>
            <p className="mt-2 text-[#6B7280]">{step.body}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
