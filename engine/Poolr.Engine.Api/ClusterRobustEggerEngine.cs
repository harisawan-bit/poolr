using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.0 Cluster-Robust Egger Test (CMA 4 style).
/// Performs Egger's regression test for publication bias with cluster-robust
/// variance estimation to handle dependent effect sizes (e.g., multiple outcomes
/// from the same study). This is a critical improvement over standard Egger
/// which assumes independence.
/// Reference: Egger et al. 1997, Hedges et al. 2010, CMA 4 cluster-robust tests.
/// </summary>
public static class ClusterRobustEggerEngine
{
    public class EggerRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string> clusters { get; set; } = new();
    }

    public class EggerResult
    {
        public double standardIntercept { get; set; }
        public double standardInterceptSe { get; set; }
        public double standardInterceptP { get; set; }
        public double robustIntercept { get; set; }
        public double robustInterceptSe { get; set; }
        public double robustInterceptP { get; set; }
        public int df { get; set; }
        public int nClusters { get; set; }
        public int k { get; set; }
        public bool significant { get; set; }
        public string interpretation { get; set; } = "";
        public string method { get; set; } = "Cluster-Robust Egger Test (CRVE, CMA 4)";
    }

    public static EggerResult Run(EggerRequest req)
    {
        int k = req.effects.Count;
        if (k < 5) throw new ArgumentException("Cluster-robust Egger requires at least 5 studies");
        if (req.variances.Count != k) throw new ArgumentException("variances must match effects length");
        if (req.clusters.Count != k) throw new ArgumentException("clusters must match effects length");

        var ses = req.variances.Select(Math.Sqrt).ToList();
        var prec = ses.Select(s => 1.0 / Math.Max(s, 1e-10)).ToList();

        // Standard Egger (naive): OLS regression of effect on precision
        var (slopeNaive, interceptNaive, seIntNaive, zNaive, pNaive) = Regression.OlsIntercept(prec, req.effects);

        // Cluster-robust Egger: adjust SE for within-cluster correlation
        var clusters = req.clusters.Distinct().ToList();
        int C = clusters.Count;
        if (C < 2) throw new ArgumentException("At least 2 clusters required");

        // Compute cluster-robust standard error of the intercept
        // Using the sandwich estimator: V = (X'X)^-1 * (Σ_c X_c' u_c u_c' X_c) * (X'X)^-1
        // where X_c is the design matrix for cluster c, u_c are residuals

        // Design matrix columns: precision (slope) and intercept
        // y = intercept + slope * precision
        var x1 = prec; // precision
        var x0 = Enumerable.Repeat(1.0, k).ToList(); // intercept

        // (X'X)^-1
        double sw = k;
        double swx = x1.Sum();
        double swxx = x1.Sum(v => v * v);
        double denom = sw * swxx - swx * swx;
        if (Math.Abs(denom) < 1e-12)
            throw new ArgumentException("Insufficient variation in precision for Egger test");

        double inv00 = swxx / denom;
        double inv01 = -swx / denom;
        double inv11 = sw / denom;

        // Cluster-robust meat: Σ_c S_c S_c' where S_c = Σ_{i∈c} X_i * u_i
        var residuals = new List<double>();
        for (int i = 0; i < k; i++)
            residuals.Add(req.effects[i] - (interceptNaive + slopeNaive * x1[i]));

        double meat00 = 0, meat01 = 0, meat11 = 0;

        foreach (var c in clusters)
        {
            var indices = Enumerable.Range(0, k).Where(i => req.clusters[i] == c).ToList();
            double s0 = 0, s1 = 0;
            foreach (var i in indices)
            {
                s0 += residuals[i];           // X[i,0] * u[i] = 1 * u[i]
                s1 += x1[i] * residuals[i];   // X[i,1] * u[i] = prec[i] * u[i]
            }
            meat00 += s0 * s0;
            meat01 += s0 * s1;
            meat11 += s1 * s1;
        }

        // Sandwich variance for intercept (index 0)
        double varRobust = inv00 * inv00 * meat00 + 2 * inv00 * inv01 * meat01 + inv01 * inv01 * meat11;
        double seRobust = Math.Sqrt(Math.Max(varRobust, 0));
        double zRobust = seRobust > 1e-12 ? interceptNaive / seRobust : 0;

        // Small-sample correction: multiply by sqrt(C / (C - 1))
        int df = Math.Max(C - 1, 1);
        double smallSampleCorr = Math.Sqrt((double)C / df);
        double seRobustCorrected = seRobust * smallSampleCorr;

        // Use t-distribution with C-1 df
        double pRobust = ExtendedStats.TwoSidePFromT(interceptNaive / seRobustCorrected, df);
        bool significant = pRobust < 0.05;

        return new EggerResult
        {
            standardIntercept = interceptNaive,
            standardInterceptSe = seIntNaive,
            standardInterceptP = pNaive,
            robustIntercept = interceptNaive,
            robustInterceptSe = seRobustCorrected,
            robustInterceptP = pRobust,
            df = df,
            nClusters = C,
            k = k,
            significant = significant,
            interpretation = significant
                ? $"Cluster-robust Egger significant (intercept={interceptNaive:F3}, SE={seRobustCorrected:F3}, t={interceptNaive / seRobustCorrected:F2}, df={df}, p={pRobust:E2}). Publication bias likely."
                : $"Cluster-robust Egger not significant (intercept={interceptNaive:F3}, SE={seRobustCorrected:F3}, t={interceptNaive / seRobustCorrected:F2}, df={df}, p={pRobust:F3}). No significant bias.",
            method = $"Cluster-Robust Egger (CRVE, {C} clusters, small-sample corrected)"
        };
    }
}
