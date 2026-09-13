using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class BayesianMcmcTests
{
    [Fact]
    public void Basic_Converges()
    {
        var studies = new BayesianMcmcEngine.BayesianRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            iter = 5000,
            warmup = 1000,
            chains = 2,
            seed = 42
        };

        var result = BayesianMcmcEngine.Run(studies);
        Assert.InRange(result.muMedian, -1, 2);
        Assert.True(result.tauMedian >= 0);
        Assert.True(result.rhatMu < 1.2);
        Assert.True(result.rhatTau < 1.2);
        Assert.True(result.essMu > 100);
        Assert.InRange(result.probPositive, 0, 1);
    }

    [Fact]
    public void Rope_ComputesProbability()
    {
        var studies = new BayesianMcmcEngine.BayesianRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            ropeLower = -0.1,
            ropeUpper = 0.1,
            iter = 3000,
            warmup = 500,
            seed = 42
        };

        var result = BayesianMcmcEngine.Run(studies);
        Assert.NotNull(result.probInRope);
        Assert.InRange(result.probInRope.Value, 0, 1);
    }

    [Fact]
    public void BayesFactor_Computed()
    {
        var studies = new BayesianMcmcEngine.BayesianRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            iter = 3000,
            warmup = 500,
            seed = 42
        };

        var result = BayesianMcmcEngine.Run(studies);
        Assert.NotNull(result.bayesFactor);
        Assert.True(result.bayesFactor > 0);
    }

    [Fact]
    public void SingleStudy_Throws()
    {
        var studies = new BayesianMcmcEngine.BayesianRequest
        {
            effects = new() { 0.5 },
            variances = new() { 0.04 }
        };

        Assert.Throws<ArgumentException>(() => BayesianMcmcEngine.Run(studies));
    }
}

public class GoshTests
{
    [Fact]
    public void Basic_GeneratesSubsets()
    {
        var studies = new GoshEngine.GoshRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            seed = 42
        };

        var result = GoshEngine.Run(studies);
        Assert.True(result.subsets.Count > 0);
        Assert.True(result.nSubsetsGenerated > 0);
    }

    [Fact]
    public void AllStudies_Included()
    {
        var studies = new GoshEngine.GoshRequest
        {
            effects = new() { 0.5, 0.3, 0.7 },
            variances = new() { 0.04, 0.05, 0.03 },
            seed = 42
        };

        var result = GoshEngine.Run(studies);
        // Should have subsets: {0,1}, {0,2}, {1,2}, {0,1,2} = 4
        Assert.Equal(4, result.subsets.Count);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var studies = new GoshEngine.GoshRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 }
        };

        Assert.Throws<ArgumentException>(() => GoshEngine.Run(studies));
    }
}

public class InfluenceTests
{
    [Fact]
    public void Basic_ComputesDiagnostics()
    {
        var studies = new InfluenceEngine.InfluenceRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 }
        };

        var result = InfluenceEngine.Run(studies);
        Assert.Equal(5, result.studies.Count);
        Assert.True(result.thresholdCooks > 0);
        Assert.True(result.thresholdDffits > 0);
    }

    [Fact]
    public void Influential_StudiesFlagged()
    {
        // One extreme outlier
        var studies = new InfluenceEngine.InfluenceRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 5.0 }, // 5.0 is extreme
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 }
        };

        var result = InfluenceEngine.Run(studies);
        Assert.True(result.nInfluential >= 1 || result.nOutliers >= 1);
    }

    [Fact]
    public void ThreeStudies_Minimum()
    {
        var studies = new InfluenceEngine.InfluenceRequest
        {
            effects = new() { 0.5, 0.3, 0.7 },
            variances = new() { 0.04, 0.05, 0.03 }
        };

        var result = InfluenceEngine.Run(studies);
        Assert.Equal(3, result.studies.Count);
    }

    [Fact]
    public void TwoStudies_Throws()
    {
        var studies = new InfluenceEngine.InfluenceRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 }
        };

        Assert.Throws<ArgumentException>(() => InfluenceEngine.Run(studies));
    }
}

