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
import {
  LOSTFOUND_API_BASE,
  buildApiUrl,
  resolveLostFoundUrl,
} from "../api/base";

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

function safeText(v: unknown, fallback = "-") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function ellipsis(v: unknown, max = 24) {
  const s = safeText(v, "-");
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function getNowFilenamePart() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
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

function PdfTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-white border border-slate-200 px-3 py-2 shadow-md">
      <div className="text-xs text-slate-500">{label}</div>
      {payload.map((p: any, idx: number) => (
        <div key={idx} className="text-sm text-slate-800 font-medium">
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

/* ================= SMALL UI COMPONENTS ================= */

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

function PdfStatCard({
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
      ? "text-red-600"
      : tone === "green"
      ? "text-emerald-600"
      : "text-slate-900";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-500">{title}</div>
      <div className={`mt-2 text-3xl font-bold ${vCls}`}>{value}</div>
    </div>
  );
}

function PdfChartCard({
  title,
  height = 360,
  children,
}: {
  title: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 break-inside-avoid">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">Auto-generated</div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-2" style={{ height }}>
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

  const chartsRef = useRef<HTMLDivElement | null>(null);

  // hidden PDF-only layout refs
  const pdfPage1Ref = useRef<HTMLDivElement | null>(null);
  const pdfChartsRef = useRef<HTMLDivElement | null>(null);

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
      const arr: LostFoundItem[] = Array.isArray(js?.items)
        ? js.items
        : Array.isArray(js)
        ? js
        : [];

      const safe = arr
        .filter((it) => it && typeof it === "object" && (it as any).id != null)
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
              : undefined,
          lastSeenTs:
            typeof it.lastSeenTs === "number"
              ? it.lastSeenTs
              : typeof it.last_seen_ts === "number"
              ? it.last_seen_ts
              : undefined,
          imageUrl: resolveLostFoundUrl(it.imageUrl || it.image_url || null),
        }));

      setItems(safe);
    } catch {
      // ignore abort and fetch failures silently like your original version
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
      const ms = i.firstSeenTs > 2_000_000_000_000 ? i.firstSeenTs : i.firstSeenTs * 1000;
      const d = new Date(ms).toLocaleDateString();
      map[d] = (map[d] || 0) + 1;
    });

    return Object.entries(map)
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
  }, [filtered]);

  const topItem = itemDistribution[0]?.name || "-";
  const topItemCount = itemDistribution[0]?.count || 0;

  const topLocation = locationDistribution[0]?.name || "-";
  const topLocationCount = locationDistribution[0]?.count || 0;

  const peakDay = useMemo(() => {
    if (!dailyTrend.length) return null;
    return [...dailyTrend].sort((a, b) => b.count - a.count)[0];
  }, [dailyTrend]);

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
      isLost(it) ? "lost" : isSolved(it) ? "solved" : (it.status || ""),
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
    downloadBlob(`lost_found_report_${getNowFilenamePart()}.csv`, blob);
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
      downloadBlob(`lost_found_charts_${getNowFilenamePart()}.png`, blob);
    }, "image/png");
  }

  async function exportPDFReport() {
    if (!pdfPage1Ref.current || !pdfChartsRef.current) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // ---------- PAGE 1: cover / summary ----------
    const coverCanvas = await html2canvas(pdfPage1Ref.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: pdfPage1Ref.current.scrollWidth,
      windowHeight: pdfPage1Ref.current.scrollHeight,
    });

    const coverImg = coverCanvas.toDataURL("image/png");
    const coverW = pageW - margin * 2;
    const coverH = (coverCanvas.height * coverW) / coverCanvas.width;

    pdf.addImage(coverImg, "PNG", margin, 8, coverW, Math.min(coverH, pageH - 16));

    // ---------- PAGE 2: charts ----------
    const chartsCanvas = await html2canvas(pdfChartsRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      windowWidth: pdfChartsRef.current.scrollWidth,
      windowHeight: pdfChartsRef.current.scrollHeight,
    });

    const chartsImg = chartsCanvas.toDataURL("image/png");
    const chartsW = pageW - margin * 2;
    const chartsH = (chartsCanvas.height * chartsW) / chartsCanvas.width;

    pdf.addPage();
    pdf.addImage(chartsImg, "PNG", margin, 8, chartsW, Math.min(chartsH, pageH - 16));

    // ---------- PAGE 3+: table ----------
    pdf.addPage();

    let rowY = 16;

    const drawTableHeader = () => {
      pdf.setFillColor(241, 245, 249);
      pdf.rect(8, rowY - 5, 194, 8, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);

      pdf.text("Item", 10, rowY);
      pdf.text("Location", 42, rowY);
      pdf.text("Source", 95, rowY);
      pdf.text("Status", 118, rowY);
      pdf.text("First Seen", 138, rowY);
      pdf.text("Last Seen", 170, rowY);

      rowY += 8;
      pdf.setFont("helvetica", "normal");
    };

    const drawFooter = (pageNo: number) => {
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`SecureWatch Pro v2.0`, 10, 292);
      pdf.text(`Page ${pageNo}`, 190, 292, { align: "right" });
    };

    drawTableHeader();

    let pageNo = 3;

    filtered.forEach((it) => {
      if (rowY > 282) {
        drawFooter(pageNo);
        pageNo += 1;
        pdf.addPage();
        rowY = 16;
        drawTableHeader();
      }

      const statusText =
        (it.status || "").toLowerCase().includes("solv") ? "solved" : "lost";

      pdf.setFontSize(8);
      pdf.setTextColor(40, 40, 40);

      pdf.text(ellipsis(it.label, 18), 10, rowY);
      pdf.text(ellipsis(it.location, 28), 42, rowY);
      pdf.text(ellipsis((it.source || "").toUpperCase(), 10), 95, rowY);

      if (statusText === "lost") pdf.setTextColor(220, 38, 38);
      else pdf.setTextColor(5, 150, 105);
      pdf.text(statusText, 118, rowY);

      pdf.setTextColor(40, 40, 40);
      pdf.text(ellipsis(fmtTs(it.firstSeenTs), 18), 138, rowY);
      pdf.text(ellipsis(fmtTs(it.lastSeenTs), 18), 170, rowY);

      rowY += 6.5;
    });

    drawFooter(pageNo);

    const filename = `lost_found_report_${getNowFilenamePart()}.pdf`;
    pdf.save(filename);
  }

  return (
    <div className="w-full h-full bg-[#0b1220] text-slate-100">
      {/* ======================= VISIBLE DASHBOARD ======================= */}
      <div className="w-full px-6 py-6">
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

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
          <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-5">
            <div className="text-sm text-slate-400">Top Item</div>
            <div className="mt-2 text-xl font-bold text-white">{topItem}</div>
            <div className="mt-1 text-sm text-slate-400">{topItemCount} records</div>
          </div>
          <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-5">
            <div className="text-sm text-slate-400">Top Location</div>
            <div className="mt-2 text-xl font-bold text-white break-words">{topLocation}</div>
            <div className="mt-1 text-sm text-slate-400">{topLocationCount} records</div>
          </div>
          <div className="bg-white/5 ring-1 ring-white/10 rounded-2xl p-5">
            <div className="text-sm text-slate-400">Peak Day</div>
            <div className="mt-2 text-xl font-bold text-white">{peakDay?.day || "-"}</div>
            <div className="mt-1 text-sm text-slate-400">
              {peakDay ? `${peakDay.count} events` : "No data"}
            </div>
          </div>
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

      {/* ======================= HIDDEN PDF EXPORT LAYOUT ======================= */}
      <div
        className="fixed -left-[99999px] top-0 pointer-events-none opacity-100"
        aria-hidden="true"
      >
        {/* PAGE 1 */}
        <div
          ref={pdfPage1Ref}
          className="w-[1200px] bg-white text-slate-900 p-10"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          <div className="rounded-3xl bg-slate-900 text-white px-8 py-8 mb-8">
            <div className="text-sm font-semibold tracking-[0.25em] uppercase text-sky-300">
              SecureWatch Pro v2.0
            </div>
            <div className="text-4xl font-bold mt-3">Lost &amp; Found Analytical Report</div>
            <div className="text-sm text-slate-300 mt-3">
              Generated on {new Date().toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-700 mb-3">Applied Filters</div>
              <div className="text-sm text-slate-600">Search: {q || "-"}</div>
              <div className="text-sm text-slate-600 mt-1">Status: {statusFilter}</div>
              <div className="text-sm text-slate-600 mt-1">Source: {sourceFilter}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-700 mb-3">Executive Summary</div>
              <div className="text-sm leading-6 text-slate-600">
                This report summarizes Lost &amp; Found records captured by the SecureWatch
                module. It includes key performance indicators, analytical charts, hotspot
                locations, item distribution trends, and a detailed event listing for audit
                and review purposes.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-8">
            <PdfStatCard title="Total Items" value={summary.total} />
            <PdfStatCard title="Lost" value={summary.lost} tone="red" />
            <PdfStatCard title="Solved" value={summary.solved} tone="green" />
            <PdfStatCard title="Solve Rate" value={`${summary.rate}%`} />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-700 mb-2">Top Item</div>
              <div className="text-2xl font-bold text-slate-900">{topItem}</div>
              <div className="text-sm text-slate-500 mt-1">{topItemCount} records</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-700 mb-2">Top Location</div>
              <div className="text-2xl font-bold text-slate-900 break-words">{topLocation}</div>
              <div className="text-sm text-slate-500 mt-1">{topLocationCount} records</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-700 mb-2">Peak Day</div>
              <div className="text-2xl font-bold text-slate-900">{peakDay?.day || "-"}</div>
              <div className="text-sm text-slate-500 mt-1">
                {peakDay ? `${peakDay.count} events` : "No data"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-lg font-semibold text-slate-900 mb-4">Key Insights</div>
            <div className="grid grid-cols-1 gap-3 text-sm text-slate-700">
              <div>• Most frequent item detected: {topItem}</div>
              <div>• Most common location: {topLocation}</div>
              <div>• Total filtered records: {summary.total}</div>
              <div>• Current solve rate: {summary.rate}%</div>
            </div>
          </div>
        </div>

        {/* PAGE 2 */}
        <div
          ref={pdfChartsRef}
          className="w-[1200px] bg-white text-slate-900 p-10"
          style={{ fontFamily: "Arial, sans-serif" }}
        >
          <div className="mb-8">
            <div className="text-sm font-semibold tracking-[0.2em] uppercase text-sky-700">
              SecureWatch Pro v2.0
            </div>
            <div className="text-3xl font-bold mt-2">Analytical Charts</div>
            <div className="text-sm text-slate-500 mt-2">
              Lost &amp; Found trends and distribution overview
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <PdfChartCard title="Item Distribution" height={360}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={itemDistribution} margin={{ top: 10, right: 18, left: 0, bottom: 35 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-10}
                    dy={12}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip content={<PdfTooltip />} />
                  <Bar dataKey="count" name="Count" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PdfChartCard>

            <PdfChartCard title="Location Distribution" height={360}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={locationDistribution}
                  margin={{ top: 10, right: 18, left: 0, bottom: 35 }}
                >
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-8}
                    dy={12}
                  />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip content={<PdfTooltip />} />
                  <Bar dataKey="count" name="Count" fill="#059669" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </PdfChartCard>

            <PdfChartCard title="Daily Trend" height={360}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend} margin={{ top: 10, right: 18, left: 0, bottom: 35 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} dy={12} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                  <Tooltip content={<PdfTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Count"
                    stroke="#ea580c"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </PdfChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}

export const LostAndFoundReportsPage = LostAndFoundReportsPageInner;
export default LostAndFoundReportsPageInner;