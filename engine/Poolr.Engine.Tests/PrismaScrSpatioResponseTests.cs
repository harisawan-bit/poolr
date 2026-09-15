using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class PrismaScrTests
{
    [Fact]
    public void Basic_GeneratesFlow()
    {
        var req = new PrismaScrEngine.PrismaScrRequest
        {
            recordsFromDatabases = 500,
            recordsFromRegisters = 50,
            recordsFromOrganizations = 20,
            recordsFromInternet = 30,
            recordsFromCitationSearching = 10,
            recordsRemovedBeforeScreening = 100,
            recordsScreened = 510,
            recordsExcluded = 400,
            fullTextArticlesAssessed = 110,
            fullTextExcluded = 80,
            studiesIncluded = 30,
            reportsOfIncludedStudies = 35
        };

        var result = PrismaScrEngine.Generate(req);
        Assert.Equal(610, result.TotalIdentified);
        Assert.Contains("PRISMA-ScR", result.SvgFlowDiagram);
        Assert.Equal(30, result.StudiesIncluded);
        Assert.Equal(19, result.Checklist.Count);
    }

    [Fact]
    public void ZeroValues_NoError()
    {
        var req = new PrismaScrEngine.PrismaScrRequest();
        var result = PrismaScrEngine.Generate(req);
        Assert.NotNull(result.SvgFlowDiagram);
    }
}

public class SpatioTemporalTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new SpatioTemporalEngine.SpatioTemporalRequest
        {
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, latitude = 40.7, longitude = -74.0, year = 2020, region = "NYC" },
                new() { study = "2", effect = 0.3, se = 0.12, latitude = 34.0, longitude = -118.2, year = 2020, region = "LA" },
                new() { study = "3", effect = 0.7, se = 0.08, latitude = 41.8, longitude = -87.6, year = 2021, region = "Chicago" },
                new() { study = "4", effect = 0.2, se = 0.15, latitude = 29.7, longitude = -95.3, year = 2021, region = "Houston" }
            }
        };

        var result = SpatioTemporalEngine.Run(req);
        Assert.Equal(4, result.nStudies);
        Assert.True(result.moranI >= -1 && result.moranI <= 1);
        Assert.NotNull(result.svgForestPlot);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new SpatioTemporalEngine.SpatioTemporalRequest
        {
            studies = new() { new() { study = "1", effect = 0.5, se = 0.1 } }
        };

        Assert.Throws<ArgumentException>(() => SpatioTemporalEngine.Run(req));
    }
}

public class ResponseSurfaceTests
{
    [Fact]
    public void Basic_Computes()
    {
        var req = new ResponseSurfaceEngine.ResponseSurfaceRequest
        {
            studies = new()
            {
                new() { study = "1", effect = 0.5, se = 0.1, x1 = 10, x2 = 5 },
                new() { study = "2", effect = 0.3, se = 0.12, x1 = 20, x2 = 10 },
                new() { study = "3", effect = 0.7, se = 0.08, x1 = 15, x2 = 7 },
                new() { study = "4", effect = 0.2, se = 0.15, x1 = 25, x2 = 12 }
            }
        };

        var result = ResponseSurfaceEngine.Run(req);
        Assert.Equal(4, result.nStudies);
        Assert.True(result.coefficients.Length >= 3);
        Assert.NotNull(result.svgContourPlot);
    }

    [Fact]
    public void TooFewStudies_Throws()
    {
        var req = new ResponseSurfaceEngine.ResponseSurfaceRequest
        {
            studies = new() { new() { study = "1", effect = 0.5, se = 0.1, x1 = 10, x2 = 5 } }
        };

        Assert.Throws<ArgumentException>(() => ResponseSurfaceEngine.Run(req));
    }
}
