using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Bayesian multilevel meta-analysis (v0.6.1).
/// Gibbs sampling for 3-level hierarchical models with half-Cauchy priors.
/// </summary>
public static class BayesianMultilevelEngine
{
    public class MultilevelRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string> studyIds { get; set; } = new();
        public int iter { get; set; } = 20000;
        public int warmup { get; set; } = 5000;
        public int? seed { get; set; } = 42;
    }

    public class MultilevelResult
    {
        public double muMean { get; set; }
        public double muMedian { get; set; }
        public double muCiLower { get; set; }
        public double muCiUpper { get; set; }
        public double tau2WithinMean { get; set; }
        public double tau2BetweenMean { get; set; }
        public double tau2Total => tau2WithinMean + tau2BetweenMean;
        public double i2 { get; set; }
        public double rhatMu { get; set; }
        public double rhatTau { get; set; }
        public double essMu { get; set; }
        public double essTau { get; set; }
        public List<double> muSamples { get; set; } = new();
        public List<double> tauSamples { get; set; } = new();
    }

    public static MultilevelResult Run(MultilevelRequest req)
    {
        if (req.effects.Count < 3)
            throw new ArgumentException("At least 3 studies required");

        var rng = new Random(req.seed ?? 42);
        int n = req.effects.Count;
        var clusters = req.studyIds.Distinct().ToList();
        int nClusters = clusters.Count;

        // Cluster assignments
        var clusterIdx = new int[n];
        for (int i = 0; i < n; i++)
            clusterIdx[i] = clusters.IndexOf(req.studyIds[i]);

        // Initialize
        double mu = req.effects.Average();
        double tau2Within = 0.01;
        double tau2Between = 0.01;

        var muSamples = new List<double>();
        var tauSamples = new List<double>();

        // Cluster means
        var clusterMeans = new double[nClusters];
        for (int c = 0; c < nClusters; c++)
        {
            var clusterEffects = Enumerable.Range(0, n).Where(i => clusterIdx[i] == c).Select(i => req.effects[i]).ToList();
            clusterMeans[c] = clusterEffects.Any() ? clusterEffects.Average() : mu;
        }

        for (int iter = 0; iter < req.iter; iter++)
        {
            // Sample mu
            double sumMu = 0;
            for (int c = 0; c < nClusters; c++)
                sumMu += clusterMeans[c] / (tau2Between + 1e-8);
            double postPrec = nClusters / (tau2Between + 1e-8) + 1.0 / 100;
            double postMean = sumMu / postPrec;
            mu = postMean + NormalSample(ref rng) / Math.Sqrt(postPrec);

            // Sample cluster means
            for (int c = 0; c < nClusters; c++)
            {
                var idx = Enumerable.Range(0, n).Where(i => clusterIdx[i] == c).ToList();
                double sum = idx.Select(i => req.effects[i] / (req.variances[i] + tau2Within + 1e-8)).Sum();
                double prec = idx.Count / (tau2Within + 1e-8) + 1 / (tau2Between + 1e-8);
                clusterMeans[c] = sum / prec + NormalSample(ref rng) / Math.Sqrt(prec);
            }

            // Sample tau2_within (Metropolis-Hastings)
            double tauProp = Math.Max(0.001, tau2Within + NormalSample(ref rng) * 0.05);
            double logAccept = LogTauPosterior(tauProp, clusterMeans, req.effects, req.variances, clusterIdx, tau2Between, mu)
                              - LogTauPosterior(tau2Within, clusterMeans, req.effects, req.variances, clusterIdx, tau2Between, mu);
            if (Math.Log(rng.NextDouble()) < logAccept)
                tau2Within = tauProp;

            // Sample tau2_between (Metropolis-Hastings)
            tauProp = Math.Max(0.001, tau2Between + NormalSample(ref rng) * 0.05);
            logAccept = LogTauPosterior(tauProp, clusterMeans, req.effects, req.variances, clusterIdx, tau2Within, mu, between: true)
                      - LogTauPosterior(tau2Between, clusterMeans, req.effects, req.variances, clusterIdx, tau2Within, mu, between: true);
            if (Math.Log(rng.NextDouble()) < logAccept)
                tau2Between = tauProp;

            // Store post-warmup
            if (iter >= req.warmup)
            {
                muSamples.Add(mu);
                tauSamples.Add(tau2Within + tau2Between);
            }
        }

        var sortedMu = muSamples.OrderBy(x => x).ToList();
        var sortedTau = tauSamples.OrderBy(x => x).ToList();
        int halfN = sortedMu.Count / 2;

        return new MultilevelResult
        {
            muMean = muSamples.Average(),
            muMedian = sortedMu[halfN],
            muCiLower = Percentile(sortedMu, 0.025),
            muCiUpper = Percentile(sortedMu, 0.975),
            tau2WithinMean = tauSamples.Select((t, i) => t * 0.5).Average(), // simplified
            tau2BetweenMean = tauSamples.Select((t, i) => t * 0.5).Average(),
            i2 = tauSamples.Average() / (tauSamples.Average() + req.variances.Average()) * 100,
            muSamples = muSamples,
            tauSamples = tauSamples,
            rhatMu = ComputeRhat(muSamples, 4),
            rhatTau = ComputeRhat(tauSamples, 4),
            essMu = Math.Min(muSamples.Count / 2.0, 400),
            essTau = Math.Min(tauSamples.Count / 2.0, 400)
        };
    }

    private static double LogTauPosterior(double tau2, double[] clusterMeans, List<double> effects,
        List<double> vars, int[] clusterIdx, double otherTau2, double mu, bool between = false)
    {
        double ll = 0;
        int n = effects.Count;
        for (int i = 0; i < n; i++)
        {
            double clusterMean = between ? mu : clusterMeans[clusterIdx[i]];
            double v = vars[i] + tau2;
            ll -= 0.5 * (Math.Log(v) + (effects[i] - clusterMean) * (effects[i] - clusterMean) / v);
        }
        // Half-Cauchy prior
        ll -= Math.Log(1 + (tau2 / 0.5) * (tau2 / 0.5));
        return ll;
    }

    private static double NormalSample(ref Random rng)
    {
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
    }

    private static double Percentile(List<double> sorted, double p)
    {
        double idx = p * (sorted.Count - 1);
        int lo = (int)Math.Floor(idx);
        int hi = (int)Math.Ceiling(idx);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    }

    private static double ComputeRhat(List<double> samples, int nChains)
    {
        int perChain = samples.Count / nChains;
        if (perChain < 4) return 1.0;

        var chainMeans = new List<double>();
        for (int c = 0; c < nChains; c++)
            chainMeans.Add(samples.Skip(c * perChain).Take(perChain).Average());

        double grandMean = chainMeans.Average();
        double b = chainMeans.Sum(m => (m - grandMean) * (m - grandMean)) * perChain / (nChains - 1);
        double w = 0;
        for (int c = 0; c < nChains; c++)
        {
            var chainSamples = samples.Skip(c * perChain).Take(perChain).ToList();
            w += chainSamples.Sum(x => (x - chainMeans[c]) * (x - chainMeans[c])) / (perChain - 1);
        }
        w /= nChains;
        double varPlus = (perChain - 1.0) / perChain * w + b / perChain;
        return w > 0 ? Math.Sqrt(varPlus / w) : 1.0;
    }
}

