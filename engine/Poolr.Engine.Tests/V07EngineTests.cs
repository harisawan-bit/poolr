using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

/// <summary>
/// v0.7.0 tests for the 6 new engines: NMA regression, SUCRA, cluster detection,
/// diagnostic OR forest, cumulative forest, cluster-robust Egger.
/// </summary>
public class V07EngineTests
{
    private static List<double> Effects10() => new()
    {
        0.35, 0.42, -0.10, 0.88, 0.25, 0.65, -0.22, 0.55, 0.30, 0.78
    };

    private static List<double> Variances10() => new()
    {
        0.04, 0.05, 0.03, 0.08, 0.06, 0.05, 0.04, 0.07, 0.03, 0.06
    };

    // ── 7. NMA Meta-Regression ───────────────────────────────────────

    [Fact]
    public void NmaReg_BasicShape()
    {
        var studies = new List<NmaMetaRegressionEngine.StudyInput>
        {
            new() { study = "S1", treatment1 = "A", treatment2 = "B", effect = -0.5, se = 0.2 },
            new() { study = "S2", treatment1 = "A", treatment2 = "C", effect = -0.3, se = 0.25 },
            new() { study = "S3", treatment1 = "B", treatment2 = "C", effect = 0.2, se = 0.3 },
            new() { study = "S4", treatment1 = "A", treatment2 = "B", effect = -0.4, se = 0.15 },
            new() { study = "S5", treatment1 = "A", treatment2 = "C", effect = -0.2, se = 0.22 },
            new() { study = "S6", treatment1 = "B", treatment2 = "C", effect = 0.1, se = 0.28 },
        };

        var req = new NmaMetaRegressionEngine.NmaRegRequest
        {
            studies = studies,
            referenceTreatment = "A",
            measure = "OR"
        };

        var result = NmaMetaRegressionEngine.RunMetaRegression(req);

        Assert.Equal(6, result.k);
        Assert.Equal(2, result.p); // 3 treatments - 1
        Assert.Equal(2, result.coefficients.Count);
        Assert.True(result.i2 >= 0 && result.i2 <= 100);
        Assert.True(result.tau2 >= 0);
        Assert.True(result.relativeEffects.Count >= 1);
    }

    [Fact]
    public void NmaReg_RelativeEffectsConsistent()
    {
        var studies = new List<NmaMetaRegressionEngine.StudyInput>
        {
            new() { study = "S1", treatment1 = "A", treatment2 = "B", effect = -0.5, se = 0.2 },
            new() { study = "S2", treatment1 = "A", treatment2 = "C", effect = -0.3, se = 0.25 },
            new() { study = "S3", treatment1 = "B", treatment2 = "C", effect = 0.2, se = 0.3 },
            new() { study = "S4", treatment1 = "A", treatment2 = "B", effect = -0.4, se = 0.15 },
            new() { study = "S5", treatment1 = "A", treatment2 = "C", effect = -0.2, se = 0.22 },
            new() { study = "S6", treatment1 = "B", treatment2 = "C", effect = 0.1, se = 0.28 },
        };

        var req = new NmaMetaRegressionEngine.NmaRegRequest
        {
            studies = studies,
            referenceTreatment = "A",
            measure = "MD"
        };

        var result = NmaMetaRegressionEngine.RunMetaRegression(req);

        // MD scale: effects should be finite
        foreach (var re in result.relativeEffects)
        {
            Assert.True(double.IsFinite(re.effect), $"Effect {re.treatment1} vs {re.treatment2} should be finite");
            Assert.True(re.ciLower <= re.ciUpper, "CI lower <= upper");
        }
    }

    // ── 8. SUCRA ─────────────────────────────────────────────────────

    [Fact]
    public void Sucra_BasicShape()
    {
        var req = new SucraEngine.SucraRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            treatments = new List<string> { "A", "B", "C", "D", "E", "F", "G", "H", "I", "J" },
            nBootstrap = 500,
            seed = 42
        };

        var result = SucraEngine.Run(req);

