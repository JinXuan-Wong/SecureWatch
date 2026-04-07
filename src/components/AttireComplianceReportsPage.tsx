// AttireComplianceReportsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Filter, TrendingUp, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ATTIRE_API_BASE } from "../api/base";

const API_BASE = ATTIRE_API_BASE;

type AttireEvent = {
  id: string;
  video_id?: string;
  video_name?: string;
  label?: string;          // "sleeveless" | "shorts" | "slippers"
  location?: string;       // view name
  view?: string;
  ts: number;              // epoch seconds
  status?: "Pending" | "Resolved";
  resolved_ts?: number | null;
  evidence_url?: string;   // "/violations/..."
};

function titleCaseViolation(label?: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("sleeveless")) return "Sleeveless";
  if (s.includes("shorts")) return "Shorts";
  if (s === "slippers" || s.includes("sandal")) return "Slippers";
  return (label || "Unknown").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatWeekTick(v: string) {
  const d = new Date(v);
  const date = d.toISOString().slice(0, 10); // yyyy-mm-dd
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  return { date, weekday };
}

type DewarpView = { name: string; label?: string };

async function apiGetDewarpLabels(API_BASE: string, videoId: string): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/attire/dewarp/${encodeURIComponent(videoId)}`);
  if (!res.ok) return {};
  const j = await res.json();
  const views: DewarpView[] = j?.views || [];
  const m: Record<string, string> = {};
  for (const v of views) {
    if (v?.name) m[String(v.name)] = String(v.label || v.name);
  }
  return m;
}

const DailyTick = ({ x, y, payload }: any) => {
  const d = new Date(payload.value);
  const date = d.toISOString().slice(5, 10); // MM-DD
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });

  return (
    <g transform={`translate(${x},${y})`}>
      <text y={0} dy={12} textAnchor="middle" fill="#94a3b8" fontSize={12}>
        {date}
      </text>
      <text y={0} dy={26} textAnchor="middle" fill="#64748b" fontSize={11}>
        {weekday}
      </text>
    </g>
  );
};

export function AttireComplianceReportsPage({ canExport }: { canExport: boolean }) {
  // default last 7 days
  const [startDate, setStartDate] = useState<string>(() => toDateInputValue(new Date(Date.now() - 6 * 86400000)));
  const [endDate, setEndDate] = useState<string>(() => toDateInputValue(new Date()));
  const [trendMode, setTrendMode] = useState<"weekly" | "monthly">("weekly");
  const reportHeaderRef = useRef<HTMLDivElement | null>(null);
  const chartsRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [filterType, setFilterType] = useState<string>("All");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [viewLabelByVideo, setViewLabelByVideo] = useState<Record<string, Record<string, string>>>({});
  const [filterSourceId, setFilterSourceId] = useState<string>("All");
  const [sourceOptions, setSourceOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [sourceNameMap, setSourceNameMap] = useState<Record<string, string>>({ webcam: "Webcam" });
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<AttireEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadSources() {
    const map: Record<string, string> = { webcam: "Webcam" };
    const opts: Array<{ id: string; name: string }> = [{ id: "webcam", name: "Webcam" }];

    // offline videos
    try {
      const r1 = await fetch(`${API_BASE}/api/offline/videos`);
      if (r1.ok) {
        const vids = await r1.json();
        (Array.isArray(vids) ? vids : []).forEach((v: any) => {
          if (!v?.id) return;
          const name = v.name || v.id;
          map[v.id] = name;
          opts.push({ id: v.id, name });
        });
      }
    } catch {}

    // RTSP sources
    try {
      const r2 = await fetch(`${API_BASE}/api/rtsp/sources`);
      if (r2.ok) {
        const j = await r2.json();
        const srcs = j.sources || [];
        (Array.isArray(srcs) ? srcs : []).forEach((s: any) => {
          if (!s?.id) return;
          const name = s.name || s.id;
          map[s.id] = name;
          opts.push({ id: s.id, name });
        });
      }
    } catch {}

    // nice ordering
    opts.sort((a, b) => a.name.localeCompare(b.name));

    setSourceNameMap(map);
    setSourceOptions(opts);
  }

  async function loadReport() {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({
        start: startDate,
        end: endDate,
        vtype: filterType,
        status: filterStatus,
        limit: "2000",
      });
      if (filterSourceId !== "All") qs.set("video_id", filterSourceId);

      const r = await fetch(`${API_BASE}/api/attire/reports?${qs.toString()}`);
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const evs = (data.events || []) as AttireEvent[];
      setEvents(evs);

      // build view labels cache (video_id -> {viewName: viewLabel})
      const uniqVideoIds = Array.from(
        new Set(evs.map(e => String(e.video_id || "").trim()).filter(Boolean))
      );

      const next: Record<string, Record<string, string>> = {};
      await Promise.all(
        uniqVideoIds.map(async (vid) => {
          try {
            next[vid] = await apiGetDewarpLabels(API_BASE, vid);
          } catch {
            next[vid] = {};
          }
        })
      );

      setViewLabelByVideo(next);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filterType, filterStatus, filterSourceId]);

  const filtered = useMemo(() => {
    // backend already filters, but keep safe in UI
    const sd = new Date(startDate);
    const ed = new Date(endDate);
    ed.setHours(23, 59, 59, 999);

    return events.filter((e) => {
      const dt = new Date((e.ts || 0) * 1000);
      if (dt < sd || dt > ed) return false;

      const t = titleCaseViolation(e.label);
      if (filterType !== "All" && t !== filterType) return false;

      const st = e.status || "Pending";
      if (filterStatus !== "All" && st !== filterStatus) return false;

      return true;
    });
  }, [events, startDate, endDate, filterType, filterStatus]);

  const totalViolations = filtered.length;
  const resolvedCount = filtered.filter((v) => (v.status || "Pending") === "Resolved").length;
  const pendingCount = totalViolations - resolvedCount;
  const resolvedRate = totalViolations > 0 ? ((resolvedCount / totalViolations) * 100).toFixed(1) : "0.0";

  const typeCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of filtered) {
      const t = titleCaseViolation(e.label);
      acc[t] = (acc[t] || 0) + 1;
    }
    return acc;
  }, [filtered]);

  function formatLocation(e: AttireEvent) {
    const vid = String(e.video_id || "").trim();

    // source name: video_name first, else fallback to video_id
    const srcName = e.video_name || sourceNameMap[vid] || vid || "Unknown";

    // view key: prefer e.view, else try parse from e.location "VideoName, view"
    let viewKey = String(e.view || "").trim();
    if (!viewKey && e.location && String(e.location).includes(",")) {
      viewKey = String(e.location).split(",").slice(1).join(",").trim();
    }

    const viewLabel = (vid && viewLabelByVideo[vid]?.[viewKey]) || viewKey || "normal";
    return `${srcName}, ${viewLabel}`;
  }

  const mostFrequentViolation =
    Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const violationTypeChartData = Object.entries(typeCounts).map(([name, count]) => ({ name, count }));

  const dailyTrendData = useMemo(() => {
    const acc: Record<string, number> = {};

    for (const e of filtered) {
      const dt = new Date((e.ts || 0) * 1000);
      dt.setHours(0, 0, 0, 0);
      const key = ymd(dt);
      acc[key] = (acc[key] || 0) + 1;
    }

    // Always show last 8 days ending at selected endDate (or today if endDate is today)
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const out: { day: string; violations: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const key = ymd(d);
      out.push({
        day: key,
        violations: acc[key] || 0,
      });
    }

    return out;
  }, [filtered, endDate]);

  const monthlyTrendData = useMemo(() => {
    const acc: Record<string, number> = {};

    for (const e of filtered) {
      const dt = new Date((e.ts || 0) * 1000);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      acc[key] = (acc[key] || 0) + 1;
    }

    const start = new Date(startDate);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);

    const out: { month: string; violations: number }[] = [];
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        month: key,
        violations: acc[key] || 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return out;
  }, [filtered, startDate, endDate]);

  const trendChartData = trendMode === "weekly" ? dailyTrendData : monthlyTrendData;

  const MonthlyTick = ({ x, y, payload }: any) => {
    const value = String(payload.value || "");
    const [yyyy, mm] = value.split("-");
    const d = new Date(Number(yyyy), Number(mm) - 1, 1);

    const month = d.toLocaleDateString(undefined, { month: "short" });
    const year = yyyy;

    return (
      <g transform={`translate(${x},${y})`}>
        <text y={0} dy={12} textAnchor="middle" fill="#94a3b8" fontSize={12}>
          {month}
        </text>
        <text y={0} dy={26} textAnchor="middle" fill="#64748b" fontSize={11}>
          {year}
        </text>
      </g>
    );
  };

  const statusData = [
    { name: "Resolved", value: resolvedCount, color: "#10b981" },
    { name: "Pending", value: pendingCount, color: "#ef4444" },
  ];

  const handleExportExcel = () => {
    if (!canExport) {
      alert("Export is restricted to Admin accounts.");
      return;
    }
    const qs = new URLSearchParams({
      start: startDate,
      end: endDate,
      vtype: filterType,
      status: filterStatus,
    });
    if (filterSourceId !== "All") qs.set("video_id", filterSourceId);
    window.open(`${API_BASE}/api/attire/reports/export.csv?${qs.toString()}`, "_blank");
  };

  const handleExportPDF = async () => {
    if (!canExport) {
      alert("Export is restricted to Admin accounts.");
      return;
    }

    if (!chartsRef.current) return;

    try {
      const chartsCanvas = await html2canvas(chartsRef.current, {
        scale: 2,
        backgroundColor: "#0f172a",
        useCORS: true,
        scrollY: -window.scrollY,
      });

      const chartImage = chartsCanvas.toDataURL("image/png");

      const payload: Record<string, any> = {
        start: startDate,
        end: endDate,
        vtype: filterType,
        status: filterStatus,
        chart_image: chartImage,
      };

      if (filterSourceId !== "All") {
        payload.video_id = filterSourceId;
      }

      const res = await fetch(`${API_BASE}/api/attire/reports/export.pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "attire_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Failed to export PDF: ${String(e?.message || e)}`);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden min-w-0 bg-[#0f172a]">
      <div ref={reportHeaderRef}>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white mb-1">Attire Compliance Reports</h2>
              <p className="text-slate-400">Track and analyze dress code compliance violations</p>
              {loading && <div className="text-slate-500 text-sm mt-1">Loading…</div>}
              {err && <div className="text-red-400 text-sm mt-1">{err}</div>}
            </div>

            <div className="flex items-center gap-2">
              {canExport ? (
                <>
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Excel
                  </button>
                </>
              ) : (
                <div className="text-slate-400 text-sm">
                  Export is restricted to Admin accounts.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-slate-400 text-sm">Total Violations</div>
                <div className="text-white text-2xl">{totalViolations}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-green-900/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <div className="text-slate-400 text-sm">Resolved Cases</div>
                <div className="text-white text-2xl">{resolvedCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-red-900/30 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-slate-400 text-sm">Pending Cases</div>
                <div className="text-white text-2xl">{pendingCount}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <div className="text-slate-400 text-sm">Resolution Rate</div>
                <div className="text-white text-2xl">{resolvedRate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Most frequent */}
        <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <div>
              <div className="text-orange-300 text-sm">Most Frequent Violation</div>
              <div className="text-white">{mostFrequentViolation}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-4">
          <Filter className="w-4 h-4 text-slate-400" />

          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="date-input bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-slate-400 text-sm">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="date-input bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option>All</option>
            <option>Sleeveless</option>
            <option>Shorts</option>
            <option>Slippers</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option>All</option>
            <option>Pending</option>
            <option>Resolved</option>
          </select>

          <select
            value={filterSourceId}
            onChange={(e) => setFilterSourceId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="All">All Sources</option>
            {sourceOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Charts */}
      <div ref={chartsRef}>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h3 className="text-white mb-4">Violation Type Frequency</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={violationTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="count" fill="#f97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white">
                {trendMode === "weekly" ? "Last 8 Days Trend" : "Monthly Trend"}
              </h3>

              <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
                <button
                  type="button"
                  onClick={() => setTrendMode("weekly")}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    trendMode === "weekly"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setTrendMode("monthly")}
                  className={`px-3 py-1.5 text-sm border-l border-slate-700 transition-colors ${
                    trendMode === "monthly"
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey={trendMode === "weekly" ? "day" : "month"}
                  tick={trendMode === "weekly" ? <DailyTick /> : <MonthlyTick />}
                  height={40}
                  interval={0}
                  minTickGap={0}
                  stroke="#94a3b8"
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="violations"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 6 }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 mb-6">
          <h3 className="text-white mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="text-white">Historical Violations</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs text-slate-400 uppercase tracking-wider">Image</th>
                <th className="px-6 py-3 text-left text-xs text-slate-400 uppercase tracking-wider">Violation Type</th>
                <th className="px-6 py-3 text-left text-xs text-slate-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs text-slate-400 uppercase tracking-wider">Detection Date</th>
                <th className="px-6 py-3 text-left text-xs text-slate-400 uppercase tracking-wider">Resolved Date</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800">
              {filtered.map((e) => {
                const dt = new Date((e.ts || 0) * 1000);
                const rt = e.resolved_ts ? new Date(e.resolved_ts * 1000) : null;

                return (
                  <tr key={e.id} className="hover:bg-slate-800/30">
                    <td className="px-6 py-2">
                      {e.evidence_url ? (
                        <a
                          href={`${API_BASE}${e.evidence_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-12 h-12 rounded-md overflow-hidden border border-slate-700 bg-slate-800 hover:border-slate-500 transition-colors"
                        >
                          <img
                            src={`${API_BASE}${e.evidence_url}`}
                            alt={titleCaseViolation(e.label)}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(ev) => {
                              const img = ev.currentTarget;
                              img.style.display = "none";
                              const holder = img.parentElement;
                              if (holder && !holder.querySelector(".thumb-fallback")) {
                                const div = document.createElement("div");
                                div.className =
                                  "thumb-fallback w-full h-full flex items-center justify-center text-slate-500 text-[10px]";
                                div.textContent = "No Image";
                                holder.appendChild(div);
                              }
                            }}
                          />
                        </a>
                      ) : (
                        <div className="w-12 h-12 rounded-md border border-dashed border-slate-700 bg-slate-800 flex items-center justify-center text-slate-500 text-[10px]">
                          No Image
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-2 whitespace-nowrap text-sm font-semibold text-white">
                      {titleCaseViolation(e.label)}
                    </td>

                    <td className="px-6 py-2 text-sm text-slate-300 whitespace-nowrap">
                      {formatLocation(e)}
                    </td>

                    <td className="px-6 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                          (e.status || "Pending") === "Resolved"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {e.status || "Pending"}
                      </span>
                    </td>

                    <td className="px-6 py-2 whitespace-nowrap text-sm text-slate-300">
                      {dt.toLocaleString()}
                    </td>

                    <td className="px-6 py-2 whitespace-nowrap text-sm text-slate-300">
                      {rt ? rt.toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-400">
            No data found matching the selected filters
          </div>
        )}
      </div>
    </div>
  );
}
