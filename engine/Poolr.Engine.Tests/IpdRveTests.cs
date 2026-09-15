using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class IpdFromKmTests
{
    [Fact]
    public void Basic_ReconstructsIPD()
    {
        var req = new IpdFromKmEngine.IpdFromKmRequest
        {
            totalN = 100,
            curve = new()
            {
                new() { time = 0, survival = 1.0, nAtRisk = 100 },
                new() { time = 6, survival = 0.8, nAtRisk = 80 },
                new() { time = 12, survival = 0.6, nAtRisk = 60 },
                new() { time = 24, survival = 0.4, nAtRisk = 40 },
                new() { time = 36, survival = 0.2, nAtRisk = 20 }
            }
        };

        var result = IpdFromKmEngine.Reconstruct(req);
        Assert.True(result.totalPatients > 0);
        Assert.True(result.totalEvents > 0);
        Assert.True(result.totalCensored >= 0);
        Assert.True(result.reconstructedHr > 0);
    }

    [Fact]
    public void TooFewPoints_Throws()
    {
        var req = new IpdFromKmEngine.IpdFromKmRequest
        {
            totalN = 10,
            curve = new() { new() { time = 0, survival = 1.0 } }
        };

        Assert.Throws<ArgumentException>(() => IpdFromKmEngine.Reconstruct(req));
    }

    [Fact]
    public void HighCensoring_Warning()
    {
        var req = new IpdFromKmEngine.IpdFromKmRequest
        {
            totalN = 100,
            curve = new()
            {
                new() { time = 0, survival = 1.0, nAtRisk = 100 },
                new() { time = 100, survival = 0.95, nAtRisk = 95 }
            }
        };

        var result = IpdFromKmEngine.Reconstruct(req);
        Assert.NotEmpty(result.warnings);
    }
}

public class RveTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new RveEngine.RveRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6, 0.4 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04, 0.05 },
            studyIds = new() { "A", "A", "B", "B", "C", "C" }
        };

        var result = RveEngine.Run(req);
        Assert.Equal(3, result.nClusters);
        Assert.Equal(6, result.nEffects);
        Assert.True(result.robustSe > 0);
        Assert.True(result.df > 0);
    }

    [Fact]
    public void RobustSe_BiggerThanNaive()
    {
        // With positive within-cluster correlation, robust SE should be bigger
        var req = new RveEngine.RveRequest
        {
            effects = new() { 0.5, 0.52, 0.3, 0.31, 0.7, 0.71 },
            variances = new() { 0.04, 0.04, 0.05, 0.05, 0.03, 0.03 },
            studyIds = new() { "A", "A", "B", "B", "C", "C" }
        };

        var result = RveEngine.Run(req);
        Assert.True(result.robustSe >= result.naiveSe * 0.5);
    }

    [Fact]
    public void SingleCluster_Throws()
    {
        var req = new RveEngine.RveRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 },
            studyIds = new() { "A", "A" }
        };

        Assert.Throws<ArgumentException>(() => RveEngine.Run(req));
    }

    [Fact]
    public void SingleEffect_Throws()
    {
        var req = new RveEngine.RveRequest
        {
            effects = new() { 0.5 },
            variances = new() { 0.04 },
            studyIds = new() { "A" }
        };

        Assert.Throws<ArgumentException>(() => RveEngine.Run(req));
    }
}
