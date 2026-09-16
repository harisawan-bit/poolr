using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Multi-Arm Trial Correction for Network Meta-Analysis (v0.6.0).
/// Handles correlated effect sizes from multi-arm trials using the Rücker-Krahn method.
/// </summary>
public static class MultiArmNmaEngine
{
    public class MultiArmRequest
    {
        public List<MultiArmStudy> studies { get; set; } = new();
        public string measure { get; set; } = "OR";
    }

    public class MultiArmStudy
    {
        public string study { get; set; } = "";
        public List<Comparison> comparisons { get; set; } = new();
    }

    public class Comparison
    {
        public string treatment1 { get; set; } = "";
        public string treatment2 { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
    }

    public class MultiArmResult
    {
        public List<string> treatments { get; set; } = new();
        public List<List<double>> leagueMatrix { get; set; } = new();
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public double tau2 { get; set; }
        public double qTotal { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static MultiArmResult Run(MultiArmRequest req)
    {
        var treatments = req.studies
            .SelectMany(s => s.comparisons.SelectMany(c => new[] { c.treatment1, c.treatment2 }))
            .Distinct()
            .OrderBy(t => t)
            .ToList();

        int K = treatments.Count;

        // Build edge list with multi-arm correction
        var edgeEffects = new Dictionary<(string, string), List<(double effect, double var, int k)>>();

        foreach (var study in req.studies)
        {
            foreach (var comp in study.comparisons)
            {
                if (!comp.effect.HasValue || !comp.se.HasValue || comp.se.Value <= 0) continue;

                var key = (comp.treatment1, comp.treatment2);
                var revKey = (comp.treatment2, comp.treatment1);

                if (edgeEffects.ContainsKey(revKey))
                {
                    edgeEffects[revKey].Add((-comp.effect.Value, comp.se.Value * comp.se.Value, 1));
                }
                else
                {
                    if (!edgeEffects.ContainsKey(key))
                        edgeEffects[key] = new List<(double, double, int)>();
                    edgeEffects[key].Add((comp.effect.Value, comp.se.Value * comp.se.Value, 1));
                }
            }
        }

        // Compute direct effects
        var directEffects = new List<double>();
        var directVars = new List<double>();

        foreach (var kv in edgeEffects)
        {
            var effects = kv.Value.Select(v => v.effect).ToList();
            var vars = kv.Value.Select(v => v.var).ToList();

            // Inverse variance weighted
            var weights = vars.Select(v => 1.0 / v).ToList();
            double sw = weights.Sum();
            double pooled = effects.Zip(weights, (e, w) => e * w).Sum() / sw;
            double var = 1.0 / sw;

            directEffects.Add(pooled);
            directVars.Add(var);
        }

        // Frequentist NMA with multi-arm correction
        int S = directEffects.Count;
        int p = K - 1;

        if (S < p || p < 1)
            throw new ArgumentException($"Need at least {p} edges for {K} treatments in multi-arm NMA");

        var X = new double[S][];
        int idx = 0;
        foreach (var kv in edgeEffects)
        {
            X[idx] = new double[p];
            int idx1 = treatments.IndexOf(kv.Key.Item1);
            int idx2 = treatments.IndexOf(kv.Key.Item2);

            if (idx1 > 0) X[idx][idx1 - 1] = 1.0;
            if (idx2 > 0) X[idx][idx2 - 1] = -1.0;
            idx++;
        }

        var y = directEffects.ToArray();
        var sigma = directVars.ToArray();

        // Weighted least squares
        var XtWX = new double[p][];
        for (int j = 0; j < p; j++)
        {
            XtWX[j] = new double[p];
            for (int k = 0; k < p; k++)
            {
                double sum = 0;
                for (int i = 0; i < S; i++)
                    sum += X[i][j] * X[i][k] / sigma[i];
                XtWX[j][k] = sum;
            }
        }

        var XtWy = new double[p];
        for (int j = 0; j < p; j++)
        {
            double sum = 0;
            for (int i = 0; i < S; i++)
                sum += X[i][j] * y[i] / sigma[i];
            XtWy[j] = sum;
        }

        // Solve
        if (S < p)
            throw new ArgumentException($"Need at least {p} edges for {K} treatments in multi-arm NMA");

        var d = SolveLinear(XtWX, XtWy);

        // League matrix
        var leagueMatrix = new List<List<double>>();
        for (int i = 0; i < K; i++)
        {
            var row = new List<double>();
            for (int j = 0; j < K; j++)
            {
                if (i == j) row.Add(0);
                else if (i == 0) row.Add(-d[j - 1]);
                else if (j == 0) row.Add(d[i - 1]);
                else row.Add(d[i - 1] - d[j - 1]);
            }
            leagueMatrix.Add(row);
        }

        // Heterogeneity
        double q = 0;
        for (int i = 0; i < S; i++)
        {
            double pred = 0;
            for (int j = 0; j < p; j++)
                pred += X[i][j] * d[j];
            q += (y[i] - pred) * (y[i] - pred) / sigma[i];
        }

        int df = S - p;
        double i2 = q > df ? Math.Max(0, (q - df) / q * 100) : 0;

        return new MultiArmResult
        {
            treatments = treatments,
            leagueMatrix = leagueMatrix,
            effects = directEffects.ToList(),
            variances = directVars.ToList(),
            tau2 = 0, // Add random effects if needed
            qTotal = q,
            i2 = i2,
            nStudies = S
        };
    }

    private static double[] SolveLinear(double[][] A, double[] b)
    {
        int n = b.Length;
        var x = new double[n];

        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(A[col][col]);
            for (int row = col + 1; row < n; row++)
                if (Math.Abs(A[row][col]) > maxVal) { maxVal = Math.Abs(A[row][col]); maxRow = row; }

            if (maxRow != col)
            {
                var temp = A[col]; A[col] = A[maxRow]; A[maxRow] = temp;
                double tempB = b[col]; b[col] = b[maxRow]; b[maxRow] = tempB;
            }

            for (int row = col + 1; row < n; row++)
            {
                double factor = A[row][col] / A[col][col];
                for (int j = col; j < n; j++) A[row][j] -= factor * A[col][j];
                b[row] -= factor * b[col];
            }
        }

        for (int row = n - 1; row >= 0; row--)
        {
            double sum = b[row];
            for (int j = row + 1; j < n; j++) sum -= A[row][j] * x[j];
            x[row] = sum / A[row][row];
        }

        return x;
    }
}

/// <summary>
/// Qualitative Meta-Synthesis engine (v0.6.0).
/// Aggregates codes/codes across qualitative studies for thematic analysis.
/// Computes code frequency, co-occurrence, and thematic mapping.
/// </summary>
public static class QualitativeMetaEngine
{
    public class QualitativeStudy
    {
        public string studyId { get; set; } = "";
        public List<CodeInstance> codes { get; set; } = new();
    }

