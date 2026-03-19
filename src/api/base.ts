function normalizeBase(url?: string) {
  return (url || "").trim().replace(/\/+$/, "");
}

const env = (import.meta as any).env || {};
const isBrowser = typeof window !== "undefined";

const isLocalhost =
  isBrowser &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

/**
 * Base URLs (NO hardcoded production URLs)
 * Priority:
 * 1. module-specific env
 * 2. legacy shared env
 * 3. localhost fallback
 */
export const LEGACY_API_BASE = normalizeBase(env.VITE_API_BASE_URL);

export const LOSTFOUND_API_BASE = normalizeBase(
  env.VITE_LOSTFOUND_API_BASE_URL ||
    env.VITE_LOSTFOUND_API_BASE ||
    LEGACY_API_BASE ||
    (isLocalhost ? "http://127.0.0.1:8000" : "")
);

export const ATTIRE_API_BASE = normalizeBase(
  env.VITE_ATTIRE_API_BASE_URL ||
    env.VITE_ATTIRE_API_BASE ||
    LEGACY_API_BASE ||
    (isLocalhost ? "http://127.0.0.1:8001" : "")
);

export function getApiBase(mode: "lost-found" | "attire") {
  return mode === "lost-found" ? LOSTFOUND_API_BASE : ATTIRE_API_BASE;
}

export function buildApiUrl(base: string, path: string) {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function resolveApiUrl(
  mode: "lost-found" | "attire",
  url?: string | null
) {
  if (!url) return "";

  const s = String(url).trim();
  if (!s) return "";

  const base = getApiBase(mode);

  // convert localhost backend URL → env base
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(s)) {
    if (!base) return s;
    try {
      const u = new URL(s);
      return `${base}${u.pathname}${u.search}`;
    } catch {
      return s;
    }
  }

  // already absolute URL
  if (/^https?:\/\//i.test(s)) {
    return s;
  }

  // relative path
  if (!base) return s;
  return `${base}${s.startsWith("/") ? "" : "/"}${s}`;
}

export function resolveLostFoundUrl(url?: string | null) {
  return resolveApiUrl("lost-found", url);
}

export function resolveAttireUrl(url?: string | null) {
  return resolveApiUrl("attire", url);
}