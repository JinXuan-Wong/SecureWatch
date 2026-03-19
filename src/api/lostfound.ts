import { LOSTFOUND_API_BASE } from "./base";

const clean = (v?: string | null) => String(v || "").trim();

export function lfBase() {
  return clean(LOSTFOUND_API_BASE).replace(/\/+$/, "");
}

export function lfUrl(path?: string | null) {
  const s = clean(path);
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) {
    // replace localhost absolute URLs with production base if needed
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(s)) {
      try {
        const u = new URL(s);
        return `${lfBase()}${u.pathname}${u.search}`;
      } catch {
        return s;
      }
    }
    return s;
  }

  return `${lfBase()}${s.startsWith("/") ? "" : "/"}${s}`;
}

export function lfStateUrl() {
  return `${lfBase()}/api/live/state`;
}

export function lfStatusUrl() {
  return `${lfBase()}/api/live/status`;
}

export function lfDetectionStateUrl() {
  return `${lfBase()}/api/live/detection/state`;
}

export function lfDetectionToggleUrl(camId: string) {
  return `${lfBase()}/api/live/detection/toggle/${encodeURIComponent(camId)}`;
}

export function lfRestartUrl(camId: string) {
  return `${lfBase()}/api/live/restart?target_cam_id=${encodeURIComponent(camId)}`;
}

export function lfCamerasForSettingsUrl() {
  return `${lfBase()}/api/lostfound/cameras_for_settings`;
}

export function lfMjpegUrl(camId: string, viewId: string | number) {
  return `${lfBase()}/api/live/mjpeg/${encodeURIComponent(camId)}/${encodeURIComponent(String(viewId))}`;
}

export function lfDashboardFrameUrl(camId: string, viewId: string | number) {
  return `${lfBase()}/api/live/dashboard_frame/${encodeURIComponent(camId)}/${encodeURIComponent(String(viewId))}`;
}

export function lfEvidenceUrl(url?: string | null) {
  return lfUrl(url);
}