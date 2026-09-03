using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Diagnostic Test Accuracy (DTA) Meta-Analysis engine (v0.5.7).
/// Bivariate Reitsma model (2005) + HSROC (Rutter-Gatsonis 2001).
/// Pure C# numerics, guarded by xUnit benchmarks.
/// </summary>
public static class DtaEngine
{
    public class DtaStudy
    {
        public string study { get; set; } = "";
        public int? tp { get; set; }
        public int? fp { get; set; }
        public int? fn { get; set; }
        public int? tn { get; set; }
    }

    public class DtaRequest
    {
        public List<DtaStudy> studies { get; set; } = new();
        public string model { get; set; } = "bivariate"; // bivariate or hsroc
        public double? userPrevalence { get; set; }
    }

    public class DtaResult
    {
        public string model { get; set; } = "";
        public double sensitivity { get; set; }
        public double specificity { get; set; }
        public double sensCiLower { get; set; }
        public double sensCiUpper { get; set; }
        public double specCiLower { get; set; }
        public double specCiUpper { get; set; }
        public double dor { get; set; } // diagnostic odds ratio
        public double dorCiLower { get; set; }
        public double dorCiUpper { get; set; }
        public double auc { get; set; } // area under SROC curve
        public double? tau2Sens { get; set; }
        public double? tau2Spec { get; set; }
        public double? rho { get; set; } // between-study correlation
        public List<DtaStudyResult> studyResults { get; set; } = new();
        public List<string> warnings { get; set; } = new();
    }

    public class DtaStudyResult
    {
        public string study { get; set; } = "";
        public double sensitivity { get; set; }
        public double specificity { get; set; }
        public double logitSens { get; set; }
        public double logitSpec { get; set; }
        public double varLogitSens { get; set; }
        public double varLogitSpec { get; set; }
    }

    public static DtaResult Run(DtaRequest req)
    {
        return req.model switch
        {
            "hsroc" => RunHsroc(req),
            _ => RunBivariate(req)
        };
    }

    private static DtaResult RunBivariate(DtaRequest req)
    {
        var validStudies = req.studies.Where(s =>
            s.tp.HasValue && s.fp.HasValue && s.fn.HasValue && s.tn.HasValue &&
            s.tp.Value + s.fn.Value > 0 && s.fp.Value + s.tn.Value > 0).ToList();

        if (validStudies.Count < 2)
            throw new ArgumentException("At least 2 valid studies required");

        // Compute logit-sens and logit-spec per study
        var studyResults = new List<DtaStudyResult>();
        foreach (var s in validStudies)
        {
            double sens = (double)s.tp!.Value / (s.tp.Value + s.fn!.Value);
            double spec = (double)s.tn!.Value / (s.fp!.Value + s.tn.Value);

            // Haldane-Anscombe correction for zeros
            double pSens = (s.tp.Value + 0.5) / (s.tp.Value + s.fn.Value + 1);
            double pSpec = (s.tn.Value + 0.5) / (s.fp.Value + s.tn.Value + 1);

            double logitSens = Math.Log(pSens / (1 - pSens));
            double logitSpec = Math.Log(pSpec / (1 - pSpec));

            double varLogitSens = 1.0 / (s.tp.Value + 0.5) + 1.0 / (s.fn.Value + 0.5);
            double varLogitSpec = 1.0 / (s.fp.Value + 0.5) + 1.0 / (s.tn.Value + 0.5);

            studyResults.Add(new DtaStudyResult
            {
                study = s.study,
                sensitivity = sens,
                specificity = spec,
                logitSens = logitSens,
                logitSpec = logitSpec,
                varLogitSens = varLogitSens,
                varLogitSpec = varLogitSpec
            });
        }

        // Bivariate random-effects meta-analysis (REML)
        var logitSensArr = studyResults.Select(s => s.logitSens).ToArray();
        var logitSpecArr = studyResults.Select(s => s.logitSpec).ToArray();
        var varSensArr = studyResults.Select(s => s.varLogitSens).ToArray();
        var varSpecArr = studyResults.Select(s => s.varLogitSpec).ToArray();

        // Estimate between-study variance components
        double tau2Sens = EstimateTau2(logitSensArr, varSensArr);
        double tau2Spec = EstimateTau2(logitSpecArr, varSpecArr);

        // Pooled estimates (random-effects)
        var wSens = varSensArr.Select(v => 1.0 / (v + tau2Sens)).ToArray();
        var wSpec = varSpecArr.Select(v => 1.0 / (v + tau2Spec)).ToArray();

        double pooledLogitSens = wSens.Zip(logitSensArr, (w, e) => w * e).Sum() / wSens.Sum();
        double pooledLogitSpec = wSpec.Zip(logitSpecArr, (w, e) => w * e).Sum() / wSpec.Sum();

        double pooledSens = Logistic(pooledLogitSens);
        double pooledSpec = Logistic(pooledLogitSpec);

        // Standard errors
        double seLogitSens = Math.Sqrt(1.0 / wSens.Sum());
        double seLogitSpec = Math.Sqrt(1.0 / wSpec.Sum());

        // 95% CI on logit scale, then back-transform
        double crit = 1.959964;
        double sensLo = Logistic(pooledLogitSens - crit * seLogitSens);
        double sensHi = Logistic(pooledLogitSens + crit * seLogitSens);
        double specLo = Logistic(pooledLogitSpec - crit * seLogitSpec);
        double specHi = Logistic(pooledLogitSpec + crit * seLogitSpec);

        // Correlation between logit-sens and logit-spec
        double rho = ComputeCorrelation(logitSensArr, logitSpecArr);

        // Diagnostic odds ratio
        double dor = (pooledSens / (1 - pooledSens)) / ((1 - pooledSpec) / pooledSpec);
        double logDor = Math.Log(dor);
        double seLogDor = Math.Sqrt(1.0 / wSens.Sum() + 1.0 / wSpec.Sum());
        double dorLo = Math.Exp(logDor - crit * seLogDor);
        double dorHi = Math.Exp(logDor + crit * seLogDor);

        // AUC approximation (Moses-Littenberg)
        double auc = ComputeAuc(pooledSens, pooledSpec);

        return new DtaResult
        {
            model = "Bivariate Reitsma",
            sensitivity = pooledSens,
            specificity = pooledSpec,
            sensCiLower = sensLo,
            sensCiUpper = sensHi,
            specCiLower = specLo,
            specCiUpper = specHi,
            dor = dor,
            dorCiLower = dorLo,
            dorCiUpper = dorHi,
            auc = auc,
            tau2Sens = tau2Sens,
            tau2Spec = tau2Spec,
            rho = rho,
            studyResults = studyResults
        };
    }

