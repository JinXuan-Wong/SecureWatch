import { Camera as CameraIcon, Video, VideoOff, Circle, AlertTriangle, WifiOff } from "lucide-react";
import type { DetectionBox } from "../types/attire";

// Minimal camera shape so different modules can reuse CameraFeed
type CameraLike = {
  id: string;
  name?: string;
  location?: string;
  status?: "online" | "warning" | "offline";
  recording?: boolean;
};

interface CameraFeedProps {
  camera?: CameraLike;
  isSelected: boolean;
  onSelect: () => void;
  onRecordingToggle: () => void;

  detections?: DetectionBox[];
  streamUrl?: string;
}

export function CameraFeed({
  camera,
  isSelected,
  onSelect,
  onRecordingToggle,
  detections,
  streamUrl,
}: CameraFeedProps) {
  const safeDetections = detections ?? [];

  const status = camera?.status ?? "offline";
  const isOffline = status === "offline";

  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "offline":
      default:
        return "text-red-400";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "online":
        return <Circle className="w-3 h-3 fill-current" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4" />;
      case "offline":
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
        isSelected
          ? "border-blue-500 shadow-lg shadow-blue-500/20"
          : "border-slate-700 hover:border-slate-600"
      }`}
    >
      {/* Camera Feed */}
      <div className="aspect-video bg-slate-900 relative overflow-hidden">
        {/* Show stream only if we have a URL and camera isn't offline */}
        {!isOffline && streamUrl ? (
          <>
            <img
              src={streamUrl}
              alt={camera?.name ?? "camera stream"}
              className="w-full h-full object-cover block"
            />

            {/* Overlay boxes */}
            <div className="pointer-events-none absolute inset-0">
              {safeDetections.map((d) => (
                <div
                  key={d.id}
                  className="absolute border-2 border-red-500"
                  style={{
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    width: `${d.width}%`,
                    height: `${d.height}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 rounded bg-red-600 px-2 py-0.5 text-xs text-white">
                    {d.label}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-950">
            <div className="text-center">
              <WifiOff className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500">
                {isOffline ? "No Signal" : "No Stream URL"}
              </p>
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {camera?.recording && !isOffline && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-2 py-1 rounded">
            <Circle className="w-2 h-2 fill-current animate-pulse" />
            <span className="text-xs">REC</span>
          </div>
        )}

        {/* Camera Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-white">{camera?.name ?? "Camera"}</h3>
              <p className="text-slate-300 text-sm mt-1">{camera?.location ?? ""}</p>
            </div>
            <div className={`flex items-center gap-1.5 ${getStatusColor()}`}>
              {getStatusIcon()}
            </div>
          </div>
        </div>

        {/* Hover Controls */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRecordingToggle();
            }}
            className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg transition-colors"
            disabled={isOffline}
          >
            {camera?.recording ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg transition-colors"
          >
            <CameraIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera ID */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs">
        {(camera?.id ?? "—").toUpperCase()}
      </div>
    </div>
  );
}
