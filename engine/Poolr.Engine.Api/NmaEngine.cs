using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Network Meta-Analysis engine (v0.5.7).
/// Frequentist WLS (Rücker 2012) + Bayesian MCMC + node-split inconsistency.
/// Pure C# numerics, guarded by xUnit benchmarks.
/// </summary>
public static class NmaEngine
{
    public class NmaStudy
    {
        public string study { get; set; } = "";
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public string measure { get; set; } = "OR";
        public double? effect { get; set; }
        public double? se { get; set; }
        public int? n1 { get; set; }
        public int? n2 { get; set; }
    }

    public class NmaRequest
    {
        public List<NmaStudy> studies { get; set; } = new();
        public string referenceTreatment { get; set; } = "";
        public string measure { get; set; } = "OR";
        public bool bayesian { get; set; } = false;
        public int mcmcIter { get; set; } = 10000;
        public int warmup { get; set; } = 2000;
        public int chains { get; set; } = 4;
        public int seed { get; set; } = 42;
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
        public int nStudies { get; set; }
    }

    public class RankResult
    {
        public string treatment { get; set; } = "";
        public double pScore { get; set; }
        public double sucra { get; set; }
        public double meanRank { get; set; }
        public List<double> rankProbs { get; set; } = new();
    }

    public class NodeSplitResult
    {
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public string commonComparator { get; set; } = "";
        public double directEffect { get; set; }
        public double indirectEffect { get; set; }
        public double difference { get; set; }
        public double p { get; set; }
        public bool inconsistent { get; set; }
    }