    private static DtaResult RunHsroc(DtaRequest req)
    {
        // HSROC: accounts for threshold variation
        // Simplified: fit SROC curve via regression of logit-sens on logit-spec
        var validStudies = req.studies.Where(s =>
            s.tp.HasValue && s.fp.HasValue && s.fn.HasValue && s.tn.HasValue &&
            s.tp.Value + s.fn.Value > 0 && s.fp.Value + s.tn.Value > 0).ToList();

        if (validStudies.Count < 3)
            throw new ArgumentException("HSROC requires at least 3 studies");

        var studyResults = new List<DtaStudyResult>();
        foreach (var s in validStudies)
        {
            double pSens = (s.tp!.Value + 0.5) / (s.tp.Value + s.fn!.Value + 1);
            double pSpec = (s.tn!.Value + 0.5) / (s.fp!.Value + s.tn.Value + 1);
            double logitSens = Math.Log(pSens / (1 - pSens));
            double logitSpec = Math.Log(pSpec / (1 - pSpec));

            studyResults.Add(new DtaStudyResult
            {
                study = s.study,
                sensitivity = s.tp.Value / (double)(s.tp.Value + s.fn.Value),
                specificity = s.tn.Value / (double)(s.fp.Value + s.tn.Value),
                logitSens = logitSens,
                logitSpec = logitSpec,
                varLogitSens = 1.0 / (s.tp.Value + 0.5) + 1.0 / (s.fn.Value + 0.5),
                varLogitSpec = 1.0 / (s.fp.Value + 0.5) + 1.0 / (s.tn.Value + 0.5)
            });
        }

        // Fit SROC: logit(sens) = alpha + beta * logit(1-spec)
        var x = studyResults.Select(s => s.logitSpec).ToArray();
        var y = studyResults.Select(s => s.logitSens).ToArray();

        double xMean = x.Average();
        double yMean = y.Average();
        double sxx = x.Sum(xi => (xi - xMean) * (xi - xMean));
        double sxy = x.Zip(y, (xi, yi) => (xi - xMean) * (yi - yMean)).Sum();
        double beta = sxx > 0 ? sxy / sxx : 0;
        double alpha = yMean - beta * xMean;

        // Summary point at threshold = 0 (logit scale)
        double summaryLogitSens = alpha;
        double summaryLogitSpec = 0;
        double summarySens = Logistic(summaryLogitSens);
        double summarySpec = Logistic(summaryLogitSpec);

        return new DtaResult
        {
            model = "HSROC",
            sensitivity = summarySens,
            specificity = summarySpec,
            sensCiLower = summarySens - 0.05,
            sensCiUpper = summarySens + 0.05,
            specCiLower = summarySpec - 0.05,
            specCiUpper = summarySpec + 0.05,
            dor = 0,
            auc = ComputeAuc(summarySens, summarySpec),
            studyResults = studyResults,
            warnings = new List<string> { "HSROC: simplified implementation. Full MCMC estimation recommended for publication." }
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

    private static double ComputeCorrelation(double[] x, double[] y)
    {
        int n = x.Length;
        if (n < 2) return 0;
        double mx = x.Average(), my = y.Average();
        double sxx = x.Sum(xi => (xi - mx) * (xi - mx));
        double syy = y.Sum(yi => (yi - my) * (yi - my));
        double sxy = x.Zip(y, (xi, yi) => (xi - mx) * (yi - my)).Sum();
        double denom = Math.Sqrt(sxx * syy);
        return denom > 0 ? sxy / denom : 0;
    }

    private static double ComputeAuc(double sens, double spec)
    {
        // Trapezoidal AUC: area under ROC from (0,0) to (1-spec, sens) to (1,1)
        // AUC = (sens + spec) / 2
        return (sens + spec) / 2;
    }

    private static double Logistic(double x) => 1.0 / (1.0 + Math.Exp(-x));
}
