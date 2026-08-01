import type { ReactNode } from "react";

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="card p-4">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#8b8d96]">{children}</div>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[3px] border border-[var(--color-border)] bg-[#0c0d11] px-2.5 py-1.5 text-[12.5px] text-[#e6e7ea] outline-none transition-colors placeholder:text-[#5a5c63] focus:border-[var(--color-border-strong)] ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[3px] border border-[var(--color-border)] bg-[#0c0d11] px-2.5 py-1.5 text-[12.5px] text-[#e6e7ea] outline-none transition-colors placeholder:text-[#5a5c63] focus:border-[var(--color-border-strong)] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-[3px] border border-[var(--color-border)] bg-[#0c0d11] px-2 py-1.5 text-[12.5px] text-[#e6e7ea] outline-none transition-colors focus:border-[var(--color-border-strong)] ${props.className ?? ""}`}
    />
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-[5px] border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-[12.5px] text-[#8b8d96]">{children}</div>;
}

export function Pill({ tone = "neutral", children }: { tone?: "include" | "exclude" | "unsure" | "neutral" | "accent"; children: ReactNode }) {
  const map: Record<string, string> = {
    include: "bg-[#3fb950]/15 text-[#3fb950] border-[#3fb950]/30",
    exclude: "bg-[#f05252]/15 text-[#f05252] border-[#f05252]/30",
    unsure: "bg-[#f2b84b]/15 text-[#f2b84b] border-[#f2b84b]/30",
    neutral: "bg-white/[0.05] text-[#8b8d96] border-[var(--color-border)]",
    accent: "bg-white/[0.08] text-[#e6e7ea] border-[var(--color-border-strong)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${map[tone]}`}>{children}</span>
  );
}