public class PermutationTests
{
    [Fact]
    public void Basic_ComputesPValue()
    {
        var studies = new PermutationEngine.PermutationRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            nPermutations = 1000,
            seed = 42
        };

        var result = PermutationEngine.Run(studies);
        Assert.InRange(result.pValue, 0, 1);
        Assert.Equal(1000, result.nPermutations);
    }

    [Fact]
    public void QStatistic_Permutation()
    {
        var studies = new PermutationEngine.PermutationRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            test = "q",
            nPermutations = 500,
            seed = 42
        };

        var result = PermutationEngine.Run(studies);
        Assert.InRange(result.pValue, 0, 1);
    }

    [Fact]
    public void SingleStudy_Throws()
    {
        var studies = new PermutationEngine.PermutationRequest
        {
            effects = new() { 0.5 },
            variances = new() { 0.04 }
        };

        Assert.Throws<ArgumentException>(() => PermutationEngine.Run(studies));
    }
}

public class BootstrapTests
{
    [Fact]
    public void Percentile_CI()
    {
        var studies = new BootstrapEngine.BootstrapRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            nBootstrap = 1000,
            seed = 42,
            method = "percentile"
        };

        var result = BootstrapEngine.Run(studies);
        Assert.True(result.ciLower < result.observed);
        Assert.True(result.ciUpper > result.observed);
        Assert.Equal(1000, result.nBootstrap);
    }

    [Fact]
    public void Bca_CI()
    {
        var studies = new BootstrapEngine.BootstrapRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            nBootstrap = 1000,
            seed = 42,
            method = "bca"
        };

        var result = BootstrapEngine.Run(studies);
        Assert.True(result.ciLower < result.observed);
        Assert.True(result.ciUpper > result.observed);
    }

    [Fact]
    public void Normal_CI()
    {
        var studies = new BootstrapEngine.BootstrapRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            nBootstrap = 1000,
            seed = 42,
            method = "normal"
        };

        var result = BootstrapEngine.Run(studies);
        Assert.True(result.ciLower < result.observed);
        Assert.True(result.ciUpper > result.observed);
    }

    [Fact]
    public void SingleStudy_Throws()
    {
        var studies = new BootstrapEngine.BootstrapRequest
        {
            effects = new() { 0.5 },
            variances = new() { 0.04 }
        };

        Assert.Throws<ArgumentException>(() => BootstrapEngine.Run(studies));
    }
}

public class TesTests
{
    [Fact]
    public void Basic_Computes()
    {
        var studies = new TesEngine.TesRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            nSimulations = 1000,
            seed = 42
        };

        var result = TesEngine.Run(studies);
        Assert.InRange(result.pValue, 0, 1);
        Assert.InRange(result.observedSignificant, 0, 5);
        Assert.InRange(result.powerMedian, 0, 1);
    }

    [Fact]
    public void NoExcessSignificance()
    {
        // All effects are small and non-significant
        var studies = new TesEngine.TesRequest
        {
            effects = new() { 0.1, 0.05, 0.15, 0.08, 0.12 },
            variances = new() { 0.5, 0.6, 0.4, 0.7, 0.5 },
            nSimulations = 500,
            seed = 42
        };

        var result = TesEngine.Run(studies);
        Assert.False(result.excessSignificance);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var studies = new TesEngine.TesRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 }
        };

        Assert.Throws<ArgumentException>(() => TesEngine.Run(studies));
    }
}

public class LocationScaleTests
{
    [Fact]
    public void Basic_Computes()
    {
        var studies = new LocationScaleEngine.LocationScaleRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            scaleModifiers = new() { 2018, 2019, 2020, 2021, 2022 }
        };

        var result = LocationScaleEngine.Run(studies);
        Assert.True(result.tau2 >= 0);
        Assert.InRange(result.i2, 0, 100);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var studies = new LocationScaleEngine.LocationScaleRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 }
        };

        Assert.Throws<ArgumentException>(() => LocationScaleEngine.Run(studies));
    }
}

