using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Bayesian Network Meta-Analysis engine (v0.6.0).
/// MCMC Gibbs sampling for network meta-analysis with consistency model.
/// Mirrors R gemtc package and JAGS/BUGS approach.
/// </summary>
public static class BayesianNmaEngine
{
    public class BayesianNmaRequest
    {
        public List<NmaEngine.NmaStudy> studies { get; set; } = new();
        public string measure { get; set; } = "OR";
        public int iter { get; set; } = 20000;
        public int warmup { get; set; } = 5000;
        public int chains { get; set; } = 4;
        public int seed { get; set; } = 42;
        public string referenceTreatment { get; set; } = "";
    }

    public class BayesianNmaResult
    {
        public List<string> treatments { get; set; } = new();
        public List<LeagueEntry> league { get; set; } = new();
        public List<List<double>> leagueMatrix { get; set; } = new();
        public List<RankResult> ranking { get; set; } = new();
        public double tau2 { get; set; }
        public double tau2CiLower { get; set; }
        public double tau2CiUpper { get; set; }
        public double dbar { get; set; } // total residual deviance
        public double pd { get; set; } // effective parameters (DIC)
        public double dic { get; set; } // deviance information criterion
        public List<string> warnings { get; set; } = new();
    }

    public class LeagueEntry
    {
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public double effect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
    }

    public class RankResult
    {
        public string treatment { get; set; } = "";
        public double sucra { get; set; }
        public double meanRank { get; set; }
        public List<double> rankProbs { get; set; } = new();
    }

