using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class BmmaTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new BayesianModelAveragingEngine.BmmaRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6, 0.4 },
            standardErrors = new() { 0.1, 0.12, 0.08, 0.15, 0.1, 0.11 },
            nIter = 1000,
            nWarmup = 200,
            seed = 42
        };

        var result = BayesianModelAveragingEngine.Run(req);
        Assert.True(double.IsFinite(result.pooledEffect));
        Assert.True(result.models.Count > 0);
        Assert.True(result.publicationBiasProbability >= 0);
    }

    [Fact]
    public void Models_HavePosteriorProbabilities()
    {
        var req = new BayesianModelAveragingEngine.BmmaRequest
        {
            effects = new() { 0.5, 0.3, 0.7 },
            standardErrors = new() { 0.1, 0.12, 0.08 },
            nIter = 500,
            nWarmup = 100,
            seed = 42
        };

        var result = BayesianModelAveragingEngine.Run(req);
        double totalProb = result.models.Sum(m => m.posteriorProbability);
        Assert.InRange(totalProb, 0.99, 1.01);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new BayesianModelAveragingEngine.BmmaRequest
        {
            effects = new() { 0.5 },
            standardErrors = new() { 0.1 }
        };

        Assert.Throws<ArgumentException>(() => BayesianModelAveragingEngine.Run(req));
    }
}

public class PhyloTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new PhylogeneticMaEngine.PhyloRequest
        {
            studies = new()
            {
                new() { species = "A", effect = 0.5, se = 0.1 },
                new() { species = "B", effect = 0.3, se = 0.12 },
                new() { species = "C", effect = 0.7, se = 0.08 }
            }
        };

        var result = PhylogeneticMaEngine.Run(req);
        Assert.True(double.IsFinite(result.pooledEffect));
        Assert.InRange(result.phylogeneticSignal, 0, 1);
    }

    [Fact]
    public void WithPhyloMatrix_UsesCorrelation()
    {
        var req = new PhylogeneticMaEngine.PhyloRequest
        {
            studies = new()
            {
                new() { species = "A", effect = 0.5, se = 0.1 },
                new() { species = "B", effect = 0.3, se = 0.12 },
                new() { species = "C", effect = 0.7, se = 0.08 }
            },
            phylogeneticMatrix = new()
            {
                new() { 1.0, 0.8, 0.3 },
                new() { 0.8, 1.0, 0.2 },
                new() { 0.3, 0.2, 1.0 }
            }
        };

        var result = PhylogeneticMaEngine.Run(req);
        Assert.True(result.tau2 >= 0);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new PhylogeneticMaEngine.PhyloRequest
        {
            studies = new()
            {
                new() { species = "A", effect = 0.5, se = 0.1 },
                new() { species = "B", effect = 0.3, se = 0.12 }
            }
        };

        Assert.Throws<ArgumentException>(() => PhylogeneticMaEngine.Run(req));
    }
}
