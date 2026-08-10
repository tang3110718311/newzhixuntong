import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function createTraceId() {
  return `trace_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function ok<T>(data: T, traceId = createTraceId(), status = 200) {
  return NextResponse.json({ success: true, code: "OK", message: "", traceId, data }, { status });
}

export function fail(code: string, message: string, status = 400, traceId = createTraceId()) {
  return NextResponse.json({ success: false, code, message, traceId, data: null }, { status });
}

export function handleRouteError(error: unknown, traceId = createTraceId()) {
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", error.issues.map((issue) => issue.message).join("；"), 400, traceId);
  }

  if (error instanceof HttpError) {
    return fail(error.code, error.message, error.status, traceId);
  }

  console.error(`[${traceId}]`, error);
  return fail("INTERNAL_ERROR", "服务暂时不可用，请稍后重试。", 500, traceId);
}