    public static BayesianNmaResult Run(BayesianNmaRequest req)
    {
        if (req.studies == null || req.studies.Count < 2)
            throw new ArgumentException("At least two studies required for Bayesian NMA");

        var treatments = req.studies
            .SelectMany(s => new[] { s.treatment1, s.treatment2 })
            .Distinct()
            .OrderBy(t => t)
            .ToList();

        if (treatments.Count < 2)
            throw new ArgumentException("At least two distinct treatments required");

        int K = treatments.Count;
        int S = req.studies.Count;

        // Build design matrix and response
        var validStudies = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        int n = validStudies.Count;

        var X = new double[n][];
        var y = new double[n];
        var sigma = new double[n];

        for (int i = 0; i < n; i++)
        {
            X[i] = new double[K - 1];
            var s = validStudies[i];
            int idx1 = treatments.IndexOf(s.treatment1);
            int idx2 = treatments.IndexOf(s.treatment2);

            if (idx1 > 0) X[i][idx1 - 1] = 1.0;
            if (idx2 > 0) X[i][idx2 - 1] = -1.0;

            y[i] = s.effect.Value;
            sigma[i] = s.se.Value;
        }

        // MCMC for Bayesian NMA
        var rng = new Random(req.seed);
        int totalIter = req.warmup + (req.iter - req.warmup) / req.chains * req.chains;

        var dSamples = new List<double>(); // basic parameters (K-1)
        var tauSamples = new List<double>();

        // Initialize
        double[] d = new double[K - 1]; // treatment effects vs reference
        double tau = 0.1;

        for (int iter = 0; iter < totalIter; iter++)
        {
            // Sample d | tau, y (multivariate normal)
            // Posterior precision: X'WX + prior_precision
            var XtWX = new double[K - 1][];
            var XtWy = new double[K - 1];

            for (int j = 0; j < K - 1; j++)
            {
                XtWX[j] = new double[K - 1];
                for (int l = 0; l < K - 1; l++)
                {
                    double sum = 0;
                    for (int i = 0; i < n; i++)
                        sum += X[i][j] * X[i][l] / (sigma[i] * sigma[i] + tau * tau);
                    XtWX[j][l] = sum;
                }
                double sumY = 0;
                for (int i = 0; i < n; i++)
                    sumY += X[i][j] * y[i] / (sigma[i] * sigma[i] + tau * tau);
                XtWy[j] = sumY;
            }

            // Add prior (normal(0, 100))
            for (int j = 0; j < K - 1; j++)
                XtWX[j][j] += 0.0001;

            // Sample from multivariate normal (Cholesky)
            d = SampleMVN(XtWy, Flatten(XtWX, K - 1), K - 1, ref rng);

            // Sample tau | d, y (Metropolis-Hastings)
            double tauProp = Math.Max(0.001, tau + NormalSample(ref rng) * 0.05);
            double logAccept = LogTauPosterior(tauProp, y, X, d, sigma) -
                              LogTauPosterior(tau, y, X, d, sigma);
            if (Math.Log(rng.NextDouble()) < logAccept)
                tau = tauProp;

            if (iter >= req.warmup)
            {
                for (int j = 0; j < K - 1; j++)
                    dSamples.Add(d[j]);
                tauSamples.Add(tau);
            }
        }

        // Compute results
        int nSamples = dSamples.Count / (K - 1);
        var dMeans = new double[K - 1];
        for (int j = 0; j < K - 1; j++)
        {
            double sum = 0;
            for (int s = 0; s < nSamples; s++)
                sum += dSamples[s * (K - 1) + j];
            dMeans[j] = sum / nSamples;
        }

        double tauMean = tauSamples.Average();
        var tauSorted = tauSamples.OrderBy(t => t).ToList();
        double tauLo = Percentile(tauSorted, 0.025);
        double tauHi = Percentile(tauSorted, 0.975);

        // League matrix
        var leagueMatrix = new List<List<double>>();
        for (int i = 0; i < K; i++)
        {
            var row = new List<double>();
            for (int j = 0; j < K; j++)
            {
                if (i == j) row.Add(0);
                else if (i == 0) row.Add(-dMeans[j - 1]);
                else if (j == 0) row.Add(dMeans[i - 1]);
                else row.Add(dMeans[i - 1] - dMeans[j - 1]);
            }
            leagueMatrix.Add(row);
        }

        // League entries
        var league = new List<LeagueEntry>();
        for (int i = 0; i < K; i++)
        {
            for (int j = i + 1; j < K; j++)
            {
                double eff = leagueMatrix[i][j];
                double se = ComputeSe(dSamples, i, j, K - 1, nSamples);
                league.Add(new LeagueEntry
                {
                    treatment1 = treatments[i],
                    treatment2 = treatments[j],
                    effect = eff,
                    ciLower = eff - 1.96 * se,
                    ciUpper = eff + 1.96 * se,
                    se = se,
                    p = 2 * (1 - Stats.NormalCdf(Math.Abs(eff / se)))
                });
            }
        }

        // Ranking
        var ranking = new List<RankResult>();
        for (int i = 0; i < K; i++)
        {
            double sucra = 0;
            var rankProbs = new List<double>(new double[K]);
            for (int s = 0; s < nSamples; s++)
            {
                // Compute treatment effects for this sample
                var effects = new List<(string treatment, int idx, double eff)>();
                for (int t = 0; t < K; t++)
                {
                    double eff;
                    if (t == 0) eff = 0;
                    else eff = dSamples[s * (K - 1) + t - 1];
                    effects.Add((treatments[t], t, eff));
                }
                effects.Sort((a, b) => a.eff.CompareTo(b.eff));
                for (int r = 0; r < K; r++)
                {
                    if (effects[r].idx == i)
                    {
                        rankProbs[r]++;
                        sucra += (double)(K - r - 1) / (K - 1);
                    }
                }
            }
            for (int r = 0; r < K; r++)
                rankProbs[r] /= nSamples;
            sucra /= nSamples;

            ranking.Add(new RankResult
            {
                treatment = treatments[i],
                sucra = sucra * 100,
                meanRank = rankProbs.Select((p, r) => p * (r + 1)).Sum(),
                rankProbs = rankProbs
            });
        }

        // DIC computation
        // Dbar: average deviance across MCMC samples
        double dbar = 0;
        for (int s = 0; s < nSamples; s++)
        {
            double[] dS = new double[K - 1];
            for (int j = 0; j < K - 1; j++)
                dS[j] = dSamples[s * (K - 1) + j];
            double tauS = tauSamples[s];
            dbar += ComputeDeviance(y, X, dS, sigma, tauS);
        }
        dbar /= nSamples;

        // Dhat: deviance at posterior means
        double dhat = ComputeDeviance(y, X, dMeans, sigma, tauMean);
        double pdValue = Math.Max(0.1, dbar - dhat);
        double dicValue = dbar + pdValue;

        var result = new BayesianNmaResult
        {
            treatments = treatments,
            league = league,
            leagueMatrix = leagueMatrix,
            ranking = ranking,
            tau2 = tauMean * tauMean,
            tau2CiLower = tauLo * tauLo,
            tau2CiUpper = tauHi * tauHi,
            dbar = dbar,
            pd = pdValue,
            dic = dicValue
        };

        if (tauMean < 0.001)
            result.warnings.Add("Between-study variance near zero. Consider fixed-effect model.");

        return result;
    }

