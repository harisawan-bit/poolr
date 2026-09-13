using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.7.0 Cumulative Forest Plot with Trendline (RevMan Web style).
/// Produces cumulative meta-analysis data with a trendline showing how
/// the pooled effect evolves as studies are added chronologically.
/// Also computes the cumulative I² trend.
/// Reference: RevMan Web cumulative forest, Borenstein et al. 2009.
/// </summary>
public static class CumulativeForestEngine
{
    public class CumulativeStudy
    {
        public string study { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
        public int? year { get; set; }
        public DateTime? dateAdded { get; set; }
    }

    public class CumulativeRequest
    {
        public List<CumulativeStudy> studies { get; set; } = new();
        public bool chronological { get; set; } = true;
        public string model { get; set; } = "random";
        public string method { get; set; } = "DL";
    }

    public class CumulativeEntry
    {
        public string study { get; set; } = "";
        public int k { get; set; }
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public double q { get; set; }
        public double p { get; set; }
        public double weight { get; set; }
    }

    public class TrendlinePoint
    {
        public int k { get; set; }
        public double x { get; set; }
        public double y { get; set; }
    }

    public class CumulativeResult
    {
        public List<CumulativeEntry> cumulative { get; set; } = new();
        public List<TrendlinePoint> trendline { get; set; } = new();
        public double finalPooledEffect { get; set; }
        public double finalCiLower { get; set; }
        public double finalCiUpper { get; set; }
        public double finalI2 { get; set; }
        public double trendlineSlope { get; set; }
        public double trendlineIntercept { get; set; }
        public double trendlineP { get; set; }
        public string interpretation { get; set; } = "";
        public string method { get; set; } = "Cumulative forest with trendline (RevMan Web)";
    }

    public static CumulativeResult Run(CumulativeRequest req)
    {
        var sorted = req.chronological
            ? req.studies.Where(s => s.effect.HasValue && s.se.HasValue)
                .OrderBy(s => s.dateAdded ?? DateTime.MinValue)
                .ThenBy(s => s.year ?? 0).ToList()
            : req.studies.Where(s => s.effect.HasValue && s.se.HasValue)
                .OrderBy(s => s.year ?? 0).ToList();

        if (sorted.Count < 2) throw new ArgumentException("At least 2 studies required");

        var cumulative = new List<CumulativeEntry>();
        var trendline = new List<TrendlinePoint>();

        for (int i = 2; i <= sorted.Count; i++)
        {
            var subset = sorted.Take(i).ToList();
            var effects = subset.Select(s => s.effect!.Value).ToList();
            var vars = subset.Select(s => s.se!.Value * s.se.Value).ToList();

            double tau2 = EstimateTau2(effects, vars, req.method);
            var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
            double sw = weights.Sum();
            double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sw;
            double se = Math.Sqrt(1.0 / sw);
            double crit = 1.959964;

            // Q and I²
            var feW = vars.Select(v => 1.0 / Math.Max(v, 1e-12)).ToList();
            double feSw = feW.Sum();
            double fe = feW.Zip(effects, (w, e) => w * e).Sum() / feSw;
            double q = feW.Zip(effects, (w, e) => w * Math.Pow(e - fe, 2)).Sum();
            int df = i - 1;
            double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;
            double z = se > 1e-12 ? pooled / se : 0;
            double p = 2.0 * (1.0 - Stats.NormalCdf(Math.Abs(z)));

            cumulative.Add(new CumulativeEntry
            {
                study = subset.Last().study,
                k = i,
                pooledEffect = pooled,
                ciLower = pooled - crit * se,
                ciUpper = pooled + crit * se,
                se = se,
                i2 = i2,
                tau2 = tau2,
                q = q,
                p = p,
                weight = 1.0 / sw
            });

            trendline.Add(new TrendlinePoint { k = i, x = i, y = pooled });
        }

        // Fit trendline (linear regression on cumulative pooled effects)
        double trendSlope = 0, trendIntercept = 0, trendP = 1;
        if (trendline.Count >= 3)
        {
            var x = trendline.Select(t => t.x).ToList();
            var y = trendline.Select(t => t.y).ToList();
            double mx = x.Average();
            double my = y.Average();
            double sxx = x.Sum(v => (v - mx) * (v - mx));
            double sxy = x.Zip(y, (a, b) => (a - mx) * (b - my)).Sum();
            trendSlope = sxx == 0 ? 0 : sxy / sxx;
            trendIntercept = my - trendSlope * mx;

            // SE of slope
            var residuals = x.Zip(y, (xi, yi) => yi - (trendSlope * xi + trendIntercept)).ToList();
            double ssRes = residuals.Sum(r => r * r);
            double mse = ssRes / Math.Max(x.Count - 2, 1);
            double seSlope = sxx > 0 ? Math.Sqrt(mse / sxx) : 0;
            double tStat = seSlope > 1e-12 ? trendSlope / seSlope : 0;
            int dfRes = Math.Max(x.Count - 2, 1);
            trendP = ExtendedStats.TwoSidePFromT(tStat, dfRes);
        }

        var final = cumulative.Last();
        string trendDir = trendSlope > 0 ? "increases" : "decreases";
        string interp = trendP < 0.05
            ? $"Significant trend over time (slope={trendSlope:F4}, p={trendP:E2}). Effect {trendDir} with more studies."
            : $"No significant temporal trend (slope={trendSlope:F4}, p={trendP:F3}).";

        return new CumulativeResult
        {
            cumulative = cumulative,
            trendline = trendline,
            finalPooledEffect = final.pooledEffect,
            finalCiLower = final.ciLower,
            finalCiUpper = final.ciUpper,
            finalI2 = final.i2,
            trendlineSlope = trendSlope,
            trendlineIntercept = trendIntercept,
            trendlineP = trendP,
            interpretation = interp,
            method = $"Cumulative forest ({req.model}, {req.method})"
        };
    }