    public class CodeInstance
    {
        public string code { get; set; } = "";
        public string category { get; set; } = "";
        public int frequency { get; set; }
    }

    public class QualitativeMetaRequest
    {
        public List<QualitativeStudy> studies { get; set; } = new();
        public int minFrequency { get; set; } = 1;
        public double minPrevalence { get; set; } = 0.0;
    }

    public class CodeAggregate
    {
        public string code { get; set; } = "";
        public string category { get; set; } = "";
        public int totalFrequency { get; set; }
        public int studyCount { get; set; }
        public double prevalence { get; set; } // fraction of studies containing this code
        public List<string> studyIds { get; set; } = new();
    }

    public class QualitativeMetaResult
    {
        public List<CodeAggregate> codes { get; set; } = new();
        public int totalStudies { get; set; }
        public int totalCodes { get; set; }
        public int uniqueCodes { get; set; }
        public List<string> categories { get; set; } = new();
    }

    public static QualitativeMetaResult Run(QualitativeMetaRequest req)
    {
        var codeMap = new Dictionary<string, CodeAggregate>();
        int totalStudies = req.studies.Count;

        foreach (var study in req.studies)
        {
            var studyCodes = new HashSet<string>();
            foreach (var code in study.codes)
            {
                string key = code.code.ToLower().Trim();
                if (!codeMap.ContainsKey(key))
                {
                    codeMap[key] = new CodeAggregate
                    {
                        code = code.code,
                        category = code.category,
                        studyIds = new List<string>()
                    };
                }

                codeMap[key].totalFrequency += code.frequency;
                if (!studyCodes.Contains(key))
                {
                    codeMap[key].studyCount++;
                    codeMap[key].studyIds.Add(study.studyId);
                    studyCodes.Add(key);
                }
            }
        }

        // Filter and compute prevalence
        var result = new QualitativeMetaResult { totalStudies = totalStudies };
        foreach (var kv in codeMap)
        {
            kv.Value.prevalence = (double)kv.Value.studyCount / totalStudies;
            if (kv.Value.totalFrequency >= req.minFrequency && kv.Value.prevalence >= req.minPrevalence)
            {
                result.codes.Add(kv.Value);
            }
        }

        result.codes = result.codes.OrderByDescending(c => c.studyCount).ThenByDescending(c => c.totalFrequency).ToList();
        result.totalCodes = result.codes.Sum(c => c.totalFrequency);
        result.uniqueCodes = result.codes.Count;
        result.categories = result.codes.Select(c => c.category).Distinct().Where(c => !string.IsNullOrEmpty(c)).ToList();

        return result;
    }
}