    private static double[] SampleMVN(double[] mean, double[] cov, int dim, ref Random rng)
    {
        // Cholesky decomposition
        var L = new double[dim][];
        for (int i = 0; i < dim; i++)
        {
            L[i] = new double[dim];
            for (int j = 0; j <= i; j++)
            {
                double sum = cov[i * dim + j];
                for (int k = 0; k < j; k++)
                    sum -= L[i][k] * L[j][k];
                L[i][j] = i == j ? Math.Sqrt(sum) : sum / L[j][j];
            }
        }

        // z ~ N(0, I)
        var z = new double[dim];
        for (int i = 0; i < dim; i++)
            z[i] = NormalSample(ref rng);

        // x = Lz + mean
        var x = new double[dim];
        for (int i = 0; i < dim; i++)
        {
            x[i] = mean[i];
            for (int j = 0; j <= i; j++)
                x[i] += L[i][j] * z[j];
        }

        return x;
    }

    private static double[] Flatten(double[][] matrix, int dim)
    {
        var result = new double[dim * dim];
        for (int i = 0; i < dim; i++)
            for (int j = 0; j < dim; j++)
                result[i * dim + j] = matrix[i][j];
        return result;
    }

    private static double LogTauPosterior(double tau, double[] y, double[][] X, double[] d, double[] sigma)
    {
        double ll = 0;
        for (int i = 0; i < y.Length; i++)
        {
            double pred = 0;
            for (int j = 0; j < d.Length; j++)
                pred += X[i][j] * d[j];
            double v = sigma[i] * sigma[i] + tau * tau;
            ll -= 0.5 * (Math.Log(v) + (y[i] - pred) * (y[i] - pred) / v);
        }
        // Half-Cauchy prior
        ll += Math.Log(2) - Math.Log(Math.PI) - Math.Log(0.5) - Math.Log(1 + (tau / 0.5) * (tau / 0.5));
        return ll;
    }

    private static double ComputeSe(List<double> dSamples, int i, int j, int dim, int nSamples)
    {
        var effects = new List<double>();
        for (int s = 0; s < nSamples; s++)
        {
            double eff_i = i == 0 ? 0 : dSamples[s * dim + i - 1];
            double eff_j = j == 0 ? 0 : dSamples[s * dim + j - 1];
            effects.Add(eff_i - eff_j);
        }
        return StdDev(effects);
    }

    private static double ComputeDbar(double[] y, double[][] X, double[] d, double[] sigma, double tau)
    {
        double dbar = 0;
        for (int i = 0; i < y.Length; i++)
        {
            double pred = 0;
            for (int j = 0; j < d.Length; j++)
                pred += X[i][j] * d[j];
            double v = sigma[i] * sigma[i] + tau * tau;
            dbar += Math.Log(v) + (y[i] - pred) * (y[i] - pred) / v;
        }
        return -2 * dbar / y.Length;
    }

    private static double ComputeDhat(double[] y, double[][] X, double[] d, double[] sigma, double tau)
    {
        // Dhat: deviance at posterior mean parameters
        double dhat = 0;
        for (int i = 0; i < y.Length; i++)
        {
            double pred = 0;
            for (int j = 0; j < d.Length; j++)
                pred += X[i][j] * d[j];
            double v = sigma[i] * sigma[i] + tau * tau;
            dhat += Math.Log(v) + (y[i] - pred) * (y[i] - pred) / v;
        }
        return -2 * dhat / y.Length;
    }

    private static double ComputeDeviance(double[] y, double[][] X, double[] d, double[] sigma, double tau)
    {
        double deviance = 0;
        for (int i = 0; i < y.Length; i++)
        {
            double pred = 0;
            for (int j = 0; j < d.Length; j++)
                pred += X[i][j] * d[j];
            double v = sigma[i] * sigma[i] + tau * tau;
            deviance += Math.Log(v) + (y[i] - pred) * (y[i] - pred) / v;
        }
        return -2 * deviance;
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
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
    }
}

