using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class DeduplicationTests
{
    [Fact]
    public void Basic_NoDuplicates()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "A study of X", Year = "2020" },
            new() { Id = "2", Title = "B study of Y", Year = "2021" },
            new() { Id = "3", Title = "C study of Z", Year = "2022" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.Empty(result.Groups);
        Assert.Equal(3, result.UniqueCitations);
        Assert.Equal(0, result.DuplicatesRemoved);
    }

    [Fact]
    public void DoiDuplicates_Detected()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "Title A", Year = "2020", Doi = "10.1000/abc" },
            new() { Id = "2", Title = "Title B", Year = "2020", Doi = "10.1000/abc" },
            new() { Id = "3", Title = "Title C", Year = "2021" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.Single(result.Groups);
        Assert.Equal("doi", result.Groups[0].MatchType);
        Assert.Equal(new[] { "1", "2" }, result.Groups[0].CitationIds);
    }

    [Fact]
    public void PmidDuplicates_Detected()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "A", Year = "2020", Pmid = "12345" },
            new() { Id = "2", Title = "B", Year = "2020", Pmid = "12345" },
            new() { Id = "3", Title = "C", Year = "2021" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.Single(result.Groups);
        Assert.Equal("pmid", result.Groups[0].MatchType);
    }

    [Fact]
    public void TitleYearDuplicates_Detected()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "The effect of X on Y", Year = "2020" },
            new() { Id = "2", Title = "Effect of X on Y", Year = "2020" },
            new() { Id = "3", Title = "Effect of X on Z", Year = "2020" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.True(result.Groups.Count >= 1);
    }

    [Fact]
    public void FuzzyDuplicates_Detected()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "Randomized controlled trial of drug X", Year = "2020" },
            new() { Id = "2", Title = "Randomized controlled trial of drug X", Year = "2020" },
            new() { Id = "3", Title = "Something completely different", Year = "2020" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.True(result.Groups.Count >= 1);
    }

    [Fact]
    public void DifferentYears_NotMatched()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "Same title", Year = "2020" },
            new() { Id = "2", Title = "Same title", Year = "2021" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.Empty(result.Groups);
    }

    [Fact]
    public void EmptyList_NoError()
    {
        var result = DeduplicationEngine.Deduplicate(new List<DeduplicationEngine.Citation>());
        Assert.Empty(result.Groups);
        Assert.Equal(0, result.TotalCitations);
    }

    [Fact]
    public void MixedDuplicates_AllStages()
    {
        var citations = new List<DeduplicationEngine.Citation>
        {
            new() { Id = "1", Title = "A", Year = "2020", Doi = "10.1000/abc" },
            new() { Id = "2", Title = "B", Year = "2020", Doi = "10.1000/abc" }, // DOI dup
            new() { Id = "3", Title = "C", Year = "2021", Pmid = "999" },
            new() { Id = "4", Title = "D", Year = "2021", Pmid = "999" }, // PMID dup
            new() { Id = "5", Title = "Unique study", Year = "2022" }
        };

        var result = DeduplicationEngine.Deduplicate(citations);
        Assert.Equal(2, result.Groups.Count);
        Assert.Equal(3, result.UniqueCitations);
        Assert.Equal(2, result.DuplicatesRemoved);
    }
}
