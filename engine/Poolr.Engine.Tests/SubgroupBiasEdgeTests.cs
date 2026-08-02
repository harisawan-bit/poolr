using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class SubgroupBiasEdgeTests
{
    private static Study B(string n, int ie, int n1, int ce, int n2, string? grp = null, int? yr = null)
        => new() { study = n, type = "binary", int_events = ie, int_n = n1, ctrl_events = ce, ctrl_n = n2, subgroup = grp, year = yr };

    [Fact]
    public void Subgroup_ByDesign()
    {
        var data = new List<Study>
        {
            new Study { study = "RCT1", type = "binary", int_events = 10, int_n = 100, ctrl_events = 20, ctrl_n = 100, design = "RCT" },
            new Study { study = "RCT2", type = "binary", int_events = 8, int_n = 80, ctrl_events = 15, ctrl_n = 80, design = "RCT" },
            new Study { study = "C1", type = "binary", int_events = 25, int_n = 200, ctrl_events = 40, ctrl_n = 200, design = "Cohort" },
            new Study { study = "C2", type = "binary", int_events = 30, int_n = 180, ctrl_events = 35, ctrl_n = 180, design = "Cohort" },
        };
        var r = new MetaAnalysis("random", "OR", "DL", subgroup: "design").Run(data);
        Assert.NotNull(r.subgroups);
        Assert.Equal(2, r.subgroups!.Count);
        var names = r.subgroups.Select(s => s.name).ToHashSet();
        Assert.Contains("RCT", names);
        Assert.Contains("Cohort", names);
        Assert.All(r.subgroups, s => Assert.Equal(2, s.k));
    }

    [Fact]
    public void Eggers_NoBias_NotSignificant()
    {
        var data = new List<Study>();
        for (int i = 0; i < 10; i++) data.Add(B($"S{i}", 10, 100, 10, 100));
        var r = new MetaAnalysis("random", "OR", "DL", pubBias: "egger").Run(data);
        Assert.NotNull(r.publication_bias);
        Assert.NotNull(r.publication_bias!.egger);
        Assert.True(r.publication_bias.egger.p_value > 0.05);
    }

    [Fact]
    public void Beggs_Test_Runs()
    {
        var data = new List<Study>();
        for (int i = 0; i < 10; i++) data.Add(B($"S{i}", 10, 100, 10, 100));
        var r = new MetaAnalysis("random", "OR", "DL", pubBias: "begg").Run(data);
        Assert.NotNull(r.publication_bias);
        Assert.NotNull(r.publication_bias!.begg);
    }

    [Fact]
    public void SingleStudy_Works()
    {
        var data = new List<Study> { B("A", 10, 100, 20, 100) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.Equal(1, r.k);
        Assert.True(r.pooled.effect > 0);
    }

    [Fact]
    public void Empty_Throws()
        => Assert.Throws<ArgumentException>(() => new MetaAnalysis("random", "OR", "DL").Run(new List<Study>()));

    [Fact]
    public void InvalidMeasure_Throws()
        => Assert.Throws<ArgumentException>(() => new MetaAnalysis("random", "INVALID", "DL").Run(new List<Study> { B("A", 10, 100, 20, 100) }));

    [Fact]
    public void MissingData_SkipsInvalid()
    {
        var data = new List<Study>
        {
            B("A", 10, 100, 20, 100),
            new Study { study = "B", type = "binary", int_events = 8 },
        };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.Equal(1, r.k);
    }

    [Fact]
    public void LargeSampleSizes_Finite()
    {
        var data = new List<Study> { B("A", 5000, 100000, 6000, 100000), B("B", 3000, 50000, 4000, 50000) };
        var r = new MetaAnalysis("random", "OR", "DL").Run(data);
        Assert.Equal(2, r.k);
        Assert.True(double.IsFinite(r.pooled.effect));
    }
}
