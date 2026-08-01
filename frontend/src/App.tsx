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

const ENGINE_URL = "http://127.0.0.1:5180";

// poolr mark — geometric 'p' (ring + stem), accent color, transparent bg.
function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="poolr">
      <circle cx="10" cy="9" r="5.2" stroke="var(--color-accent)" strokeWidth="2.4" />
      <path d="M10 14.2V22" stroke="var(--color-accent)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [connected, setConnected] = useState<boolean | null>(null);
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
    <div className="relative flex h-full w-full overflow-hidden text-[#e6e7ea]">
      {/* Faint abstract line field — subconscious texture behind everything */}
      <div className="linefield" aria-hidden="true" />

      {/* Sidebar — compact */}
      <aside
        className={`glass flex flex-col border-r border-white/[0.07] transition-[width] duration-150 ${
          collapsed ? "w-[56px]" : "w-52"
        }`}
      >
        <div
          className={`flex items-center gap-2 py-3.5 ${
            collapsed ? "justify-center px-0" : "px-4"
          }`}
        >
          <LogoMark size={20} />
          {!collapsed && (
            <span className="font-sans text-[15px] font-semibold tracking-tight">
              poolr
            </span>
          )}
        </div>
        <nav className={`flex flex-1 flex-col gap-0.5 ${collapsed ? "px-1.5" : "px-2.5"} py-1`}>
          {NAV.map((item) => {
            const active = item.key === page;
            return (
              <button
                key={item.key}
                title={collapsed ? item.label : undefined}
                onClick={() => setPage(item.key)}
                className={`relative flex items-center gap-2.5 rounded-[3px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                  active
                    ? "bg-white/[0.06] font-sans font-semibold text-[#e6e7ea]"
                    : "text-[#8b8d96] hover:bg-white/[0.03] hover:text-[#e6e7ea]"
                } ${collapsed ? "justify-center" : ""}`}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-[var(--color-accent)]" />
                )}
                <span className={`text-center text-[14px] ${collapsed ? "" : "w-4"}`}>
                  {item.icon}
                </span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>
        <div
          className={`py-2.5 text-[10.5px] text-[#8b8d96] ${
            collapsed ? "text-center px-1" : "px-4"
          }`}
        >
          {collapsed
            ? "v0.4.0"
            : `v0.4.0 · ${connected === null ? "connecting…" : connected ? "online" : "offline"}`}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header — compact */}
        <header className="glass flex items-center justify-between border-b border-white/[0.07] px-4 py-2">
          <div>
            <h1 className="text-[16px] font-semibold">{TITLES[page]}</h1>
            <p className="text-[10.5px] text-[#8b8d96]">
              Systematic review &amp; meta-analysis
            </p>
          </div>
          <div className="flex gap-1.5">
            <button className="btn-ghost">Open</button>
            <button className="btn-ghost">New</button>
            <button className="btn-primary">Export</button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4">
          <div className="card p-4">
            <h2 className="mb-1.5 text-[14px] font-semibold">{TITLES[page]}</h2>
            <p className="text-[12.5px] text-[#8b8d96] leading-relaxed">
              This is the <span className="text-[#e6e7ea]">{TITLES[page]}</span> page
              placeholder. Real content (forms, virtualized screening list, forest plots)
              lands in Phase D. Review the compact shell: small buttons, accent left-bar
              on active nav, tighter spacing.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {["Studies", "Included", "RoB done"].map((k) => (
                <div key={k} className="card p-2.5">
                  <div className="text-[18px] font-semibold">—</div>
                  <div className="text-[10.5px] text-[#8b8d96]">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Status bar — compact */}
        <footer className="glass flex items-center justify-between border-t border-white/[0.07] px-4 py-1 text-[10.5px] text-[#8b8d96]">
          <span>poolr v0.4.0</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3fb950]" />
            saved
          </span>
        </footer>
      </div>
    </div>
  );
}
