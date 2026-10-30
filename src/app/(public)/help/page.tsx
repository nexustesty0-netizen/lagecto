import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Help & Support" };

export default function HelpPage() {
  redirect("/support");
}
