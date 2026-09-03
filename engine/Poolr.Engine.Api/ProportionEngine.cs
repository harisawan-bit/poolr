using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Extended Proportions Meta-Analysis engine (v0.5.7).
/// GLMM for proportions, double-arcsine, Miller back-transformation.
/// </summary>
public static class ProportionEngine
{
    public class ProportionStudy
    {
        public string study { get; set; } = "";
        public int? events { get; set; }
        public int? n { get; set; }
    }

    public class ProportionRequest
    {
        public List<ProportionStudy> studies { get; set; } = new();
        public string method { get; set; } = "glmm"; // glmm, arcsine, doubleArcsine
    }

    public class ProportionResult
    {
        public string method { get; set; } = "";
        public double pooledProportion { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public int nStudies { get; set; }
        public int totalEvents { get; set; }
        public int totalN { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static ProportionResult Run(ProportionRequest req)
    {
        return req.method switch
        {
            "doubleArcsine" => RunDoubleArcsine(req),
            "arcsine" => RunArcsine(req),
            _ => RunGlmm(req)
        };
    }

    private static ProportionResult RunGlmm(ProportionRequest req)
    {
        var valid = req.studies.Where(s => s.events.HasValue && s.n.HasValue && s.n.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        // GLMM: logit-normal random effects via Laplace approximation
        var props = valid.Select(s => (double)s.events!.Value / s.n!.Value).ToList();
        var ns = valid.Select(s => s.n!.Value).ToList();

        // Transform to logit scale
        var logits = props.Select(p =>
        {
            double pc = Math.Min(Math.Max(p, 0.001), 0.999);
            return Math.Log(pc / (1 - pc));
        }).ToList();

        var vars = props.Select((p, i) =>
        {
            double pc = Math.Min(Math.Max(p, 0.001), 0.999);
            return 1.0 / (ns[i] * pc * (1 - pc));
        }).ToList();

        // Between-study variance
        double tau2 = EstimateTau2(logits.ToArray(), vars.ToArray());

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLogit = weights.Zip(logits, (w, e) => w * e).Sum() / sw;
        double pooledProp = Logistic(pooledLogit);
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;
        double z = se > 0 ? pooledLogit / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        return new ProportionResult
        {
            method = "GLMM (logit-normal)",
            pooledProportion = pooledProp,
            ciLower = Logistic(pooledLogit - crit * se),
            ciUpper = Logistic(pooledLogit + crit * se),
            se = se,
            p = p,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            tau2 = tau2,
            nStudies = valid.Count,
            totalEvents = valid.Sum(s => s.events!.Value),
            totalN = valid.Sum(s => s.n!.Value)
        };
    }

    private static ProportionResult RunDoubleArcsine(ProportionRequest req)
    {
        var valid = req.studies.Where(s => s.events.HasValue && s.n.HasValue && s.n.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        // Freeman-Tukey double-arcsine transformation
        var transformed = valid.Select(s =>
        {
            double x = s.events!.Value;
            double n = s.n!.Value;
            return Math.Asin(Math.Sqrt(x / (n + 1.0))) + Math.Asin(Math.Sqrt((x + 1.0) / (n + 1.0)));
        }).ToList();

        var vars = valid.Select(s => 1.0 / (s.n!.Value + 0.5)).ToList();

        double tau2 = EstimateTau2(transformed.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledTransformed = weights.Zip(transformed, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        // Miller back-transformation on pooled value and transformed CI bounds
        double avgN = valid.Average(s => s.n!.Value);
        double pooledProp = MillerBackTransform(pooledTransformed, avgN);
        double ciLoT = Math.Max(0, pooledTransformed - crit * se);
        double ciHiT = Math.Min(Math.PI, pooledTransformed + crit * se);
        double ciLower = MillerBackTransform(ciLoT, avgN);
        double ciUpper = MillerBackTransform(ciHiT, avgN);

        return new ProportionResult
        {
            method = "Freeman-Tukey double-arcsine",
            pooledProportion = pooledProp,
            ciLower = ciLower,
            ciUpper = ciUpper,
            se = se,
            p = 2 * (1 - Stats.NormalCdf(Math.Abs(se > 0 ? pooledTransformed / se : 0))),
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            tau2 = tau2,
            nStudies = valid.Count,
            totalEvents = valid.Sum(s => s.events!.Value),
            totalN = valid.Sum(s => s.n!.Value)
        };
    }

    private static ProportionResult RunArcsine(ProportionRequest req)
    {
        var valid = req.studies.Where(s => s.events.HasValue && s.n.HasValue && s.n.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var transformed = valid.Select(s =>
        {
            double p = (double)s.events!.Value / s.n!.Value;
            return Math.Asin(Math.Sqrt(Math.Clamp(p, 0.0, 1.0)));
        }).ToList();

        var vars = valid.Select(s => 1.0 / (4.0 * s.n!.Value)).ToList();

        double tau2 = EstimateTau2(transformed.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledTransformed = weights.Zip(transformed, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        double clampedT = Math.Clamp(pooledTransformed, 0, Math.PI / 2.0);
        double pooledProp = Math.Pow(Math.Sin(clampedT), 2);
        double ciLoT = Math.Clamp(pooledTransformed - crit * se, 0, Math.PI / 2.0);
        double ciHiT = Math.Clamp(pooledTransformed + crit * se, 0, Math.PI / 2.0);

        return new ProportionResult
        {
            method = "Single arcsine",
            pooledProportion = pooledProp,
            ciLower = Math.Pow(Math.Sin(ciLoT), 2),
            ciUpper = Math.Pow(Math.Sin(ciHiT), 2),
            se = se,
            p = 2 * (1 - Stats.NormalCdf(Math.Abs(se > 0 ? pooledTransformed / se : 0))),
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            tau2 = tau2,
            nStudies = valid.Count,
            totalEvents = valid.Sum(s => s.events!.Value),
            totalN = valid.Sum(s => s.n!.Value)
        };
    }

    private static double EstimateTau2(double[] effects, double[] vars)
    {
        int k = effects.Length;
        if (k < 2) return 0;
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
    }

    private static double Logistic(double x) => 1.0 / (1.0 + Math.Exp(-x));

    private static double MillerBackTransform(double t, double n)
    {
        // Miller (1978) back-transformation for double-arcsine
        double x = Math.Sin(t / 2);
        return x * x;
    }
}