    private static double EstimateTau2(List<double> effects, List<double> vars, string method)
    {
        var feW = vars.Select(v => 1.0 / Math.Max(v, 1e-12)).ToList();
        double feSw = feW.Sum();
        double fe = feW.Zip(effects, (w, e) => w * e).Sum() / feSw;
        double q = feW.Zip(effects, (w, e) => w * Math.Pow(e - fe, 2)).Sum();
        int df = effects.Count - 1;
        double c = feSw - feW.Sum(w => w * w) / feSw;

        return method.ToLowerInvariant() switch
        {
            "reml" => RemlTau2(effects, vars),
            "pm" => PauleMandelTau2(effects, vars),
            _ => (df > 0 && q > df && c > 1e-12) ? Math.Max(0, (q - df) / c) : 0
        };
    }

    private static double RemlTau2(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        if (k < 2) return 0;
        var w = variances.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wt, e) => wt * e).Sum() / sw;
        double q = w.Zip(effects, (wt, e) => wt * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c2 = sw - w.Sum(wt => wt * wt) / sw;
        return (df > 0 && q > df && c2 > 1e-12) ? Math.Max(0, (q - df) / c2) : 0;
    }

    private static double PauleMandelTau2(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        if (k < 2) return 0;
        double Qt(double t)
        {
            var w = variances.Select(v => 1.0 / (v + t)).ToList();
            double sw = w.Sum();
            double pooled = w.Zip(effects, (wt, e) => wt * e).Sum() / sw;
            return w.Zip(effects, (wt, e) => wt * Math.Pow(e - pooled, 2)).Sum();
        }
        double target = k - 1;
        double lo = 0, hi = 1;
        while (Qt(hi) > target) { hi *= 2; if (hi > 1e6) break; }
        for (int iter = 0; iter < 100; iter++)
        {
            double mid = (lo + hi) / 2;
            double qMid = Qt(mid);
            if (Math.Abs(qMid - target) < 1e-8) return Math.Max(0, mid);
            if (qMid > target) lo = mid; else hi = mid;
        }
        return Math.Max(0, (lo + hi) / 2);
    }
}
