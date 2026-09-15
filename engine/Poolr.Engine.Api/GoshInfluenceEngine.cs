using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// GOSH (Graphic Approach to Heterogeneity) engine (v0.6.0).
/// Fits meta-analysis model to all possible subsets of studies to detect heterogeneity clusters.
/// Introduced by Olkin et al. (2012), implemented in metafor::gosh().
/// </summary>
public static class GoshEngine
{
    public class GoshRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public int? seed { get; set; } = 42;
        public int maxSubsets { get; set; } = 10000;
        public string model { get; set; } = "random"; // random, fixed
        public string method { get; set; } = "DL";
    }

    public class GoshSubset
    {
        public List<int> studyIndices { get; set; } = new();
        public double pooledEffect { get; set; }
        public double tau2 { get; set; }
        public double i2 { get; set; }
    }

    public class GoshResult
    {
        public List<GoshSubset> subsets { get; set; } = new();
        public double overallPooled { get; set; }
        public double overallTau2 { get; set; }
        public double overallI2 { get; set; }
        public List<string> clusterWarnings { get; set; } = new();
        public int nSubsetsGenerated { get; set; }
    }

    public static GoshResult Run(GoshRequest req)
    {
        int n = req.effects.Count;
        if (n < 3)
            throw new ArgumentException("At least 3 studies required for GOSH analysis");

        var rng = new Random(req.seed ?? 42);
        var subsets = new List<GoshSubset>();

        // For small n, enumerate all subsets; for large n, sample randomly
        bool enumerateAll = n <= 12;
        int targetSubsets = enumerateAll ? (1 << n) - n - 1 : req.maxSubsets;

        if (enumerateAll)
        {
            // Enumerate all subsets of size >= 2
            for (int mask = 1; mask < (1 << n); mask++)
            {
                int bits = CountBits(mask);
                if (bits < 2) continue;

                var indices = new List<int>();
                for (int i = 0; i < n; i++)
                    if ((mask & (1 << i)) != 0)
                        indices.Add(i);

                var subset = FitSubset(indices, req);
                if (subset != null)
                    subsets.Add(subset);
            }
        }
        else
        {
            // Random subset sampling
            var seen = new HashSet<string>();
            int attempts = 0;
            while (subsets.Count < targetSubsets && attempts < targetSubsets * 10)
            {
                attempts++;
                int size = rng.Next(2, n + 1);
                var indices = Enumerable.Range(0, n).OrderBy(_ => rng.Next()).Take(size).OrderBy(i => i).ToList();
                string key = string.Join(",", indices);
                if (seen.Contains(key)) continue;
                seen.Add(key);

                var subset = FitSubset(indices, req);
                if (subset != null)
                    subsets.Add(subset);
            }
        }

        // Overall model
        var allIndices = Enumerable.Range(0, n).ToList();
        var overall = FitSubset(allIndices, req);

        var result = new GoshResult
        {
            subsets = subsets,
            overallPooled = overall?.pooledEffect ?? 0,
            overallTau2 = overall?.tau2 ?? 0,
            overallI2 = overall?.i2 ?? 0,
            nSubsetsGenerated = subsets.Count
        };

        // Detect clusters: if subsets form distinct groups, flag them
        if (subsets.Count > 10)
        {
            var sorted = subsets.OrderBy(s => s.pooledEffect).ToList();
            double q1 = Percentile(sorted.Select(s => s.pooledEffect).ToList(), 0.25);
            double q3 = Percentile(sorted.Select(s => s.pooledEffect).ToList(), 0.75);
            double iqr = q3 - q1;
            double lower = q1 - 1.5 * iqr;
            double upper = q3 + 1.5 * iqr;

            int outlierSubsets = subsets.Count(s => s.pooledEffect < lower || s.pooledEffect > upper);
            if (outlierSubsets > subsets.Count * 0.1)
                result.clusterWarnings.Add($"GOSH detected {outlierSubsets} outlier subsets ({100.0 * outlierSubsets / subsets.Count:F1}%). Possible heterogeneity clusters.");
        }

        return result;
    }

    private static GoshSubset? FitSubset(List<int> indices, GoshRequest req)
    {
        var effects = indices.Select(i => req.effects[i]).ToList();
        var vars = indices.Select(i => req.variances[i]).ToList();

        if (effects.Count < 2) return null;

        try
        {
            double tau2 = 0;
            if (req.model == "random")
            {
                var w = vars.Select(v => 1.0 / v).ToList();
                double sw = w.Sum();
                double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
                double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
                int df = effects.Count - 1;
                double c = sw - w.Sum(wi => wi * wi) / sw;
                tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
            }

            var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
            double sumW = weights.Sum();
            double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sumW;

            double i2 = 0;
            if (req.model == "random" && tau2 > 0)
            {
                double meanVar = vars.Average();
                i2 = tau2 / (meanVar + tau2) * 100;
            }

            return new GoshSubset
            {
                studyIndices = indices,
                pooledEffect = pooled,
                tau2 = tau2,
                i2 = i2
            };
        }
        catch
        {
            return null;
        }
    }

    private static int CountBits(int n)
    {
        int count = 0;
        while (n != 0) { count++; n &= n - 1; }
        return count;
    }

    private static double Percentile(List<double> sorted, double p)
    {
        var s = sorted.OrderBy(x => x).ToList();
        double idx = p * (s.Count - 1);
        int lo = (int)Math.Floor(idx);
        int hi = (int)Math.Ceiling(idx);
        if (lo == hi) return s[lo];
        return s[lo] + (s[hi] - s[lo]) * (idx - lo);
    }
}

