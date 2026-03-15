import { apiGet, apiUrl } from "./http";
import type { Camera, DetectionsResponse, EventsResponse } from "../types/attire";

export type DashRow = {
  video_id: string;
  name: string;
  count: number;
  top_type: string;
  risk: "low" | "medium" | "high";
  people_est?: number;
};

export type DashData = {
  generated_ts: number;
  overview: {
    violations_today: number;
    violations_24h: number;
    most_common_24h: string;
    worst_camera_24h: DashRow | null;
  };
  hotspot_24h: DashRow[];
  hotspot_7d: DashRow[];
  breakdown_24h: { type: string; count: number }[];
  recent_events: any[];
};

export function getStreamUrl(cameraId: string) {
  return apiUrl(`/api/cameras/${cameraId}/stream`);
}

export function getCameras() {
  return apiGet<Camera[]>(`/api/cameras`);
}

export function getLatestDetections(cameraId: string) {
  return apiGet<DetectionsResponse>(`/api/cameras/${cameraId}/detections`);
}

export function getEvents(cameraId: string, limit = 50) {
  return apiGet<EventsResponse>(`/api/events?camera_id=${encodeURIComponent(cameraId)}&limit=${limit}`);
}

export function getAttireDashboard() {
  return apiGet<DashData>(`/api/attire/dashboard`);
}
