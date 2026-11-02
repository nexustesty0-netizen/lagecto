"use client";

import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";

export default function CustomerError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <AppErrorBoundary error={error} retry={retry} reset={reset} />;
}
