using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Survival extensions: RMST meta-analysis, IPD reconstruction from KM curves (v0.5.7).
/// </summary>
public static class SurvivalEngine
{
    public class RmstStudy
    {
        public string study { get; set; } = "";
        public double? rmstDiff { get; set; } // RMST difference (intervention - control)
        public double? se { get; set; }
        public double? tau { get; set; } // restriction time
    }

    public class RmstRequest
    {
        public List<RmstStudy> studies { get; set; } = new();
        public double tau { get; set; } = 5.0; // restriction time
    }

    public class RmstResult
    {
        public double pooledRmstDiff { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public int nStudies { get; set; }
        public List<(double tau, double pooled, double lo, double hi)> tauSensitivity { get; set; } = new();
    }

    public class KmPoint
    {
        public double time { get; set; }
        public double survival { get; set; }
        public int? nAtRisk { get; set; }
    }

    public class KmReconstructionRequest
    {
        public List<KmPoint> interventionCurve { get; set; } = new();
        public List<KmPoint> controlCurve { get; set; } = new();
        public int totalIntervention { get; set; }
        public int totalControl { get; set; }
    }

    public class KmReconstructionResult
    {
        public double reconstructedHr { get; set; }
        public double se { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public int reconstructedEventsIntervention { get; set; }
        public int reconstructedEventsControl { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static RmstResult RunRmst(RmstRequest req)
    {
        var valid = req.studies.Where(s => s.rmstDiff.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var effects = valid.Select(s => s.rmstDiff.Value).ToList();
        var vars = valid.Select(s => s.se.Value * s.se.Value).ToArray();

        double tau2 = EstimateTau2(effects.ToArray(), vars);
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;
        double z = se > 0 ? pooled / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        // Tau sensitivity analysis
        var tauSens = new List<(double, double, double, double)>();
        for (double t = 1; t <= 10; t += 0.5)
        {
            // Approximate RMST difference scales with tau
            double scaleFactor = t / req.tau;
            double scaledPooled = pooled * scaleFactor;
            double scaledSe = se * scaleFactor;
            tauSens.Add((t, scaledPooled, scaledPooled - crit * scaledSe, scaledPooled + crit * scaledSe));
        }

        return new RmstResult
        {
            pooledRmstDiff = pooled,
            ciLower = pooled - crit * se,
            ciUpper = pooled + crit * se,
            se = se,
            p = p,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            tau2 = tau2,
            nStudies = valid.Count,
            tauSensitivity = tauSens
        };
    }

    public static KmReconstructionResult ReconstructIPD(KmReconstructionRequest req)
    {
        // Guyader 2012 / Hsieh 2020 IPD reconstruction from published KM curves
        if (req.interventionCurve.Count < 2 || req.controlCurve.Count < 2)
            throw new ArgumentException("At least 2 time points per curve required");

        // Reconstruct pseudo-IPD using iterative algorithm
        var ipdIntervention = ReconstructCurve(req.interventionCurve, req.totalIntervention);
        var ipdControl = ReconstructCurve(req.controlCurve, req.totalControl);

        // Compute reconstructed HR
        int eventsInt = ipdIntervention.Count(p => p.eventTime > 0);
        int eventsCtrl = ipdControl.Count(p => p.eventTime > 0);

        double oa = eventsInt + eventsCtrl;
        double ea = (double)eventsInt * (eventsInt + eventsCtrl) / (req.totalIntervention + req.totalControl) * req.totalIntervention;

        double logHr = Math.Log(Math.Max(eventsInt / Math.Max(ea, 0.001), 0.001));
        double se = Math.Sqrt(1.0 / eventsInt + 1.0 / eventsCtrl);
        double crit = 1.959964;

        return new KmReconstructionResult
        {
            reconstructedHr = Math.Exp(logHr),
            se = se,
            ciLower = Math.Exp(logHr - crit * se),
            ciUpper = Math.Exp(logHr + crit * se),
            reconstructedEventsIntervention = eventsInt,
            reconstructedEventsControl = eventsCtrl,
            warnings = new List<string> { "IPD reconstruction is approximate. Use with caution for publication." }
        };
    }

    private static List<(double time, double eventTime, int atRisk)> ReconstructCurve(List<KmPoint> curve, int totalN)
    {
        var ipd = new List<(double, double, int)>();
        int prevAtRisk = totalN;

        for (int i = 0; i < curve.Count - 1; i++)
        {
            double t1 = curve[i].time;
            double t2 = curve[i + 1].time;
            double s1 = curve[i].survival;
            double s2 = curve[i + 1].survival;

            int nAtRisk = curve[i].nAtRisk ?? prevAtRisk;
            int nCensored = (int)((s1 - s2) * nAtRisk / Math.Max(s2, 0.001));
            int nEvented = nAtRisk - nCensored - (int)(s2 * nAtRisk);

            for (int j = 0; j < Math.Max(nEvented, 0); j++)
                ipd.Add((t1, t1, nAtRisk - j));

            prevAtRisk = nAtRisk - Math.Max(nEvented, 0) - Math.Max(nCensored, 0);
        }

        return ipd;
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
}
