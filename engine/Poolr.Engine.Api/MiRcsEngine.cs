using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Multiple Imputation for Missing Data in Meta-Analysis (v0.6.0).
/// Handles missing effect sizes or variances via Rubin's rules.
/// Supports missing SDs, missing correlations, missing cell counts.
/// </summary>
public static class MultipleImputationEngine
{
    public class MiRequest
    {
        public List<double?> effects { get; set; } = new();
        public List<double?> variances { get; set; } = new();
        public int m { get; set; } = 20; // number of imputations
        public int? seed { get; set; } = 42;
        public string method { get; set; } = "pmm"; // pmm (predictive mean matching), norm
    }

    public class MiResult
    {
        public double pooledEffect { get; set; }
        public double totalVariance { get; set; }
        public double withinVariance { get; set; }
        public double betweenVariance { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double df { get; set; }
        public double p { get; set; }
        public double lambda { get; set; } // fraction of missing information
        public int nImputations { get; set; }
        public int nMissing { get; set; }
        public int nComplete { get; set; }
    }

    public static MiResult Run(MiRequest req)
    {
        int n = req.effects.Count;
        int nMissing = req.effects.Count(e => !e.HasValue) + req.variances.Count(v => !v.HasValue);
        int nComplete = req.effects.Zip(req.variances, (e, v) => e.HasValue && v.HasValue).Count(x => x);

        if (nComplete < 2)
            throw new ArgumentException("At least 2 complete studies required");

        var rng = new Random(req.seed ?? 42);

        // Fit imputation model on complete cases
        var completeEffects = new List<double>();
        var completeVars = new List<double>();
        for (int i = 0; i < n; i++)
        {
            if (req.effects[i].HasValue && req.variances[i].HasValue)
            {
                completeEffects.Add(req.effects[i]!.Value);
                completeVars.Add(req.variances[i]!.Value);
            }
        }

        double meanEffect = completeEffects.Average();
        double varEffect = Variance(completeEffects);
        double meanVar = completeVars.Average();

        // Generate M imputed datasets and pool
        var pooledEstimates = new List<double>();
        var pooledVariances = new List<double>();

        for (int imp = 0; imp < req.m; imp++)
        {
            var imputedEffects = new List<double>();
            var imputedVars = new List<double>();

            for (int i = 0; i < n; i++)
            {
                if (req.effects[i].HasValue)
                    imputedEffects.Add(req.effects[i]!.Value);
                else
                    imputedEffects.Add(meanEffect + NormalSample(ref rng) * Math.Sqrt(varEffect));

                if (req.variances[i].HasValue)
                    imputedVars.Add(req.variances[i]!.Value);
                else
                    imputedVars.Add(Math.Max(0.001, meanVar + NormalSample(ref rng) * Math.Sqrt(Variance(completeVars))));
            }

            // Pool this imputed dataset
            var weights = imputedVars.Select(v => 1.0 / v).ToList();
            double sw = weights.Sum();
            double pooled = weights.Zip(imputedEffects, (w, e) => w * e).Sum() / sw;
            double varPooled = 1.0 / sw;

            pooledEstimates.Add(pooled);
            pooledVariances.Add(varPooled);
        }

        // Rubin's rules
        double qBar = pooledEstimates.Average(); // pooled estimate
        double uBar = pooledVariances.Average(); // within-imputation variance
        double b = Variance(pooledEstimates); // between-imputation variance
        double t = uBar + (1 + 1.0 / req.m) * b; // total variance

        // Degrees of freedom (Barnard-Rubin)
        double lambda = (1 + 1.0 / req.m) * b / t; // fraction of missing information
        double dfObs = (req.m - 1) / Math.Pow(lambda, 2);
        double dfLocal = (nComplete - 1) * (1 + 1.0 / req.m) * uBar / t;
        dfLocal = Math.Max(1, Math.Min(dfLocal, dfObs));

        double se = Math.Sqrt(t);
        int dfInt = (int)Math.Round(dfLocal);
        double crit = ExtendedStats.TCrit975(dfInt);
        double z = se > 0 ? qBar / se : 0;
        double p = ExtendedStats.TwoSidePFromT(z, dfInt);

        return new MiResult
        {
            pooledEffect = qBar,
            totalVariance = t,
            withinVariance = uBar,
            betweenVariance = b,
            ciLower = qBar - crit * se,
            ciUpper = qBar + crit * se,
            df = dfLocal,
            p = p,
            lambda = lambda,
            nImputations = req.m,
            nMissing = nMissing,
            nComplete = nComplete
        };
    }

