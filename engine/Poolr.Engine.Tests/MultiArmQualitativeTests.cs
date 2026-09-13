using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class MultiArmNmaTests
{
    [Fact]
    public void Basic_ThreeArmTrial()
    {
        var req = new MultiArmNmaEngine.MultiArmRequest
        {
            studies = new()
            {
                new()
                {
                    study = "1",
                    comparisons = new()
                    {
                        new() { treatment1 = "A", treatment2 = "B", effect = 0.2, se = 0.15 },
                        new() { treatment1 = "A", treatment2 = "C", effect = 0.1, se = 0.18 },
                        new() { treatment1 = "B", treatment2 = "C", effect = -0.1, se = 0.12 }
                    }
                }
            }
        };

        var result = MultiArmNmaEngine.Run(req);
        Assert.Equal(3, result.treatments.Count);
        Assert.Equal(3, result.leagueMatrix.Count);
        Assert.Equal(3, result.effects.Count);
    }

    [Fact]
    public void LeagueMatrix_Symmetric()
    {
        var req = new MultiArmNmaEngine.MultiArmRequest
        {
            studies = new()
            {
                new()
                {
                    study = "1",
                    comparisons = new()
                    {
                        new() { treatment1 = "A", treatment2 = "B", effect = 0.3, se = 0.2 },
                        new() { treatment1 = "B", treatment2 = "C", effect = 0.1, se = 0.15 }
                    }
                }
            }
        };

        var result = MultiArmNmaEngine.Run(req);
        Assert.Equal(0, result.leagueMatrix[0][0]);
        Assert.Equal(-result.leagueMatrix[0][1], result.leagueMatrix[1][0]);
    }
}

public class QualitativeMetaTests
{
    [Fact]
    public void Basic_AggregatesCodes()
    {
        var req = new QualitativeMetaEngine.QualitativeMetaRequest
        {
            studies = new()
            {
                new()
                {
                    studyId = "1",
                    codes = new()
                    {
                        new() { code = "Anxiety", category = "Mental Health", frequency = 5 },
                        new() { code = "Depression", category = "Mental Health", frequency = 3 }
                    }
                },
                new()
                {
                    studyId = "2",
                    codes = new()
                    {
                        new() { code = "Anxiety", category = "Mental Health", frequency = 4 },
                        new() { code = "Stress", category = "Mental Health", frequency = 2 }
                    }
                }
            }
        };

        var result = QualitativeMetaEngine.Run(req);
        Assert.Equal(3, result.uniqueCodes);
        Assert.Equal(2, result.totalStudies);

        var anxiety = result.codes.First(c => c.code == "Anxiety");
        Assert.Equal(2, anxiety.studyCount);
        Assert.Equal(9, anxiety.totalFrequency);
        Assert.Equal(1.0, anxiety.prevalence);
    }

    [Fact]
    public void Filter_MinFrequency()
    {
        var req = new QualitativeMetaEngine.QualitativeMetaRequest
        {
            minFrequency = 3,
            studies = new()
            {
                new()
                {
                    studyId = "1",
                    codes = new()
                    {
                        new() { code = "Common", frequency = 5 },
                        new() { code = "Rare", frequency = 1 }
                    }
                }
            }
        };

        var result = QualitativeMetaEngine.Run(req);
        Assert.Single(result.codes);
        Assert.Equal("Common", result.codes[0].code);
    }

    [Fact]
    public void Filter_MinPrevalence()
    {
        var req = new QualitativeMetaEngine.QualitativeMetaRequest
        {
            minPrevalence = 0.6,
            studies = new()
            {
                new() { studyId = "1", codes = new() { new() { code = "Common", frequency = 5 } } },
                new() { studyId = "2", codes = new() { new() { code = "Common", frequency = 3 } } },
                new() { studyId = "3", codes = new() { new() { code = "Rare", frequency = 10 } } }
            }
        };

        var result = QualitativeMetaEngine.Run(req);
        Assert.Single(result.codes);
        Assert.Equal("Common", result.codes[0].code);
    }
}
