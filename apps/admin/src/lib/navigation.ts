const APP_BASE_PATH = process.env.NEXT_PUBLIC_APP_BASE_PATH || "";

export function appPath(path: string) {
  if (!path || path === "/") return APP_BASE_PATH || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${normalized}`;
}

export function navigateTo(path: string) {
  showNavigationLoading();
  window.location.href = appPath(path);
}

export function navigateBackOr(fallbackPath: string) {
  showNavigationLoading();
  const referrer = typeof document !== "undefined" ? document.referrer : "";
  const sameOriginReferrer = referrer && referrer.startsWith(window.location.origin);
  if (window.history.length > 1 && sameOriginReferrer) {
    window.history.back();
    return;
  }
  window.location.href = appPath(fallbackPath);
}

function showNavigationLoading() {
  if (typeof document === "undefined") return;
  if (document.getElementById("navigation-loading-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "navigation-loading-overlay";
  overlay.innerHTML = '<div class="navigation-loading-spinner" aria-label="页面跳转中" role="status"></div>';
  document.body.appendChild(overlay);
}

export function getPathId(segment: string) {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  const index = parts.indexOf(segment);
  return index >= 0 ? parts[index + 1] || "" : "";
}
