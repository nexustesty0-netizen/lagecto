import { NextResponse } from "next/server";
import { logAppError, publicRpcMessage } from "@/lib/safe-log";

export { publicRpcMessage };

export function jsonError(scope: string, fallback: string, status = 400, error?: unknown, requestId?: string) {
  if (error) logAppError(scope, error, requestId);
  return NextResponse.json({ error: fallback }, { status });
}