/// <summary>
/// Umbrella Review engine (v0.6.0).
/// Re-analyzes existing systematic reviews/meta-analyses.
/// Computes overlap, corrected covered area (CCA), and re-pools effects.
/// </summary>
public static class UmbrellaReviewEngine
{
    public class ReviewStudy
    {
        public string reviewId { get; set; } = "";
        public string title { get; set; } = "";
        public int? year { get; set; }
        public int nStudies { get; set; }
        public int nParticipants { get; set; }
        public double? pooledEffect { get; set; }
        public double? ciLower { get; set; }
        public double? ciUpper { get; set; }
        public double? i2 { get; set; }
        public string certainty { get; set; } = "Moderate";
        public List<string> includedStudies { get; set; } = new();
    }

    public class UmbrellaRequest
    {
        public List<ReviewStudy> reviews { get; set; } = new();
        public string outcome { get; set; } = "";
    }

    public class UmbrellaResult
    {
        public int nReviews { get; set; }
        public int totalUniqueStudies { get; set; }
        public double cca { get; set; } // corrected covered area
        public string overlapLevel { get; set; } = ""; // slight, moderate, high, very high
        public double? pooledEffect { get; set; }
        public double? ciLower { get; set; }
        public double? ciUpper { get; set; }
        public double? i2 { get; set; }
        public List<string> warnings { get; set; } = new();
        public List<ReviewStudy> reviews { get; set; } = new();
    }

    public static UmbrellaResult Run(UmbrellaRequest req)
    {
        if (req.reviews == null || req.reviews.Count < 2)
            throw new ArgumentException("At least 2 reviews required for umbrella review");

        var result = new UmbrellaResult { nReviews = req.reviews.Count, reviews = req.reviews };

        // Compute unique studies
        var allStudies = new HashSet<string>();
        int totalStudyInstances = 0;
        foreach (var review in req.reviews)
        {
            foreach (var study in review.includedStudies)
                allStudies.Add(study);
            totalStudyInstances += review.includedStudies.Count;
        }
        result.totalUniqueStudies = allStudies.Count;

        int nReviews = req.reviews.Count;
        int nUnique = allStudies.Count;

        // Compute CCA (Corrected Covered Area) - Pieper et al. (2014)
        // CCA = (N - r) / (r * c - r) * 100
        // where N = total study instances, r = unique studies, c = number of reviews
        if (nUnique > 0 && nReviews > 1)
        {
            double numerator = totalStudyInstances - nUnique;
            double denominator = nUnique * nReviews - nUnique;
            double cca = denominator > 0 ? (numerator / denominator) * 100 : 0;
            result.cca = Math.Max(0, Math.Min(100, cca));
        }

        // Overlap level
        result.overlapLevel = result.cca switch
        {
            <= 5 => "Slight",
            <= 10 => "Moderate",
            <= 15 => "High",
            _ => "Very high"
        };

        // Re-pool effects from reviews
        var validReviews = req.reviews.Where(r => r.pooledEffect.HasValue && r.ciLower.HasValue && r.ciUpper.HasValue).ToList();
        if (validReviews.Count >= 2)
        {
            var effects = validReviews.Select(r => r.pooledEffect.Value).ToList();
            var weights = validReviews.Select(r =>
            {
                double se = (r.ciUpper.Value - r.ciLower.Value) / (2 * 1.96);
                return 1.0 / (se * se);
            }).ToList();

            double sumW = weights.Sum();
            double pooled = effects.Zip(weights, (e, w) => e * w).Sum() / sumW;
            double se = Math.Sqrt(1.0 / sumW);

            result.pooledEffect = pooled;
            result.ciLower = pooled - 1.96 * se;
            result.ciUpper = pooled + 1.96 * se;

            // I² across reviews
            var w = weights.Select(wi => 1.0 / wi).ToList();
            double fe = effects.Zip(w, (e, wi) => e * wi).Sum() / w.Sum();
            double q = effects.Zip(w, (e, wi) => wi * (e - fe) * (e - fe)).Sum();
            int df = validReviews.Count - 1;
            result.i2 = q > df ? Math.Max(0, (q - df) / q * 100) : 0;
        }

        if (result.cca > 10)
            result.warnings.Add($"High overlap (CCA={result.cca:F1}%). Consider sensitivity analyses excluding overlapping studies.");

        return result;
    }
}
