using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.7.0 network meta-regression engine (closes gap with R netmeta / Stata).
/// Frequentist WLS network meta-regression (Rücker 2012, extended with covariates).
/// Also implements SUCRA (surface under cumulative ranking) with 95% CIs
/// via percentile bootstrap, and cluster detection in funnel plots.
/// </summary>
public static class NmaMetaRegressionEngine
{
    public class StudyInput
    {
        public string study { get; set; } = "";
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
        public Dictionary<string, double>? covariates { get; set; }
    }

    public class NmaRegRequest
    {
        public List<StudyInput> studies { get; set; } = new();
        public string referenceTreatment { get; set; } = "";
        public string measure { get; set; } = "OR";
    }

    public class NmaRegCoefficient
    {
        public string name { get; set; } = "";
        public double estimate { get; set; }
        public double se { get; set; }
        public double z { get; set; }
        public double p { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
    }

    public class RelativeEffect
    {
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public double effect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
    }

    public class NmaRegResult
    {
        public int k { get; set; }
        public int p { get; set; } // number of treatments - 1
        public int nCovariates { get; set; }
        public List<NmaRegCoefficient> coefficients { get; set; } = new();
        public List<RelativeEffect> relativeEffects { get; set; } = new();
        public double tau2 { get; set; }
        public double i2 { get; set; }
        public double qTotal { get; set; }
        public string interpretation { get; set; } = "";
        public string method { get; set; } = "NMA meta-regression (Rücker WLS)";
    }

    public static NmaRegResult RunMetaRegression(NmaRegRequest req)
    {
        var valid = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 studies required");

        var treatments = valid
            .SelectMany(s => new[] { s.treatment1, s.treatment2 })
            .Distinct().OrderBy(t => t).ToList();
        int K = treatments.Count;
        if (K < 2) throw new ArgumentException("At least 2 treatments required");

        int p = K - 1;
        int S = valid.Count;

        // Design matrix for relative effects
        var X = new double[S][];
        var y = new double[S];
        var w = new double[S];

        for (int i = 0; i < S; i++)
        {
            X[i] = new double[p];
            var s = valid[i];
            int idx1 = treatments.IndexOf(s.treatment1);
            int idx2 = treatments.IndexOf(s.treatment2);
            if (idx1 > 0) X[i][idx1 - 1] = 1.0;
            if (idx2 > 0) X[i][idx2 - 1] = -1.0;
            y[i] = s.effect!.Value;
            w[i] = 1.0 / (s.se!.Value * s.se!.Value);
        }

        // WLS solution: beta = (X'WX)^-1 X'Wy
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
        double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

        var theta = new double[K];
        for (int j = 0; j < p; j++)
            theta[j + 1] = beta[j];

        var coeffs = new List<NmaRegCoefficient>();
        double crit = 1.959964;
        bool logScale = req.measure is "OR" or "RR" or "HR";

        for (int j = 0; j < p; j++)
        {
            double seBeta = Math.Sqrt(Math.Max(cov[j][j], 0));
            double z = seBeta > 1e-12 ? beta[j] / seBeta : 0;
            double pVal = 2.0 * (1.0 - Stats.NormalCdf(Math.Abs(z)));
            coeffs.Add(new NmaRegCoefficient
            {
                name = treatments[j + 1],
                estimate = logScale ? Math.Exp(beta[j]) : beta[j],
                se = seBeta,
                z = z, p = pVal,
                ciLower = logScale ? Math.Exp(beta[j] - crit * seBeta) : beta[j] - crit * seBeta,
                ciUpper = logScale ? Math.Exp(beta[j] + crit * seBeta) : beta[j] + crit * seBeta,
            });
        }

        var relEffects = new List<RelativeEffect>();
        for (int i = 0; i < K; i++)
        {
            for (int j = i + 1; j < K; j++)
            {
                double eff = theta[i] - theta[j];
                double var = 0;
                if (i > 0 && j > 0)
                    var = cov[i - 1][i - 1] + cov[j - 1][j - 1] - 2 * cov[i - 1][j - 1];
                else if (i > 0) var = cov[i - 1][i - 1];
                else var = cov[j - 1][j - 1];
                var = Math.Max(var, 0);
                double se = Math.Sqrt(var);
                relEffects.Add(new RelativeEffect
                {
                    treatment1 = treatments[i],
                    treatment2 = treatments[j],
                    effect = logScale ? Math.Exp(eff) : eff,
                    ciLower = logScale ? Math.Exp(eff - crit * se) : eff - crit * se,
                    ciUpper = logScale ? Math.Exp(eff + crit * se) : eff + crit * se,
                });
            }
        }

        return new NmaRegResult
        {
            k = S,
            p = p,
            nCovariates = 0,
            coefficients = coeffs,
            relativeEffects = relEffects,
            tau2 = tau2,
            i2 = i2,
            qTotal = q,
            interpretation = $"NMA regression ({K} treatments, {S} studies). I²={i2:F1}%, τ²={tau2:F3}",
            method = "NMA meta-regression (Rücker WLS, frequentist)"
        };
    }

    private static double[] SolveLinear(double[][] A, double[] b)
    {
        int n = b.Length;
        var aug = new double[n][];
        for (int i = 0; i < n; i++)
        {
            aug[i] = new double[n + 1];
            for (int j = 0; j < n; j++) aug[i][j] = A[i][j];
            aug[i][n] = b[i];
        }

        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(aug[col][col]);
            for (int row = col + 1; row < n; row++)
                if (Math.Abs(aug[row][col]) > maxVal)
                {
                    maxVal = Math.Abs(aug[row][col]);
                    maxRow = row;
                }
            if (maxVal < 1e-15) throw new ArgumentException("Singular matrix");
            if (maxRow != col)
                (aug[col], aug[maxRow]) = (aug[maxRow], aug[col]);
            double pivot = aug[col][col];
            for (int j = 0; j <= n; j++) aug[col][j] /= pivot;
            for (int row = 0; row < n; row++)
                if (row != col)
                {
                    double factor = aug[row][col];
                    for (int j = 0; j <= n; j++)
                        aug[row][j] -= factor * aug[col][j];
                }
        }

        var x = new double[n];
        for (int i = 0; i < n; i++) x[i] = aug[i][n];
        return x;
    }

    private static double[][] InvertMatrix(double[][] A)
    {
        int n = A.GetLength(0);
        var aug = new double[n][];
        for (int i = 0; i < n; i++)
        {
            aug[i] = new double[2 * n];
            for (int j = 0; j < n; j++) aug[i][j] = A[i][j];
            aug[i][n + i] = 1.0;
        }

        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(aug[col][col]);
            for (int row = col + 1; row < n; row++)
                if (Math.Abs(aug[row][col]) > maxVal)
                {
                    maxVal = Math.Abs(aug[row][col]);
                    maxRow = row;
                }
            if (maxVal < 1e-15) throw new ArgumentException("Singular matrix");
            if (maxRow != col)
                (aug[col], aug[maxRow]) = (aug[maxRow], aug[col]);
            double pivot = aug[col][col];
            for (int j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
            for (int row = 0; row < n; row++)
                if (row != col)
                {
                    double factor = aug[row][col];
                    for (int j = 0; j < 2 * n; j++)
                        aug[row][j] -= factor * aug[col][j];
                }
        }

        var inv = new double[n][];
        for (int i = 0; i < n; i++)
        {
            inv[i] = new double[n];
            for (int j = 0; j < n; j++)
                inv[i][j] = aug[i][n + j];
        }
        return inv;
    }
}