/// <summary>
/// Influence Diagnostics engine (v0.6.0).
/// Cook's distance, DFFITS, DFBETAS, hat values, covariance ratios.
/// Mirrors metafor::influence() and the standard regression diagnostics.
/// </summary>
public static class InfluenceEngine
{
    public class InfluenceRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public string model { get; set; } = "random";
        public string method { get; set; } = "DL";
    }

    public class StudyInfluence
    {
        public int index { get; set; }
        public double study { get; set; }
        public double rawResidual { get; set; }
        public double standardizedResidual { get; set; }
        public double studentizedResidual { get; set; }
        public double dffits { get; set; }
        public double cooksDistance { get; set; }
        public double covarianceRatio { get; set; }
        public double hatValue { get; set; }
        public double dfbetas { get; set; }
        public bool isOutlier { get; set; }
        public bool isInfluential { get; set; }
    }

    public class InfluenceResult
    {
        public List<StudyInfluence> studies { get; set; } = new();
        public double thresholdCooks { get; set; }
        public double thresholdDffits { get; set; }
        public double thresholdCovRatioLower { get; set; }
        public double thresholdCovRatioUpper { get; set; }
        public int nInfluential { get; set; }
        public int nOutliers { get; set; }
        public List<string> flaggedStudies { get; set; } = new();
    }

    public static InfluenceResult Run(InfluenceRequest req)
    {
        int n = req.effects.Count;
        if (n < 3)
            throw new ArgumentException("At least 3 studies required for influence diagnostics");

        // Fit full model
        var fullResult = FitModel(req.effects, req.variances, req.model, req.method);
        double pooledFull = fullResult.pooled;
        double tau2Full = fullResult.tau2;

        var studies = new List<StudyInfluence>();

        for (int i = 0; i < n; i++)
        {
            // Leave-one-out
            var looEffects = req.effects.Where((_, idx) => idx != i).ToList();
            var looVars = req.variances.Where((_, idx) => idx != i).ToList();
            var looResult = FitModel(looEffects, looVars, req.model, req.method);

            // Raw residual
            double rawResid = req.effects[i] - pooledFull;

            // Standardized residual
            double residVar = req.variances[i] + tau2Full;
            double stdResid = rawResid / Math.Sqrt(residVar);

            // Studentized residual (externally studentized)
            double studResid = rawResid / Math.Sqrt(
                (looResult.varPooled * (n - 1) / (double)(n - 2)) + req.variances[i] + looResult.tau2);

            // Hat value (leverage)
            double wi = 1.0 / (req.variances[i] + tau2Full);
            double sumW = req.variances.Sum(v => 1.0 / (v + tau2Full));
            double hat = wi / sumW;

            // Cook's distance
            double cooksD = (looResult.pooled - pooledFull) * (looResult.pooled - pooledFull) /
                           (fullResult.varPooled * n);

            // DFFITS
            double dffits = (pooledFull - looResult.pooled) / Math.Sqrt(looResult.varPooled * (1 - hat));

            // DFBETAS (change in pooled estimate when study i removed, scaled)
            double dfbetasVal = (pooledFull - looResult.pooled) / Math.Sqrt(fullResult.varPooled);

            // Covariance ratio
            double covRatio = 1.0 / ((1 - hat) * (1 - hat) *
                              (looResult.varPooled / fullResult.varPooled));

            // Thresholds
            double thresholdCooks = 4.0 / n;
            double thresholdDffits = 2.0 * Math.Sqrt(1.0 / n);
            double thresholdCovRatioLower = 1 - 3.0 / n;
            double thresholdCovRatioUpper = 1 + 3.0 / n;

            bool isOutlier = Math.Abs(studResid) > 2;
            bool isInfluential = cooksD > thresholdCooks ||
                                Math.Abs(dffits) > thresholdDffits ||
                                covRatio < thresholdCovRatioLower ||
                                covRatio > thresholdCovRatioUpper;

            studies.Add(new StudyInfluence
            {
                index = i,
                study = i,
                rawResidual = rawResid,
                standardizedResidual = stdResid,
                studentizedResidual = studResid,
                dffits = dffits,
                cooksDistance = cooksD,
                covarianceRatio = covRatio,
                hatValue = hat,
                dfbetas = dfbetasVal,
                isOutlier = isOutlier,
                isInfluential = isInfluential
            });
        }

        var result = new InfluenceResult
        {
            studies = studies,
            thresholdCooks = 4.0 / n,
            thresholdDffits = 2.0 * Math.Sqrt(1.0 / n),
            thresholdCovRatioLower = 1 - 3.0 / n,
            thresholdCovRatioUpper = 1 + 3.0 / n,
            nInfluential = studies.Count(s => s.isInfluential),
            nOutliers = studies.Count(s => s.isOutlier),
            flaggedStudies = studies.Where(s => s.isInfluential || s.isOutlier)
                                   .Select(s => $"Study {s.index}: Cook's={s.cooksDistance:F3}, DFFITS={s.dffits:F3}")
                                   .ToList()
        };

        return result;
    }

    private static (double pooled, double tau2, double varPooled) FitModel(
        List<double> effects, List<double> vars, string model, string method)
    {
        double tau2 = 0;
        if (model == "random")
        {
            var w = vars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
            int df = effects.Count - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
        }

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sumW;
        double varPooled = 1.0 / sumW;

        return (pooled, tau2, varPooled);
    }
}

