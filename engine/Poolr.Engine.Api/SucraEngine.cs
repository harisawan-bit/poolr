using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.7.0 SUCRA (Surface Under Cumulative Ranking) engine with percentile
/// bootstrap 95% CIs. Implements the frequentist SUCRA computation with
/// uncertainty quantification via bootstrap resampling of study effects.
/// Reference: Rücker & Schwarzer 2015, Salanti et al. 2011.
/// </summary>
public static class SucraEngine
{
    public class SucraRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string>? treatments { get; set; }
        public int nBootstrap { get; set; } = 10000;
        public int seed { get; set; } = 42;
    }

    public class RankingEntry
    {
        public string treatment { get; set; } = "";
        public double sucra { get; set; }
        public double pScore { get; set; }
        public double meanRank { get; set; }
        public double rankSd { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public int originalRank { get; set; }
    }

    public class SucraResult
    {
        public List<RankingEntry> rankings { get; set; } = new();
        public int nBootstrap { get; set; }
        public int seed { get; set; }
        public double pooledEffect { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public string interpretation { get; set; } = "";
        public string method { get; set; } = "SUCRA with bootstrap CI (Rücker & Schwarzer)";
    }

    public static SucraResult Run(SucraRequest req)
    {
        int k = req.effects.Count;
        if (k < 2) throw new ArgumentException("At least 2 treatments required");
        if (req.variances.Count != k) throw new ArgumentException("variances must match effects length");

        var treatments = req.treatments ?? Enumerable.Range(1, k).Select(i => $"T{i}").ToList();
        var rng = new Random(req.seed);

        // Compute pooled effect and tau2 for the full dataset
        var feW = req.variances.Select(v => 1.0 / Math.Max(v, 1e-12)).ToList();
        double feSw = feW.Sum();
        double fe = feW.Zip(req.effects, (w, e) => w * e).Sum() / feSw;
        double q = feW.Zip(req.effects, (w, e) => w * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c = feSw - feW.Sum(w => w * w) / feSw;
        double tau2 = (df > 0 && q > df && c > 1e-12) ? Math.Max(0, (q - df) / c) : 0;
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        // Compute SUCRA and p-scores for the original data
        var originalRanks = ComputeRanks(req.effects, req.variances);
        double originalSucra = ComputeSucra(originalRanks, k);
        double originalPScore = ComputePScore(originalRanks, k);

        // Bootstrap to get CI for SUCRA
        var bootstrapSucras = new List<double>();
        var bootstrapMeanRanks = new List<double[]>();

        for (int b = 0; b < req.nBootstrap; b++)
        {
            // Resample from N(effects[i], variances[i])
            var bootEffects = new List<double>();
            for (int i = 0; i < k; i++)
            {
                double mu = req.effects[i];
                double sigma = Math.Sqrt(req.variances[i]);
                double z = GenerateNormal(rng);
                bootEffects.Add(mu + sigma * z);
            }

            var bootRanks = ComputeRanks(bootEffects, req.variances);
            bootstrapSucras.Add(ComputeSucra(bootRanks, k));

            // Mean rank per treatment across bootstrap
            var meanRanks = new double[k];
            for (int i = 0; i < k; i++)
                meanRanks[i] = bootRanks[i];
            bootstrapMeanRanks.Add(meanRanks);
        }

        bootstrapSucras.Sort();
        int lowerIdx = (int)Math.Floor(0.025 * req.nBootstrap);
        int upperIdx = (int)Math.Floor(0.975 * req.nBootstrap);

        // Compute bootstrap statistics per treatment
        var rankings = new List<RankingEntry>();
        for (int i = 0; i < k; i++)
        {
            var treatmentSucras = bootstrapMeanRanks.Select(b => b[i]).ToList();
            treatmentSucras.Sort();

            double meanRank = treatmentSucras.Average();
            double rankSd = Math.Sqrt(treatmentSucras.Sum(r => (r - meanRank) * (r - meanRank)) / Math.Max(treatmentSucras.Count - 1, 1));

            rankings.Add(new RankingEntry
            {
                treatment = treatments[i],
                sucra = originalSucra,
                pScore = originalPScore,
                meanRank = meanRank,
                rankSd = rankSd,
                ciLower = lowerIdx < treatmentSucras.Count ? treatmentSucras[lowerIdx] : 1,
                ciUpper = upperIdx < treatmentSucras.Count ? treatmentSucras[upperIdx] : k,
                originalRank = (int)originalRanks[i],
            });
        }

        // Sort by mean rank (lower is better)
        rankings = rankings.OrderByDescending(r => r.pScore).ToList();

        return new SucraResult
        {
            rankings = rankings,
            nBootstrap = req.nBootstrap,
            seed = req.seed,
            pooledEffect = fe,
            i2 = i2,
            tau2 = tau2,
            interpretation = $"SUCRA with {req.nBootstrap}-bootstrap 95% CIs. Best: {rankings[0].treatment} (p-score={rankings[0].pScore:F3})",
            method = "SUCRA with bootstrap CI (Rücker & Schwarzer 2015)"
        };
    }

    private static double[] ComputeRanks(List<double> effects, List<double> variances)
    {
        int k = effects.Count;
        var ranks = new double[k];
        // Higher effect = better rank (rank 1 = best)
        for (int i = 0; i < k; i++)
        {
            double rank = 1;
            for (int j = 0; j < k; j++)
                if (effects[j] > effects[i])
                    rank++;
            ranks[i] = rank;
        }
        return ranks;
    }

    private static double ComputeSucra(double[] ranks, int k)
    {
        // SUCRA_i = (sum_{b=1}^{k} rank_i <= b) / (k - 1)
        double sucra = 0;
        for (int b = 1; b < k; b++)
        {
            if (ranks[0] <= b) sucra++;
        }
        return sucra / (k - 1);
    }

    private static double ComputePScore(double[] ranks, int k)
    {
        // P-score = SUCRA simplified: probability of being best
        double minRank = ranks.Min();
        int bestCount = ranks.Count(r => r == minRank);
        return minRank == ranks[0] ? 1.0 / bestCount : 0;
    }

    private static double GenerateNormal(Random rng)
    {
        // Box-Muller transform
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
    }
}
