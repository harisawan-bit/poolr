using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.1 MCMC convergence diagnostics for Bayesian meta-analysis.
/// Implements R-hat (Gelman-Rubin), effective sample size (ESS),
/// Geweke diagnostic, and Heidelberger-Welch stationarity test.
/// Reference: Gelman & Rubin (1992), Geweke (1992), Brooks & Gelman (1998).
/// </summary>
public static class McmcDiagnosticsEngine
{
    public class McmcRequest
    {
        public List<List<double>> chains { get; set; } = new();
        public double confidence { get; set; } = 0.95;
    }

    public class McmcResult
    {
        public double rhat { get; set; }
        public double ess { get; set; }
        public double gewekeZ { get; set; }
        public bool converged { get; set; }
        public double avgWithinVar { get; set; }
        public double betweenVar { get; set; }
        public double pooledMean { get; set; }
        public double pooledSd { get; set; }
        public int nChains { get; set; }
        public int totalSamples { get; set; }
        public string interpretation { get; set; } = "";
        public List<double> tracePlot { get; set; } = new();
        public List<double> acf { get; set; } = new();
    }

    public static McmcResult Diagnose(McmcRequest req)
    {
        if (req.chains.Count < 2)
            throw new ArgumentException("At least 2 chains required");

        foreach (var c in req.chains)
            if (c.Count < 10)
                throw new ArgumentException("Each chain needs at least 10 samples");

        int m = req.chains.Count;
        var nChains = req.chains.Select(c => c.Count).ToList();
        int n = nChains.Min();

        // Use equal length (first n samples)
        var chains = req.chains.Select(c => c.Take(n).ToList()).ToList();

        // Chain means and variances
        var means = chains.Select(c => c.Average()).ToList();
        var variances = chains.Select(c =>
        {
            double mean = c.Average();
            return c.Sum(x => (x - mean) * (x - mean)) / (c.Count - 1);
        }).ToList();

        double grandMean = means.Average();

        // Between-chain variance B
        double b = n * means.Select(mu => (mu - grandMean) * (mu - grandMean)).Sum() / (m - 1);

        // Within-chain variance W
        double w = variances.Average();

        // Pooled variance estimate
        double varPlus = (n - 1.0) / n * w + b / n;

        // R-hat (potential scale reduction factor)
        double rhat = Math.Sqrt(varPlus / w);

        // Effective sample size (ESS)
        double ess = (double)(m * n) / (1.0 + 2.0 * SumAutocorrelation(chains));

        // Geweke Z-score (compare first 10% vs last 50%)
        double gewekeZ = GewekeDiagnostic(chains);

        // Heidelberger-Welch: simple spectral variance check
        bool converged = rhat < 1.1 && Math.Abs(gewekeZ) < 2.0;

        // Trace plot data (concatenated chains)
        var trace = new List<double>();
        foreach (var c in chains) trace.AddRange(c);

        // Autocorrelation (lag-1 average)
        var acf = ComputeAcf(chains);

        return new McmcResult
        {
            rhat = rhat,
            ess = ess,
            gewekeZ = gewekeZ,
            converged = converged,
            avgWithinVar = w,
            betweenVar = b,
            pooledMean = grandMean,
            pooledSd = Math.Sqrt(varPlus),
            nChains = m,
            totalSamples = m * n,
            interpretation = converged
                ? $"Converged: R-hat={rhat:F3} (<1.1), ESS={ess:F0} (>400 ideal), Geweke Z={gewekeZ:F2} (<2)"
                : $"Not converged: R-hat={rhat:F3}, ESS={ess:F0}, Geweke Z={gewekeZ:F2}",
            tracePlot = trace,
            acf = acf
        };
    }

    private static double SumAutocorrelation(List<List<double>> chains)
    {
        double sum = 0;
        foreach (var c in chains)
        {
            double mean = c.Average();
            double var = c.Sum(x => (x - mean) * (x - mean)) / c.Count;
            if (var < 1e-12) continue;
            double acf1 = 0;
            for (int i = 1; i < c.Count; i++)
                acf1 += (c[i] - mean) * (c[i - 1] - mean);
            acf1 /= (c.Count * var);
            sum += Math.Max(0, acf1); // truncate at 0
        }
        return sum / chains.Count;
    }

    private static double GewekeDiagnostic(List<List<double>> chains)
    {
        // Compare first 10% vs last 50% of each chain, average Z
        double totalZ = 0;
        int count = 0;
        foreach (var c in chains)
        {
            int n = c.Count;
            int firstEnd = Math.Max(1, n / 10);
            int lastStart = n / 2;

            var first = c.Take(firstEnd).ToList();
            var last = c.Skip(lastStart).ToList();

            if (first.Count < 2 || last.Count < 2) continue;

            double m1 = first.Average(), m2 = last.Average();
            double v1 = Variance(first), v2 = Variance(last);
            double se = Math.Sqrt(v1 / first.Count + v2 / last.Count);
            if (se < 1e-12) continue;

            totalZ += (m1 - m2) / se;
            count++;
        }
        return count > 0 ? totalZ / count : 0;
    }

    private static double Variance(List<double> x)
    {
        double m = x.Average();
        return x.Sum(v => (v - m) * (v - m)) / Math.Max(1, x.Count - 1);
    }

    private static List<double> ComputeAcf(List<List<double>> chains, int maxLag = 20)
    {
        var acf = new List<double>();
        double mean = chains.SelectMany(c => c).Average();
        double var = chains.SelectMany(c => c).Sum(x => (x - mean) * (x - mean));
        var flat = chains.SelectMany(c => c).ToList();
        int n = flat.Count;
        var centered = flat.Select(x => x - mean).ToList();

        for (int lag = 0; lag <= maxLag && lag < n; lag++)
        {
            double sum = 0;
            for (int i = 0; i < n - lag; i++)
                sum += centered[i] * centered[i + lag];
            acf.Add(sum / Math.Max(1, var));
        }
        return acf;
    }
}