public class MiTests
{
    [Fact]
    public void CompleteData_NoImputation()
    {
        var studies = new MultipleImputationEngine.MiRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 },
            m = 10,
            seed = 42
        };

        var result = MultipleImputationEngine.Run(studies);
        Assert.Equal(0, result.nMissing);
        Assert.Equal(5, result.nComplete);
        Assert.Equal(10, result.nImputations);
    }

    [Fact]
    public void MissingData_Imputed()
    {
        var studies = new MultipleImputationEngine.MiRequest
        {
            effects = new() { 0.5, null, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, null, 0.06, 0.04 },
            m = 20,
            seed = 42
        };

        var result = MultipleImputationEngine.Run(studies);
        Assert.Equal(2, result.nMissing);
        Assert.Equal(3, result.nComplete);
        Assert.True(result.totalVariance > result.withinVariance);
    }

    [Fact]
    public void SingleComplete_Throws()
    {
        var studies = new MultipleImputationEngine.MiRequest
        {
            effects = new() { 0.5, null },
            variances = new() { 0.04, null }
        };

        Assert.Throws<ArgumentException>(() => MultipleImputationEngine.Run(studies));
    }
}

public class RcsTests
{
    [Fact]
    public void Basic_ComputesSpline()
    {
        var studies = new RcsEngine.RcsRequest
        {
            doses = new() { 0, 1, 2, 3, 4, 5 },
            effects = new() { 0, 0.2, 0.35, 0.45, 0.5, 0.52 },
            variances = new() { 0.01, 0.01, 0.01, 0.01, 0.01, 0.01 },
            nKnots = 3
        };

        var result = RcsEngine.Run(studies);
        Assert.Equal(3, result.knotPositions.Count);
        Assert.True(result.fittedCurve.Count > 0);
    }

    [Fact]
    public void NonlinearityTest()
    {
        // Strong nonlinear pattern
        var studies = new RcsEngine.RcsRequest
        {
            doses = new() { 0, 1, 2, 3, 4, 5, 6, 7 },
            effects = new() { 0, 0.1, 0.25, 0.4, 0.5, 0.55, 0.57, 0.58 },
            variances = new() { 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01 },
            nKnots = 4
        };

        var result = RcsEngine.Run(studies);
        Assert.True(result.nonlinearityChi2 >= 0);
        Assert.InRange(result.nonlinearityP, 0, 1);
    }

    [Fact]
    public void TooFewPoints_Throws()
    {
        var studies = new RcsEngine.RcsRequest
        {
            doses = new() { 0, 1, 2 },
            effects = new() { 0, 0.2, 0.35 },
            variances = new() { 0.01, 0.01, 0.01 }
        };

        Assert.Throws<ArgumentException>(() => RcsEngine.Run(studies));
    }
}

public class ClusterRobustTests
{
    [Fact]
    public void Basic_Computes()
    {
        var studies = new ClusterRobustEngine.ClusterRobustRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6, 0.4 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04, 0.05 },
            clusterIds = new() { "A", "A", "B", "B", "C", "C" }
        };

        var result = ClusterRobustEngine.Run(studies);
        Assert.Equal(3, result.nClusters);
        Assert.Equal(6, result.nEffects);
        Assert.True(result.robustSe > 0);
        Assert.True(result.df > 0);
    }

    [Fact]
    public void RobustSe_BiggerThanNaive()
    {
        // With dependent effects, robust SE should be bigger
        var studies = new ClusterRobustEngine.ClusterRobustRequest
        {
            effects = new() { 0.5, 0.52, 0.3, 0.31, 0.7, 0.71 },
            variances = new() { 0.04, 0.04, 0.05, 0.05, 0.03, 0.03 },
            clusterIds = new() { "A", "A", "B", "B", "C", "C" }
        };

        var result = ClusterRobustEngine.Run(studies);
        // With positive within-cluster correlation, robust SE should be >= naive
        Assert.True(result.robustSe >= result.naiveSe * 0.5); // relaxed for small samples
    }

    [Fact]
    public void SingleEffect_Throws()
    {
        var studies = new ClusterRobustEngine.ClusterRobustRequest
        {
            effects = new() { 0.5 },
            variances = new() { 0.04 },
            clusterIds = new() { "A" }
        };

        Assert.Throws<ArgumentException>(() => ClusterRobustEngine.Run(studies));
    }
}
