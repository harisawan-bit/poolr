using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class SurvivalHeterogeneityTests
{
    private static Study S(string n, double hr, double lo, double hi)
        => new() { study = n, type = "survival", hr = hr, hr_lower = lo, hr_upper = hi };

    [Fact]
    public void Hr_FromReportedCi()
    {
        var data = new List<Study> { S("A", 0.75, 0.55, 1.02), S("B", 0.82, 0.62, 1.08), S("C", 0.90, 0.70, 1.15) };
        var r = new MetaAnalysis("random", "HR", "DL").Run(data);
        Assert.Equal("HR", r.measure);
        Assert.Equal(3, r.k);
        Assert.True(r.pooled.effect > 0);
        Assert.True(r.pooled.ci_lower > 0);
        Assert.True(r.pooled.ci_upper > 0);
    }

    [Fact]
    public void I2_LowHeterogeneity()
    {
        var data = new List<Study> { S2("A", 10, 100, 10, 100), S2("B", 10, 100, 10, 100) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.True(r.heterogeneity.i2 < 25);
    }

    [Fact]
    public void I2_HighHeterogeneity()
    {
        var data = new List<Study> { S2("A", 5, 100, 20, 100), S2("B", 30, 100, 10, 100), S2("C", 2, 100, 25, 100) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.True(r.heterogeneity.i2 > 50);
        Assert.True(r.heterogeneity.tau2 > 0);
    }

    [Fact]
    public void QTest_PValue_HighForIdentical()
    {
        var data = new List<Study> { S2("A", 10, 100, 10, 100), S2("B", 10, 100, 10, 100) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.True(r.heterogeneity.q_p > 0.5);
    }

    private static Study S2(string n, int ie, int n1, int ce, int n2)
        => new() { study = n, type = "binary", int_events = ie, int_n = n1, ctrl_events = ce, ctrl_n = n2 };
}
