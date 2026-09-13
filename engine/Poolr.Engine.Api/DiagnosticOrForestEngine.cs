using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.0 Diagnostic OR Forest Engine (JASP-style).
/// Computes diagnostic odds ratio (DOR) forest plot data for each study
/// and the pooled DOR with 95% CI using the Moses-Littenberg method.
/// Also provides SROC curve coordinates for plotting.
/// Reference: Moses et al. 1993, Irwig et al. 1985, JASP DTA module.
/// </summary>
public static class DiagnosticOrForestEngine
{
    public class DorStudyInput
    {
        public string study { get; set; } = "";
        public int? tp { get; set; }
        public int? fp { get; set; }
        public int? fn { get; set; }
        public int? tn { get; set; }
    }

    public class DorRequest
    {
        public List<DorStudyInput> studies { get; set; } = new();
        public double? userPrevalence { get; set; }
    }

    public class DorStudyResult
    {
        public string study { get; set; } = "";
        public double sensitivity { get; set; }
        public double specificity { get; set; }
        public double dor { get; set; }
        public double logDor { get; set; }
        public double seLogDor { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double weight { get; set; }
        public int n { get; set; }
    }

    public class SrocPoint
    {
        public double logitSens { get; set; }
        public double logitSpec { get; set; }
        public double sensitivity { get; set; }
        public double specificity { get; set; }
    }

    public class DorResult
    {
        public List<DorStudyResult> studyResults { get; set; } = new();
        public double pooledDor { get; set; }
        public double pooledLogDor { get; set; }
        public double sePooledLogDor { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double pooledSensitivity { get; set; }
        public double pooledSpecificity { get; set; }
        public double auc { get; set; }
        public List<SrocPoint> srocCurve { get; set; } = new();
        public string interpretation { get; set; } = "";
        public string method { get; set; } = "Diagnostic OR Forest (Moses-Littenberg)";
    }

    public static DorResult Run(DorRequest req)
    {
        var valid = req.studies.Where(s =>
            s.tp.HasValue && s.fp.HasValue && s.fn.HasValue && s.tn.HasValue &&
            s.tp.Value + s.fn.Value > 0 && s.fp.Value + s.tn.Value > 0).ToList();

        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var studyResults = new List<DorStudyResult>();
        var logDors = new List<double>();
        var vars = new List<double>();

        foreach (var s in valid)
        {
            double tp = s.tp!.Value, fp = s.fp!.Value, fn = s.fn!.Value, tn = s.tn!.Value;

            // Haldane-Anscombe correction
            double pSens = (tp + 0.5) / (tp + fn + 1);
            double pSpec = (tn + 0.5) / (fp + tn + 1);
            double sens = tp / (tp + fn);
            double spec = tn / (fp + tn);

            // DOR = (TP * TN) / (FP * FN) with correction
            double dor = ((tp + 0.5) * (tn + 0.5)) / ((fp + 0.5) * (fn + 0.5));
            double logDor = Math.Log(dor);
            double varLogDor = 1.0 / (tp + 0.5) + 1.0 / (fp + 0.5) + 1.0 / (fn + 0.5) + 1.0 / (tn + 0.5);
            double seLogDor = Math.Sqrt(varLogDor);

            double crit = 1.959964;
            logDors.Add(logDor);
            vars.Add(varLogDor);

            studyResults.Add(new DorStudyResult
            {
                study = s.study,
                sensitivity = sens,
                specificity = spec,
                dor = dor,
                logDor = logDor,
                seLogDor = seLogDor,
                ciLower = Math.Exp(logDor - crit * seLogDor),
                ciUpper = Math.Exp(logDor + crit * seLogDor),
                weight = 0, // will be set after pooling
                n = (int)(tp + fp + fn + tn)
            });
        }

        // Random-effects pooling of log(DOR) using DL estimator
        var feW = vars.Select(v => 1.0 / Math.Max(v, 1e-12)).ToList();
        double feSw = feW.Sum();
        double fe = feW.Zip(logDors, (w, e) => w * e).Sum() / feSw;
        double q = feW.Zip(logDors, (w, e) => w * Math.Pow(e - fe, 2)).Sum();
        int df = valid.Count - 1;
        double c = feSw - feW.Sum(w => w * w) / feSw;
        double tau2 = (df > 0 && q > df && c > 1e-12) ? Math.Max(0, (q - df) / c) : 0;

        var reW = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double reSw = reW.Sum();
        double pooledLogDor = reW.Zip(logDors, (w, e) => w * e).Sum() / reSw;
        double sePooled = Math.Sqrt(1.0 / reSw);
        double crit2 = 1.959964;

        // Update weights
        for (int i = 0; i < studyResults.Count; i++)
            studyResults[i].weight = reW[i] / reSw * 100;

        // Pooled sensitivity and specificity
        double pooledSens = studyResults.Select(s => s.sensitivity).Average();
        double pooledSpec = studyResults.Select(s => s.specificity).Average();

        // AUC approximation
        double auc = ComputeAuc(pooledSens, pooledSpec);

        // Generate SROC curve
        var srocCurve = GenerateSrocCurve(pooledSens, pooledSpec, logDors, vars);

        return new DorResult
        {
            studyResults = studyResults,
            pooledDor = Math.Exp(pooledLogDor),
            pooledLogDor = pooledLogDor,
            sePooledLogDor = sePooled,
            ciLower = Math.Exp(pooledLogDor - crit2 * sePooled),
            ciUpper = Math.Exp(pooledLogDor + crit2 * sePooled),
            pooledSensitivity = pooledSens,
            pooledSpecificity = pooledSpec,
            auc = auc,
            srocCurve = srocCurve,
            interpretation = $"Pooled DOR={Math.Exp(pooledLogDor):F2} (95% CI: {Math.Exp(pooledLogDor - crit2 * sePooled):F2}-{Math.Exp(pooledLogDor + crit2 * sePooled):F2}), AUC={auc:F3}",
            method = "Diagnostic OR Forest (Moses-Littenberg, random-effects)"
        };
    }

    private static double ComputeAuc(double sens, double spec)
    {
        // Moses-Littenberg AUC approximation
        double logitSens = Math.Log(sens / (1 - sens));
        double logitSpec = Math.Log(spec / (1 - spec));
        return 0.5 * (1 + Math.Tanh((logitSens + logitSpec) / 2));
    }

    private static List<SrocPoint> GenerateSrocCurve(double pooledSens, double pooledSpec,
        List<double> logDors, List<double> vars)
    {
        var points = new List<SrocPoint>();
        int nPoints = 100;

        // Simple SROC: vary threshold parameter
        for (int i = 0; i <= nPoints; i++)
        {
            double threshold = -3.0 + 6.0 * i / nPoints;
            double sensI = Logistic(threshold + 0.5 * pooledSens);
            double specI = Logistic(-threshold + 0.5 * pooledSpec);
            points.Add(new SrocPoint
            {
                sensitivity = sensI,
                specificity = specI,
                logitSens = Math.Log(sensI / (1 - sensI)),
                logitSpec = Math.Log(specI / (1 - specI))
            });
        }

        return points;
    }

    private static double Logistic(double x)
    {
        return 1.0 / (1.0 + Math.Exp(-Math.Max(-10, Math.Min(10, x))));
    }
}
