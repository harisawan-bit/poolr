using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;

namespace Poolr.Engine.Api;

/// <summary>v0.5.1 diagnostic figures (SVG, monochrome palette matching Figures.cs).</summary>
public static class DiagnosticFigures
{
    private const string StudyColor = "#e6e7ea";
    private const string NullColor = "#8b8d96";
    private const string TextColor = "#e6e7ea";
    private const string Muted = "#8b8d96";
    private const string Accent = "#f05252";

    private static string F(double v, string fmt = "0.00") =>
        v.ToString(fmt, CultureInfo.InvariantCulture);

    public record PlotInput(string Measure, List<double> Effs, List<double> Vars, List<string> Names);

    public class LabbeArm
    {
        public string name { get; set; } = "";
        public double a { get; set; }
        public double n1 { get; set; }
        public double c { get; set; }
        public double n2 { get; set; }
    }

    /// <summary>Galbraith/radial plot: standardized effect vs precision, with pooled-estimate guides.</summary>
    public static string Galbraith(PlotInput d, double pooledLogEff)
    {
        int k = d.Effs.Count;
        var sb = StartSvg(560, 520);
        if (k < 3) return NeedMore(sb, "Need >=3 studies for Galbraith plot");

        double precMax = 1.0 / Math.Sqrt(d.Vars.Max());
        double zMaxAbs = Math.Max(2.5, d.Effs.Zip(d.Vars, (e, v) => e / Math.Sqrt(v)).Select(Math.Abs).Max() * 1.15);
        double xW = 440, yH = 380, ml = 60, mt = 46;

        // scale: x = precision (0..precMax*1.05), y = std eff (-zMax..+zMax)
        Func<double, double> px = p => ml + p / (precMax * 1.05) * xW;
        Func<double, double> py = z => mt + yH / 2 - z / zMaxAbs * (yH / 2);

        // central line: y = pooled * x ; +/-2 SE arcs are circles through origin (draw ±2 band lines)
        sb.Append($"<line x1=\"{px(0)}\" y1=\"{py(0)}\" x2=\"{px(precMax * 1.05)}\" y2=\"{py(pooledLogEff * precMax * 1.05)}\" stroke=\"{Accent}\" stroke-width=\"1.5\"/>");
        for (int i = 0; i <= 20; i++)
        {
            double p = precMax * 1.05 * i / 20;
            double x = px(p), yc = py(pooledLogEff * p);
            double band = 2.0; // |z|<=2 region boundary at this precision
            double halfH = band / (p == 0 ? 1 : 1) * (yH / 2 / zMaxAbs); // approx vertical offset in px
            halfH = band * (xW / precMax / 1.05) * (yH / 2 / zMaxAbs) * 0 + 2.0 * (yH / 2 / zMaxAbs);
            if (i == 0 || i == 20)
                sb.Append($"<circle cx=\"{px(0)}\" cy=\"{py(0)}\" r=\"{Math.Max(2, i == 0 ? 0 : 0)}\" fill=\"none\"/>");
            _ = x; _ = yc;
        }
        // simpler ±2 circle: radius chosen so it passes through (precMax, 2)
        double rCircle = Math.Sqrt(Math.Pow(px(precMax * 1.05) - px(0), 2)); // placeholder replaced below
        rCircle = 2.0 / zMaxAbs * (yH / 2) / (2.0 / (precMax * 1.05));
        sb.Append($"<circle cx=\"{px(0)}\" cy=\"{py(0)}\" r=\"{F(rCircle)}\" fill=\"none\" stroke=\"{NullColor}\" stroke-dasharray=\"4 3\" stroke-opacity=\"0.7\"/>");

        for (int i = 0; i < k; i++)
        {
            double prec = 1.0 / Math.Sqrt(d.Vars[i]);
            double z = d.Effs[i] * prec;
            sb.Append($"<circle cx=\"{F(px(prec))}\" cy=\"{F(py(z))}\" r=\"4\" fill=\"{StudyColor}\" fill-opacity=\"0.85\"/>");
            sb.Append($"<text x=\"{F(px(prec) + 6)}\" y=\"{F(py(z) - 4)}\" font-size=\"9\" fill=\"{Muted}\">{Escape(Trunc(d.Names[i], 14))}</text>");
        }
        sb.Append($"<text x=\"{ml + xW / 2}\" y=\"510\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\">Precision (1/SE)</text>");
        sb.Append($"<text x=\"20\" y=\"{mt + yH / 2}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\" transform=\"rotate(-90 20 {mt + yH / 2})\">Standardized effect (z)</text>");
        sb.Append($"<text x=\"280\" y=\"24\" text-anchor=\"middle\" font-size=\"13\" font-weight=\"600\" fill=\"{TextColor}\">Galbraith (Radial) Plot</text>");
        return sb.Append("</svg>").ToString();
    }

