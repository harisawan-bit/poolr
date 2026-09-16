using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class ProfileLikelihoodTests
{
    [Fact]
    public void Basic_ComputesCI()
    {
        var req = new ProfileLikelihoodEngine.PlRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04 }
        };

        var result = ProfileLikelihoodEngine.Compute(req);
        Assert.True(result.tau2Estimate >= 0);
        Assert.True(result.ciLower >= 0);
        Assert.True(result.ciUpper > result.ciLower);
        Assert.True(result.tau2Grid.Count == req.gridPoints);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new ProfileLikelihoodEngine.PlRequest
        {
            effects = new() { 0.5 },
            variances = new() { 0.04 }
        };
        Assert.Throws<ArgumentException>(() => ProfileLikelihoodEngine.Compute(req));
    }
}

public class BayesianDtaTests
{
    [Fact]
    public void Basic_PoolsSensSpec()
    {
        var req = new BayesianDtaEngine.BayesianDtaRequest
        {
            studies = new()
            {
                new() { tp = 45, fp = 10, fn = 5, tn = 40 },
                new() { tp = 50, fp = 15, fn = 8, tn = 35 },
                new() { tp = 40, fp = 12, fn = 6, tn = 38 }
            },
            iter = 1000, warmup = 200
        };

        var result = BayesianDtaEngine.Run(req);
        Assert.InRange(result.sensitivity, 0.5, 1.0);
        Assert.InRange(result.specificity, 0.5, 1.0);
        Assert.InRange(result.rho, -1, 1);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new BayesianDtaEngine.BayesianDtaRequest
        {
            studies = new() { new() { tp = 45, fp = 10, fn = 5, tn = 40 } }
        };
        Assert.Throws<ArgumentException>(() => BayesianDtaEngine.Run(req));
    }
}

public class NetworkGraphTests
{
    [Fact]
    public void Basic_GeneratesSVG()
    {
        var req = new NetworkGraphEngine.GraphRequest
        {
            edges = new()
            {
                new() { treatment1 = "A", treatment2 = "B", nStudies = 5 },
                new() { treatment1 = "B", treatment2 = "C", nStudies = 3 },
                new() { treatment1 = "A", treatment2 = "C", nStudies = 2 }
            }
        };

        var result = NetworkGraphEngine.Generate(req);
        Assert.Contains("<svg", result.svg);
        Assert.Equal(3, result.nNodes);
        Assert.Equal(3, result.nEdges);
    }

    [Fact]
    public void EmptyInput_ReturnsEmpty()
    {
        var req = new NetworkGraphEngine.GraphRequest { edges = new() };
        var result = NetworkGraphEngine.Generate(req);
        Assert.Equal(0, result.nNodes);
    }
}

public class BayesianMultilevelTests
{
    [Fact]
    public void Basic_Pools()
    {
        var req = new BayesianMultilevelEngine.MultilevelRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6, 0.4 },
            variances = new() { 0.04, 0.05, 0.03, 0.06, 0.04, 0.05 },
            studyIds = new() { "A", "A", "B", "B", "C", "C" },
            iter = 1000, warmup = 200
        };

        var result = BayesianMultilevelEngine.Run(req);
        Assert.InRange(result.muMean, -1, 2);
        Assert.True(result.tau2WithinMean >= 0);
        Assert.True(result.tau2BetweenMean >= 0);
    }

    [Fact]
    public void SingleCluster_Throws()
    {
        var req = new BayesianMultilevelEngine.MultilevelRequest
        {
            effects = new() { 0.5, 0.3 },
            variances = new() { 0.04, 0.05 },
            studyIds = new() { "A", "A" }
        };
        Assert.Throws<ArgumentException>(() => BayesianMultilevelEngine.Run(req));
    }
}
