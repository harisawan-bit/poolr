using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.1 Bayesian Prognostic Factor Meta-Analysis.
/// Pools log hazard ratios from prognostic factor studies using MCMC.
//}
/// Based on: Hemingway et al. (1999), Riley et al. (2007), Tzoulaki et al. (2011)
/// </summary>
public static class BayesianPrognosticEngine
{
    public class PrognosticRequest
    {
        public List<PrognosticStudy> studies { get; set; } = new();
        public string priorEffect { get; set; } = "normal(0,100)";
        public string priorTau { get; set; } = "half-cauchy(0,1)";
        public int iter { get; set; } = 20000;
        public int warmup { get; set; } = 5000;
        public int chains { get; set; } = 4;
        public int? seed { get; set; } = 42;
    }

    public class PrognosticStudy
    {
        public string id { get; set; } = "";
        public double logHr { get; set; }
        public double se { get; set; }
        public int? nevents { get; set; }
    }

    public class PrognosticResult
    {
        public double pooledEffect { get; set; }
        public double pooledMedian { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double predictiveLower { get; set; }
        public double predictiveUpper { get; set; }
        public double tau { get; set; }
        public double i2 { get; set; }
        public double rhat { get; set; }
        public double ess { get; set; }
        public bool converged { get; set; }
        public int nStudies { get; set; }
        public int totalEvents { get; set; }
        public double q { get; set; }
        public double pValue { get; set; }
        public string interpretation { get; set; } = "";
        public List<double> forestPlot { get; set; } = new();
    }

    public static PrognosticResult Run(PrognosticRequest req)
    {
        if (req.studies.Count < 3)
            throw new ArgumentException("At least 3 studies required");
        if (req.studies.Any(s => s.se <= 0))
            throw new ArgumentException("All SEs must be positive");

        int n = req.studies.Count;
        var rng = new Random(req.seed ?? 42);
        var y = req.studies.Select(s => s.logHr).ToArray();
        var v = req.studies.Select(s => s.se * s.se).ToArray();

        // Initialize via method of moments
        double mu = y.Average();
        double tau2 = Math.Max(0, (n - 1) * y.Select((yi, i) => Math.Pow(yi - mu, 2) / (v[i] + 1e-10)).Sum() / y.Select((yi, i) => 1.0 / (v[i] + 1e-10)).Sum());

        var muSamples = new List<double>();
        var tauSamples = new List<double>();

        // Gibbs sampler
        for (int iter = 0; iter < req.iter; iter++)
        {
            // Sample mu
            var w = v.Select(vi => 1.0 / (vi + tau2)).ToArray();
            double sw = w.Sum();
            double muMean = w.Zip(y, (wi, yi) => wi * yi).Sum() / sw;
            double muSe = Math.Sqrt(1.0 / sw);
            mu = muMean + NormalSample(ref rng) * muSe;

            // Sample tau2 (half-cauchy prior on tau)
            double tauProp = Math.Max(0.001, tau2 + NormalSample(ref rng) * 0.05);
            double logAcc = LogTauPosterior(tauProp, y, v, mu) - LogTauPosterior(tau2, y, v, mu);
            if (Math.Log(rng.NextDouble()) < logAcc)
                tau2 = tauProp;

            if (iter >= req.warmup)
            {
                muSamples.Add(mu);
                tauSamples.Add(Math.Sqrt(tau2));
            }
        }

        // Summarize posterior
        muSamples.Sort();
        tauSamples.Sort();

        double median = muSamples[muSamples.Count / 2];
        double ciLo = muSamples[(int)(muSamples.Count * 0.025)];
        double ciHi = muSamples[(int)(muSamples.Count * 0.975)];
        double tauMedian = tauSamples[tauSamples.Count / 2];

        // Prediction interval
        double predSe = Math.Sqrt(Math.Pow(muSamples.Std(), 2) + tauMedian * tauMedian);
        double predLo = median - 1.96 * predSe;
        double predHi = median + 1.96 * predSe;

        // Heterogeneity: I²
        double vHarmonic = n / v.Sum(vi => 1.0 / vi);
        double q = y.Select((yi, i) => Math.Pow(yi - mu, 2) / v[i]).Sum();
        double i2 = Math.Max(0, 100 * (q - (n - 1)) / q);
        double pVal = 1.0 - Chi2.Cdf(q, n - 1);

        // Convergence diagnostics
        double rhat = ComputeRhat(muSamples, req.chains);
        double ess = (double)muSamples.Count / (1.0 + 2.0 * SumAcf(muSamples));
        bool converged = rhat < 1.1 && ess > 400;

        // Forest plot points: BLUPs per study
        var forestBlups = new List<double>();
        for (int i = 0; i < n; i++)
        {
            double w = 1.0 / (v[i] + tauMedian * tauMedian);
            double blup = (w * y[i] + (1.0 / Math.Pow(100.0, 2)) * 0) / (w + 1.0 / Math.Pow(100.0, 2));
            forestBlups.Add(blup);
        }

        int totalEvents = req.studies.Sum(s => s.nevents ?? 0);

        return new PrognosticResult
        {
            pooledEffect = muSamples.Mean(),
            pooledMedian = median,
            ciLower = ciLo,
            ciUpper = ciHi,
            predictiveLower = predLo,
            predictiveUpper = predHi,
            tau = tauMedian,
            i2 = i2,
            rhat = rhat,
            ess = ess,
            converged = converged,
            nStudies = n,
            totalEvents = totalEvents,
            q = q,
            pValue = pVal,
            interpretation = converged
                ? $"Pooled HR = {Math.Exp(median):F3} [{Math.Exp(ciLo):F3}, {Math.Exp(ciHi):F3}]. I² = {i2:F1}%. {(median - 1.96 * predSe > 0 || median + 1.96 * predSe < 0 ? "Significant" : "Not significant")} heterogeneity."
                : $"Warning: MCMC may not have converged (R-hat = {rhat:F3}, ESS = {ess:F0}). Results should be interpreted with caution.",
            forestPlot = forestBlups
        };
    }