    /// <summary>L'Abbe plot: event rate treatment vs control, bubble ~ 1/variance.</summary>
    public static string Labbe(List<(string name, double a, double n1, double c, double n2)> arms)
    {
        var sb = StartSvg(540, 520);
        if (arms.Count < 2) return NeedMore(sb, "Need >=2 binary studies for L'Abbe plot");
        double maxRate = 0.05 + arms.Select(t => Math.Max(t.a / t.n1, t.c / t.n2)).DefaultIfEmpty(0).Max();
        const double ml = 56, mt = 46, size = 400;
        Func<double, double> sc = v => ml + v / maxRate * size;

        // diagonal = no-effect line
        sb.Append($"<line x1=\"{sc(0)}\" y1=\"{sc(0)}\" x2=\"{sc(maxRate)}\" y2=\"{sc(maxRate)}\" stroke=\"{NullColor}\" stroke-dasharray=\"4 3\" stroke-opacity=\"0.7\"/>");
        foreach (var t in arms)
        {
            double p1 = t.a / t.n1, p2 = t.c / t.n2;
            double r = Math.Max(3, Math.Min(10, Math.Sqrt(t.n1 + t.n2) / 25));
            sb.Append($"<circle cx=\"{F(sc(p2))}\" cy=\"{F(sc(p1))}\" r=\"{F(r)}\" fill=\"{StudyColor}\" fill-opacity=\"0.75\"/>");
        }
        sb.Append($"<text x=\"{ml + size / 2}\" y=\"505\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\">Event rate, control</text>");
        sb.Append($"<text x=\"18\" y=\"{mt + size / 2}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\" transform=\"rotate(-90 18 {mt + size / 2})\">Event rate, treatment</text>");
        sb.Append($"<text x=\"270\" y=\"24\" text-anchor=\"middle\" font-size=\"13\" font-weight=\"600\" fill=\"{TextColor}\">L'Abbe Plot</text>");
        return sb.Append("</svg>").ToString();
    }

    /// <summary>Baujat plot: contribution to Q (x) vs influence on pooled estimate (y).</summary>
    public static string Baujat(PlotInput d)
    {
        int k = d.Effs.Count;
        var sb = StartSvg(560, 520);
        if (k < 4) return NeedMore(sb, "Need >=4 studies for Baujat plot");

        var pts = new List<(string name, double qContrib, double infl)>();
        var wAll = d.Vars.Select(v => 1 / v).ToList();
        double swAll = wAll.Sum();
        double feAll = wAll.Zip(d.Effs, (w, e) => w * e).Sum() / swAll;

        for (int i = 0; i < k; i++)
        {
            // leave-one-out influence on FE estimate (% change)
            var idx = Enumerable.Range(0, k).Where(j => j != i).ToList();
            double sw = idx.Select(j => wAll[j]).Sum();
            double fe = idx.Select(j => wAll[j] * d.Effs[j]).Sum() / sw;
            double inflPct = Math.Abs(fe - feAll) / Math.Abs(feAll == 0 ? 1e-9 : feAll) * 100;
            pts.Add((d.Names[i], wAll[i] * Math.Pow(d.Effs[i] - feAll, 2), inflPct));
        }
        double xMax = pts.Max(p => p.qContrib) * 1.15 + 1e-9;
        double yMax = pts.Max(p => p.infl) * 1.15 + 1e-9;
        const double ml = 64, mt = 46, pw = 420, ph = 380;
        Func<double, double> px = v => ml + v / xMax * pw;
        Func<double, double> py = v => mt + ph - v / yMax * ph;

        foreach (var p in pts)
        {
            sb.Append($"<circle cx=\"{F(px(p.qContrib))}\" cy=\"{F(py(p.infl))}\" r=\"4.5\" fill=\"{StudyColor}\" fill-opacity=\"0.85\"/>");
            sb.Append($"<text x=\"{F(px(p.qContrib) + 6)}\" y=\"{F(py(p.infl) + 3)}\" font-size=\"9\" fill=\"{Muted}\">{Escape(Trunc(p.name, 16))}</text>");
        }
        sb.Append($"<text x=\"{ml + pw / 2}\" y=\"508\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\">Contribution to Cochran's Q</text>");
        sb.Append($"<text x=\"22\" y=\"{mt + ph / 2}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\" transform=\"rotate(-90 22 {mt + ph / 2})\">Influence on pooled estimate (%)</text>");
        sb.Append($"<text x=\"280\" y=\"24\" text-anchor=\"middle\" font-size=\"13\" font-weight=\"600\" fill=\"{TextColor}\">Baujat Plot</text>");
        return sb.Append("</svg>").ToString();
    }

