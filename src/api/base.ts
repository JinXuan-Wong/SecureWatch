const clean = (url?: string) => url?.replace(/\/$/, "");

export const LOSTFOUND_API_BASE =
  clean(import.meta.env.VITE_LOSTFOUND_API_BASE_URL) ||
  "http://127.0.0.1:8000";

export const ATTIRE_API_BASE =
  clean(import.meta.env.VITE_ATTIRE_API_BASE_URL) ||
  "http://127.0.0.1:8001";