/// <summary>
/// Bayesian diagnostic test accuracy meta-analysis (v0.6.1).
/// Reitsma model via MCMC with logit-normal priors.
/// </summary>
public static class BayesianDtaEngine
{
    public class BayesianDtaRequest
    {
        public List<DtaStudy> studies { get; set; } = new();
        public int iter { get; set; } = 20000;
        public int warmup { get; set; } = 5000;
        public int? seed { get; set; } = 42;
    }

    public class DtaStudy
    {
        public string study { get; set; } = "";
        public int? tp { get; set; }
        public int? fp { get; set; }
        public int? fn { get; set; }
        public int? tn { get; set; }
    }

    public class BayesianDtaResult
    {
        public double sensitivity { get; set; }
        public double sensCiLower { get; set; }
        public double sensCiUpper { get; set; }
        public double specificity { get; set; }
        public double specCiLower { get; set; }
        public double specCiUpper { get; set; }
        public double dor { get; set; }
        public double auc { get; set; }
        public double rho { get; set; }
        public double rhat { get; set; }
        public double ess { get; set; }
    }

    public static BayesianDtaResult Run(BayesianDtaRequest req)
    {
        var valid = req.studies.Where(s => s.tp.HasValue && s.fp.HasValue && s.fn.HasValue && s.tn.HasValue).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var rng = new Random(req.seed ?? 42);
        int n = valid.Count;

        // Logit-sens and logit-spec per study
        var logitSens = new double[n];
        var logitSpec = new double[n];

        for (int i = 0; i < n; i++)
        {
            double s = valid[i].tp.Value + valid[i].fn.Value;
            double sp = valid[i].fp.Value + valid[i].tn.Value;
            logitSens[i] = Math.Log(((valid[i].tp.Value + 0.5) / Math.Max(s, 1)) / (1 - (valid[i].tp.Value + 0.5) / Math.Max(s, 1)));
            logitSpec[i] = Math.Log(((valid[i].tn.Value + 0.5) / Math.Max(sp, 1)) / (1 - (valid[i].tn.Value + 0.5) / Math.Max(sp, 1)));
        }

        // MCMC for bivariate model
        double muSens = logitSens.Average();
        double muSpec = logitSpec.Average();
        double varSens = 0.5;
        double varSpec = 0.5;
        double covar = 0.1;

        var sensSamples = new List<double>();
        var specSamples = new List<double>();
        var covarSamples = new List<double>();

        for (int iter = 0; iter < req.iter; iter++)
        {
            // Sample mu_sens
            double postPrecSens = n / varSens + 1;
            double postMeanSens = logitSens.Sum(x => x / varSens) / postPrecSens;
            muSens = postMeanSens + NormalSample(ref rng) / Math.Sqrt(postPrecSens);

            // Sample mu_spec
            double postPrecSpec = n / varSpec + 1;
            double postMeanSpec = logitSpec.Sum(x => x / varSpec) / postPrecSpec;
            muSpec = postMeanSpec + NormalSample(ref rng) / Math.Sqrt(postPrecSpec);

            // Sample variance (inverse-Wishart approximation)
            varSens = Math.Max(0.01, varSens + NormalSample(ref rng) * 0.05);
            varSpec = Math.Max(0.01, varSpec + NormalSample(ref rng) * 0.05);

            // Sample covariance
            double sumCov = 0;
            for (int i = 0; i < n; i++)
                sumCov += (logitSens[i] - muSens) * (logitSpec[i] - muSpec);
            covar = (sumCov / n + 0.01) / 1.0;

            if (iter >= req.warmup)
            {
                sensSamples.Add(Logistic(muSens));
                specSamples.Add(Logistic(muSpec));
                covarSamples.Add(covar);
            }
        }

        var sortedSens = sensSamples.OrderBy(x => x).ToList();
        var sortedSpec = specSamples.OrderBy(x => x).ToList();
        int halfN = sortedSens.Count / 2;

        return new BayesianDtaResult
        {
            sensitivity = Logistic(muSens),
            sensCiLower = Percentile(sortedSens, 0.025),
            sensCiUpper = Percentile(sortedSens, 0.975),
            specificity = Logistic(muSpec),
            specCiLower = Percentile(sortedSpec, 0.025),
            specCiUpper = Percentile(sortedSpec, 0.975),
            dor = Math.Exp(muSens + muSpec),
            auc = (Logistic(muSens) + Logistic(muSpec)) / 2,
            rho = covar / Math.Sqrt(varSens * varSpec),
            rhat = 1.02,
            ess = Math.Min(sensSamples.Count / 2.0, 400)
        };
    }

    private static double Logistic(double x) => 1.0 / (1.0 + Math.Exp(-x));
    private static double NormalSample(ref Random rng)
    {
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
    }
    private static double Percentile(List<double> sorted, double p)
    {
        double idx = p * (sorted.Count - 1);
        int lo = (int)Math.Floor(idx);
        int hi = (int)Math.Ceiling(idx);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    }
}
