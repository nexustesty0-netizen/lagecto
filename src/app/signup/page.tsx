import { SignupForm } from "@/components/auth/SignupForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create account",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create a customer account"
      subtitle="This creates a shopper account for orders and receipts. To open a business, use Register a shop instead. Use a strong password with letters and numbers."
    >
      <SignupForm />
    </AuthShell>
  );
}