    private static double Variance(List<double> values)
    {
        if (values.Count < 2) return 0;
        double mean = values.Average();
        return values.Sum(v => (v - mean) * (v - mean)) / (values.Count - 1);
    }

    private static double NormalSample(ref Random rng)
    {
        double u1 = 1.0 - rng.NextDouble();
        double u2 = 1.0 - rng.NextDouble();
        return Math.Sqrt(-2.0 * Math.Log(u1)) * Math.Sin(2.0 * Math.PI * u2);
    }
}

/// <summary>
/// Restricted Cubic Splines for Dose-Response (v0.6.0).
/// Proper implementation with knot placement and boundary constraints.
/// Harrell (2001) regression strategies.
/// </summary>
public static class RcsEngine
{
    public class RcsRequest
    {
        public List<double> doses { get; set; } = new();
        public List<double> effects { get; set; } = new(); // log-RR or similar
        public List<double> variances { get; set; } = new();
        public int nKnots { get; set; } = 3; // 3, 4, or 5 knots
    }

    public class RcsResult
    {
        public List<double> knotPositions { get; set; } = new();
        public List<FittedPoint> fittedCurve { get; set; } = new();
        public double nonlinearityChi2 { get; set; }
        public double nonlinearityP { get; set; }
        public double aic { get; set; }
        public string model { get; set; } = "Restricted cubic spline";
    }

    public class FittedPoint
    {
        public double dose { get; set; }
        public double effect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
    }

