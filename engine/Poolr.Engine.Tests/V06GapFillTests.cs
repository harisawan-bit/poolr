using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

public class McmcDiagnosticsTests
{
    [Fact]
    public void Basic_ConvergedChains()
    {
        var rng = new Random(42);
        var chains = new List<List<double>>();
        for (int c = 0; c < 4; c++)
        {
            var chain = new List<double>();
            for (int i = 0; i < 500; i++)
                chain.Add(rng.NextDouble() * 0.5 + 1.0); // all near 1.0
            chains.Add(chain);
        }

        var result = McmcDiagnosticsEngine.Diagnose(new McmcDiagnosticsEngine.McmcRequest { chains = chains });
        Assert.True(result.rhat < 1.2);
        Assert.True(result.converged);
        Assert.Equal(4, result.nChains);
    }

    [Fact]
    public void TwoChains_Minimum()
    {
        var chains = new List<List<double>>
        {
            new() { 1.0, 1.1, 0.9, 1.05, 0.95, 1.0, 1.1, 0.9, 1.0, 0.95 },
            new() { 2.0, 2.1, 1.9, 2.05, 1.95, 2.0, 2.1, 1.9, 2.0, 1.95 }
        };

        var result = McmcDiagnosticsEngine.Diagnose(new McmcDiagnosticsEngine.McmcRequest { chains = chains });
        Assert.True(result.rhat > 1.5); // not converged
    }

    [Fact]
    public void TooFewChains_Throws()
    {
        var chains = new List<List<double>> { new() { 1.0, 1.1 } };
        Assert.Throws<ArgumentException>(() => McmcDiagnosticsEngine.Diagnose(new McmcDiagnosticsEngine.McmcRequest { chains = chains }));
    }

    [Fact]
    public void EmptyChains_ReturnsAcf()
    {
        var rng = new Random(123);
        var chains = new List<List<double>>();
        for (int c = 0; c < 2; c++)
        {
            var chain = new List<double>();
            for (int i = 0; i < 100; i++)
                chain.Add(rng.NextDouble());
            chains.Add(chain);
        }

        var result = McmcDiagnosticsEngine.Diagnose(new McmcDiagnosticsEngine.McmcRequest { chains = chains });
        Assert.True(result.acf.Count > 0);
    }
}

public class QualitativeSynthesisTests
{
    [Fact]
    public void Thematic_Basic()
    {
        var req = new QualitativeSynthesisEngine.QualRequest
        {
            method = "thematic",
            studies = new()
            {
                new() { id = "1", codes = new() { "anxiety", "stress", "coping" } },
                new() { id = "2", codes = new() { "anxiety", "depression" } },
                new() { id = "3", codes = new() { "stress", "coping", "support" } }
            }
        };

        var result = QualitativeSynthesisEngine.Run(req);
        Assert.Equal(3, result.totalStudies);
        Assert.True(result.uniqueCodes >= 3);
        Assert.True(result.codeFrequencies.Count > 0);
        Assert.Equal("anxiety", result.codeFrequencies[0].code);
    }

    [Fact]
    public void MetaEthnography_Translations()
    {
        var req = new QualitativeSynthesisEngine.QualRequest
        {
            method = "meta_ethnography",
            studies = new()
            {
                new() { id = "1", codes = new() { "themeA", "themeB" } },
                new() { id = "2", codes = new() { "themeA", "themeC" } }
            }
        };

        var result = QualitativeSynthesisEngine.Run(req);
        Assert.True(result.translations.Count > 0);
    }

    [Fact]
    public void VoteCounting()
    {
        var req = new QualitativeSynthesisEngine.QualRequest
        {
            method = "vote_counting",
            studies = new()
            {
                new() { id = "1", codes = new() { "a", "b" } },
                new() { id = "2", codes = new() { "a", "c" } },
                new() { id = "3", codes = new() { "a" } }
            }
        };

        var result = QualitativeSynthesisEngine.Run(req);
        Assert.Equal("a", result.codeFrequencies[0].code);
        Assert.Equal(3, result.codeFrequencies[0].count);
    }

    [Fact]
    public void UnknownMethod_Throws()
    {
        var req = new QualitativeSynthesisEngine.QualRequest
        {
            method = "unknown",
            studies = new() { new() { id = "1", codes = new() { "a" } }, new() { id = "2", codes = new() { "b" } } }
        };
        Assert.Throws<ArgumentException>(() => QualitativeSynthesisEngine.Run(req));
    }
}