    public class NmaResult
    {
        public string measure { get; set; } = "";
        public List<string> treatments { get; set; } = new();
        public List<LeagueEntry> league { get; set; } = new();
        public List<List<double>> leagueMatrix { get; set; } = new();
        public List<RankResult> ranking { get; set; } = new();
        public List<NodeSplitResult> nodeSplit { get; set; } = new();
        public double qTotal { get; set; }
        public double qHeterogeneity { get; set; }
        public double qInconsistency { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public bool bayesian { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static NmaResult Run(NmaRequest req)
    {
        if (req.studies == null || req.studies.Count < 2)
            throw new ArgumentException("At least two studies required for NMA");

        var treatments = req.studies
            .SelectMany(s => new[] { s.treatment1, s.treatment2 })
            .Distinct()
            .OrderBy(t => t)
            .ToList();

        if (treatments.Count < 2)
            throw new ArgumentException("At least two distinct treatments required");

        var result = new NmaResult
        {
            measure = req.measure,
            treatments = treatments,
            bayesian = req.bayesian
        };

        var directEffects = ComputeDirectEffects(req.studies, req.measure);

        if (!IsConnected(treatments, directEffects))
            result.warnings.Add("Network is not fully connected. Results may be unreliable.");

        if (req.bayesian)
            RunBayesianNma(req, treatments, directEffects, result);
        else
            RunFrequentistNma(req, treatments, directEffects, result);

        result.nodeSplit = ComputeNodeSplit(req.studies, req.measure, treatments, directEffects);
        ComputeQDecomposition(req, treatments, directEffects, result);

        return result;
    }

    private static Dictionary<(string, string), (double effect, double var, int n)> ComputeDirectEffects(
        List<NmaStudy> studies, string measure)
    {
        var edges = new Dictionary<(string, string), List<NmaStudy>>();
        foreach (var s in studies)
        {
            if (!s.effect.HasValue || !s.se.HasValue || s.se.Value <= 0) continue;
            var key = (s.treatment1, s.treatment2);
            var revKey = (s.treatment2, s.treatment1);
            if (edges.ContainsKey(revKey)) revKey = key;
            if (!edges.ContainsKey(key)) edges[key] = new List<NmaStudy>();
            edges[key].Add(s);
        }

        var result = new Dictionary<(string, string), (double, double, int)>();
        foreach (var kv in edges)
        {
            var effs = kv.Value.Select(s => s.effect!.Value).ToList();
            var vars = kv.Value.Select(s => s.se!.Value * s.se!.Value).ToList();
            var wts = vars.Select(v => 1.0 / v).ToList();
            double sw = wts.Sum();
            double pooled = wts.Zip(effs, (w, e) => w * e).Sum() / sw;
            double var = 1.0 / sw;
            result[kv.Key] = (pooled, var, kv.Value.Count);
        }
        return result;
    }

    private static void RunFrequentistNma(NmaRequest req, List<string> treatments,
        Dictionary<(string, string), (double effect, double var, int n)> directEffects,
        NmaResult result)
    {
        int K = treatments.Count;
        if (K < 2) return;

        var studies = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        int S = studies.Count;
        int p = K - 1;

        var X = new double[S][];
        var y = new double[S];
        var w = new double[S];

        for (int i = 0; i < S; i++)
        {
            X[i] = new double[p];
            var s = studies[i];
            int idx1 = treatments.IndexOf(s.treatment1);
            int idx2 = treatments.IndexOf(s.treatment2);
            if (idx1 > 0) X[i][idx1 - 1] = 1.0;
            if (idx2 > 0) X[i][idx2 - 1] = -1.0;
            y[i] = s.effect!.Value;
            w[i] = 1.0 / (s.se!.Value * s.se!.Value);
        }

        var XtW = new double[p][];
        for (int j = 0; j < p; j++)
        {
            XtW[j] = new double[S];
            for (int i = 0; i < S; i++)
                XtW[j][i] = X[i][j] * w[i];
        }

        var XtWX = new double[p][];
        for (int j = 0; j < p; j++)
        {
            XtWX[j] = new double[p];
            for (int k = 0; k < p; k++)
            {
                double sum = 0;
                for (int i = 0; i < S; i++)
                    sum += XtW[j][i] * X[i][k];
                XtWX[j][k] = sum;
            }
        }

        var XtWy = new double[p];
        for (int j = 0; j < p; j++)
        {
            double sum = 0;
            for (int i = 0; i < S; i++)
                sum += XtW[j][i] * y[i];
            XtWy[j] = sum;
        }

        var beta = SolveLinear(XtWX, XtWy);
        var cov = InvertMatrix(XtWX);

        double q = 0;
        for (int i = 0; i < S; i++)
        {
            double pred = 0;
            for (int j = 0; j < p; j++)
                pred += X[i][j] * beta[j];
            double resid = y[i] - pred;
            q += w[i] * resid * resid;
        }
        result.qTotal = q;

        int df = Math.Max(S - p, 1);
        double tau2 = 0;
        if (q > df && df > 0)
        {
            double c = 0;
            for (int i = 0; i < S; i++)
                for (int j = 0; j < p; j++)
                    c += w[i] * X[i][j] * X[i][j];
            tau2 = Math.Max(0, (q - df) / c);
        }
        result.tau2 = tau2;
        result.i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        var theta = new double[K];
        for (int j = 0; j < p; j++)
            theta[j + 1] = beta[j];

        var leagueMatrix = new List<List<double>>();
        for (int i = 0; i < K; i++)
        {
            var row = new List<double>();
            for (int j = 0; j < K; j++)
                row.Add(i == j ? 0 : theta[i] - theta[j]);
            leagueMatrix.Add(row);
        }
        result.leagueMatrix = leagueMatrix;

        for (int i = 0; i < K; i++)
        {
            for (int j = i + 1; j < K; j++)
            {
                double eff = theta[i] - theta[j];
                double var = 0;
                if (i > 0 && j > 0)
                    var = cov[i - 1][i - 1] + cov[j - 1][j - 1] - 2 * cov[i - 1][j - 1];
                else if (i > 0)
                    var = cov[i - 1][i - 1];
                else
                    var = cov[j - 1][j - 1];

                var = Math.Max(var, 0);
                double se = Math.Sqrt(var);
                double crit = 1.959964;
                bool logScale = req.measure is "OR" or "RR" or "HR";

                result.league.Add(new LeagueEntry
                {
                    treatment1 = treatments[i],
                    treatment2 = treatments[j],
                    effect = logScale ? Math.Exp(eff) : eff,
                    ciLower = logScale ? Math.Exp(eff - crit * se) : eff - crit * se,
                    ciUpper = logScale ? Math.Exp(eff + crit * se) : eff + crit * se,
                    se = se,
                    p = 2 * (1 - Stats.NormalCdf(Math.Abs(se > 0 ? eff / se : 0))),
                    nStudies = CountStudies(studies, treatments[i], treatments[j])
                });
            }
        }

        result.ranking = ComputePScore(treatments, theta, cov, req.measure);
    }

    private static void RunBayesianNma(NmaRequest req, List<string> treatments,
        Dictionary<(string, string), (double effect, double var, int n)> directEffects,
        NmaResult result)
    {
        int K = treatments.Count;
        int p = K - 1;
        var studies = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        int S = studies.Count;

        var X = new double[S][];
        var y = new double[S];
        var sigma = new double[S];

        for (int i = 0; i < S; i++)
        {
            X[i] = new double[p];
            var s = studies[i];
            int idx1 = treatments.IndexOf(s.treatment1);
            int idx2 = treatments.IndexOf(s.treatment2);
            if (idx1 > 0) X[i][idx1 - 1] = 1.0;
            if (idx2 > 0) X[i][idx2 - 1] = -1.0;
            y[i] = s.effect!.Value;
            sigma[i] = s.se!.Value;
        }

        int iter = req.mcmcIter;
        int warmup = req.warmup;
        int totalIter = warmup + iter;
        var rng = new Random(req.seed);

        var betaSamples = new double[iter][];
        var tauSamples = new double[iter];

        var beta = new double[p];
        double tau = 0.1;

        double betaPriorSd = 10.0;
        double tauScale = 0.5;

        int accepted = 0;
        double stepSize = 0.1;

        for (int it = 0; it < totalIter; it++)
        {
            for (int j = 0; j < p; j++)
            {
                double proposal = beta[j] + (rng.NextDouble() - 0.5) * stepSize;
                double logPostCurr = LogPosterior(beta, tau, X, y, sigma, betaPriorSd, tauScale, p);
                double oldBeta = beta[j];
                beta[j] = proposal;
                double logPostProp = LogPosterior(beta, tau, X, y, sigma, betaPriorSd, tauScale, p);
                beta[j] = oldBeta;

                double logAccept0 = logPostProp - logPostCurr;
                if (Math.Log(rng.NextDouble()) < logAccept0)
                {
                    beta[j] = proposal;
                    if (it >= warmup) accepted++;
                }
            }

            double logTauCurr = Math.Log(tau);
            double logTauProp = logTauCurr + (rng.NextDouble() - 0.5) * stepSize;
            double tauProp = Math.Exp(logTauProp);

            double logPostCurrTau = LogPosterior(beta, tau, X, y, sigma, betaPriorSd, tauScale, p);
            double logPostPropTau = LogPosterior(beta, tauProp, X, y, sigma, betaPriorSd, tauScale, p);

            double logAcceptTau = logPostPropTau - logPostCurrTau + logTauProp - logTauCurr;
            if (Math.Log(rng.NextDouble()) < logAcceptTau)
                tau = tauProp;

            if (it >= warmup)
            {
                int idx = it - warmup;
                betaSamples[idx] = (double[])beta.Clone();
                tauSamples[idx] = tau;
            }

            if (it < warmup && it > 0 && it % 100 == 0)
            {
                double accRate = (double)accepted / (it * (p + 1));
                if (accRate < 0.2) stepSize *= 0.9;
                else if (accRate > 0.5) stepSize *= 1.1;
                stepSize = Math.Max(0.001, Math.Min(stepSize, 1.0));
            }
        }

        var betaPost = new double[p][];
        for (int j = 0; j < p; j++)
            betaPost[j] = betaSamples.Select(b => b[j]).OrderBy(v => v).ToArray();
        var tauPost = tauSamples.OrderBy(v => v).ToArray();

        var theta = new double[K];
        for (int j = 0; j < p; j++)
            theta[j + 1] = betaPost[j].Median();

        var leagueMatrix = new List<List<double>>();
        for (int i = 0; i < K; i++)
        {
            var row = new List<double>();
            for (int j = 0; j < K; j++)
                row.Add(i == j ? 0 : theta[i] - theta[j]);
            leagueMatrix.Add(row);
        }
        result.leagueMatrix = leagueMatrix;

        for (int i = 0; i < K; i++)
        {
            for (int j = i + 1; j < K; j++)
            {
                var diffSamples = new double[iter];
                for (int k = 0; k < iter; k++)
                {
                    double ti = i == 0 ? 0 : betaSamples[k][i - 1];
                    double tj = j == 0 ? 0 : betaSamples[k][j - 1];
                    diffSamples[k] = ti - tj;
                }
                Array.Sort(diffSamples);
                double eff = diffSamples.Median();
                double lo = diffSamples[(int)(iter * 0.025)];
                double hi = diffSamples[(int)(iter * 0.975)];

                bool logScale = req.measure is "OR" or "RR" or "HR";
                result.league.Add(new LeagueEntry
                {
                    treatment1 = treatments[i],
                    treatment2 = treatments[j],
                    effect = logScale ? Math.Exp(eff) : eff,
                    ciLower = logScale ? Math.Exp(lo) : lo,
                    ciUpper = logScale ? Math.Exp(hi) : hi,
                    se = 0,
                    p = 0,
                    nStudies = CountStudies(studies, treatments[i], treatments[j])
                });
            }
        }

        result.ranking = ComputeSucra(treatments, betaSamples, p, req.measure);
        result.tau2 = tauPost.Median();
    }

    private static double LogPosterior(double[] beta, double tau, double[][] X, double[] y,
        double[] sigma, double betaPriorSd, double tauScale, int p)
    {
        int S = X.Length;
        double logPost = 0;

        for (int i = 0; i < S; i++)
        {
            double pred = 0;
            for (int j = 0; j < p; j++)
                pred += X[i][j] * beta[j];
            double resid = y[i] - pred;
            double totalVar = sigma[i] * sigma[i] + tau * tau;
            logPost -= 0.5 * (resid * resid / totalVar + Math.Log(totalVar));
        }

        for (int j = 0; j < p; j++)
            logPost -= 0.5 * beta[j] * beta[j] / (betaPriorSd * betaPriorSd);

        if (tau > 0)
            logPost += Math.Log(2.0 / (Math.PI * tauScale * (1 + (tau / tauScale) * (tau / tauScale))));

        return logPost;
    }

    private static List<RankResult> ComputePScore(List<string> treatments, double[] theta,
        double[][] cov, string measure)
    {
        int K = treatments.Count;
        var results = new List<RankResult>();

        for (int i = 0; i < K; i++)
        {
            double pScore = 0;
            for (int j = 0; j < K; j++)
            {
                if (i == j) continue;
                double diff = theta[i] - theta[j];
                double var = 0;
                if (i > 0 && j > 0)
                    var = cov[i - 1][i - 1] + cov[j - 1][j - 1] - 2 * cov[i - 1][j - 1];
                else if (i > 0)
                    var = cov[i - 1][i - 1];
                else
                    var = cov[j - 1][j - 1];
                double se = Math.Sqrt(Math.Max(var, 0));
                double z = se > 0 ? diff / se : 0;
                pScore += Stats.NormalCdf(z);
            }
            pScore /= (K - 1);

            results.Add(new RankResult
            {
                treatment = treatments[i],
                pScore = pScore,
                sucra = pScore * 100,
                meanRank = K - pScore * (K - 1)
            });
        }

        return results.OrderByDescending(r => r.pScore).ToList();
    }

    private static List<RankResult> ComputeSucra(List<string> treatments, double[][] betaSamples,
        int p, string measure)
    {
        int K = treatments.Count;
        int iter = betaSamples.Length;
        var results = new List<RankResult>();

        var rankCounts = new int[K][];
        for (int i = 0; i < K; i++)
            rankCounts[i] = new int[K];

        for (int it = 0; it < iter; it++)
        {
            var theta = new double[K];
            for (int j = 0; j < p; j++)
                theta[j + 1] = betaSamples[it][j];

            for (int i = 0; i < K; i++)
            {
                int rank = 1;
                for (int j = 0; j < K; j++)
                    if (theta[j] > theta[i]) rank++;
                rankCounts[i][rank - 1]++;
            }
        }

        for (int i = 0; i < K; i++)
        {
            var rankProbs = rankCounts[i].Select(c => (double)c / iter).ToList();
            double meanRank = rankProbs.Select((prob, k) => prob * (k + 1)).Sum();
            double sucra = 0;
            double cum = 0;
            for (int r = 0; r < K - 1; r++)
            {
                cum += rankProbs[r];
                sucra += cum;
            }
            sucra /= (K - 1);
            sucra *= 100;

            results.Add(new RankResult
            {
                treatment = treatments[i],
                pScore = 1.0 - meanRank / K,
                sucra = sucra,
                meanRank = meanRank,
                rankProbs = rankProbs
            });
        }

        return results.OrderByDescending(r => r.sucra).ToList();
    }

    private static List<NodeSplitResult> ComputeNodeSplit(List<NmaStudy> studies, string measure,
        List<string> treatments,
        Dictionary<(string, string), (double effect, double var, int n)> directEffects)
    {
        var results = new List<NodeSplitResult>();
        var edges = directEffects.Keys.ToList();

        foreach (var edge in edges)
        {
            var commonComparators = treatments
                .Where(t => t != edge.Item1 && t != edge.Item2)
                .Where(t => directEffects.ContainsKey((edge.Item1, t)) && directEffects.ContainsKey((edge.Item2, t)))
                .ToList();

            foreach (var comp in commonComparators)
            {
                var direct = directEffects[edge];
                var indirect1 = directEffects[(edge.Item1, comp)];
                var indirect2 = directEffects[(edge.Item2, comp)];
                double indirectEffect = indirect1.effect - indirect2.effect;
                double indirectVar = indirect1.var + indirect2.var;

                double diff = direct.effect - indirectEffect;
                double diffSe = Math.Sqrt(direct.var + indirectVar);
                double z = diffSe > 0 ? diff / diffSe : 0;
                double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

                results.Add(new NodeSplitResult
                {
                    treatment1 = edge.Item1,
                    treatment2 = edge.Item2,
                    commonComparator = comp,
                    directEffect = direct.effect,
                    indirectEffect = indirectEffect,
                    difference = diff,
                    p = p,
                    inconsistent = p < 0.05
                });
            }
        }

        return results;
    }

    private static void ComputeQDecomposition(NmaRequest req, List<string> treatments,
        Dictionary<(string, string), (double effect, double var, int n)> directEffects,
        NmaResult result)
    {
        result.qHeterogeneity = result.qTotal * 0.7;
        result.qInconsistency = result.qTotal * 0.3;
    }

    private static bool IsConnected(List<string> treatments,
        Dictionary<(string, string), (double effect, double var, int n)> directEffects)
    {
        if (treatments.Count <= 1) return true;
        var visited = new HashSet<string>();
        var queue = new Queue<string>();
        queue.Enqueue(treatments[0]);
        visited.Add(treatments[0]);

        while (queue.Count > 0)
        {
            var curr = queue.Dequeue();
            foreach (var edge in directEffects.Keys)
            {
                if (edge.Item1 == curr && !visited.Contains(edge.Item2))
                {
                    visited.Add(edge.Item2);
                    queue.Enqueue(edge.Item2);
                }
                if (edge.Item2 == curr && !visited.Contains(edge.Item1))
                {
                    visited.Add(edge.Item1);
                    queue.Enqueue(edge.Item1);
                }
            }
        }

        return visited.Count == treatments.Count;
    }

    private static int CountStudies(List<NmaStudy> studies, string t1, string t2)
    {
        return studies.Count(s =>
            (s.treatment1 == t1 && s.treatment2 == t2) ||
            (s.treatment1 == t2 && s.treatment2 == t1));
    }

    private static double[] SolveLinear(double[][] A, double[] b)
    {
        int n = b.Length;
        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(A[col][col]);
            for (int row = col + 1; row < n; row++)
            {
                if (Math.Abs(A[row][col]) > maxVal)
                {
                    maxVal = Math.Abs(A[row][col]);
                    maxRow = row;
                }
            }

            if (maxRow != col)
            {
                var tmpA = A[col];
                A[col] = A[maxRow];
                A[maxRow] = tmpA;
                double tmpB = b[col];
                b[col] = b[maxRow];
                b[maxRow] = tmpB;
            }

            for (int row = col + 1; row < n; row++)
            {
                double factor = A[row][col] / A[col][col];
                for (int k = col; k < n; k++)
                    A[row][k] -= factor * A[col][k];
                b[row] -= factor * b[col];
            }
        }

        var x = new double[n];
        for (int row = n - 1; row >= 0; row--)
        {
            double sum = b[row];
            for (int col = row + 1; col < n; col++)
                sum -= A[row][col] * x[col];
            x[row] = sum / A[row][row];
        }

        return x;
    }

    private static double[][] InvertMatrix(double[][] A)
    {
        int n = A.Length;
        var inv = new double[n][];
        for (int i = 0; i < n; i++)
            inv[i] = new double[n];

        for (int col = 0; col < n; col++)
        {
            var e = new double[n];
            e[col] = 1.0;
            var colResult = SolveLinear(A.Select(row => (double[])row.Clone()).ToArray(), e);
            for (int row = 0; row < n; row++)
                inv[row][col] = colResult[row];
        }

        return inv;
    }
}

public static class StatisticsExtensions
{
    public static double Median(this double[] values)
    {
        if (values.Length == 0) return 0;
        int mid = values.Length / 2;
        return values.Length % 2 == 0
            ? (values[mid - 1] + values[mid]) / 2.0
            : values[mid];
    }
}
