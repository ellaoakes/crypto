import { NextResponse } from "next/server";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Consistent JSON error shape for all route handlers. */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, details } },
    { status },
  );
}
