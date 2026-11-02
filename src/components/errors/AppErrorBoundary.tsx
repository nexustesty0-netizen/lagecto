"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/errors/ErrorScreen";
import { logAppError } from "@/lib/safe-log";

type BoundaryError = Error & { digest?: string };

export function AppErrorBoundary({
  error,
  retry,
  reset,
  compact = true,
}: {
  error: BoundaryError;
  retry?: () => void;
  reset?: () => void;
  compact?: boolean;
}) {
  useEffect(() => {
    logAppError("boundary", error);
  }, [error]);

  const recover = retry ?? reset;
  return (
    <ErrorScreen
      kind="error"
      compact={compact}
      onRetry={recover}
      reference={typeof error?.digest === "string" ? error.digest : undefined}
    />
  );
}
