using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class BubblePlotTests
{
    [Fact]
    public void Basic_GeneratesPlot()
    {
        var req = new BubblePlotEngine.BubblePlotRequest
        {
            effects = new() { 0.5, 0.3, 0.7, 0.2, 0.6 },
            standardErrors = new() { 0.1, 0.12, 0.08, 0.15, 0.1 },
            moderators = new() { 2018, 2019, 2020, 2021, 2022 },
            studyLabels = new() { "A", "B", "C", "D", "E" }
        };

        var result = BubblePlotEngine.Generate(req);
        Assert.NotNull(result.Svg);
        Assert.Contains("svg", result.Svg);
        Assert.True(double.IsFinite(result.Slope));
        Assert.True(double.IsFinite(result.R2));
    }

    [Fact]
    public void RegressionLine_Computed()
    {
        var req = new BubblePlotEngine.BubblePlotRequest
        {
            effects = new() { 0.1, 0.2, 0.3, 0.4, 0.5 },
            standardErrors = new() { 0.1, 0.1, 0.1, 0.1, 0.1 },
            moderators = new() { 1, 2, 3, 4, 5 }
        };

        var result = BubblePlotEngine.Generate(req);
        Assert.True(Math.Abs(result.Slope - 0.1) < 0.01);
        Assert.True(result.R2 > 0.9);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new BubblePlotEngine.BubblePlotRequest
        {
            effects = new() { 0.5, 0.3 },
            standardErrors = new() { 0.1, 0.12 },
            moderators = new() { 2018, 2019 }
        };

        Assert.Throws<ArgumentException>(() => BubblePlotEngine.Generate(req));
    }

    [Fact]
    public void MismatchedLengths_Throws()
    {
        var req = new BubblePlotEngine.BubblePlotRequest
        {
            effects = new() { 0.5, 0.3, 0.7 },
            standardErrors = new() { 0.1, 0.12 },
            moderators = new() { 2018, 2019, 2020 }
        };

        Assert.Throws<ArgumentException>(() => BubblePlotEngine.Generate(req));
    }
}

public class LeagueMatrixTests
{
    [Fact]
    public void Basic_GeneratesHeatmap()
    {
        var req = new LeagueMatrixEngine.LeagueMatrixRequest
        {
            treatments = new() { "A", "B", "C" },
            matrix = new()
            {
                new() { 0, 0.2, 0.1 },
                new() { -0.2, 0, -0.15 },
                new() { -0.1, 0.15, 0 }
            }
        };

        var result = LeagueMatrixEngine.Generate(req);
        Assert.NotNull(result.Svg);
        Assert.Contains("League Matrix", result.Svg);
    }

    [Fact]
    public void SingleTreatment_Throws()
    {
        var req = new LeagueMatrixEngine.LeagueMatrixRequest
        {
            treatments = new() { "A" },
            matrix = new() { new() { 0 } }
        };

        Assert.Throws<ArgumentException>(() => LeagueMatrixEngine.Generate(req));
    }
}
