import type { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "zxt_mobile_session";

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function normalizeSameSite(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return "Lax";
}

function cookieSecure() {
  const sameSite = normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE);
  return sameSite === "None" || parseBooleanEnv(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production");
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; expires: Date; httpOnly?: boolean },
) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${Math.max(0, Math.floor(options.maxAge))}`,
    `Expires=${options.expires.toUTCString()}`,
    `SameSite=${normalizeSameSite(process.env.AUTH_COOKIE_SAMESITE)}`,
  ];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

export function getAuthCookieToken(request?: Request) {
  const cookieHeader = request?.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(AUTH_COOKIE_NAME.length + 1));
  } catch {
    return "";
  }
}

export function setAuthCookie(response: NextResponse, token: string, expiresAt: string) {
  const expires = new Date(expiresAt);
  const maxAge = Number.isFinite(expires.getTime())
    ? Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000))
    : 7 * 24 * 60 * 60;
  response.headers.append(
    "Set-Cookie",
    serializeCookie(AUTH_COOKIE_NAME, token, {
      maxAge,
      expires: Number.isFinite(expires.getTime()) ? expires : new Date(Date.now() + maxAge * 1000),
    }),
  );
}

export function clearAuthCookie(response: NextResponse) {
  response.headers.append(
    "Set-Cookie",
    serializeCookie(AUTH_COOKIE_NAME, "", {
      maxAge: 0,
      expires: new Date(0),
    }),
  );
}
