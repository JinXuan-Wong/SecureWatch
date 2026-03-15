import { usePersistedState } from "../hooks/usePersistedState";
import  LostAndFoundReportsPage  from "./LostAndFoundReportsPage";
import { AttireComplianceReportsPage } from "./AttireComplianceReportsPage";

export function ReportsPage({ canExport }: { canExport: boolean }) {
  const [activeModule, setActiveModule] = usePersistedState<
    "lost-found" | "attire"
  >("reports:activeModule", "lost-found");

  return (
    <main className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Module Tabs */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-2 bg-slate-800/30 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveModule("lost-found")}
            className={`px-6 py-2 rounded-md transition-colors ${
              activeModule === "lost-found"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Lost & Found
          </button>
          <button
            onClick={() => setActiveModule("attire")}
            className={`px-6 py-2 rounded-md transition-colors ${
              activeModule === "attire"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Attire Compliance
          </button>
        </div>
      </div>

      {/* Module Content */}
      <div className="flex-1 overflow-hidden min-w-0">
        {activeModule === "lost-found" ? (
          <LostAndFoundReportsPage />
        ) : (
          <AttireComplianceReportsPage canExport={canExport} />
        )}
      </div>
    </main>
  );
}
