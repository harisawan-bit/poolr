import { useState } from "react";

/** 2.4 Effect Size Conversions modal — embedded in Meta page */
import { postJson } from "../lib/api";

const MEASURES = ["OR", "RR", "RD", "MD", "SMD", "HR", "NNT"];

interface ConvertResult { conversion: string; result: number; extra?: Record<string, number>; note?: string }

export function EffectSizeConverter() {
  const [from, setFrom] = useState("OR");
  const [to, setTo] = useState("RR");
  const [value, setValue] = useState("");
  const [controlRate, setControlRate] = useState("0.2");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [open, setOpen] = useState(false);

  const convert = async () => {
    const v = parseFloat(value);
    if (isNaN(v)) return;

    const conversion = `${from.toLowerCase()}2${to.toLowerCase()}`;
    try {
      const res = await postJson<ConvertResult>("/api/convert", {
        conversion,
        value: v,
        control_rate: parseFloat(controlRate),
      });
      setResult(res);
    } catch (e) {
      setResult({ conversion, result: 0, note: e instanceof Error ? e.message : "Conversion failed" });
    }
  };

  return (
    <>
      <button className="btn-ghost" onClick={() => setOpen(!open)}>Convert</button>
      {open && (
        <div className="mt-3 rounded border border-[var(--color-border)] p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">From</div>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[12px]">
                {MEASURES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">To</div>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[12px]">
                {MEASURES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Value</div>
              <input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[12px]" />
            </div>
          </div>
          {(from === "OR" || from === "RR") && (to === "RR" || to === "RD" || to === "NNT") && (
            <div>
              <div className="text-[10px] text-[var(--color-text-muted)]">Control Rate (p0)</div>
              <input type="number" step="0.01" value={controlRate} onChange={(e) => setControlRate(e.target.value)} className="w-full rounded border border-[var(--color-border)] bg-transparent px-2 py-1 text-[12px]" />
            </div>
          )}
          <button className="btn-primary w-full" onClick={convert}>Convert</button>
          {result && (
            <div className="text-[12px]">
              <div className="font-semibold">{result.conversion}: {result.result.toFixed(4)}</div>
              {result.extra && Object.entries(result.extra).map(([k, v]) => (
                <div key={k} className="text-[var(--color-text-muted)]">{k}: {v.toFixed(4)}</div>
              ))}
              {result.note && <div className="text-[var(--color-text-muted)]">{result.note}</div>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
