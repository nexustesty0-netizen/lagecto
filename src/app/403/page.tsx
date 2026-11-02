import type { Metadata } from "next";
import { ErrorScreen } from "@/components/errors/ErrorScreen";

export const metadata: Metadata = {
  title: "Access unavailable",
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return <ErrorScreen kind="forbidden" />;
}
