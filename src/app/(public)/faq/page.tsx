import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "FAQs" };

export default function FaqRedirectPage() {
  redirect("/support/faqs");
}
