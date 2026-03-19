// src/api/auth.ts
import { LOSTFOUND_API_BASE } from "./base";

type LoginPayload = {
  username: string;
  password: string;
};

export async function loginApi(payload: LoginPayload) {
  if (!LOSTFOUND_API_BASE) {
    throw new Error("VITE_LOSTFOUND_API_BASE is not configured");
  }

  const res = await fetch(`${LOSTFOUND_API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    credentials: "include",
  });

  if (!res.ok) {
    let msg = `Login failed (${res.status})`;
    try {
      const data = await res.json();
      msg = data?.detail || data?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return res.json();
}

export async function getMeApi() {
  if (!LOSTFOUND_API_BASE) {
    throw new Error("VITE_LOSTFOUND_API_BASE is not configured");
  }

  const res = await fetch(`${LOSTFOUND_API_BASE}/api/auth/me`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to load user (${res.status})`);
  }

  return res.json();
}

export async function logoutApi() {
  if (!LOSTFOUND_API_BASE) {
    throw new Error("VITE_LOSTFOUND_API_BASE is not configured");
  }

  const res = await fetch(`${LOSTFOUND_API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Logout failed (${res.status})`);
  }

  return res.json().catch(() => ({}));
}