using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class MultivariateDoseResponseTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new MultivariateDoseResponseEngine.MultiDoseRequest
        {
            studies = new()
            {
                new()
                {
                    study = "1",
                    outcomes = new()
                    {
                        new() { dose = 0, logRr = 0, se = 0.1 },
                        new() { dose = 10, logRr = -0.2, se = 0.12 },
                        new() { dose = 20, logRr = -0.5, se = 0.15 }
                    }
                },
                new()
                {
                    study = "2",
                    outcomes = new()
                    {
                        new() { dose = 0, logRr = 0, se = 0.08 },
                        new() { dose = 10, logRr = -0.15, se = 0.1 },
                        new() { dose = 20, logRr = -0.4, se = 0.12 }
                    }
                }
            }
        };

        var result = MultivariateDoseResponseEngine.Run(req);
        Assert.NotNull(result.fittedCurve);
        Assert.True(result.fittedCurve.Count > 0);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new MultivariateDoseResponseEngine.MultiDoseRequest
        {
            studies = new()
            {
                new() { study = "1", outcomes = new() { new() { dose = 0, logRr = 0, se = 0.1 }, new() { dose = 10, logRr = -0.2, se = 0.12 } } }
            }
        };

        Assert.Throws<ArgumentException>(() => MultivariateDoseResponseEngine.Run(req));
    }
}

public class NetworkMetaRegressionTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new NetworkMetaRegressionEngine.NmaRegressionRequest
        {
            studies = new()
            {
                new() { study = "1", treatment1 = "A", treatment2 = "B", effect = 0.2, se = 0.15 },
                new() { study = "2", treatment1 = "B", treatment2 = "C", effect = -0.15, se = 0.18 },
                new() { study = "3", treatment1 = "A", treatment2 = "C", effect = 0.05, se = 0.22 },
                new() { study = "4", treatment1 = "A", treatment2 = "B", effect = 0.1, se = 0.2 }
            },
            covariates = new()
            {
                new() { name = "Year", values = new() { 2018, 2019, 2020, 2021 } }
            }
        };

        var result = NetworkMetaRegressionEngine.Run(req);
        Assert.Equal(3, result.treatments.Count);
        Assert.Single(result.covariateEffects);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new NetworkMetaRegressionEngine.NmaRegressionRequest
        {
            studies = new() { new() { treatment1 = "A", treatment2 = "B", effect = 0.2, se = 0.15 } }
        };

        Assert.Throws<ArgumentException>(() => NetworkMetaRegressionEngine.Run(req));
    }
}

public class GradeSoFTests
{
    [Fact]
    public void Basic_Generates()
    {
        var req = new GradeSoFGenerator.GradeRequest
        {
            intervention = "Drug X",
            comparator = "Placebo",
            outcomes = new()
            {
                new()
                {
                    name = "Mortality",
                    studies = 5,
                    participants = 1000,
                    effectEstimate = 0.75,
                    ciLower = 0.6,
                    ciUpper = 0.9,
                    effectMeasure = "RR",
                    i2 = 30
                },
                new()
                {
                    name = "Adverse events",
                    studies = 3,
                    participants = 800,
                    effectEstimate = 1.2,
                    ciLower = 0.9,
                    ciUpper = 1.6,
                    effectMeasure = "RR",
                    i2 = 60
                }
            }
        };

        var result = GradeSoFGenerator.Generate(req);
        Assert.Equal(2, result.outcomes.Count);
        Assert.NotNull(result.markdown);
        Assert.Contains("Drug X", result.markdown);
    }

    [Fact]
    public void Certainty_DowngradedForHighRoB()
    {
        var req = new GradeSoFGenerator.GradeRequest
        {
            intervention = "Drug",
            comparator = "Placebo",
            outcomes = new()
            {
                new()
                {
                    name = "Outcome",
                    studies = 3,
                    participants = 500,
                    robRandomization = 2, // High risk
                    robDeviations = 2,
                    robMissing = 2,
                    robMeasurement = 2,
                    robSelection = 2,
                    i2 = 80,
                    publicationBiasP = 0.01
                }
            }
        };

        var result = GradeSoFGenerator.Generate(req);
        var outcome = result.outcomes[0];
        Assert.True(outcome.nDowngrades >= 4);
        Assert.Contains("VERY LOW", outcome.certainty);
    }

    [Fact]
    public void NoDowngrades_HighCertainty()
    {
        var req = new GradeSoFGenerator.GradeRequest
        {
            intervention = "Drug",
            comparator = "Placebo",
            outcomes = new()
            {
                new()
                {
                    name = "Outcome",
                    studies = 20,
                    participants = 10000,
                    effectEstimate = 0.8,
                    ciLower = 0.75,
                    ciUpper = 0.85,
                    i2 = 5,
                    effectMeasure = "RR"
                }
            }
        };

        var result = GradeSoFGenerator.Generate(req);
        Assert.Equal("⊕⊕⊕⊕ HIGH", result.outcomes[0].certainty);
    }
}