    private static double LogTauPosterior(double tau2, double[] y, double[] v, double mu)
    {
        double ll = 0;
        for (int i = 0; i < y.Length; i++)
            ll -= 0.5 * Math.Log(v[i] + tau2) - 0.5 * Math.Pow(y[i] - mu, 2) / (v[i] + tau2);
        // Half-Cauchy(0,1) prior on tau = sqrt(tau2)
        double tau = Math.Sqrt(tau2);
        if (tau <= 0) return double.NegativeInfinity;
        ll -= Math.Log(1 + tau * tau);
        return ll;
    }

    private static double ComputeRhat(List<double> samples, int chains)
    {
        int perChain = samples.Count / chains;
        if (perChain < 10) return 99.0;
        var chainMeans = new double[chains];
        var chainVars = new double[chains];
        for (int c = 0; c < chains; c++)
        {
            var sub = samples.Skip(c * perChain).Take(perChain).ToList();
            chainMeans[c] = sub.Mean();
            chainVars[c] = sub.Variance();
        }
        double grandMean = chainMeans.Mean();
        double b = chainMeans.Sum(m => (m - grandMean) * (m - grandMean)) * perChain / (chains - 1);
        double w = chainVars.Average();
        double varPlus = (perChain - 1.0) / perChain * w + b / perChain;
        return Math.Sqrt(varPlus / Math.Max(w, 1e-12));
    }

    private static double SumAcf(List<double> x, int maxLag = 50)
    {
        double mean = x.Mean();
        double var = x.Sum(v => (v - mean) * (v - mean)) / x.Count;
        if (var < 1e-12) return 0;
        double sum = 0;
        var centered = x.Select(v => v - mean).ToList();
        for (int lag = 1; lag <= maxLag && lag < x.Count; lag++)
        {
            double acf = 0;
            for (int i = 0; i < x.Count - lag; i++)
                acf += centered[i] * centered[i + lag];
            acf /= (x.Count * var);
            sum += Math.Max(0, acf);
        }
        return sum;
    }

    private static double NormalSample(ref Random rng)
    {
        // Box-Muller
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Cos(2.0 * Math.PI * u2);
    }
}

public static class StatisticalExtensions
{
    public static double Mean(this IEnumerable<double> x) => x.Average();

    public static double Variance(this IEnumerable<double> x)
    {
        double m = x.Average();
        return x.Sum(v => (v - m) * (v - m)) / Math.Max(1, x.Count() - 1);
    }

    public static double Std(this IEnumerable<double> x) => Math.Sqrt(x.Variance());
}
