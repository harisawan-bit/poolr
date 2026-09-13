/**
 * MetaPlotHelpers — shared forest/funnel plot SVG generation.
 *
 * Extracted from Meta.tsx to reduce the 1196-line monolith.
 */

export function generateForestSVG(data: {
  studies: { study: string; effect: number; ci_lower: number; ci_upper: number; weight: number }[];
  pooled: { effect: number; ci_lower: number; ci_upper: number; se: number };
  measure: string;
}): string {
  const W = 600, H = 80 + data.studies.length * 22;
  const padL = 180, padR = 80, padT = 30;
  const plotW = W - padL - padR;
  const allE = [...data.studies.flatMap((s) => [s.ci_lower, s.ci_upper]), data.pooled.ci_lower, data.pooled.ci_upper];
  const lo = Math.min(...allE), hi = Math.max(...allE);
  const scale = (v: number) => padL + ((v - lo) / (hi - lo || 1)) * plotW;
  const logScale = data.measure === "OR" || data.measure === "RR" || data.measure === "HR";
  const zeroX = logScale ? scale(1) : scale(0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif" font-size="11">`;
  // Header
  svg += `<text x="${padL}" y="18" font-weight="600">Forest Plot</text>`;
  svg += `<text x="${W - padR}" y="18" text-anchor="end" fill="#888">${data.measure} (${data.studies.length} studies)</text>`;
  // Zero/null line
  svg += `<line x1="${zeroX}" y1="${padT}" x2="${zeroX}" y2="${H - 20}" stroke="#999" stroke-dasharray="3,3" stroke-width="1"/>`;
  // Studies
  data.studies.forEach((s, i) => {
    const y = padT + 20 + i * 22;
    const x1 = scale(s.ci_lower), x2 = scale(s.ci_upper), cx = scale(s.effect);
    svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#555" stroke-width="1.5"/>`;
    svg += `<polygon points="${cx},${y - 4} ${cx + 4},${y + 3} ${cx - 4},${y + 3}" fill="#666"/>`;
    svg += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" fill="#333">${s.study.slice(0, 24)}</text>`;
    svg += `<text x="${W - padR + 4}" y="${y + 3}" fill="#555">${s.effect.toFixed(2)} [${s.ci_lower.toFixed(2)}, ${s.ci_upper.toFixed(2)}]</text>`;
  });
  // Pooled
  const py = padT + 20 + data.studies.length * 22 + 10;
  const px1 = scale(data.pooled.ci_lower), px2 = scale(data.pooled.ci_upper), pcx = scale(data.pooled.effect);
  svg += `<line x1="${px1}" y1="${py}" x2="${px2}" y2="${py}" stroke="#e63946" stroke-width="2"/>`;
  svg += `<polygon points="${pcx},${py - 5} ${pcx + 5},${py + 4} ${pcx - 5},${py + 4}" fill="#e63946"/>`;
  svg += `<text x="${padL - 8}" y="${py + 3}" text-anchor="end" font-weight="600" fill="#e63946">Pooled</text>`;
  svg += `</svg>`;
  return svg;
}

export function generateFunnelSVG(data: { points: { effect: number; se: number; study: string }[] }): string {
  const W = 400, H = 300;
  const pad = 50;
  const plotW = W - pad * 2, plotH = H - pad * 2;
  const maxSe = Math.max(...data.points.map((p) => p.se));
  const allEff = data.points.map((p) => p.effect);
  const meanEff = allEff.reduce((a, b) => a + b, 0) / allEff.length;
  const scaleY = (se: number) => pad + (se / maxSe) * plotH;
  const scaleX = (eff: number) => pad + ((eff - meanEff) / (maxSe * 2) + 0.5) * plotW;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,sans-serif" font-size="10">`;
  svg += `<text x="${pad}" y="20" font-weight="600">Funnel Plot</text>`;
  // Funnel boundaries
  svg += `<polygon points="${scaleX(meanEff)},${scaleY(0)} ${scaleX(meanEff - 1.96 * maxSe)},${scaleY(maxSe)} ${scaleX(meanEff + 1.96 * maxSe)},${scaleY(maxSe)}" fill="#e8f4f8" stroke="#6c9ead" stroke-width="0.5"/>`;
  svg += `<line x1="${scaleX(meanEff)}" y1="${scaleY(0)}" x2="${scaleX(meanEff)}" y2="${scaleY(maxSe)}" stroke="#333" stroke-width="1"/>`;
  // Points
  data.points.forEach((p) => {
    svg += `<circle cx="${scaleX(p.effect)}" cy="${scaleY(p.se)}" r="3" fill="#4a90d9" opacity="0.7"/>`;
  });
  svg += `</svg>`;
  return svg;
}
