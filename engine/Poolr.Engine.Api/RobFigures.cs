using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.5.1 — robvis-style RoB figures: traffic-light plot (per-study x per-domain
/// judgement cells) and weighted summary bar (distribution of judgements,
/// weighted by the reverse-variance weights robvis uses).
/// Judgement values accepted: "Low", "Some concerns"/"Concerns", "High", "Critical", "NA".
/// </summary>
public static class RobFigures
{
    public class TrafficLightRequest
    {
        public List<string>? studies { get; set; }
        public List<string>? domains { get; set; }
        /// <summary>judgements[i][j] = judgement of study i in domain j</summary>
        public List<List<string>>? judgements { get; set; }
        /// <summary>optional per-study weights (percent); defaults to equal weighting</summary>
        public List<double>? weights { get; set; }
    }

    private const string LowColor = "#3fb950";
    private const string ConcernColor = "#f2b84b";
    private const string HighColor = "#f05252";
    private const string CriticalColor = "#8b1a1a";
    private const string NaColor = "#3a3c43";
    private const string TextColor = "#e6e7ea";
    private const string Muted = "#8b8d96";

    private static string ColorOf(string j) => j?.Trim() switch
    {
        "Low" or "low" => LowColor,
        "Some concerns" or "Concerns" or "Moderate" => ConcernColor,
        "High" or "high" => HighColor,
        "Critical" => CriticalColor,
        _ => NaColor,
    };

    private static string F(double v) => v.ToString("0.##", CultureInfo.InvariantCulture);

    public static string TrafficLight(TrafficLightRequest req)
    {
        var studies = req.studies ?? new();
        var domains = req.domains ?? new();
        var judg = req.judgements ?? new();
        int k = Math.Min(studies.Count, judg.Count);
        if (k == 0 || domains.Count == 0)
            return Wrap("<text x=\"280\" y=\"200\" text-anchor=\"middle\" font-size=\"13\" fill=\"" + Muted + "\">No risk-of-bias data</text>", 560, 400);

        double cellW = 44, cellH = 30;
        double labelW = 170;
        double headerH = 34;
        double W = labelW + domains.Count * cellW + 24;
        double H = headerH + k * cellH + 56;

        var sb = new StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{F(W)}\" height=\"{F(H)}\" viewBox=\"0 0 {F(W)} {F(H)}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.Append("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        // domain headers (rotated 35 degrees like robvis)
        for (int j = 0; j < domains.Count; j++)
        {
            double cx = labelW + j * cellW + cellW / 2;
            sb.Append($"<text x=\"{F(cx)}\" y=\"26\" font-size=\"9.5\" fill=\"{TextColor}\" text-anchor=\"start\" transform=\"rotate(-35 {F(cx)} 26)\">{Esc(domains[j])}</text>");
        }

        for (int i = 0; i < k; i++)
        {
            double y = headerH + i * cellH;
            sb.Append($"<text x=\"{labelW - 10}\" y=\"{F(y + cellH / 2 + 4)}\" text-anchor=\"end\" font-size=\"11\" fill=\"{TextColor}\">{Esc(Trunc(studies[i], 24))}</text>");
            var row = judg[i];
            for (int j = 0; j < domains.Count; j++)
            {
                string val = j < row.Count ? row[j] : "";
                double x = labelW + j * cellW;
                sb.Append($"<circle cx=\"{F(x + cellW / 2)}\" cy=\"{F(y + cellH / 2)}\" r=\"11\" fill=\"{ColorOf(val)}\" fill-opacity=\"0.92\" stroke=\"#0c0d11\" stroke-width=\"1\"/>");
            }
        }

        // legend
        double ly = headerH + k * cellH + 22;
        string[] legend = { "Low", "Some concerns", "High", "Critical", "NA" };
        string[] colors = { LowColor, ConcernColor, HighColor, CriticalColor, NaColor };
        double lx = 12;
        for (int i = 0; i < legend.Length; i++)
        {
            sb.Append($"<circle cx=\"{F(lx + 7)}\" cy=\"{ly}\" r=\"6\" fill=\"{colors[i]}\"/>");
            sb.Append($"<text x=\"{F(lx + 17)}\" y=\"{ly + 3.5}\" font-size=\"9.5\" fill=\"{Muted}\">{legend[i]}</text>");
            lx += 24 + legend[i].Length * 5.4;
        }
        sb.Append("</svg>");
        return sb.ToString();
    }

    public static string SummaryBar(TrafficLightRequest req)
    {
        var studies = req.studies ?? new();
        var domains = req.domains ?? new();
        var judg = req.judgements ?? new();
        var weights = req.weights;
        int k = Math.Min(studies.Count, judg.Count);
        if (k == 0 || domains.Count == 0)
            return Wrap("<text x=\"280\" y=\"200\" text-anchor=\"middle\" font-size=\"13\" fill=\"" + Muted + "\">No risk-of-bias data</text>", 560, 400);

        // normalize weights (robvis uses inverse-variance weights; we accept percent shares)
        double total = 0;
        var w = new List<double>();
        for (int i = 0; i < k; i++)
        {
            double wi = weights != null && i < weights.Count && weights[i] > 0 ? weights[i] : 1.0;
            w.Add(wi); total += wi;
        }
        if (total <= 0) { for (int i = 0; i < k; i++) w[i] = 1; total = k; }

        const double barH = 26;
        double W = 560, ml = 150, mr = 20, mt = 40;
        double barW = W - ml - mr;
        double H = mt + domains.Count * (barH + 18) + 46;

        var sb = new StringBuilder($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{W}\" height=\"{F(H)}\" viewBox=\"0 0 {W} {F(H)}\" font-family=\"Inter, Arial, sans-serif\">");
        sb.Append("<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

        for (int j = 0; j < domains.Count; j++)
        {
            double y = mt + j * (barH + 18);
            sb.Append($"<text x=\"{ml - 8}\" y=\"{F(y + barH / 2 + 4)}\" text-anchor=\"end\" font-size=\"10.5\" fill=\"{TextColor}\">{Esc(Trunc(domains[j], 28))}</text>");

            var counts = new Dictionary<string, double>();
            for (int i = 0; i < k; i++)
            {
                string val = j < judg[i].Count ? judg[i].Key() : "NA";
                counts[val] = counts.GetValueOrDefault(val) + w[i];
            }
            double x = ml;
            foreach (var (val, share) in counts.OrderByDescending(kv => kv.Value))
            {
                double segW = share / total * barW;
                if (segW <= 0) continue;
                sb.Append($"<rect x=\"{F(x)}\" y=\"{F(y)}\" width=\"{F(segW)}\" height=\"{barH}\" fill=\"{ColorOf(val)}\" stroke=\"#0c0d11\" stroke-width=\"0.75\"/>");
                double pct = share / total * 100;
                if (segW > 34 && pct >= 8)
                    sb.Append($"<text x=\"{F(x + segW / 2)}\" y=\"{F(y + barH / 2 + 3.5)}\" text-anchor=\"middle\" font-size=\"9\" fill=\"#0c0d11\" font-weight=\"700\">{F(pct)}%</text>");
                x += segW;
            }
        }

        // legend
        double ly = mt + domains.Count * (barH + 18) + 16;
        string[] legend = { "Low", "Some concerns", "High", "Critical", "NA" };
        string[] colors = { LowColor, ConcernColor, HighColor, CriticalColor, NaColor };
        double lx = 12;
        for (int i = 0; i < legend.Length; i++)
        {
            sb.Append($"<rect x=\"{F(lx)}\" y=\"{ly - 6}\" width=\"10\" height=\"10\" rx=\"2\" fill=\"{colors[i]}\"/>");
            sb.Append($"<text x=\"{F(lx + 14)}\" y=\"{ly + 2.5}\" font-size=\"9.5\" fill=\"{Muted}\">{legend[i]}</text>");
            lx += 26 + legend[i].Length * 5.4;
        }
        sb.Append("</svg>");
        return sb.ToString();
    }

    private static string Key(this List<string> row, int idx = 0) =>
        row.Count > idx ? row[idx] : "NA";

    private static string Wrap(string inner, double w, double h) =>
        $"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\"><rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>{inner}</svg>";

    private static string Trunc(string s, int n) => string.IsNullOrEmpty(s) ? "?" : (s.Length <= n ? s : s[..n]);
    private static string Esc(string s) => (s ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
