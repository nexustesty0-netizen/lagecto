import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: true, follow: true },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Customers and admins use email or username. Shop owners sign in with a Shop ID, for example gectotech@lg23."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
