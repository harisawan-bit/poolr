using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class PrismaDtaTests
{
    [Fact]
    public void Basic_GeneratesFlow()
    {
        var req = new PrismaDtaEngine.PrismaDtaRequest
        {
            recordsFromDatabases = 500,
            recordsFromRegisters = 50,
            recordsFromOtherSources = 20,
            recordsRemovedBeforeScreening = 100,
            recordsScreened = 470,
            recordsExcluded = 350,
            fullTextArticlesAssessed = 120,
            fullTextExcluded = 80,
            studiesIncluded = 40,
            studiesIncludedQuantitative = 35
        };

        var result = PrismaDtaEngine.Generate(req);
        Assert.Equal(570, result.TotalIdentified);
        Assert.Contains("PRISMA-DTA", result.SvgFlowDiagram);
        Assert.Contains("500", result.SvgFlowDiagram);
    }

    [Fact]
    public void ZeroValues_NoError()
    {
        var req = new PrismaDtaEngine.PrismaDtaRequest();
        var result = PrismaDtaEngine.Generate(req);
        Assert.NotNull(result.SvgFlowDiagram);
    }
}

public class LivingReviewAutomationTests
{
    [Fact]
    public void NotDue_ReturnsStatus()
    {
        var config = new LivingReviewAutomationEngine.LivingReviewConfig
        {
            projectId = "test",
            nextRun = DateTime.UtcNow.AddDays(7)
        };

        var result = LivingReviewAutomationEngine.Run(config, new List<string>());
        Assert.False(result.isDue);
        Assert.Empty(result.runs);
    }

    [Fact]
    public void Due_ProcessesNewStudies()
    {
        var config = new LivingReviewAutomationEngine.LivingReviewConfig
        {
            projectId = "test",
            nextRun = DateTime.UtcNow.AddDays(-1),
            knownStudyIds = new() { "s1", "s2" }
        };

        var newStudies = new List<string> { "s2", "s3", "s4" };
        var result = LivingReviewAutomationEngine.Run(config, newStudies);

        Assert.True(result.isDue);
        Assert.Single(result.runs);
        Assert.Equal(2, result.totalNewStudies);
        Assert.Equal(1, result.totalDuplicatesRemoved);
        Assert.True(result.runs[0].alertSent);
    }

    [Fact]
    public void NoNewStudies_NoAlert()
    {
        var config = new LivingReviewAutomationEngine.LivingReviewConfig
        {
            projectId = "test",
            nextRun = DateTime.UtcNow.AddDays(-1),
            knownStudyIds = new() { "s1", "s2", "s3" }
        };

        var newStudies = new List<string> { "s1", "s2" };
        var result = LivingReviewAutomationEngine.Run(config, newStudies);

        Assert.Equal(0, result.totalNewStudies);
        Assert.False(result.runs[0].alertSent);
    }

    [Fact]
    public void Schedule_UpdatesNextRun()
    {
        var config = new LivingReviewAutomationEngine.LivingReviewConfig
        {
            projectId = "test",
            nextRun = DateTime.UtcNow.AddDays(-1),
            schedule = "weekly"
        };

        LivingReviewAutomationEngine.Run(config, new List<string> { "s1" });
        Assert.True(config.nextRun > DateTime.UtcNow);
    }
}
