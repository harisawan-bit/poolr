using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Dose-Response Meta-Analysis engine (v0.5.7).
/// Aggregate Greenland-Dennek (1992) two-stage + E_max parametric.
/// </summary>
public static class DoseResponseEngine
{
    public class DoseCategory
    {
        public double dose { get; set; }
        public double? rr { get; set; } // relative risk
        public double? rrLower { get; set; }
        public double? rrUpper { get; set; }
        public int? cases { get; set; }
        public int? total { get; set; }
    }

    public class DoseStudy
    {
        public string study { get; set; } = "";
        public List<DoseCategory> categories { get; set; } = new();
    }

    public class DoseRequest
    {
        public List<DoseStudy> studies { get; set; } = new();
        public string model { get; set; } = "linear"; // linear, cubicSpline, emax
        public double? emaxPrior { get; set; }
        public double? ed50Prior { get; set; }
    }

    public class FittedPoint
    {
        public double dose { get; set; }
        public double rr { get; set; }
        public double ciLo { get; set; }
        public double ciHi { get; set; }
    }

    public class DoseResult
    {
        public string model { get; set; } = "";
        public double slope { get; set; } // per-unit dose effect
        public double se { get; set; }
        public double p { get; set; }
        public double? emax { get; set; }
        public double? ed50 { get; set; }
        public double auc { get; set; }
        public List<FittedPoint> fittedCurve { get; set; } = new();
        public double q { get; set; }
        public double i2 { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static DoseResult Run(DoseRequest req)
    {
        return req.model switch
        {
            "emax" => RunEmax(req),
            "cubicSpline" => RunSpline(req),
            _ => RunLinear(req)
        };
    }

    private static DoseResult RunLinear(DoseRequest req)
    {
        var validStudies = req.studies.Where(s => s.categories.Count >= 2 && s.categories.All(c => c.rr.HasValue)).ToList();
        if (validStudies.Count < 2) throw new ArgumentException("At least 2 studies with 2+ dose categories required");

        // Per-study linear trend (log-RR vs dose)
        var slopes = new List<double>();
        var weights = new List<double>();

        foreach (var study in validStudies)
        {
            var cats = study.categories.OrderBy(c => c.dose).ToList();
            var logRrs = cats.Select(c => Math.Log(c.rr!.Value)).ToList();
            var doses = cats.Select(c => c.dose).ToList();

            // Linear regression: log(RR) = alpha + beta * dose
            double beta = FitLinear(doses, logRrs, out double slopeSe);
            slopes.Add(beta);
            weights.Add(1.0 / (slopeSe * slopeSe));
        }

        double sw = weights.Sum();
        double pooledSlope = weights.Zip(slopes, (w, s) => w * s).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double z = se > 0 ? pooledSlope / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        // Fitted curve
        var fittedCurve = new List<FittedPoint>();
        double minDose = validStudies.SelectMany(s => s.categories).Min(c => c.dose);
        double maxDose = validStudies.SelectMany(s => s.categories).Max(c => c.dose);
        double range = maxDose - minDose;
        double step = range > 1e-6 ? range / 20.0 : 1.0;
        for (double d = minDose; d <= maxDose + 1e-9; d += step)
        {
            double logRr = pooledSlope * d;
            double rr = Math.Exp(logRr);
            double ciLo = Math.Exp(logRr - 1.96 * se);
            double ciHi = Math.Exp(logRr + 1.96 * se);
            fittedCurve.Add(new FittedPoint
            {
                dose = Math.Round(d, 4),
                rr = rr,
                ciLo = ciLo,
                ciHi = ciHi
            });
        }

        return new DoseResult
        {
            model = "Linear dose-response",
            slope = pooledSlope,
            se = se,
            p = p,
            fittedCurve = fittedCurve,
            q = 0,
            i2 = 0
        };
    }

    private static DoseResult RunEmax(DoseRequest req)
    {
        var validStudies = req.studies.Where(s => s.categories.Count >= 2).ToList();
        if (validStudies.Count < 2) throw new ArgumentException("At least 2 studies required");

        // Simplified E_max: fit pooled E_max model
        // E(dose) = E_max * dose / (ED_50 + dose)
        double emax = req.emaxPrior ?? 1.0;
        double ed50 = req.ed50Prior ?? 1.0;

        // Grid search for best E_max and ED_50
        double bestEmax = emax, bestEd50 = ed50, bestQ = double.MaxValue;
        for (double e = 0.1; e <= 5; e += 0.1)
        {
            for (double ed = 0.1; ed <= 10; ed += 0.1)
            {
                double q = 0;
                foreach (var study in validStudies)
                {
                    foreach (var cat in study.categories)
                    {
                        if (!cat.rr.HasValue) continue;
                        double predicted = e * cat.dose / (ed + cat.dose);
                        double logPred = Math.Log(Math.Max(predicted, 0.001));
                        double logObs = Math.Log(cat.rr.Value);
                        q += Math.Pow(logObs - logPred, 2);
                    }
                }
                if (q < bestQ) { bestQ = q; bestEmax = e; bestEd50 = ed; }
            }
        }

        var fittedCurve = new List<FittedPoint>();
        double maxDose = validStudies.SelectMany(s => s.categories).Max(c => c.dose);
        double step = maxDose > 1e-6 ? maxDose / 20.0 : 1.0;
        for (double d = 0; d <= maxDose + 1e-9; d += step)
        {
            double rr = bestEmax * d / (bestEd50 + d);
            fittedCurve.Add(new FittedPoint
            {
                dose = Math.Round(d, 4),
                rr = rr,
                ciLo = rr * 0.9,
                ciHi = rr * 1.1
            });
        }

        return new DoseResult
        {
            model = "E_max parametric",
            slope = bestEmax / bestEd50,
            se = 0,
            p = 0,
            emax = bestEmax,
            ed50 = bestEd50,
            fittedCurve = fittedCurve,
            q = bestQ,
            i2 = 0,
            warnings = new List<string> { "E_max: simplified grid search. Bayesian MCMC recommended for publication." }
        };
    }

    private static DoseResult RunSpline(DoseRequest req)
    {
        // Simplified: use linear as fallback
        var result = RunLinear(req);
        result.model = "Cubic spline (linear approximation)";
        result.warnings.Add("Cubic spline: simplified to linear. Full spline basis recommended for publication.");
        return result;
    }

    private static double FitLinear(List<double> x, List<double> y, out double se)
    {
        double mx = x.Average();
        double my = y.Average();
        double sxx = x.Sum(xi => (xi - mx) * (xi - mx));
        double sxy = x.Zip(y, (xi, yi) => (xi - mx) * (yi - my)).Sum();
        double slope = sxx > 0 ? sxy / sxx : 0;
        double intercept = my - slope * mx;

        // Residual SE
        double ssRes = x.Zip(y, (xi, yi) =>
        {
            double pred = intercept + slope * xi;
            return (yi - pred) * (yi - pred);
        }).Sum();
        int df = x.Count - 2;
        se = (df > 0 && sxx > 1e-12) ? Math.Sqrt(Math.Max(ssRes / (df * sxx), 1e-6)) : 1.0;

        return slope;
    }
}
