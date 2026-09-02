using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class MultilevelTests
{
    private static MultilevelEngine.MultilevelStudy S(string study, string effectId, double eff, double se)
        => new() { study = study, effectId = effectId, effect = eff, se = se };

    [Fact]
    public void ThreeLevel_Basic()
    {
        var studies = new List<MultilevelEngine.MultilevelStudy>
        {
            S("A", "1", 0.5, 0.2),
            S("A", "2", 0.3, 0.18),
            S("B", "1", 0.4, 0.22),
            S("B", "2", 0.2, 0.15),
            S("C", "1", 0.6, 0.25),
        };
        var req = new MultilevelEngine.MultilevelRequest { studies = studies, method = "threeLevel" };
        var result = MultilevelEngine.Run(req);

        Assert.Equal(3, result.nStudies);
        Assert.Equal(5, result.nEffects);
        Assert.InRange(result.pooledEffect, 0, 1);
        Assert.True(result.ciLower < result.pooledEffect);
        Assert.True(result.ciUpper > result.pooledEffect);
        Assert.True(result.tau2Within >= 0);
        Assert.True(result.tau2Between >= 0);
    }

    [Fact]
    public void ThreeLevel_I2Decomposition()
    {
        var studies = new List<MultilevelEngine.MultilevelStudy>
        {
            S("A", "1", 0.5, 0.1),
            S("A", "2", 0.48, 0.12),
            S("B", "1", 0.3, 0.15),
            S("B", "2", 0.28, 0.13),
        };
        var req = new MultilevelEngine.MultilevelRequest { studies = studies, method = "threeLevel" };
        var result = MultilevelEngine.Run(req);

        double i2Sum = result.i2Level1 + result.i2Level2 + result.i2Level3;
        Assert.InRange(i2Sum, 99, 101);
    }

    [Fact]
    public void Rve_ClusterRobust()
    {
        var studies = new List<MultilevelEngine.MultilevelStudy>
        {
            S("A", "1", 0.5, 0.2),
            S("A", "2", 0.3, 0.18),
            S("B", "1", 0.4, 0.22),
            S("B", "2", 0.2, 0.15),
            S("C", "1", 0.6, 0.25),
            S("C", "2", 0.35, 0.2),
        };
        var req = new MultilevelEngine.MultilevelRequest { studies = studies, method = "rve", assumedRho = 0.5 };
        var result = MultilevelEngine.Run(req);

        Assert.Equal("RVE (cluster-robust)", result.method);
        Assert.Equal(3, result.nStudies);
        Assert.NotNull(result.rveDf);
        Assert.NotNull(result.rveAdjustedSe);
        Assert.True(result.rveAdjustedSe > 0);
    }

    [Fact]
    public void Multivariate_Basic()
    {
        var studies = new List<MultilevelEngine.MultilevelStudy>
        {
            S("A", "1", 0.5, 0.2),
            S("B", "1", 0.3, 0.18),
            S("C", "1", 0.4, 0.22),
        };
        var req = new MultilevelEngine.MultilevelRequest { studies = studies, method = "multivariate" };
        var result = MultilevelEngine.Run(req);

        Assert.Equal("Multivariate (Gleser-Olkin)", result.method);
        Assert.NotEmpty(result.warnings);
    }

    [Fact]
    public void ThreeLevel_ThrowsOnSingleStudy()
    {
        var studies = new List<MultilevelEngine.MultilevelStudy>
        {
            S("A", "1", 0.5, 0.2),
        };
        var req = new MultilevelEngine.MultilevelRequest { studies = studies, method = "threeLevel" };
        Assert.Throws<ArgumentException>(() => MultilevelEngine.Run(req));
    }
}
