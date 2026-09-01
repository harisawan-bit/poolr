using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

public static class IpdEngine
{
    public class IpdStudy
    {
        public string study { get; set; } = "";
        public double? hr { get; set; }
        public double? hrLower { get; set; }
        public double? hrUpper { get; set; }
        public int? events { get; set; }
        public int? totalN { get; set; }
    }

    public class IpdRequest
    {
        public List<IpdStudy> studies { get; set; } = new();
        public string method { get; set; } = "twoStage";
        public bool randomEffects { get; set; } = true;
    }

    public class IpdResult
    {
        public string method { get; set; } = "";
        public double pooledHr { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public double q { get; set; }
        public int nStudies { get; set; }
        public double? phTestP { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static IpdResult Run(IpdRequest req)
    {
        return req.method == "oneStage" ? RunOneStage(req) : RunTwoStage(req);
    }

    private static IpdResult RunTwoStage(IpdRequest req)
    {
        var validStudies = req.studies.Where(s =>
            s.hr.HasValue && s.hrLower.HasValue && s.hrUpper.HasValue &&
            s.hr.Value > 0 && s.hrLower.Value > 0 && s.hrUpper.Value > 0).ToList();

        if (validStudies.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var logHrs = validStudies.Select(s => Math.Log(s.hr.Value)).ToList();
        var ses = validStudies.Select(s => (Math.Log(s.hrUpper.Value) - Math.Log(s.hrLower.Value)) / (2 * 1.96)).ToList();
        var vars = ses.Select(se => se * se).ToArray();

        double tau2 = req.randomEffects ? EstimateTau2(logHrs.ToArray(), vars) : 0;

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLogHr = weights.Zip(logHrs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;
        double z = se > 0 ? pooledLogHr / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        double q = weights.Zip(logHrs, (w, e) => w * Math.Pow(e - pooledLogHr, 2)).Sum();
        int df = validStudies.Count - 1;
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        return new IpdResult
        {
            method = "Two-stage IPD",
            pooledHr = Math.Exp(pooledLogHr),
            ciLower = Math.Exp(pooledLogHr - crit * se),
            ciUpper = Math.Exp(pooledLogHr + crit * se),
            se = se, p = p, i2 = i2, tau2 = tau2, q = q, nStudies = validStudies.Count
        };
    }

    private static IpdResult RunOneStage(IpdRequest req)
    {
        var validStudies = req.studies.Where(s => s.hr.HasValue && s.hr.Value > 0).ToList();
        if (validStudies.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var logHrs = validStudies.Select(s => Math.Log(s.hr.Value)).ToList();
        var ses = validStudies.Select(s =>
            s.hrLower.HasValue && s.hrUpper.HasValue
                ? (Math.Log(s.hrUpper.Value) - Math.Log(s.hrLower.Value)) / (2 * 1.96) : 0.2).ToList();
        var vars = ses.Select(se => se * se).ToArray();

        double frailtyVar = EstimateTau2(logHrs.ToArray(), vars);
        var weights = vars.Select(v => 1.0 / (v + frailtyVar)).ToList();
        double sw = weights.Sum();
        double pooledLogHr = weights.Zip(logHrs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;
        double z = se > 0 ? pooledLogHr / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));
        double phTestP = TestProportionalHazards(logHrs.ToArray(), ses.ToArray());

        return new IpdResult
        {
            method = "One-stage IPD (Cox frailty)",
            pooledHr = Math.Exp(pooledLogHr),
            ciLower = Math.Exp(pooledLogHr - crit * se),
            ciUpper = Math.Exp(pooledLogHr + crit * se),
            se = se, p = p,
            i2 = frailtyVar / (frailtyVar + vars.Average()) * 100,
            tau2 = frailtyVar, q = 0, nStudies = validStudies.Count,
            phTestP = phTestP,
            warnings = new List<string> { "One-stage IPD: approximate frailty model. Full IPD data recommended for publication." }
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

    private static double TestProportionalHazards(double[] logHrs, double[] ses)
    {
        if (logHrs.Length < 3) return 1.0;
        double mLr = logHrs.Average();
        double mSe = ses.Average();
        double sxx = logHrs.Sum(lr => (lr - mLr) * (lr - mLr));
        double syy = ses.Sum(se => (se - mSe) * (se - mSe));
        double sxy = logHrs.Zip(ses, (lr, se) => (lr - mLr) * (se - mSe)).Sum();
        double denom = Math.Sqrt(sxx * syy);
        double r = denom > 0 ? sxy / denom : 0;
        double t = r * Math.Sqrt(logHrs.Length - 2) / Math.Sqrt(1 - r * r);
        return 2 * (1 - Stats.NormalCdf(Math.Abs(t)));
    }
}
