import { useEffect, useState } from "react";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "▦" },
  { key: "protocol", label: "Protocol", icon: "✎" },
  { key: "search", label: "Search", icon: "⌕" },
  { key: "screening", label: "Screening", icon: "☑" },
  { key: "extraction", label: "Extraction", icon: "▤" },
  { key: "rob", label: "Risk of Bias", icon: "⚠" },
  { key: "meta", label: "Meta-Analysis", icon: "📈" },
  { key: "prisma", label: "PRISMA", icon: "◫" },
] as const;

type PageKey = (typeof NAV)[number]["key"];

const TITLES: Record<PageKey, string> = {
  dashboard: "Dashboard",
  protocol: "Protocol / PICO Definition",
  search: "Search Strategy Builder",
  screening: "Screening",
  extraction: "Data Extraction",
  rob: "Risk of Bias Assessment",
  meta: "Meta-Analysis",
  prisma: "PRISMA 2020",
};

// In dev and packaged, the C# sidecar serves localhost:5180 (Tauri spawns it).
const ENGINE_URL = "http://127.0.0.1:5180";

// poolr mark — red, transparent background. (Placeholder; refine to match brand ref.)
function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="poolr">
      <rect x="2" y="2" width="20" height="20" rx="2" fill="#e5484d" />
      <path
        d="M9 7v10M9 7h4.2a3.3 3.3 0 0 1 0 6.6H9"
        stroke="#0e0e10"
        strokeWidth="2.2"
        strokeLinecap="square"
        fill="none"
      />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [connected, setConnected] = useState<boolean | null>(null);
  // Collapse sidebar to an icon rail when the window is narrow / vertical.
  const [collapsed, setCollapsed] = useState(
    typeof window !== "undefined" && window.innerWidth < 820
  );

  useEffect(() => {
    let alive = true;
    fetch(`${ENGINE_URL}/health`)
      .then((r) => (alive ? setConnected(r.ok) : null))
      .catch(() => alive && setConnected(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0e0e10] text-[#ededed]">
      {/* Sidebar — frosted glass, collapses to icon rail when narrow */}
      <aside
        className={`glass flex flex-col border-r border-white/10 transition-[width] duration-150 ${
          collapsed ? "w-[60px]" : "w-56"
        }`}
      >
        <div
          className={`flex items-center gap-2 py-4 ${
            collapsed ? "justify-center px-0" : "px-4"
          }`}
        >
          <LogoMark size={22} />
          {!collapsed && (
            <span className="font-sans text-base font-bold tracking-tight">poolr</span>
          )}
        </div>
        <nav className={`flex flex-1 flex-col gap-1 ${collapsed ? "px-2" : "px-3"} py-2`}>
          {NAV.map((item) => {
            const active = item.key === page;
            return (
              <button
                key={item.key}
                title={collapsed ? item.label : undefined}
                onClick={() => setPage(item.key)}
                className={`flex items-center gap-3 rounded-[2px] px-3 py-2 text-left text-[13px] transition-colors ${
                  active
                    ? "bg-[#e5484d] font-sans font-bold text-white"
                    : "text-[#9a9a9e] hover:bg-white/5 hover:text-[#ededed]"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <span className={`text-center text-base ${collapsed ? "" : "w-5"}`}>
                  {item.icon}
                </span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>
        <div className={`py-3 text-[11px] text-[#9a9a9e] ${collapsed ? "text-center px-1" : "px-4"}`}>
          {collapsed
            ? "v0.4.0"
            : `v0.4.0 · ${connected === null ? "connecting…" : connected ? "engine online" : "engine off"}`}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header bar — frosted */}
        <header className="glass flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div>
            <h1 className="text-lg font-bold">{TITLES[page]}</h1>
            <p className="text-[11px] text-[#9a9a9e]">
              Systematic review &amp; meta-analysis workspace
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost !text-[12px] !py-2 !px-3">Open</button>
            <button className="btn-ghost !text-[12px] !py-2 !px-3">New</button>
            <button className="btn-primary !text-[12px] !py-2 !px-3">Export</button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-5">
          <div className="card p-5">
            <h2 className="mb-2 text-base font-bold">{TITLES[page]}</h2>
            <p className="text-[13px] text-[#9a9a9e]">
              This is the <span className="text-[#ededed]">{TITLES[page]}</span> page
              placeholder. Real content (forms, virtualized screening list, forest plots)
              lands in Phase D. Review the shell: collapsible sidebar, square corners,
              tighter type.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {["Studies", "Included", "RoB done"].map((k) => (
                <div key={k} className="card p-3">
                  <div className="text-xl font-bold">—</div>
                  <div className="text-[11px] text-[#9a9a9e]">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Status bar — frosted */}
        <footer className="glass flex items-center justify-between border-t border-white/10 px-5 py-1.5 text-[11px] text-[#9a9a9e]">
          <span>poolr v0.4.0</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
            saved
          </span>
        </footer>
      </div>
    </div>
  );
}
