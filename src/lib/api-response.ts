import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RULE_VIOLATION"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export function apiSuccess<T>(data: T, status: number = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function apiError(code: ApiErrorCode, message: string, status: number = 400, fieldErrors?: Record<string, string[]>) {
  const body: ApiErrorBody = {
    code,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
  return NextResponse.json(body, { status });
}

export function handleZodError(error: ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (!fieldErrors[field]) {
      fieldErrors[field] = [];
    }
    fieldErrors[field].push(issue.message);
  }
  return apiError("VALIDATION_ERROR", "داده‌های ارسالی نامعتبر است", 422, fieldErrors);
}
