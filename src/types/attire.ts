export type Camera = {
  id: string;
  name: string;
  location?: string;
  mode?: string; // "attire"

  // ✅ add these
  status?: "online" | "warning" | "offline";
  recording?: boolean;

  // (optional but recommended if your UI uses it)
  detections?: DetectionBox[];
};

export type DetectionBox = {
  id: string;
  x: number;      // percent
  y: number;      // percent
  width: number;  // percent
  height: number; // percent
  label: string;
  violation?: string;
};

export type DetectionsResponse = {
  ts: number;
  fps: number;
  resolution: [number, number];
  detections: DetectionBox[];
};

export type AttireEvent = {
  id: string;
  camera_id: string;
  ts: number;
  type: string;   // "attire_violation"
  label: string;  // "Slippers"
};

export type EventsResponse = {
  events: AttireEvent[];
};
