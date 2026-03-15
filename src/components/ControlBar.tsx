import { Grid3x3, Maximize2, Search, SlidersHorizontal, Download } from "lucide-react";

type StatusFilter = "all" | "online" | "warning" | "offline";

type ControlBarProps = {
  viewMode: "grid" | "single";
  onToggleView: () => void;
  onFullscreen: () => void | Promise<void>;

  searchTerm: string;
  onSearchChange: (v: string) => void;

  onOpenFilters: () => void;
  onExport: () => void;

  // optional (if you want quick status filter later)
  statusFilter?: StatusFilter;
};

export function ControlBar({
  viewMode,
  onToggleView,
  onFullscreen,
  searchTerm,
  onSearchChange,
  onOpenFilters,
  onExport,
}: ControlBarProps) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        {/* View Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleView}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Toggle grid/single view"
          >
            <Grid3x3 className="w-4 h-4" />
            <span>{viewMode === "grid" ? "Grid View" : "Single View"}</span>
          </button>

          <button
            onClick={onFullscreen}
            className="flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Fullscreen</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-800 text-white pl-10 pr-4 py-2 rounded-lg border border-slate-700 focus:border-slate-600 focus:outline-none w-64"
            />
          </div>

          <button
            onClick={onOpenFilters}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Open filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>

          <button
            onClick={onExport}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            title="Export current list"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </div>
  );
}