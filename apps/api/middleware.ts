import { NextResponse, type NextRequest } from "next/server";

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

function configuredAllowedOrigins() {
  const fromEnv = (process.env.API_CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...defaultAllowedOrigins, ...fromEnv]);
}

function resolveAllowedOrigin(origin: string | null) {
  if (!origin) return "";
  if (process.env.API_CORS_ALLOW_ALL === "true" && process.env.NODE_ENV !== "production") return origin;
  return configuredAllowedOrigins().has(origin) ? origin : "";
}

function applyCorsHeaders(response: NextResponse, request: NextRequest) {
  const allowedOrigin = resolveAllowedOrigin(request.headers.get("origin"));
  if (allowedOrigin) response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  if (allowedOrigin) response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Code");
  return response;
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && !resolveAllowedOrigin(origin)) {
    return NextResponse.json(
      { success: false, code: "CORS_ORIGIN_DENIED", message: "请求来源不被允许。", data: null },
      { status: 403 },
    );
  }

  if (request.method === "OPTIONS") {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), request);
  }

  return applyCorsHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: "/api/:path*",
};
