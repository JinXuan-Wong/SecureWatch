import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Download, FileDown, Image as ImageIcon } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { LOSTFOUND_API_BASE, buildApiUrl } from "../api/base";

/* ================= TYPES ================= */

type LostFoundItem = {
  id: string;
  source?: string;
  location?: string;
  label?: string;
  status?: string;
  firstSeenTs?: number;
  lastSeenTs?: number;
  imageUrl?: string | null;
};

/* ================= UTILS ================= */

function fmtTs(ts?: number) {
  if (!ts) return "-";
  const ms = ts > 2_000_000_000_000 ? ts : ts * 1000;
  return new Date(ms).toLocaleString();
}

function isLost(x: LostFoundItem) {
  return (x.status || "").toLowerCase().includes("lost");
}

function isSolved(x: LostFoundItem) {
  return (x.status || "").toLowerCase().includes("solv");
}

function NiceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-slate-950/95 ring-1 ring-white/15 px-3 py-2 shadow-xl">
      <div className="text-xs text-slate-400">{label}</div>
      {payload.map((p: any, idx: number) => (
        <div key={idx} className="text-sm text-slate-100 font-medium">
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

function downloadBlob(filename: string, data: Blob) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ================= UI SMALL COMPONENTS ================= */

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: React.ReactNode;
  tone?: "red" | "green" | "neutral";
}) {
  const vCls =
    tone === "red"
      ? "text-red-400"
      : tone === "green"
      ? "text-emerald-400"
      : "text-white";

  return (
    <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-6">
      <div className="text-slate-400 text-sm">{title}</div>
      <div className={`text-2xl font-bold mt-2 ${vCls}`}>{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  height = 420,
  children,
}: {
  title: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-semibold text-slate-100">{title}</div>
        <div className="text-xs text-slate-400">Auto-generated</div>
      </div>

      <div
        className="rounded-xl bg-black/20 ring-1 ring-white/10 p-3"
        style={{ height }}
      >
        {children}
      </div>
    </div>
  );
}

/* ================= COMPONENT ================= */

function LostAndFoundReportsPageInner() {
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "lost" | "solved">(
    "all"
  );
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const abortRef = useRef<AbortController | null>(null);

  const reportRef = useRef<HTMLDivElement | null>(null);
  const chartsRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    try {
      const res = await fetch(
        buildApiUrl(LOSTFOUND_API_BASE, "/api/lostfound/items"),
        { signal: ac.signal }
      );
      if (!res.ok) throw new Error("Failed to load items");
      const js = await res.json();
      const arr: LostFoundItem[] = Array.isArray(js)
        ? js
        : Array.isArray(js?.items)
        ? js.items
        : [];

      const safe = arr
        .filter(
          (it) => it && typeof it === "object" && (it as any).id != null
        )
        .map((it: any) => ({
          id: String(it.id),
          source: it.source ? String(it.source) : "unknown",
          location: it.location ? String(it.location) : "Unknown",
          label: it.label ? String(it.label) : "Unknown",
          status: it.status ? String(it.status) : "lost",
          firstSeenTs:
            typeof it.firstSeenTs === "number"
              ? it.firstSeenTs
              : typeof it.first_seen_ts === "number"
              ? it.first_seen_ts
              : typeof it.firstSeen === "number"
              ? it.firstSeen
              : undefined,
          lastSeenTs:
            typeof it.lastSeenTs === "number"
              ? it.lastSeenTs
              : typeof it.last_seen_ts === "number"
              ? it.last_seen_ts
              : typeof it.lastSeen === "number"
              ? it.lastSeen
              : undefined,
          imageUrl: it.imageUrl
            ? buildApiUrl(LOSTFOUND_API_BASE, String(it.imageUrl))
            : it.image_url
            ? buildApiUrl(LOSTFOUND_API_BASE, String(it.image_url))
            : null,
        }));

      setItems(safe);
    } catch (e) {
      // ignore abort errors
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sources = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => s.add((it.source || "unknown").toLowerCase()));
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return items.filter((it) => {
      if (statusFilter === "lost" && !isLost(it)) return false;
      if (statusFilter === "solved" && !isSolved(it)) return false;

      if (sourceFilter !== "all") {
        const src = (it.source || "").toLowerCase();
        if (src !== sourceFilter) return false;
      }

      if (!qq) return true;
      const text = `${it.id} ${it.label} ${it.location} ${it.source} ${it.status}`
        .toLowerCase()
        .trim();
      return text.includes(qq);
    });
  }, [items, q, statusFilter, sourceFilter]);

  const summary = useMemo(() => {
    const lost = filtered.filter(isLost).length;
    const solved = filtered.filter(isSolved).length;
    return {
      total: filtered.length,
      lost,
      solved,
      rate: filtered.length ? ((solved / filtered.length) * 100).toFixed(1) : "0.0",
    };
  }, [filtered]);

  const itemDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((i) => {
      const key = i.label || "Unknown";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  const locationDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((i) => {
      const key = i.location || "Unknown";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((i) => {
      if (!i.firstSeenTs) return;
      const ms =
        i.firstSeenTs > 2_000_000_000_000 ? i.firstSeenTs : i.firstSeenTs * 1000;
      const d = new Date(ms).toLocaleDateString();
      map[d] = (map[d] || 0) + 1;
    });

    return Object.entries(map)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
  }, [filtered]);

  function exportCSV() {
    const headers = [
      "ID",
      "Label",
      "Location",
      "Source",
      "Status",
      "First Seen",
      "Last Seen",
      "Image URL",
    ];

    const rows = filtered.map((it) => [
      it.id,
      it.label || "",
      it.location || "",
      it.source || "",
      isLost(it) ? "lost" : isSolved(it) ? "solved" : it.status || "",
      fmtTs(it.firstSeenTs),
      fmtTs(it.lastSeenTs),
      it.imageUrl || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob("lost_found_report.csv", blob);
  }

  async function exportPNGCharts() {
    if (!chartsRef.current) return;

    const canvas = await html2canvas(chartsRef.current, {
      scale: 2,
      backgroundColor: "#0b1220",
      useCORS: true,
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlob("lost_found_charts.png", blob);
    }, "image/png");
  }

  async function exportPDFReport() {
    if (!reportRef.current) return;

    const canvas = await html2canvas(reportRef.current, {
      scale: 2,
      backgroundColor: "#0b1220",
      useCORS: true,
      scrollY: -window.scrollY,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      let remaining = imgHeight;
      let position = 0;

      while (remaining > 0) {
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        remaining -= pageHeight;
        position -= pageHeight;

        if (remaining > 0) pdf.addPage();
      }
    }

    pdf.save("lost_found_report.pdf");
  }

  return (
    <div className="w-full h-full bg-[#0b1220] text-slate-100">
      <div ref={reportRef} className="w-full px-6 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <div className="text-2xl font-bold">Lost &amp; Found Analytical Report</div>
            <div className="text-sm text-slate-400 mt-1">
              Summary + charts + full list (exportable).
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={load}
              className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl flex items-center gap-2 ring-1 ring-white/10"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            <button
              onClick={exportCSV}
              className="px-3 py-2 bg-sky-600/90 hover:bg-sky-600 rounded-xl flex items-center gap-2 ring-1 ring-sky-400/30"
              title="Export CSV"
            >
              <Download size={16} />
              Export CSV
            </button>

            <button
              onClick={exportPNGCharts}
              className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl flex items-center gap-2 ring-1 ring-white/10"
              title="Export charts as PNG"
            >
              <ImageIcon size={16} />
              Export Charts PNG
            </button>

            <button
              onClick={exportPDFReport}
              className="px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 rounded-xl flex items-center gap-2 ring-1 ring-emerald-400/30"
              title="Export full report as PDF"
            >
              <FileDown size={16} />
              Export PDF
            </button>
          </div>
        </div>

        <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-4 mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (item / location / id...)"
              className="w-full px-3 py-2 rounded-xl bg-[#0f172a] ring-1 ring-white/10 outline-none text-sm"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#0f172a] ring-1 ring-white/10 outline-none text-sm"
            >
              <option value="all">All Status</option>
              <option value="lost">Lost</option>
              <option value="solved">Solved</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#0f172a] ring-1 ring-white/10 outline-none text-sm"
            >
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All Source" : s.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 text-xs text-slate-400">
            Showing <span className="text-slate-200 font-semibold">{filtered.length}</span> items
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          <StatCard title="Total Items" value={summary.total} />
          <StatCard title="Lost" value={summary.lost} tone="red" />
          <StatCard title="Solved" value={summary.solved} tone="green" />
          <StatCard title="Solve Rate" value={`${summary.rate}%`} />
        </div>

        <div ref={chartsRef} className="grid grid-cols-1 xl:grid-cols-3 gap-10 mb-12">
          <ChartCard title="Item Distribution" height={440}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={itemDistribution} margin={{ top: 10, right: 18, left: 0, bottom: 35 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-10}
                  dy={12}
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip content={<NiceTooltip />} />
                <Bar dataKey="count" name="Count" fill="#3b82f6" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Location Distribution" height={440}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={locationDistribution}
                margin={{ top: 10, right: 18, left: 0, bottom: 35 }}
              >
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-8}
                  dy={12}
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip content={<NiceTooltip />} />
                <Bar dataKey="count" name="Count" fill="#10b981" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Daily Trend" height={440}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTrend} margin={{ top: 10, right: 18, left: 0, bottom: 35 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 12 }} dy={12} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip content={<NiceTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Count"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[980px]">
              <thead className="bg-white/10">
                <tr>
                  <th className="p-3 text-left">Image</th>
                  <th className="p-3 text-left">Item</th>
                  <th className="p-3 text-left">Location</th>
                  <th className="p-3 text-left">Source</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">First Seen</th>
                  <th className="p-3 text-left">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="p-3">
                      {it.imageUrl ? (
                        <img
                          src={it.imageUrl}
                          className="w-16 h-12 object-cover rounded-lg ring-1 ring-white/10"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-slate-100">{it.label}</td>
                    <td className="p-3 text-slate-200">{it.location}</td>
                    <td className="p-3 text-slate-300">{(it.source || "").toUpperCase()}</td>
                    <td className="p-3">
                      <span className={isLost(it) ? "text-red-400" : "text-emerald-400"}>
                        {isLost(it) ? "lost" : "solved"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{fmtTs(it.firstSeenTs)}</td>
                    <td className="p-3 text-slate-300">{fmtTs(it.lastSeenTs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400">No items found</div>
          )}
        </div>
      </div>
    </div>
  );
}

export const LostAndFoundReportsPage = LostAndFoundReportsPageInner;
export default LostAndFoundReportsPageInner;