using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Bayesian MCMC Meta-Analysis engine (v0.6.0).
/// Gibbs sampling for random-effects meta-analysis with proper priors.
/// Mirrors the metafor + brms approach: normal prior on mu, half-Cauchy on tau.
/// </summary>
public static class BayesianMcmcEngine
{
    public class BayesianRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public string priorMu { get; set; } = "normal(0, 10)";
        public string priorTau { get; set; } = "half-cauchy(0, 0.5)";
        public int iter { get; set; } = 20000;
        public int warmup { get; set; } = 5000;
        public int chains { get; set; } = 4;
        public int seed { get; set; } = 42;
        public double? ropeLower { get; set; }
        public double? ropeUpper { get; set; }
    }

    public class BayesianResult
    {
        public double muMean { get; set; }
        public double muMedian { get; set; }
        public double muCiLower { get; set; }
        public double muCiUpper { get; set; }
        public double tauMean { get; set; }
        public double tauMedian { get; set; }
        public double tauCiLower { get; set; }
        public double tauCiUpper { get; set; }
        public double rhatMu { get; set; }
        public double rhatTau { get; set; }
        public double essMu { get; set; }
        public double essTau { get; set; }
        public double probPositive { get; set; }
        public double? probInRope { get; set; }
        public double? bayesFactor { get; set; }
        public List<double> muSamples { get; set; } = new();
        public List<double> tauSamples { get; set; } = new();
        public List<string> warnings { get; set; } = new();
    }

    private static readonly Random Rng = new();

    public static BayesianResult Run(BayesianRequest req)
    {
        if (req.effects.Count < 2)
            throw new ArgumentException("At least 2 studies required");

        int n = req.effects.Count;
        int totalIter = req.warmup + (req.iter - req.warmup) / req.chains * req.chains;

        var allMuSamples = new List<double>();
        var allTauSamples = new List<double>();

        // Prior parameters
        double muPriorMean = 0, muPriorSd = 10;
        double tauPriorScale = 0.5;

        for (int chain = 0; chain < req.chains; chain++)
        {
            int chainSeed = req.seed + chain * 1000;
            var rng = new Random(chainSeed);

            // Initialize
            double mu = req.effects.Average();
            double tau = 0.1;

            for (int iter = 0; iter < totalIter; iter++)
            {
                // Sample mu | tau, y
                double sumPrec = 0, sumWy = 0;
                for (int i = 0; i < n; i++)
                {
                    double prec = 1.0 / (req.variances[i] + tau * tau);
                    sumPrec += prec;
                    sumWy += prec * req.effects[i];
                }
                double priorPrec = 1.0 / (muPriorSd * muPriorSd);
                double postPrec = sumPrec + priorPrec;
                double postMean = (sumWy + priorPrec * muPriorMean) / postPrec;
                double postSd = Math.Sqrt(1.0 / postPrec);
                mu = postMean + postSd * NormalSample(ref rng);

                // Sample tau | mu, y (Metropolis-Hastings with half-Cauchy prior)
                double tauProp = Math.Max(0.001, tau + NormalSample(ref rng) * 0.1);
                double logAccept = LogTauPosterior(tauProp, req.effects, req.variances, mu, tauPriorScale)
                                 - LogTauPosterior(tau, req.effects, req.variances, mu, tauPriorScale);
                if (Math.Log(rng.NextDouble()) < logAccept)
                    tau = tauProp;

                // Store post-warmup
                if (iter >= req.warmup)
                {
                    allMuSamples.Add(mu);
                    allTauSamples.Add(tau);
                }
            }
        }

        // Compute summaries
        var muSorted = allMuSamples.OrderBy(x => x).ToList();
        var tauSorted = allTauSamples.OrderBy(x => x).ToList();

        int halfN = muSorted.Count / 2;
        double muMedian = muSorted[halfN];
        double tauMedian = tauSorted[halfN];

        // R-hat (split-chain)
        double rhatMu = ComputeRhat(allMuSamples, req.chains);
        double rhatTau = ComputeRhat(allTauSamples, req.chains);

        // ESS (effective sample size, crude)
        double essMu = allMuSamples.Count / Math.Max(rhatMu - 1, 0.1);
        double essTau = allTauSamples.Count / Math.Max(rhatTau - 1, 0.1);

        // Probability of direction
        double probPos = allMuSamples.Count(s => s > 0) / (double)allMuSamples.Count;

        // ROPE
        double? probRope = null;
        if (req.ropeLower.HasValue && req.ropeUpper.HasValue)
        {
            probRope = allMuSamples.Count(s => s >= req.ropeLower.Value && s <= req.ropeUpper.Value)
                       / (double)allMuSamples.Count;
        }

        // Savage-Dickey Bayes Factor (H0: mu=0 vs H1: mu~N(0,10))
        double bf = ComputeSavageDickey(allMuSamples, muPriorSd);

        var result = new BayesianResult
        {
            muMean = allMuSamples.Average(),
            muMedian = muMedian,
            muCiLower = Percentile(muSorted, 0.025),
            muCiUpper = Percentile(muSorted, 0.975),
            tauMean = allTauSamples.Average(),
            tauMedian = tauMedian,
            tauCiLower = Percentile(tauSorted, 0.025),
            tauCiUpper = Percentile(tauSorted, 0.975),
            rhatMu = rhatMu,
            rhatTau = rhatTau,
            essMu = essMu,
            essTau = essTau,
            probPositive = probPos,
            probInRope = probRope,
            bayesFactor = bf,
            muSamples = allMuSamples,
            tauSamples = allTauSamples
        };

        if (rhatMu > 1.1 || rhatTau > 1.1)
            result.warnings.Add($"R-hat > 1.1 (mu={rhatMu:F2}, tau={rhatTau:F2}). Consider increasing warmup.");
        if (essMu < 400 || essTau < 400)
            result.warnings.Add($"Low ESS (mu={essMu:F0}, tau={essTau:F0}). Consider increasing iterations.");

        return result;
    }

    private static double LogTauPosterior(double tau, List<double> y, List<double> vars, double mu, double tauScale)
    {
        double ll = 0;
        for (int i = 0; i < y.Count; i++)
        {
            double v = vars[i] + tau * tau;
            ll -= 0.5 * (Math.Log(v) + (y[i] - mu) * (y[i] - mu) / v);
        }
        // Half-Cauchy prior: log p(tau) = log(2) - log(pi) - log(tauScale) - log(1 + (tau/tauScale)^2)
        ll += Math.Log(2) - Math.Log(Math.PI) - Math.Log(tauScale) - Math.Log(1 + (tau / tauScale) * (tau / tauScale));
        return ll;
    }

    private static double ComputeRhat(List<double> samples, int chains)
    {
        int perChain = samples.Count / chains;
        if (perChain < 4) return 1.0;

        var chainMeans = new List<double>();
        for (int c = 0; c < chains; c++)
        {
            double sum = 0;
            for (int i = c * perChain; i < (c + 1) * perChain; i++)
                sum += samples[i];
            chainMeans.Add(sum / perChain);
        }

        double grandMean = chainMeans.Average();
        double B = chainMeans.Sum(m => (m - grandMean) * (m - grandMean)) * perChain / (chains - 1);

        double W = 0;
        for (int c = 0; c < chains; c++)
        {
            double chainVar = 0;
            for (int i = c * perChain; i < (c + 1) * perChain; i++)
                chainVar += (samples[i] - chainMeans[c]) * (samples[i] - chainMeans[c]);
            W += chainVar / (perChain - 1);
        }
        W /= chains;

        double varPlus = (perChain - 1.0) / perChain * W + B / perChain;
        return W > 0 ? Math.Sqrt(varPlus / W) : 1.0;
    }

    private static double ComputeSavageDickey(List<double> muSamples, double priorSd)
    {
        // Savage-Dickey density ratio at mu=0
        // BF01 = p(mu=0 | H1) / p(mu=0 | data)
        // Approximate posterior density at 0 using kernel density
        double bw = 1.06 * StdDev(muSamples) * Math.Pow(muSamples.Count, -0.2);
        double postDensityAt0 = KernelDensity(muSamples, 0, bw);
        double priorDensityAt0 = NormalPdf(0, 0, priorSd);
        return priorDensityAt0 / Math.Max(postDensityAt0, 1e-10);
    }

    private static double KernelDensity(List<double> samples, double x, double bw)
    {
        double sum = 0;
        foreach (var s in samples)
            sum += NormalPdf(x, s, bw);
        return sum / samples.Count;
    }

    private static double NormalPdf(double x, double mean, double sd)
    {
        double z = (x - mean) / sd;
        return Math.Exp(-0.5 * z * z) / (sd * Math.Sqrt(2 * Math.PI));
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

    private static double NormalSample(ref Random rng)
    {
        // Box-Muller
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
    }
}
