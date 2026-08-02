using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class ContinuousTests
{
    private static Study C(string n, double m1, double s1, int n1, double m2, double s2, int n2)
        => new() { study = n, type = "continuous", int_mean = m1, int_sd = s1, int_n = n1, ctrl_mean = m2, ctrl_sd = s2, ctrl_n = n2 };

    [Fact]
    public void Md_FixedEffect_Negative()
    {
        var data = new List<Study> { C("A", 10.5, 2.1, 50, 12.3, 2.5, 50), C("B", 8.2, 1.8, 40, 9.8, 2.0, 40) };
        var r = new MetaAnalysis("fixed", "MD", "DL").Run(data);
        Assert.Equal("MD", r.measure);
        Assert.Equal(2, r.k);
        Assert.True(r.pooled.effect < 0);
    }

    [Fact]
    public void Smd_HedgesG_Negative()
    {
        var data = new List<Study> { C("A", 10.5, 2.1, 50, 12.3, 2.5, 50), C("B", 8.2, 1.8, 40, 9.8, 2.0, 40) };
        var r = new MetaAnalysis("random", "SMD", "DL").Run(data);
        Assert.Equal("SMD", r.measure);
        Assert.True(r.pooled.effect < 0);
    }

    [Fact]
    public void Smd_HedgesG_SmallSampleCorrection()
    {
        var data = new List<Study> { C("A", 5, 2, 10, 10, 2, 10) };
        var r = new MetaAnalysis("fixed", "SMD", "DL").Run(data);
        // Cohen's d = -2.5; Hedges' g = J*d with J<1 => |g| < 2.5 but substantial
        Assert.InRange(Math.Abs(r.pooled.effect), 2.0, 2.5);
    }
}
