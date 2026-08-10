const APP_BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";

export function appPath(path: string) {
  if (!path || path === "/") return APP_BASE_PATH || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${normalized}`;
}

export function navigateTo(path: string) {
  window.location.href = appPath(path);
}

export function getPathId(segment: string) {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const index = parts.indexOf(segment);
  return index >= 0 ? parts[index + 1] || "" : "";
}
