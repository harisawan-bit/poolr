using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// Publication-ready figures as SVG strings (no external graphics lib — cross-platform,
/// renders natively in the webview). Mirrors python/poolr/plotting/figures.py layout.
/// Palette is monochrome (per the locked visual spec): study markers + CIs in
/// off-white, pooled diamond in a brighter tint, null line faint.
/// </summary>
public static class Figures
{
    private const string StudyColor = "#e6e7ea";
    private const string PooledColor = "#ffffff";
    private const string NullColor = "#8b8d96";
    private const string AxisColor = "#8b8d96";
    private const string TextColor = "#e6e7ea";
    private const string Muted = "#8b8d96";

    private static string F(double v, string fmt = "0.00") =>
        v.ToString(fmt, CultureInfo.InvariantCulture);

    public static string ForestPlot(MetaResponse r)
    {
        var studies = r.studies ?? new List<StudyResult>();
        bool useLog = r.measure is "OR" or "RR" or "HR";
        int k = studies.Count;

        const double x0 = 150;      // left margin for study names
        const double rightText = 80; // space for effect/CI text on right
        const double rowH = 26;
        const double topPad = 54;
        const double botPad = 60;   // pooled row + labels
        double plotW = 720;
        double plotH = topPad + k * rowH + botPad;
        double x1 = x0 + plotW;
        double plotRight = x1 - rightText;

        // x scale
        double lo = studies.Select(s => s.ci_lower).Where(v => v > 0 || !useLog).Concat(
            useLog ? studies.Select(s => s.ci_lower).Where(v => v > 0) : studies.Select(s => s.ci_lower))
            .DefaultIfEmpty(0.1).Min();
        double hi = studies.Select(s => s.ci_upper).Concat(new[] { r.pooled.ci_upper }).DefaultIfEmpty(2).Max();
        double xmin, xmax;
        if (useLog)
        {
            xmin = Math.Max(lo * 0.6, 1e-3);
            xmax = hi * 1.4;
        }
        else
        {
            xmin = lo - 0.5;
            xmax = hi + 0.5;
        }
        double sx(double v) => x0 + (v - xmin) / (xmax - xmin) * (plotRight - x0);

        var sb = new StringBuilder();
        sb.Append($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{x1}\" height=\"{plotH}\" viewBox=\"0 0 {x1} {plotH}\" font-family=\"Inter, Helvetica, Arial, sans-serif\">");
        sb.Append($"<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // column headers
        sb.Append($"<text x=\"{x0 - 8}\" y=\"{topPad - 18}\" text-anchor=\"end\" font-size=\"12\" font-weight=\"700\" fill=\"{TextColor}\">Study</text>");
        sb.Append($"<text x=\"{plotRight + 10}\" y=\"{topPad - 18}\" font-size=\"12\" font-weight=\"700\" fill=\"{TextColor}\">{r.measure} (95% CI)</text>");
        sb.Append($"<text x=\"{x1 - 6}\" y=\"{topPad - 18}\" text-anchor=\"end\" font-size=\"11\" font-weight=\"700\" fill=\"{Muted}\">Weight</text>");
        sb.Append($"<line x1=\"{x0}\" y1=\"{topPad - 8}\" x2=\"{plotRight}\" y2=\"{topPad - 8}\" stroke=\"#ffffff\" stroke-opacity=\"0.25\" stroke-width=\"1\"/>");

        // x ticks
        int ticks = useLog ? 5 : 6;
        for (int i = 0; i <= ticks; i++)
        {
            double v = xmin + (xmax - xmin) * i / ticks;
            double px = sx(v);
            sb.Append($"<line x1=\"{px}\" y1=\"{topPad - 4}\" x2=\"{px}\" y2=\"{topPad + k * rowH + 6}\" stroke=\"{AxisColor}\" stroke-opacity=\"0.12\" stroke-width=\"1\"/>");
            sb.Append($"<text x=\"{px}\" y=\"{topPad + k * rowH + 22}\" text-anchor=\"middle\" font-size=\"10\" fill=\"{Muted}\">{F(v, useLog ? "0.00" : "0.00")}</text>");
        }

        // null line
        double nullV = useLog ? 1.0 : 0.0;
        if (nullV >= xmin && nullV <= xmax)
            sb.Append($"<line x1=\"{sx(nullV)}\" y1=\"{topPad - 4}\" x2=\"{sx(nullV)}\" y2=\"{topPad + k * rowH + 6}\" stroke=\"{NullColor}\" stroke-dasharray=\"4 3\" stroke-opacity=\"0.6\" stroke-width=\"1\"/>");

        // studies (top to bottom)
        for (int i = 0; i < k; i++)
        {
            var s = studies[i];
            double y = topPad + (k - 1 - i) * rowH + rowH / 2;
            double eff = s.effect;
            double lo2 = s.ci_lower, hi2 = s.ci_upper;
            double px = sx(eff), pl = sx(lo2), ph = sx(hi2);
            // CI line + caps
            sb.Append($"<line x1=\"{pl}\" y1=\"{y}\" x2=\"{ph}\" y2=\"{y}\" stroke=\"{StudyColor}\" stroke-opacity=\"0.85\" stroke-width=\"1.5\"/>");
            sb.Append($"<line x1=\"{pl}\" y1=\"{y - 4}\" x2=\"{pl}\" y2=\"{y + 4}\" stroke=\"{StudyColor}\" stroke-width=\"1.5\"/>");
            sb.Append($"<line x1=\"{ph}\" y1=\"{y - 4}\" x2=\"{ph}\" y2=\"{y + 4}\" stroke=\"{StudyColor}\" stroke-width=\"1.5\"/>");
            // point (size ~ weight)
            double size = 5 + Math.Sqrt(Math.Max(s.weight, 0)) * 0.6;
            sb.Append($"<rect x=\"{px - size / 2}\" y=\"{y - size / 2}\" width=\"{size}\" height=\"{size}\" fill=\"{StudyColor}\" stroke=\"#0c0d11\" stroke-width=\"0.5\"/>");
            // name
            sb.Append($"<text x=\"{x0 - 8}\" y=\"{y + 4}\" text-anchor=\"end\" font-size=\"11\" fill=\"{TextColor}\">{Escape(s.study)}</text>");
            // effect (CI)
            sb.Append($"<text x=\"{plotRight + 10}\" y=\"{y + 4}\" font-family=\"monospace\" font-size=\"10.5\" fill=\"{TextColor}\">{F(eff)} ({F(lo2)}, {F(hi2)})</text>");
            // weight
            sb.Append($"<text x=\"{x1 - 6}\" y=\"{y + 4}\" text-anchor=\"end\" font-size=\"10\" fill=\"{Muted}\">{F(s.weight, "0.0")}%</text>");
        }

        // pooled row (diamond)
        double py = topPad + k * rowH + 36;
        double pe = r.pooled.effect, plo = r.pooled.ci_lower, phi = r.pooled.ci_upper;
        double ppx = sx(pe), ppl = sx(plo), pph = sx(phi);
        double dh = 6;
        sb.Append($"<polygon points=\"{ppx},{py - dh} {pph},{py} {ppx},{py + dh} {ppl},{py}\" fill=\"{PooledColor}\" stroke=\"#0c0d11\" stroke-width=\"1\"/>");
        sb.Append($"<line x1=\"{ppl}\" y1=\"{py}\" x2=\"{pph}\" y2=\"{py}\" stroke=\"{PooledColor}\" stroke-width=\"1.5\"/>");
        sb.Append($"<text x=\"{x0 - 8}\" y=\"{py + 4}\" text-anchor=\"end\" font-size=\"11.5\" font-weight=\"700\" fill=\"{TextColor}\">Pooled ({r.model})</text>");
        sb.Append($"<text x=\"{plotRight + 10}\" y=\"{py + 4}\" font-family=\"monospace\" font-size=\"11\" font-weight=\"700\" fill=\"{TextColor}\">{F(pe)} ({F(plo)}, {F(phi)})</text>");

        // title
        var h = r.heterogeneity;
        string title = $"Forest Plot — {r.measure} ({r.model})";
        if (h != null)
            title += $"  |  I² = {F(h.i2, "0.0")}%, τ² = {F(h.tau2, "0.000")}, Q = {F(h.q, "0.0")} (df={h.df})";
        sb.Append($"<text x=\"8\" y=\"22\" font-size=\"13\" font-weight=\"600\" fill=\"{TextColor}\">{Escape(title)}</text>");

        sb.Append("</svg>");
        return sb.ToString();
    }

    public static string FunnelPlot(MetaResponse r)
    {
        var studies = r.studies ?? new List<StudyResult>();
        bool useLog = r.measure is "OR" or "RR" or "HR";
        const double W = 560, H = 520;
        const double ml = 70, mr = 24, mt = 50, mb = 50;
        double plotW = W - ml - mr, plotH = H - mt - mb;

        if (studies.Count < 3)
        {
            var sb0 = new StringBuilder();
            sb0.Append($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{W}\" height=\"{H}\" viewBox=\"0 0 {W} {H}\" font-family=\"Inter, Arial, sans-serif\"><rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");
            sb0.Append($"<text x=\"{W / 2}\" y=\"{H / 2}\" text-anchor=\"middle\" font-size=\"14\" fill=\"{Muted}\">Need ≥3 studies for funnel plot</text></svg>");
            return sb0.ToString();
        }

        // compute log effects + SE
        var pts = new List<(double eff, double se, double wt)>();
        foreach (var s in studies)
        {
            double eff = useLog ? Math.Log(Math.Max(s.effect, 1e-6)) : s.effect;
            double lo = useLog ? Math.Log(Math.Max(s.ci_lower, 1e-6)) : s.ci_lower;
            double hi = useLog ? Math.Log(Math.Max(s.ci_upper, 1e-6)) : s.ci_upper;
            double se = (hi - lo) / (2 * 1.96);
            pts.Add((eff, se, s.weight));
        }
        double pe = useLog ? Math.Log(Math.Max(r.pooled.effect, 1e-6)) : r.pooled.effect;
        double eMin = pts.Min(p => p.eff), eMax = pts.Max(p => p.eff);
        double sMax = pts.Max(p => p.se);
        double ePad = (eMax - eMin) * 0.15 + 0.05;
        double eLo = eMin - ePad, eHi = eMax + ePad;
        double sHi = sMax * 1.4;
        double ex(double e) => ml + (e - eLo) / (eHi - eLo) * plotW;
        double sy(double s) => mt + (s / sHi) * plotH;

        var sb = new StringBuilder();
        sb.Append($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{W}\" height=\"{H}\" viewBox=\"0 0 {W} {H}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.Append($"<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // pseudo 95% CI region
        int N = 60;
        var top = new List<string>();
        var bot = new List<string>();
        for (int i = 0; i <= N; i++)
        {
            double s = sHi * i / N;
            double cu = pe + 1.96 * s, cl = pe - 1.96 * s;
            top.Add($"{ex(cu)},{sy(s)}");
            bot.Add($"{ex(cl)},{sy(s)}");
        }
        bot.Reverse();
        sb.Append($"<polygon points=\"{string.Join(" ", top.Concat(bot))}\" fill=\"{StudyColor}\" fill-opacity=\"0.10\"/>");

        // pooled vertical line
        sb.Append($"<line x1=\"{ex(pe)}\" y1=\"{mt}\" x2=\"{ex(pe)}\" y2=\"{mt + plotH}\" stroke=\"#f05252\" stroke-width=\"2\"/>");
        // null line (0 for log)
        if (0 >= eLo && 0 <= eHi)
            sb.Append($"<line x1=\"{ex(0)}\" y1=\"{mt}\" x2=\"{ex(0)}\" y2=\"{mt + plotH}\" stroke=\"{NullColor}\" stroke-dasharray=\"4 3\" stroke-opacity=\"0.5\" stroke-width=\"1\"/>");

        // points
        foreach (var p in pts)
        {
            double rad = 3 + Math.Sqrt(p.wt) * 0.5;
            sb.Append($"<circle cx=\"{ex(p.eff)}\" cy=\"{sy(p.se)}\" r=\"{rad}\" fill=\"{StudyColor}\" fill-opacity=\"0.8\" stroke=\"#0c0d11\" stroke-width=\"0.5\"/>");
        }

        // axes labels
        sb.Append($"<text x=\"{ml + plotW / 2}\" y=\"{H - 14}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\">{(useLog ? "Log " + r.measure : r.measure)}</text>");
        sb.Append($"<text x=\"16\" y=\"{mt + plotH / 2}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\" transform=\"rotate(-90 16 {mt + plotH / 2})\">Standard Error</text>");
        sb.Append($"<text x=\"{W / 2}\" y=\"24\" text-anchor=\"middle\" font-size=\"13\" font-weight=\"600\" fill=\"{TextColor}\">Funnel Plot — {r.measure}</text>");

        sb.Append("</svg>");
        return sb.ToString();
    }

    private static string Escape(string s) =>
        (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