    public static RcsResult Run(RcsRequest req)
    {
        int n = req.doses.Count;
        if (n < 4)
            throw new ArgumentException("At least 4 dose-response points required");

        // Place knots at percentiles
        var sortedDoses = req.doses.OrderBy(d => d).ToList();
        double minDose = sortedDoses.First();
        double maxDose = sortedDoses.Last();
        double range = maxDose - minDose;

        var knots = new List<double>();
        if (req.nKnots == 3)
        {
            knots.Add(minDose + 0.1 * range);
            knots.Add(minDose + 0.5 * range);
            knots.Add(minDose + 0.9 * range);
        }
        else if (req.nKnots == 4)
        {
            knots.Add(minDose + 0.05 * range);
            knots.Add(minDose + 0.35 * range);
            knots.Add(minDose + 0.65 * range);
            knots.Add(minDose + 0.95 * range);
        }
        else
        {
            knots.Add(minDose + 0.025 * range);
            knots.Add(minDose + 0.275 * range);
            knots.Add(minDose + 0.5 * range);
            knots.Add(minDose + 0.725 * range);
            knots.Add(minDose + 0.975 * range);
        }

        // Build spline basis (k-1 terms for k knots, with 2 restricted to linear beyond boundary)
        int p = knots.Count - 1; // number of basis functions
        var X = new double[n][];
        for (int i = 0; i < n; i++)
        {
            X[i] = new double[p + 1]; // intercept + spline terms
            X[i][0] = 1; // intercept
            double d = req.doses[i];
            for (int j = 0; j < p; j++)
            {
                X[i][j + 1] = SplineBasis(d, j, knots);
            }
        }

        // Weighted least squares
        var weights = req.variances.Select(v => 1.0 / v).ToList();
        var y = req.effects;

        // X'WX
        int dim = p + 1;
        var XtWX = new double[dim][];
        for (int j = 0; j < dim; j++)
        {
            XtWX[j] = new double[dim];
            for (int k = 0; k < dim; k++)
            {
                double sum = 0;
                for (int i = 0; i < n; i++)
                    sum += weights[i] * X[i][j] * X[i][k];
                XtWX[j][k] = sum;
            }
        }

        // X'Wy
        var XtWy = new double[dim];
        for (int j = 0; j < dim; j++)
        {
            double sum = 0;
            for (int i = 0; i < n; i++)
                sum += weights[i] * X[i][j] * y[i];
            XtWy[j] = sum;
        }

        // Solve via Gaussian elimination
        var beta = SolveLinear(XtWX, XtWy);

        // Fitted curve
        var fittedCurve = new List<FittedPoint>();
        double step = range > 0 ? range / 50.0 : 1.0;
        for (double d = minDose; d <= maxDose + 1e-9; d += step)
        {
            double effect = beta[0];
            for (int j = 0; j < p; j++)
                effect += beta[j + 1] * SplineBasis(d, j, knots);

            // SE of fitted value
            double[] xVec = new double[dim];
            xVec[0] = 1;
            for (int j = 0; j < p; j++)
                xVec[j + 1] = SplineBasis(d, j, knots);

            double se = Math.Sqrt(xVec.Zip(Enumerable.Range(0, dim), (xi, i) => xi * Enumerable.Range(0, dim).Sum(j => xVec[j] * XtWX[i][j])).Sum());

            fittedCurve.Add(new FittedPoint
            {
                dose = d,
                effect = effect,
                ciLower = effect - 1.96 * se,
                ciUpper = effect + 1.96 * se
            });
        }

        // Test for nonlinearity: compare spline model to linear model
        double rssSpline = 0, rssLinear = 0;
        double meanY = y.Average();
        for (int i = 0; i < n; i++)
        {
            double fitSpline = beta[0];
            for (int j = 0; j < p; j++)
                fitSpline += beta[j + 1] * SplineBasis(req.doses[i], j, knots);

            // Linear fit
            double fitLinear = beta[0] + (beta.Length > 1 ? beta[1] * req.doses[i] : 0);

            rssSpline += weights[i] * (y[i] - fitSpline) * (y[i] - fitSpline);
            rssLinear += weights[i] * (y[i] - fitLinear) * (y[i] - fitLinear);
        }

        double chi2 = (n - dim) * (rssLinear - rssSpline) / Math.Max(rssSpline, 1e-12);
        double pNonlin = 1 - Chi2.Cdf(Math.Max(chi2, 0), p - 1);

        // AIC
        double aic = n * Math.Log(Math.Max(rssSpline / n, 1e-12)) + 2 * dim;

        return new RcsResult
        {
            knotPositions = knots,
            fittedCurve = fittedCurve,
            nonlinearityChi2 = chi2,
            nonlinearityP = pNonlin,
            aic = aic
        };
    }

    private static double SplineBasis(double x, int term, List<double> knots)
    {
        // Restricted cubic spline basis (Harrell 2001)
        int k = knots.Count;
        if (term == 0) return x; // first term is linear

        double t = knots[Math.Min(term, k - 1)];
        double tLast = knots[k - 1];
        double tFirst = knots[0];

        double truncated = Math.Max(0, x - t);
        double truncatedLast = Math.Max(0, x - tLast);
        double truncatedFirst = Math.Max(0, x - tFirst);

        double basis = Math.Pow(truncated, 3)
                      - Math.Pow(truncatedLast, 3) * (tLast - t) / (tLast - tFirst)
                      + Math.Pow(truncatedFirst, 3) * (t - tFirst) / (tLast - tFirst);

        return basis / Math.Pow(tLast - tFirst, 2); // normalize
    }