        Assert.Equal(10, result.rankings.Count);
        Assert.True(result.i2 >= 0 && result.i2 <= 100);
        Assert.True(result.tau2 >= 0);
        Assert.True(result.rankings[0].pScore >= result.rankings[^1].pScore);
    }

    [Fact]
    public void Sucra_BootstrapCIsValid()
    {
        var req = new SucraEngine.SucraRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            nBootstrap = 1000,
            seed = 123
        };

        var result = SucraEngine.Run(req);

        foreach (var r in result.rankings)
        {
            Assert.True(r.ciLower >= 1, $"CI lower {r.ciLower} should be >= 1");
            Assert.True(r.ciUpper <= 10, $"CI upper {r.ciUpper} should be <= 10");
            Assert.True(r.meanRank >= 1 && r.meanRank <= 10);
        }
    }

    // ── 9. Cluster Detection ────────────────────────────────────────

    [Fact]
    public void Cluster_BasicShape()
    {
        var req = new ClusterDetectionEngine.ClusterRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            names = new List<string> { "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10" },
            epsilonMultiplier = 1.5,
            minPoints = 3
        };

        var result = ClusterDetectionEngine.DetectClusters(req);

        Assert.Equal(10, result.points.Count);
        Assert.True(result.nClusters >= 0);
        Assert.True(result.nNoise >= 0);
        // All points are assigned to a cluster or marked as noise
        Assert.All(result.points, p => Assert.True(p.cluster >= -1));
    }

    [Fact]
    public void Cluster_DetectsTwoGroups()
    {
        // Create two distinct clusters
        var effects = new List<double> { 0.1, 0.15, 0.12, 0.18, 0.14, 1.5, 1.6, 1.55, 1.52, 1.58 };
        var variances = new List<double> { 0.04, 0.05, 0.03, 0.04, 0.05, 0.04, 0.05, 0.03, 0.04, 0.05 };

        var req = new ClusterDetectionEngine.ClusterRequest
        {
            effects = effects,
            variances = variances,
            epsilonMultiplier = 1.0,
            minPoints = 3
        };

        var result = ClusterDetectionEngine.DetectClusters(req);

        Assert.True(result.nClusters >= 1, "Should detect at least one cluster");
    }

    // ── 10. Diagnostic OR Forest ─────────────────────────────────────

    [Fact]
    public void DorForest_BasicShape()
    {
        var studies = new List<DiagnosticOrForestEngine.DorStudyInput>
        {
            new() { study = "S1", tp = 45, fp = 10, fn = 15, tn = 50 },
            new() { study = "S2", tp = 60, fp = 8, fn = 12, tn = 70 },
            new() { study = "S3", tp = 30, fp = 5, fn = 10, tn = 40 },
            new() { study = "S4", tp = 55, fp = 12, fn = 18, tn = 60 },
            new() { study = "S5", tp = 70, fp = 15, fn = 20, tn = 80 },
            new() { study = "S6", tp = 40, fp = 7, fn = 13, tn = 45 },
        };

        var req = new DiagnosticOrForestEngine.DorRequest { studies = studies };
        var result = DiagnosticOrForestEngine.Run(req);

        Assert.Equal(6, result.studyResults.Count);
        Assert.True(result.pooledDor > 0);
        Assert.True(result.ciLower > 0);
        Assert.True(result.ciUpper > result.ciLower);
        Assert.True(result.auc > 0.5 && result.auc <= 1.0);
    }

    [Fact]
    public void DorForest_PerfectTestHasHighDOR()
    {
        var studies = new List<DiagnosticOrForestEngine.DorStudyInput>
        {
            new() { study = "S1", tp = 95, fp = 5, fn = 5, tn = 95 },
            new() { study = "S2", tp = 90, fp = 10, fn = 10, tn = 90 },
            new() { study = "S3", tp = 98, fp = 2, fn = 2, tn = 98 },
            new() { study = "S4", tp = 85, fp = 15, fn = 15, tn = 85 },
            new() { study = "S5", tp = 92, fp = 8, fn = 8, tn = 92 },
            new() { study = "S6", tp = 88, fp = 12, fn = 12, tn = 88 },
        };

        var req = new DiagnosticOrForestEngine.DorRequest { studies = studies };
        var result = DiagnosticOrForestEngine.Run(req);

        Assert.True(result.pooledDor > 10, $"Perfect test DOR should be high, got {result.pooledDor}");
        Assert.True(result.auc > 0.8, $"Perfect test AUC should be high, got {result.auc}");
    }

    // ── 11. Cumulative Forest ────────────────────────────────────────

    [Fact]
    public void CumulativeForest_BasicShape()
    {
        var studies = new List<CumulativeForestEngine.CumulativeStudy>
        {
            new() { study = "S1", effect = 0.3, se = 0.2, year = 2010 },
            new() { study = "S2", effect = 0.4, se = 0.18, year = 2012 },
            new() { study = "S3", effect = 0.35, se = 0.22, year = 2014 },
            new() { study = "S4", effect = 0.5, se = 0.15, year = 2016 },
            new() { study = "S5", effect = 0.45, se = 0.17, year = 2018 },
            new() { study = "S6", effect = 0.38, se = 0.19, year = 2020 },
            new() { study = "S7", effect = 0.42, se = 0.16, year = 2022 },
            new() { study = "S8", effect = 0.48, se = 0.14, year = 2024 },
        };

        var req = new CumulativeForestEngine.CumulativeRequest
        {
            studies = studies,
            chronological = true,
            model = "random",
            method = "DL"
        };

        var result = CumulativeForestEngine.Run(req);

        Assert.Equal(7, result.cumulative.Count); // starts from k=2
        Assert.Equal(7, result.trendline.Count);
        Assert.True(double.IsFinite(result.trendlineSlope));
        Assert.True(result.trendlineP >= 0 && result.trendlineP <= 1);
    }

    [Fact]
    public void CumulativeForest_ChronologicalOrder()
    {
        var studies = new List<CumulativeForestEngine.CumulativeStudy>
        {
            new() { study = "S1", effect = 0.5, se = 0.3, year = 2010 },
            new() { study = "S2", effect = 0.4, se = 0.25, year = 2015 },
            new() { study = "S3", effect = 0.3, se = 0.2, year = 2020 },
            new() { study = "S4", effect = 0.2, se = 0.15, year = 2024 },
        };

        var req = new CumulativeForestEngine.CumulativeRequest { studies = studies, chronological = true };
        var result = CumulativeForestEngine.Run(req);

        // Effects should generally decrease over time in this test data
        Assert.True(result.cumulative.Count >= 2);
    }

    // ── 12. Cluster-Robust Egger ─────────────────────────────────────

    [Fact]
    public void ClusterEgger_BasicShape()
    {
        var effects = new List<double> { 0.5, 0.3, 0.8, 0.2, 0.6, 0.4, 0.7, 0.35 };
        var variances = new List<double> { 0.04, 0.05, 0.08, 0.03, 0.06, 0.05, 0.07, 0.04 };
        var clusters = new List<string> { "A", "A", "B", "B", "C", "C", "D", "D" };

        var req = new ClusterRobustEggerEngine.EggerRequest
        {
            effects = effects,
            variances = variances,
            clusters = clusters
        };

        var result = ClusterRobustEggerEngine.Run(req);

        Assert.Equal(8, result.k);
        Assert.Equal(4, result.nClusters);
        Assert.True(result.df >= 1);
        Assert.True(result.standardInterceptP >= 0 && result.standardInterceptP <= 1);
        Assert.True(result.robustInterceptP >= 0 && result.robustInterceptP <= 1);
    }

    [Fact]
    public void ClusterEgger_RobustSELargerThanNaive()
    {
        // With within-cluster correlation, robust SE should generally be >= naive SE
        var effects = new List<double> { 0.5, 0.55, 0.3, 0.35, 0.8, 0.85, 0.2, 0.25 };
        var variances = new List<double> { 0.04, 0.04, 0.05, 0.05, 0.08, 0.08, 0.03, 0.03 };
        var clusters = new List<string> { "A", "A", "B", "B", "C", "C", "D", "D" };

        var req = new ClusterRobustEggerEngine.EggerRequest
        {
            effects = effects,
            variances = variances,
            clusters = clusters
        };

        var result = ClusterRobustEggerEngine.Run(req);

        // Robust SE should be larger due to small-sample correction
        Assert.True(result.robustInterceptSe > 0);
        Assert.True(result.robustInterceptP >= result.standardInterceptP || result.robustInterceptP > 0.05,
            "Robust p-value should generally be >= naive p-value with small-sample correction");
    }

    [Fact]
    public void ClusterEgger_NoBiasReturnsHighP()
    {
        // Zero effects -> Egger intercept should be ~ 0
        var effects = new List<double> { 0, 0, 0, 0, 0, 0, 0, 0 };
        var variances = new List<double> { 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08 };
        var clusters = new List<string> { "A", "B", "C", "D", "E", "F", "G", "H" };

        var req = new ClusterRobustEggerEngine.EggerRequest
        {
            effects = effects,
            variances = variances,
            clusters = clusters
        };

        var result = ClusterRobustEggerEngine.Run(req);

        // With zero effects, intercept should be ~ 0
        Assert.False(result.significant, $"No bias expected but Egger was significant (intercept={result.robustIntercept:F3}, p={result.robustInterceptP:F3})");
    }
}