/// <summary>
/// Permutation Test engine for meta-analysis (v0.6.0).
/// Non-parametric p-value via permutation of study labels.
/// Robust to violations of normality assumptions.
/// </summary>
public static class PermutationEngine
{
    public class PermutationRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public int nPermutations { get; set; } = 10000;
        public int? seed { get; set; } = 42;
        public string test { get; set; } = "pooled"; // pooled, q, tau2
    }

    public class PermutationResult
    {
        public double observedStatistic { get; set; }
        public double pValue { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public int nPermutations { get; set; }
        public List<double> permutedStatistics { get; set; } = new();
    }

    public static PermutationResult Run(PermutationRequest req)
    {
        if (req.effects.Count < 2)
            throw new ArgumentException("At least 2 studies required");

        var rng = new Random(req.seed ?? 42);
        int n = req.effects.Count;

        // Observed statistic
        double observed = ComputeStatistic(req.effects, req.variances, req.test);

        var permutedStats = new List<double>();

        for (int p = 0; p < req.nPermutations; p++)
        {
            // Permute effect sizes (keeping variances fixed)
            var shuffled = req.effects.OrderBy(_ => rng.Next()).ToList();
            double stat = ComputeStatistic(shuffled, req.variances, req.test);
            permutedStats.Add(stat);
        }

        // Two-sided p-value
        int extreme = permutedStats.Count(s => Math.Abs(s) >= Math.Abs(observed));
        double pValue = (extreme + 1.0) / (req.nPermutations + 1.0);

        var sorted = permutedStats.OrderBy(s => s).ToList();
        double ciLower = Percentile(sorted, 0.025);
        double ciUpper = Percentile(sorted, 0.975);

        return new PermutationResult
        {
            observedStatistic = observed,
            pValue = pValue,
            ciLower = ciLower,
            ciUpper = ciUpper,
            nPermutations = req.nPermutations,
            permutedStatistics = permutedStats
        };
    }

    private static double ComputeStatistic(List<double> effects, List<double> vars, string test)
    {
        return test switch
        {
            "q" => ComputeQ(effects, vars),
            "tau2" => ComputeTau2(effects, vars),
            _ => ComputePooled(effects, vars)
        };
    }

    private static double ComputePooled(List<double> effects, List<double> vars)
    {
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        return w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
    }

    private static double ComputeQ(List<double> effects, List<double> vars)
    {
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        return w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
    }

    private static double ComputeTau2(List<double> effects, List<double> vars)
    {
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = effects.Count - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
    }

    private static double Percentile(List<double> sorted, double p)
    {
        double idx = p * (sorted.Count - 1);
        int lo = (int)Math.Floor(idx);
        int hi = (int)Math.Ceiling(idx);
        if (lo == hi) return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    }
}