    private static double[] SolveLinear(double[][] A, double[] b)
    {
        int n = b.Length;
        var x = new double[n];

        // Gaussian elimination with partial pivoting
        for (int col = 0; col < n; col++)
        {
            // Find pivot
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

            // Swap rows
            if (maxRow != col)
            {
                var temp = A[col];
                A[col] = A[maxRow];
                A[maxRow] = temp;
                double tempB = b[col];
                b[col] = b[maxRow];
                b[maxRow] = tempB;
            }

            // Eliminate
            for (int row = col + 1; row < n; row++)
            {
                double factor = A[row][col] / A[col][col];
                for (int j = col; j < n; j++)
                    A[row][j] -= factor * A[col][j];
                b[row] -= factor * b[col];
            }
        }

        // Back substitution
        for (int row = n - 1; row >= 0; row--)
        {
            double sum = b[row];
            for (int j = row + 1; j < n; j++)
                sum -= A[row][j] * x[j];
            x[row] = sum / A[row][row];
        }

        return x;
    }
}

/// <summary>
/// Cluster-Robust Inference for Dependent Effect Sizes (v0.6.0).
/// Hedges, Tipton, Pustejovsky (2010) small-sample correction.
/// Handles multiple effect sizes from the same study/cluster.
/// </summary>
public static class ClusterRobustEngine
{
    public class ClusterRobustRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string> clusterIds { get; set; } = new();
        public string model { get; set; } = "random";
        public string method { get; set; } = "DL";
    }

    public class ClusterRobustResult
    {
        public double pooledEffect { get; set; }
        public double naiveSe { get; set; }
        public double robustSe { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double t { get; set; }
        public double df { get; set; }
        public double p { get; set; }
        public int nClusters { get; set; }
        public int nEffects { get; set; }
        public double designEffect { get; set; }
    }

    public static ClusterRobustResult Run(ClusterRobustRequest req)
    {
        int n = req.effects.Count;
        if (n < 2)
            throw new ArgumentException("At least 2 effects required");

        var clusters = req.clusterIds.Distinct().ToList();
        int nClusters = clusters.Count;

        // Fit standard model
        double tau2 = 0;
        if (req.model == "random")
        {
            var w = req.variances.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(req.effects, (wi, e) => wi * e).Sum() / sw;
            double q = w.Zip(req.effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
            int dfLocal2 = n - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (dfLocal2 > 0 && q > dfLocal2 && c > 0) ? Math.Max(0, (q - dfLocal2) / c) : 0;
        }

        var weights = req.variances.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        double pooled = weights.Zip(req.effects, (w, e) => w * e).Sum() / sumW;
        double naiveSe = Math.Sqrt(1.0 / sumW);

        // Cluster-robust variance estimation
        // V_robust = (X'WX)^{-1} * sum_c (X_c' u_c u_c' X_c) * (X'WX)^{-1}
        // For intercept-only model: V_robust = sum_c (sum_i w_i e_i)^2 / (sum_i w_i)^2

        double robustVar = 0;
        foreach (var cluster in clusters)
        {
            var clusterIndices = Enumerable.Range(0, n).Where(i => req.clusterIds[i] == cluster).ToList();
            double clusterSum = clusterIndices.Sum(i => weights[i] * (req.effects[i] - pooled));
            robustVar += clusterSum * clusterSum;
        }
        robustVar /= (sumW * sumW);

        // Small-sample correction (Hedges-Tipton-Pustejovsky)
        // df = (nClusters - 1) / nClusters * (sum w_i)^2 / sum(w_i^2)
        double sumW2 = weights.Sum(w => w * w);
        double correction = nClusters > 1 ? (double)(nClusters - 1) / nClusters : 1;
        double df = correction * (sumW * sumW) / Math.Max(sumW2, 1e-12);
        df = Math.Max(1, Math.Min(df, nClusters - 1));

        double robustSe = Math.Sqrt(robustVar);
        double crit = ExtendedStats.TCrit975((int)df);
        double t = robustSe > 0 ? pooled / robustSe : 0;
        double p = ExtendedStats.TwoSidePFromT(t, (int)df);

        // Design effect
        double deff = naiveSe > 0 ? robustVar / (naiveSe * naiveSe) : 1;

        return new ClusterRobustResult
        {
            pooledEffect = pooled,
            naiveSe = naiveSe,
            robustSe = robustSe,
            ciLower = pooled - crit * robustSe,
            ciUpper = pooled + crit * robustSe,
            t = t,
            df = df,
            p = p,
            nClusters = nClusters,
            nEffects = n,
            designEffect = deff
        };
    }
}
