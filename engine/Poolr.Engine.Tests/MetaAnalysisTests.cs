using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class MetaAnalysisTests
{
    private static Study B(string name, int ie, int n1, int ce, int n2, string? grp = null)
        => new() { study = name, type = "binary", int_events = ie, int_n = n1, ctrl_events = ce, ctrl_n = n2, subgroup = grp };

    private static Study C(string name, double m1, double s1, int n1, double m2, double s2, int n2)
        => new() { study = name, type = "continuous", int_mean = m1, int_sd = s1, int_n = n1, ctrl_mean = m2, ctrl_sd = s2, ctrl_n = n2 };

    private static Study S(string name, double hr, double lo, double hi)
        => new() { study = name, type = "survival", hr = hr, hr_lower = lo, hr_upper = hi };

    [Fact]
    public void Or_FixedEffect_KnownExample()
    {
        var data = new List<Study> { B("1", 15, 100, 25, 100), B("2", 8, 50, 18, 50), B("3", 30, 200, 45, 200) };
        var r = new MetaAnalysis("fixed", "OR", "DL").Run(data);
        Assert.Equal(3, r.k);
        Assert.Equal("Fixed-effect", r.model);
        Assert.Equal("OR", r.measure);
        Assert.InRange(r.pooled.effect, 0, 1);
        Assert.True(r.pooled.ci_lower < r.pooled.effect);
        Assert.True(r.pooled.ci_upper > r.pooled.effect);
        var totalW = r.studies.Sum(s => s.weight);
        Assert.InRange(totalW, 99.9, 100.1);
    }

    [Fact]
    public void Or_RandomEffects_Dl()
    {
        var data = new List<Study> { B("A", 15, 100, 25, 100), B("B", 8, 50, 18, 50), B("C", 30, 200, 45, 200) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.Equal("Random-effects", r.model);
        Assert.True(r.heterogeneity.tau2 >= 0);
        Assert.InRange(r.heterogeneity.i2, 0, 100);
    }

    [Fact]
    public void Rr_Measure()
    {
        var data = new List<Study> { B("A", 10, 100, 20, 100), B("B", 5, 50, 15, 50) };
        var r = new MetaAnalysis("random", "RR", "DL").Run(data);
        Assert.Equal("RR", r.measure);
        Assert.True(r.pooled.effect > 0);
    }

    [Fact]
    public void Rd_Measure_Negative()
    {
        var data = new List<Study> { B("A", 10, 100, 20, 100), B("B", 5, 50, 15, 50) };
        var r = new MetaAnalysis("random", "RD", "DL").Run(data);
        Assert.Equal("RD", r.measure);
        Assert.True(r.pooled.effect < 0);
    }

    [Fact]
    public void ContinuityCorrection_ZeroCells()
    {
        var data = new List<Study> { B("A", 0, 50, 10, 50), B("B", 5, 50, 0, 50) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.Equal(2, r.k);
        Assert.True(double.IsFinite(r.pooled.effect));
        Assert.True(double.IsFinite(r.pooled.ci_lower));
        Assert.True(double.IsFinite(r.pooled.ci_upper));
    }
}
