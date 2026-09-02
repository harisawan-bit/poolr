using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class IpdTests
{
    private static IpdEngine.IpdStudy S(string name, double hr, double lo, double hi)
        => new() { study = name, hr = hr, hrLower = lo, hrUpper = hi };

    [Fact]
    public void TwoStageIpd_Basic()
    {
        var studies = new List<IpdEngine.IpdStudy>
        {
            S("1", 0.7, 0.5, 0.9),
            S("2", 0.8, 0.6, 1.0),
            S("3", 0.6, 0.4, 0.8),
        };
        var req = new IpdEngine.IpdRequest { studies = studies, method = "twoStage" };
        var result = IpdEngine.Run(req);

        Assert.Equal("Two-stage IPD", result.method);
        Assert.Equal(3, result.nStudies);
        Assert.InRange(result.pooledHr, 0, 2);
        Assert.True(result.ciLower < result.pooledHr);
        Assert.True(result.ciUpper > result.pooledHr);
        Assert.InRange(result.i2, 0, 100);
    }

    [Fact]
    public void OneStageIpd_Basic()
    {
        var studies = new List<IpdEngine.IpdStudy>
        {
            S("1", 0.7, 0.5, 0.9),
            S("2", 0.8, 0.6, 1.0),
            S("3", 0.6, 0.4, 0.8),
        };
        var req = new IpdEngine.IpdRequest { studies = studies, method = "oneStage" };
        var result = IpdEngine.Run(req);

        Assert.Equal("One-stage IPD (Cox frailty)", result.method);
        Assert.NotNull(result.phTestP);
        Assert.NotEmpty(result.warnings);
    }

    [Fact]
    public void Ipd_ThrowsOnInsufficientStudies()
    {
        var studies = new List<IpdEngine.IpdStudy>
        {
            S("1", 0.7, 0.5, 0.9),
        };
        var req = new IpdEngine.IpdRequest { studies = studies, method = "twoStage" };
        Assert.Throws<ArgumentException>(() => IpdEngine.Run(req));
    }
}
