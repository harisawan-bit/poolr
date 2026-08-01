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

// In dev, the C# sidecar runs on :5180. In the packaged app, Tauri spawns it
// and exposes it on the same port (see src-tauri/src/lib.rs).
const ENGINE_URL =
  import.meta.env.DEV ? "http://127.0.0.1:5180" : "http://127.0.0.1:5180";

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${ENGINE_URL}/health`)
      .then((r) => (alive ? setConnected(r.ok) : null))
      .catch(() => alive && setConnected(false));
    return () => {
      alive = false;
    };
  }, []);

  // Lightweight health ping to the C# sidecar (Phase A6 will wire the port).
  // Until then we render the shell so the look is reviewable.
  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0e0e10] text-[#ededed]">
      {/* Sidebar — frosted glass */}
      <aside className="glass flex w-60 flex-col border-r border-white/10">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e5484d] font-sans text-lg font-bold text-white">
            p
          </div>
          <span className="font-sans text-lg font-bold tracking-tight">poolr</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV.map((item) => {
            const active = item.key === page;
            return (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? "bg-[#e5484d] font-sans font-bold text-white"
                    : "text-[#9a9a9e] hover:bg-white/5 hover:text-[#ededed]"
                }`}
              >
                <span className="w-5 text-center text-base">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-4 text-xs text-[#9a9a9e]">
          v0.4.0 · {connected === null ? "connecting…" : connected ? "engine online" : "engine off"}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header bar — frosted */}
        <header className="glass flex items-center justify-between border-b border-white/10 px-6 py-3.5">
          <div>
            <h1 className="text-xl font-bold">{TITLES[page]}</h1>
            <p className="text-xs text-[#9a9a9e]">
              Premium SRMA workspace — dark · red accent · glass chrome
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost">Open</button>
            <button className="btn-ghost">New</button>
            <button className="btn-primary">Export</button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="card p-6">
            <h2 className="mb-2 text-lg font-bold">{TITLES[page]}</h2>
            <p className="text-sm text-[#9a9a9e]">
              This is the <span className="text-[#ededed]">{TITLES[page]}</span> page
              placeholder. Real content (forms, virtualized screening list, forest plots)
              lands in Phase D. The shell — sidebar active-state, header, status bar,
              margins, and 7px button radius — is what to review now.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4">
              {["Studies", "Included", "RoB done"].map((k) => (
                <div key={k} className="card p-4">
                  <div className="text-2xl font-bold">—</div>
                  <div className="text-xs text-[#9a9a9e]">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Status bar — frosted */}
        <footer className="glass flex items-center justify-between border-t border-white/10 px-6 py-2 text-xs text-[#9a9a9e]">
          <span>poolr v0.4.0</span>
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#3fb950]" />
            saved
          </span>
        </footer>
      </div>
    </div>
  );
}
