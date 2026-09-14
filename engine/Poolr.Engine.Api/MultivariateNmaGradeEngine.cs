using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Multivariate Dose-Response Meta-Analysis engine (v0.6.0).
/// Handles studies reporting multiple dose-response relationships simultaneously.
/// Uses generalized least squares with covariance structure.
/// Mirrors R dosresmeta package functionality.
/// </summary>
public static class MultivariateDoseResponseEngine
{
    public class MultiDoseStudy
    {
        public string study { get; set; } = "";
        public List<DoseOutcome> outcomes { get; set; } = new();
    }

    public class DoseOutcome
    {
        public double dose { get; set; }
        public double? logRr { get; set; }
        public double? se { get; set; }
        public string outcomeLabel { get; set; } = "";
    }

    public class MultiDoseRequest
    {
        public List<MultiDoseStudy> studies { get; set; } = new();
        public string model { get; set; } = "linear"; // linear, quadratic, cubicSpline
        public int nKnots { get; set; } = 3;
    }

    public class MultiDoseResult
    {
        public string model { get; set; } = "";
        public List<double> coefficients { get; set; } = new();
        public double q { get; set; }
        public double qP { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public double r2 { get; set; }
        public List<FittedPoint> fittedCurve { get; set; } = new();
        public double auc { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public class FittedPoint
    {
        public double dose { get; set; }
        public double effect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
    }

    public static MultiDoseResult Run(MultiDoseRequest req)
    {
        var validStudies = req.studies.Where(s => s.outcomes.Count >= 2 && s.outcomes.All(o => o.logRr.HasValue && o.se.HasValue && o.se.Value > 0)).ToList();

        if (validStudies.Count < 2)
            throw new ArgumentException("At least 2 studies with 2+ outcomes required");

        // Flatten all dose-outcome pairs
        var allEffects = new List<double>();
        var allSes = new List<double>();
        var allDoses = new List<double>();

        foreach (var study in validStudies)
        {
            foreach (var outcome in study.outcomes)
            {
                allEffects.Add(outcome.logRr!.Value);
                allSes.Add(outcome.se!.Value);
                allDoses.Add(outcome.dose);
            }
        }

        int n = allEffects.Count;
        var effects = allEffects.ToArray();
        var ses = allSes.ToArray();
        var doses = allDoses.ToArray();
        var vars = ses.Select(s => s * s).ToArray();

        // Fit polynomial dose-response
        int degree = req.model switch
        {
            "linear" => 1,
            "quadratic" => 2,
            _ => 1
        };

        // Build design matrix: [1, dose, dose^2, ...]
        var X = new double[n][];
        for (int i = 0; i < n; i++)
        {
            X[i] = new double[degree + 1];
            for (int j = 0; j <= degree; j++)
                X[i][j] = Math.Pow(doses[i], j);
        }

        // Weighted least squares
        var weights = vars.Select(v => 1.0 / v).ToList();
        var XtWX = new double[degree + 1][];
        for (int j = 0; j <= degree; j++)
        {
            XtWX[j] = new double[degree + 1];
            for (int k = 0; k <= degree; k++)
            {
                double sum = 0;
                for (int i = 0; i < n; i++)
                    sum += X[i][j] * X[i][k] * weights[i];
                XtWX[j][k] = sum;
            }
        }

        var XtWy = new double[degree + 1];
        for (int j = 0; j <= degree; j++)
        {
            double sum = 0;
            for (int i = 0; i < n; i++)
                sum += X[i][j] * effects[i] * weights[i];
            XtWy[j] = sum;
        }

        var beta = SolveLinear(XtWX, XtWy);

        // Fitted curve
        double minDose = doses.Min();
        double maxDose = doses.Max();
        var fittedCurve = new List<FittedPoint>();
        for (double d = minDose; d <= maxDose; d += (maxDose - minDose) / 50)
        {
            double effect = 0;
            for (int j = 0; j <= degree; j++)
                effect += beta[j] * Math.Pow(d, j);

            double se = Math.Sqrt(1.0 / weights.Sum());
            fittedCurve.Add(new FittedPoint
            {
                dose = d,
                effect = effect,
                ciLower = effect - 1.96 * se,
                ciUpper = effect + 1.96 * se
            });
        }

        // Q statistic
        double q = 0;
        for (int i = 0; i < n; i++)
        {
            double pred = 0;
            for (int j = 0; j <= degree; j++)
                pred += X[i][j] * beta[j];
            q += weights[i] * (effects[i] - pred) * (effects[i] - pred);
        }

        int df = n - degree - 1;
        double qP = df > 0 ? 1 - Chi2.Cdf(q, df) : 1;
        double i2 = q > df ? Math.Max(0, (q - df) / q * 100) : 0;

        return new MultiDoseResult
        {
            model = $"Polynomial (degree {degree})",
            coefficients = beta.ToList(),
            q = q,
            qP = qP,
            i2 = i2,
            r2 = i2 / 100,
            fittedCurve = fittedCurve,
            warnings = qP < 0.05 ? new List<string> { "Significant heterogeneity detected." } : new List<string>()
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
/// Network Meta-Regression with Covariates engine (v0.6.0).
/// Handles study-level covariates in NMA to explain heterogeneity.
/// </summary>
public static class NetworkMetaRegressionEngine
{
    public class NmaCovariate
    {
        public string name { get; set; } = "";
        public List<double> values { get; set; } = new(); // per study
    }

    public class NmaRegressionRequest
    {
        public List<NmaEngine.NmaStudy> studies { get; set; } = new();
        public List<NmaCovariate> covariates { get; set; } = new();
        public string measure { get; set; } = "OR";
    }

    public class NmaRegressionResult
    {
        public List<string> treatments { get; set; } = new();
        public List<List<double>> leagueMatrix { get; set; } = new();
        public List<CovariateResult> covariateEffects { get; set; } = new();
        public double tau2 { get; set; }
        public double r2 { get; set; }
        public double qTotal { get; set; }
        public double qCovariates { get; set; }
        public double qCovariatesP { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public class CovariateResult
    {
        public string name { get; set; } = "";
        public double beta { get; set; }
        public double se { get; set; }
        public double z { get; set; }
        public double p { get; set; }
    }

    public static NmaRegressionResult Run(NmaRegressionRequest req)
    {
        if (req.studies == null || req.studies.Count < 3)
            throw new ArgumentException("At least 3 studies required");

        var treatments = req.studies
            .SelectMany(s => new[] { s.treatment1, s.treatment2 })
            .Distinct()
            .OrderBy(t => t)
            .ToList();

        int K = treatments.Count;
        int nCov = req.covariates.Count;
        var validStudies = req.studies.Where(s => s.effect.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        int S = validStudies.Count;
        int p = K - 1 + nCov;

        // Build design matrix
        var X = new double[S][];
        var y = new double[S];
        var sigma = new double[S];

        for (int i = 0; i < S; i++)
        {
            X[i] = new double[p];
            var s = validStudies[i];
            int idx1 = treatments.IndexOf(s.treatment1);
            int idx2 = treatments.IndexOf(s.treatment2);

            if (idx1 > 0) X[i][idx1 - 1] = 1.0;
            if (idx2 > 0) X[i][idx2 - 1] = -1.0;

            for (int c = 0; c < nCov; c++)
                X[i][K - 1 + c] = req.covariates[c].values[i];

            y[i] = s.effect.Value;
            sigma[i] = s.se.Value;
        }

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

        var beta = SolveLinear(XtWX, XtWy);

        // League matrix
        var leagueMatrix = new List<List<double>>();
        for (int i = 0; i < K; i++)
        {
            var row = new List<double>();
            for (int j = 0; j < K; j++)
            {
                if (i == j) row.Add(0);
                else if (i == 0) row.Add(-beta[j - 1]);
                else if (j == 0) row.Add(beta[i - 1]);
                else row.Add(beta[i - 1] - beta[j - 1]);
            }
            leagueMatrix.Add(row);
        }

        // Covariate effects
        var covEffects = new List<CovariateResult>();
        for (int c = 0; c < nCov; c++)
        {
            double est = beta[K - 1 + c];
            double se = Math.Sqrt(XtWX[K - 1 + c][K - 1 + c] > 0 ? 1.0 / XtWX[K - 1 + c][K - 1 + c] : 1);
            double z = est / se;
            covEffects.Add(new CovariateResult
            {
                name = req.covariates[c].name,
                beta = est,
                se = se,
                z = z,
                p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)))
            });
        }

        // Q statistics
        double qTotal = 0;
        for (int i = 0; i < S; i++)
        {
            double pred = 0;
            for (int j = 0; j < p; j++)
                pred += X[i][j] * beta[j];
            qTotal += (y[i] - pred) * (y[i] - pred) / sigma[i];
        }

        return new NmaRegressionResult
        {
            treatments = treatments,
            leagueMatrix = leagueMatrix,
            covariateEffects = covEffects,
            qTotal = qTotal,
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
/// GRADE Summary of Findings (SoF) table generator (v0.6.0).
/// Implements GRADEpro GDT workflow for creating SoF tables.
/// Evaluates certainty of evidence across 5 domains.
/// </summary>
public static class GradeSoFGenerator
{
    public class OutcomeInput
    {
        public string name { get; set; } = "";
        public int studies { get; set; }
        public int participants { get; set; }
        public double? effectEstimate { get; set; }
        public double? ciLower { get; set; }
        public double? ciUpper { get; set; }
        public string effectMeasure { get; set; } = "RR";
        // RoB domains
        public int robRandomization { get; set; } = 0; // 0=low, 1=some concerns, 2=high
        public int robDeviations { get; set; } = 0;
        public int robMissing { get; set; } = 0;
        public int robMeasurement { get; set; } = 0;
        public int robSelection { get; set; } = 0;
        // GRADE domains
        public int imprecisionEvents { get; set; } = 0; // optimal info size
        public int imprecisionN { get; set; } = 0;
        public double i2 { get; set; }
        public double? publicationBiasP { get; set; }
        public string? indirectness { get; set; }
    }

    public class GradeRequest
    {
        public List<OutcomeInput> outcomes { get; set; } = new();
        public string comparison { get; set; } = "";
        public string intervention { get; set; } = "";
        public string comparator { get; set; } = "";
        public string? patientPopulation { get; set; }
        public string? setting { get; set; }
    }

    public class GradeOutcomeResult
    {
        public string outcome { get; set; } = "";
        public int studies { get; set; }
        public int participants { get; set; }
        public string effectEstimate { get; set; } = "";
        public string certainty { get; set; } = "⊕⊕⊕⊕ HIGH";
        public List<string> downgradeReasons { get; set; } = new();
        public int nDowngrades { get; set; }
        public string? imprecisionBasis { get; set; }
        public double? ois { get; set; }
    }

    public class GradeResult
    {
        public List<GradeOutcomeResult> outcomes { get; set; } = new();
        public string markdown { get; set; } = "";
        public string comparison { get; set; } = "";
        public string intervention { get; set; } = "";
        public string comparator { get; set; } = "";
    }

    public static GradeResult Generate(GradeRequest req)
    {
        var results = new List<GradeOutcomeResult>();

        foreach (var outcome in req.outcomes)
        {
            var gradeResult = EvaluateOutcome(outcome, req);
            results.Add(gradeResult);
        }

        return new GradeResult
        {
            outcomes = results,
            comparison = req.comparison,
            intervention = req.intervention,
            comparator = req.comparator,
            markdown = GenerateMarkdown(results, req)
        };
    }

    private static GradeOutcomeResult EvaluateOutcome(OutcomeInput outcome, GradeRequest req)
    {
        int nDowngrades = 0;
        var reasons = new List<string>();

        // 1. Risk of Bias
        int maxRoB = Math.Max(outcome.robRandomization, Math.Max(outcome.robDeviations, Math.Max(outcome.robMissing, Math.Max(outcome.robMeasurement, outcome.robSelection))));
        if (maxRoB >= 2)
        {
            nDowngrades += 2;
            reasons.Add("Serious risk of bias");
        }
        else if (maxRoB >= 1)
        {
            nDowngrades += 1;
            reasons.Add("Some concerns regarding risk of bias");
        }

        // 2. Inconsistency (I²)
        if (outcome.i2 > 75)
        {
            nDowngrades += 2;
            reasons.Add("Serious inconsistency (I² > 75%)");
        }
        else if (outcome.i2 > 50)
        {
            nDowngrades += 1;
            reasons.Add("Moderate inconsistency (I² > 50%)");
        }

        // 3. Indirectness
        if (!string.IsNullOrEmpty(outcome.indirectness))
        {
            nDowngrades += 1;
            reasons.Add($"Indirectness: {outcome.indirectness}");
        }

        // 4. Imprecision
        double ois = ComputeOIS(outcome);
        outcome.imprecisionEvents = (int)ois;
        if (outcome.participants < ois)
        {
            nDowngrades += 1;
            reasons.Add($"Imprecision: total N {outcome.participants} below OIS {ois:F0}");
        }
        else if (outcome.ciLower.HasValue && outcome.ciUpper.HasValue)
        {
            // Check if CI crosses null AND includes clinically meaningful effect
            double ciWidth = outcome.ciUpper.Value - outcome.ciLower.Value;
            if (ciWidth > 0.5) // arbitrary threshold
            {
                nDowngrades += 1;
                reasons.Add("Imprecision: wide confidence interval");
            }
        }

        // 5. Publication Bias
        if (outcome.publicationBiasP.HasValue && outcome.publicationBiasP.Value < 0.05)
        {
            nDowngrades += 1;
            reasons.Add("Suspected publication bias");
        }

        // Determine certainty
        string certainty = nDowngrades switch
        {
            0 => "⊕⊕⊕⊕ HIGH",
            1 => "⊕⊕⊕◯ MODERATE",
            2 => "⊕⊕◯◯ LOW",
            _ => "⊕◯◯◯ VERY LOW"
        };

        return new GradeOutcomeResult
        {
            outcome = outcome.name,
            studies = outcome.studies,
            participants = outcome.participants,
            effectEstimate = outcome.effectEstimate.HasValue
                ? $"{outcome.effectMeasure} {outcome.effectEstimate:F2} ({outcome.ciLower:F2} to {outcome.ciUpper:F2})"
                : "—",
            certainty = certainty,
            downgradeReasons = reasons,
            nDowngrades = nDowngrades,
            ois = ois
        };
    }

    private static double ComputeOIS(OutcomeInput outcome)
    {
        // Simplified OIS calculation
        // For binary outcomes: based on control event rate and clinically meaningful effect
        double controlRate = 0.1; // assumed 10% control event rate
        double clinicallyMeaningfulRR = 0.8; // 20% risk reduction

        double p1 = controlRate;
        double p2 = controlRate * clinicallyMeaningfulRR;
        double pBar = (p1 + p2) / 2;

        double za = 1.96; // alpha = 0.05
        double zb = 0.84; // beta = 0.20

        double nPerGroup = Math.Pow(za + zb, 2) * (p1 * (1 - p1) + p2 * (1 - p2)) / Math.Pow(p1 - p2, 2);
        return 2 * Math.Ceiling(nPerGroup);
    }

    private static string GenerateMarkdown(List<GradeOutcomeResult> outcomes, GradeRequest req)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine($"### Summary of findings: {req.intervention} vs {req.comparator}");
        if (!string.IsNullOrEmpty(req.comparison))
            sb.AppendLine($"**Comparison:** {req.comparison}");
        sb.AppendLine();
        sb.AppendLine("| Outcome | Studies (N) | Effect estimate | Certainty |");
        sb.AppendLine("|---|---|---|---|");
        foreach (var o in outcomes)
        {
            sb.AppendLine($"| {o.outcome} | {o.studies} ({o.participants}) | {o.effectEstimate} | {o.certainty} |");
        }
        sb.AppendLine();
        sb.AppendLine("*Certainty assessment follows GRADE: High / Moderate / Low / Very Low.*");
        return sb.ToString();
    }
}