/// <summary>
/// Bootstrap Confidence Interval engine (v0.6.0).
/// Non-parametric bootstrap for meta-analysis pooled estimate.
/// Robust to distributional assumptions.
/// </summary>
public static class BootstrapEngine
{
    public class BootstrapRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public int nBootstrap { get; set; } = 10000;
        public int? seed { get; set; } = 42;
        public string method { get; set; } = "percentile"; // percentile, bca, normal
        public string model { get; set; } = "random";
    }

    public class BootstrapResult
    {
        public double observed { get; set; }
        public double bias { get; set; }
        public double se { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public string method { get; set; } = "";
        public int nBootstrap { get; set; }
        public List<double> bootstrapEstimates { get; set; } = new();
    }

    public static BootstrapResult Run(BootstrapRequest req)
    {
        if (req.effects.Count < 2)
            throw new ArgumentException("At least 2 studies required");

        var rng = new Random(req.seed ?? 42);
        int n = req.effects.Count;

        // Observed estimate
        double observed = ComputePooled(req.effects, req.variances, req.model);

        var bootstrapEstimates = new List<double>();

        for (int b = 0; b < req.nBootstrap; b++)
        {
            // Resample studies with replacement
            var bootEffects = new List<double>();
            var bootVars = new List<double>();
            for (int i = 0; i < n; i++)
            {
                int idx = rng.Next(n);
                bootEffects.Add(req.effects[idx]);
                bootVars.Add(req.variances[idx]);
            }
            double est = ComputePooled(bootEffects, bootVars, req.model);
            bootstrapEstimates.Add(est);
        }

        var sorted = bootstrapEstimates.OrderBy(x => x).ToList();
        double bias = sorted.Average() - observed;
        double se = StdDev(sorted);

        double ciLower, ciUpper;
        switch (req.method)
        {
            case "bca":
                (ciLower, ciUpper) = BcaInterval(sorted, observed, req);
                break;
            case "normal":
                ciLower = observed - 1.96 * se;
                ciUpper = observed + 1.96 * se;
                break;
            default: // percentile
                ciLower = Percentile(sorted, 0.025);
                ciUpper = Percentile(sorted, 0.975);
                break;
        }

        return new BootstrapResult
        {
            observed = observed,
            bias = bias,
            se = se,
            ciLower = ciLower,
            ciUpper = ciUpper,
            method = req.method,
            nBootstrap = req.nBootstrap,
            bootstrapEstimates = bootstrapEstimates
        };
    }

    private static double ComputePooled(List<double> effects, List<double> vars, string model)
    {
        double tau2 = 0;
        if (model == "random")
        {
            var w = vars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
            int df = effects.Count - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
        }

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        return weights.Zip(effects, (w, e) => w * e).Sum() / sumW;
    }

    private static (double lower, double upper) BcaInterval(List<double> sorted, double observed, BootstrapRequest req)
    {
        // Bias-corrected and accelerated interval
        double z0 = NormalQuantile(sorted.Count(x => x < observed) / (double)sorted.Count);
        double zAlpha = -1.96; // 95% CI

        double a1 = NormalCdf(z0 + (z0 + zAlpha) / (1 - 0.1 * (z0 + zAlpha)));
        double a2 = NormalCdf(z0 + (z0 - zAlpha) / (1 - 0.1 * (z0 - zAlpha)));

        int idx1 = (int)(a1 * sorted.Count);
        int idx2 = (int)(a2 * sorted.Count);
        idx1 = Math.Max(0, Math.Min(idx1, sorted.Count - 1));
        idx2 = Math.Max(0, Math.Min(idx2, sorted.Count - 1));

        return (sorted[idx1], sorted[idx2]);
    }

    private static double NormalCdf(double x) => 0.5 * (1 + Stats.Erf(x / Math.Sqrt(2)));
    private static double NormalQuantile(double p)
    {
        // Approximate inverse normal CDF
        if (p <= 0) return double.NegativeInfinity;
        if (p >= 1) return double.PositiveInfinity;
        if (p == 0.5) return 0;

        // Rational approximation
        double[] a = { -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00 };
        double[] b = { -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01 };
        double[] c = { -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00 };
        double[] d = { 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00 };

        double pLow = 0.02425;
        double pHigh = 1 - pLow;

        double q, r;
        if (p < pLow)
        {
            q = Math.Sqrt(-2 * Math.Log(p));
            return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                   ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        }
        if (p <= pHigh)
        {
            q = p - 0.5;
            r = q * q;
            return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
                   (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
        }
        q = Math.Sqrt(-2 * Math.Log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    private static double StdDev(List<double> values)
    {
        double mean = values.Average();
        return Math.Sqrt(values.Sum(v => (v - mean) * (v - mean)) / (values.Count - 1));
    }

    private static double Percentile(List<double> sorted, double p)
    {
        double idx = p * (sorted.Count - 1);
        int lo = (int)Math.Floor(idx);
        int hi = (int)Math.Ceiling(idx);
        if (lo == hi) return sorted[lo];
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    }
}

/// <summary>
/// Test of Excess Significance (TES) engine (v0.6.0).
/// Detects whether too many studies show significant results, suggesting bias.
/// Ioannidis & Trikalinos (2007), metafor::tes().
/// </summary>
public static class TesEngine
{
    public class TesRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public double alpha { get; set; } = 0.05;
        public int? seed { get; set; } = 42;
        public int nSimulations { get; set; } = 10000;
    }

    public class TesResult
    {
        public int observedSignificant { get; set; }
        public double expectedSignificant { get; set; }
        public double ratio { get; set; }
        public double pValue { get; set; }
        public double powerMedian { get; set; }
        public bool excessSignificance { get; set; }
        public string interpretation { get; set; } = "";
    }

    public static TesResult Run(TesRequest req)
    {
        int n = req.effects.Count;
        if (n < 3)
            throw new ArgumentException("At least 3 studies required for TES");

        // Count observed significant studies (one-sided p < alpha)
        int obsSig = 0;
        foreach (var (e, v) in req.effects.Zip(req.variances, (e, v) => (e, v)))
        {
            double z = e / Math.Sqrt(v);
            double p = 1 - Stats.NormalCdf(z);
            if (p < req.alpha) obsSig++;
        }

        // Estimate power for each study under the random-effects model
        var powers = new List<double>();
        double tau2 = EstimateTau2(req.effects.ToArray(), req.variances.ToArray());
        double mu = ComputePooled(req.effects, req.variances, tau2);

        foreach (var (e, v) in req.effects.Zip(req.variances, (e, v) => (e, v)))
        {
            double se = Math.Sqrt(v);
            double power = 1 - Stats.NormalCdf(1.6449 - mu / se) + Stats.NormalCdf(-1.6449 - mu / se);
            powers.Add(Math.Max(0.05, Math.Min(power, 0.9999)));
        }

        double medianPower = Median(powers);

        // Simulate expected number of significant studies
        var rng = new Random(req.seed ?? 42);
        int totalSig = 0;
        for (int sim = 0; sim < req.nSimulations; sim++)
        {
            int sig = 0;
            for (int i = 0; i < n; i++)
            {
                if (rng.NextDouble() < powers[i]) sig++;
            }
            totalSig += sig;
        }

        double expectedSig = totalSig / (double)req.nSimulations;
        double ratio = expectedSig > 0 ? obsSig / expectedSig : 999;

        // Binomial test: P(X >= obsSig) under expected proportion
        double pExp = expectedSig / n;
        double pValue = 1 - BinomialCdf(obsSig - 1, n, pExp);

        bool excess = pValue < 0.05 && obsSig > expectedSig;

        string interp;
        if (excess)
            interp = $"Excess significance detected ({obsSig}/{n} observed vs {expectedSig:F1} expected, p={pValue:F4}). Possible publication bias or selective reporting.";
        else
            interp = $"No excess significance ({obsSig}/{n} observed vs {expectedSig:F1} expected, p={pValue:F4}).";

        return new TesResult
        {
            observedSignificant = obsSig,
            expectedSignificant = expectedSig,
            ratio = ratio,
            pValue = pValue,
            powerMedian = medianPower,
            excessSignificance = excess,
            interpretation = interp
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

    private static double ComputePooled(List<double> effects, List<double> vars, double tau2)
    {
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        return weights.Zip(effects, (w, e) => w * e).Sum() / sumW;
    }

    private static double Median(List<double> values)
    {
        var sorted = values.OrderBy(v => v).ToList();
        int n = sorted.Count;
        return n % 2 == 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2.0 : sorted[n / 2];
    }

    private static double BinomialCdf(int k, int n, double p)
    {
        if (k < 0) return 0;
        if (k >= n) return 1;
        double sum = 0;
        for (int i = 0; i <= k; i++)
            sum += BinomialPmf(i, n, p);
        return sum;
    }

    private static double BinomialPmf(int k, int n, double p)
    {
        return Combination(n, k) * Math.Pow(p, k) * Math.Pow(1 - p, n - k);
    }

    private static double Combination(int n, int k)
    {
        if (k < 0 || k > n) return 0;
        if (k == 0 || k == n) return 1;
        double result = 1;
        for (int i = 0; i < k; i++)
            result = result * (n - i) / (i + 1);
        return result;
    }
}

/// <summary>
/// Location-Scale Meta-Analysis engine (v0.6.0).
/// Models heterogeneity as a function of study characteristics.
/// Mirrors metafor::rma() with scale argument.
/// </summary>
public static class LocationScaleEngine
{
    public class LocationScaleRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<double> scaleModifiers { get; set; } = new(); // e.g., year, dose, quality score
        public string model { get; set; } = "location"; // location, scale, both
    }

    public class LocationScaleResult
    {
        public double locationIntercept { get; set; }
        public double locationSlope { get; set; }
        public double scaleIntercept { get; set; }
        public double scaleSlope { get; set; }
        public double tau2 { get; set; }
        public double i2 { get; set; }
        public double q { get; set; }
        public double qP { get; set; }
        public double lrtScale { get; set; }
        public double lrtScaleP { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static LocationScaleResult Run(LocationScaleRequest req)
    {
        int n = req.effects.Count;
        if (n < 3)
            throw new ArgumentException("At least 3 studies required");

        // Fit location-only model (standard random-effects)
        var w = req.variances.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(req.effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(req.effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = n - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        double tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;

        // Location model: y = beta0 + beta1 * x + epsilon
        double beta0 = 0, beta1 = 0;
        if (req.scaleModifiers.Count == n && req.model != "scale")
        {
            var x = req.scaleModifiers;
            var y = req.effects;
            var wLoc = req.variances.Select(v => 1.0 / v).ToList();

            double sumW = wLoc.Sum();
            double sumWx = wLoc.Zip(x, (wi, xi) => wi * xi).Sum();
            double sumWy = wLoc.Zip(y, (wi, yi) => wi * yi).Sum();
            double sumWx2 = wLoc.Zip(x, (wi, xi) => wi * xi * xi).Sum();
            double sumWxy = wLoc.Zip(x.Zip(y, (xi, yi) => (xi, yi)), (wi, p) => wi * p.xi * p.yi).Sum();

            double denom = sumW * sumWx2 - sumWx * sumWx;
            beta1 = (sumW * sumWxy - sumWx * sumWy) / denom;
            beta0 = (sumWy - beta1 * sumWx) / sumW;
        }

        // Scale model: log(tau2) = gamma0 + gamma1 * x
        double gamma0 = 0, gamma1 = 0;
        if (req.scaleModifiers.Count == n && req.model != "location")
        {
            // Simplified: regress absolute residuals on scale modifier
            var absResid = req.effects.Select((e, i) => Math.Abs(e - (beta0 + beta1 * req.scaleModifiers[i]))).ToList();
            var logResid = absResid.Select(r => Math.Log(Math.Max(r, 0.001))).ToList();
            var x = req.scaleModifiers;

            double mx = x.Average();
            double my = logResid.Average();
            double sxx = x.Sum(xi => (xi - mx) * (xi - mx));
            double sxy = x.Zip(logResid, (xi, yi) => (xi - mx) * (yi - my)).Sum();
            gamma1 = sxx > 0 ? sxy / sxx : 0;
            gamma0 = my - gamma1 * mx;
        }

        // LRT for scale model
        double ll0 = LogLikelihood(req.effects, req.variances, tau2);
        double ll1 = LogLikelihood(req.effects, req.variances, Math.Exp(gamma0 + gamma1 * req.scaleModifiers.Average()));
        double lrt = 2 * (ll1 - ll0);
        double lrtP = 1 - Chi2.Cdf(Math.Max(lrt, 0), 1);

        return new LocationScaleResult
        {
            locationIntercept = beta0,
            locationSlope = beta1,
            scaleIntercept = gamma0,
            scaleSlope = gamma1,
            tau2 = tau2,
            i2 = tau2 / (tau2 + req.variances.Average()) * 100,
            q = q,
            qP = df > 0 ? 1 - Chi2.Cdf(q, df) : 1,
            lrtScale = lrt,
            lrtScaleP = lrtP,
            warnings = lrtP < 0.05 ? new List<string> { "Scale model significant: heterogeneity varies with modifier." } : new List<string>()
        };
    }

    private static double LogLikelihood(List<double> effects, List<double> vars, double tau2)
    {
        double ll = 0;
        for (int i = 0; i < effects.Count; i++)
        {
            double v = vars[i] + tau2;
            ll -= 0.5 * (Math.Log(v) + effects[i] * effects[i] / v);
        }
        return ll;
    }
}