    /// <summary>Contour-enhanced funnel: significance contours at p=.01/.05/.10 over the classic funnel.</summary>
    public static string ContourFunnel(MetaResponse r)
    {
        var studies = r.studies ?? new List<StudyResult>();
        bool useLog = r.measure is "OR" or "RR" or "HR" or "IRR";
        const double W = 600, H = 540;
        const double ml = 70, mr = 24, mt = 50, mb = 54;
        double plotW = W - ml - mr, plotH = H - mt - mb;
        var sb = StartSvg(W, H);
        if (studies.Count < 3) return NeedMore(sb, "Need >=3 studies for funnel plot");

        var pts = new List<(double eff, double se)>();
        foreach (var s in studies)
        {
            double eff = useLog ? Math.Log(Math.Max(s.effect, 1e-6)) : s.effect;
            double lo = useLog ? Math.Log(Math.Max(s.ci_lower, 1e-6)) : s.ci_lower;
            double hi = useLog ? Math.Log(Math.Max(s.ci_upper, 1e-6)) : s.ci_upper;
            pts.Add((eff, (hi - lo) / (2 * 1.959964)));
        }
        double pe = useLog ? Math.Log(Math.Max(r.pooled.effect, 1e-6)) : r.pooled.effect;
        double eMin = pts.Min(p => p.eff), eMax = pts.Max(p => p.eff);
        double sMax = pts.Max(p => p.se);
        double pad = (eMax - eMin) * 0.18 + 0.05;
        double eLo = Math.Min(eMin - pad, pe - pad), eHi = Math.Max(eMax + pad, pe + pad);
        double sHi = sMax * 1.35;
        Func<double, double> ex = e => ml + (e - eLo) / (eHi - eLo) * plotW;
        Func<double, double> sy = s => mt + s / sHi * plotH;

        // contour regions: |z|>2.576 (white/p=.01), >1.96 (.05), >1.645 (.10), else centre
        (double z, string col, double op)[] bands = { (2.576, "#ffffff", 0.16f), (1.960f, "#ffffff", 0.09f), (1.645f, "#ffffff", 0.045f) };
        double prev = 0;
        foreach (var (z, col, op) in bands)
        {
            double seZ = z / 1.959964; // se where pseudo-CI crosses null at this z
            double sTop = Math.Min(sHi, seZ);
            var left = new List<string>(); var right = new List<string>();
            for (int i = 0; i <= 30; i++)
            {
                double s = prev + (sTop - prev) * i / 30;
                left.Add($"{F(ex(pe - z * s))},{F(sy(s))}");
                right.Add($"{F(ex(pe + z * s))},{F(sy(s))}");
            }
            right.Reverse();
            sb.Append($"<polygon points=\"{string.Join(" ", left.Concat(right))}\" fill=\"{col}\" fill-opacity=\"{op.ToString(CultureInfo.InvariantCulture)}\"/>");
            if (i0(prev) && false) { } // no-op guard
            prev = sTop;
        }

        // study points
        foreach (var p in pts)
            sb.Append($"<circle cx=\"{F(ex(p.eff))}\" cy=\"{F(sy(p.se))}\" r=\"4\" fill=\"{StudyColor}\" fill-opacity=\"0.85\" stroke=\"#0c0d11\" stroke-width=\"0.5\"/>");
        sb.Append($"<line x1=\"{F(ex(pe))}\" y1=\"{mt}\" x2=\"{F(ex(pe))}\" y2=\"{mt + plotH}\" stroke=\"{Accent}\" stroke-width=\"2\"/>");

        // legend
        double lx = W - mr - 150, ly = mt + 8;
        string[] labels = { "p<.01", "p<.05", "p<.10" };
        double[] ops = { 0.16f, 0.09f, 0.045f };
        for (int i = 0; i < 3; i++)
        {
            sb.Append($"<rect x=\"{lx}\" y=\"{ly + i * 18}\" width=\"12\" height=\"12\" fill=\"#ffffff\" fill-opacity=\"{ops[i].ToString(CultureInfo.InvariantCulture)}\" stroke=\"{NullColor}\" stroke-width=\"0.5\"/>");
            sb.Append($"<text x=\"{lx + 18}\" y=\"{ly + i * 18 + 10}\" font-size=\"10\" fill=\"{Muted}\">{labels[i]} region</text>");
        }
        sb.Append($"<text x=\"{ml + plotW / 2}\" y=\"{H - 14}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\">{(useLog ? "Log " : "")}{Escape(r.measure)}</text>");
        sb.Append($"<text x=\"18\" y=\"{mt + plotH / 2}\" text-anchor=\"middle\" font-size=\"12\" fill=\"{TextColor}\" transform=\"rotate(-90 18 {mt + plotH / 2})\">Standard error</text>");
        sb.Append($"<text x=\"{W / 2}\" y=\"24\" text-anchor=\"middle\" font-size=\"13\" font-weight=\"600\" fill=\"{TextColor}\">Contour-Enhanced Funnel</text>");
        return sb.Append("</svg>").ToString();
    }

    private static bool i0(double _) => false;

    private static StringBuilder StartSvg(double w, double h) =>
        new($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"0 0 {w} {h}\" font-family=\"Inter, Arial, sans-serif\">" +
            $"<rect width=\"100%\" height=\"100%\" fill=\"#0c0d11\"/>");

    private static string NeedMore(StringBuilder sb, string msg) =>
        sb.Append($"<text x=\"280\" y=\"260\" text-anchor=\"middle\" font-size=\"14\" fill=\"{Muted}\">{Escape(msg)}</text></svg>").ToString();

    private static string Trunc(string s, int n) => string.IsNullOrEmpty(s) ? "?" : (s.Length <= n ? s : s[..n]);

    private static string Escape(string s) => s.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;");
}
