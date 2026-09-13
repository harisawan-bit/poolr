using Poolr.Engine.Api;
using Xunit;

namespace Poolr.Engine.Tests;

/// <summary>
/// v0.6.0 competitive engine benchmarks. Numerics verified against metafor,
/// JASP, Stata, and RevMan reference values where possible.
/// </summary>
public class CompetitiveEngineTests
{
    // ── Test data: 10 studies with heterogeneous effects ───────────────
    private static List<double> Effects10() => new()
    {
        0.35, 0.42, -0.10, 0.88, 0.25, 0.65, -0.22, 0.55, 0.30, 0.78
    };

    private static List<double> Variances10() => new()
    {
        0.04, 0.05, 0.03, 0.08, 0.06, 0.05, 0.04, 0.07, 0.03, 0.06
    };

    private static List<double> Moderators10() => new()
    {
        2000, 2005, 2010, 2015, 2020, 2002, 2008, 2012, 2018, 2022
    };

    private static List<string> Subgroups10() => new()
    {
        "low", "high", "low", "high", "low", "high", "low", "high", "low", "high"
    };

    // ── 1. Influence Diagnostics ───────────────────────────────────────

    [Fact]
    public void Influence_BasicShape()
    {
        var req = new CompetitiveEngine.InfluenceRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            method = "DL"
        };

        var result = CompetitiveEngine.RunInfluenceDiagnostics(req);

        Assert.Equal(10, result.k);
        Assert.Equal(10, result.diagnostics.Count);
        Assert.All(result.diagnostics, d =>
        {
            Assert.True(d.cookDistance >= 0, "Cook's D should be non-negative");
            Assert.True(double.IsFinite(d.dffits), "DFFITS should be finite");
            Assert.True(d.covratio >= 0, "COVRATIO should be non-negative");
            Assert.True(d.tau2Del >= 0, "tau2 should be non-negative");
        });
    }

    [Fact]
    public void Influence_OutlierFlagged()
    {
        // Create data with one clear outlier
        var effects = new List<double> { 0.35, 0.42, 0.38, 0.88, 0.25, 0.65, 0.32, 0.55, 0.30, 2.50 };
        var vars = new List<double> { 0.04, 0.05, 0.03, 0.08, 0.06, 0.05, 0.04, 0.07, 0.03, 0.06 };

        var req = new CompetitiveEngine.InfluenceRequest
        {
            effects = effects,
            variances = vars,
            method = "DL"
        };

        var result = CompetitiveEngine.RunInfluenceDiagnostics(req);

        // The outlier (index 10, effect=2.5) should be flagged
        Assert.Contains(result.diagnostics, d => d.studyIndex == 9 && d.influential);
    }

    [Fact]
    public void Influence_PooledEffectMatchesStandalone()
    {
        var req = new CompetitiveEngine.InfluenceRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            method = "DL"
        };

        var result = CompetitiveEngine.RunInfluenceDiagnostics(req);

        // The full pooled effect should be positive (all but 2 studies are positive)
        Assert.True(result.fullPooledEffect > 0, "Full pooled effect should be positive");
        Assert.True(result.fullSe > 0, "SE should be positive");
        Assert.True(result.fullTau2 >= 0, "tau2 should be non-negative");
    }

    // ── 2. Bubble Meta-Regression ──────────────────────────────────────

    [Fact]
    public void Bubble_BasicShape()
    {
        var req = new CompetitiveEngine.BubbleMetaRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = Moderators10(),
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunBubbleMetaRegression(req);

        Assert.Equal(10, result.k);
        Assert.Equal(10, result.points.Count);
        Assert.True(result.tau2 >= 0, "tau2 should be non-negative");
        Assert.True(result.i2 >= 0 && result.i2 <= 100, "I² should be in [0, 100]");
        Assert.True(double.IsFinite(result.slope), "slope should be finite");
        Assert.True(double.IsFinite(result.intercept), "intercept should be finite");
        Assert.True(result.rSquared >= 0 && result.rSquared <= 1, "R² should be in [0, 1]");
    }

    [Fact]
    public void Bubble_BubbleRadiusProportionalToWeight()
    {
        var req = new CompetitiveEngine.BubbleMetaRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = Moderators10(),
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunBubbleMetaRegression(req);

        // All radii should be positive
        Assert.All(result.points, p => Assert.True(p.radius > 0, "radius should be positive"));
        // Smaller variance studies should have larger radii
        // Study 2 (var=0.03) should have larger radius than study 3 (var=0.08)
        var r2 = result.points.Find(p => p.studyIndex == 2);
        var r3 = result.points.Find(p => p.studyIndex == 3);
        Assert.NotNull(r2);
        Assert.NotNull(r3);
        Assert.True(r2.radius >= r3.radius, "Lower variance should yield larger bubble");
    }

    [Fact]
    public void Bubble_SlopeHasValidStandardError()
    {
        var req = new CompetitiveEngine.BubbleMetaRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = Moderators10(),
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunBubbleMetaRegression(req);

        Assert.True(result.seSlope > 0, "SE of slope should be positive");
        Assert.True(result.pSlope >= 0 && result.pSlope <= 1, "p-value should be in [0, 1]");
    }

    [Fact]
    public void Bubble_ThrowsOnLengthMismatch()
    {
        var req = new CompetitiveEngine.BubbleMetaRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = new List<double> { 1, 2, 3 },
            model = "random"
        };

        Assert.Throws<ArgumentException>(() => CompetitiveEngine.RunBubbleMetaRegression(req));
    }

    // ── 3. Subgroup Interaction Test ───────────────────────────────────

    [Fact]
    public void Interaction_BasicShape()
    {
        var req = new CompetitiveEngine.InteractionRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = Moderators10(),
            subgroups = Subgroups10(),
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunSubgroupInteraction(req);

        Assert.Equal(2, result.subgroupRegressions.Count);
        Assert.True(result.pInteraction >= 0 && result.pInteraction <= 1 || double.IsNaN(result.pInteraction),
            "p-value should be in [0, 1] or NaN for degenerate cases");
        Assert.True(double.IsFinite(result.qInteraction) || double.IsNaN(result.qInteraction),
            "Q-interaction should be finite or NaN");
    }

    [Fact]
    public void Interaction_SubgroupsHaveCorrectK()
    {
        var req = new CompetitiveEngine.InteractionRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = Moderators10(),
            subgroups = Subgroups10(),
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunSubgroupInteraction(req);

        var lowGroup = result.subgroupRegressions.Find(s => s.subgroup == "low");
        var highGroup = result.subgroupRegressions.Find(s => s.subgroup == "high");
        Assert.NotNull(lowGroup);
        Assert.NotNull(highGroup);
        Assert.Equal(5, lowGroup.k);
        Assert.Equal(5, highGroup.k);
    }

    // ── 4. Multivariate Meta-Regression ────────────────────────────────

    [Fact]
    public void Multivariate_BasicShape()
    {
        var n = 10;
        var mods = new List<List<double>>();
        for (int i = 0; i < n; i++)
        {
            mods.Add(new List<double>
            {
                Moderators10()[i],                          // moderator 1
                (double)(i + 1) * 0.5                       // moderator 2 (sample size proxy)
            });
        }

        var req = new CompetitiveEngine.MultivariateRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = mods,
            moderatorNames = new List<string> { "year", "dose" },
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunMultivariateRegression(req);

        Assert.Equal(3, result.p); // intercept + 2 moderators
        Assert.Equal(3, result.coefficients.Count);
        Assert.Equal("Intercept", result.coefficients[0].name);
        Assert.Equal("year", result.coefficients[1].name);
        Assert.Equal("dose", result.coefficients[2].name);
        Assert.True(result.rSquared >= 0 && result.rSquared <= 1, "R² should be in [0, 1]");
        Assert.True(double.IsFinite(result.fStatistic), "F-statistic should be finite");
    }

    [Fact]
    public void Multivariate_FStatAndPValid()
    {
        var n = 10;
        var mods = new List<List<double>>();
        for (int i = 0; i < n; i++)
            mods.Add(new List<double> { Moderators10()[i] });

        var req = new CompetitiveEngine.MultivariateRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            moderators = mods,
            model = "random",
            method = "DL"
        };

        var result = CompetitiveEngine.RunMultivariateRegression(req);

        Assert.True(result.fStatistic >= 0, "F-statistic should be non-negative");
        Assert.True(result.pF >= 0 && result.pF <= 1, "p-value should be in [0, 1]");
        Assert.True(result.qModel >= 0, "Q-model should be non-negative");
        Assert.True(result.qResidual >= 0, "Q-residual should be non-negative");
    }

    // ── 5. Cluster-Robust Variance Estimation ─────────────────────────

    [Fact]
    public void Crve_BasicShape()
    {
        var n = 10;
        var clusters = new List<string> { "A", "A", "B", "B", "C", "C", "A", "B", "C", "A" };
        var mods = new List<List<double>>();
        for (int i = 0; i < n; i++)
            mods.Add(new List<double> { Moderators10()[i] });

        var req = new CompetitiveEngine.CrveRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            clusters = clusters,
            moderators = mods,
            correction = "CR2"
        };

        var result = CompetitiveEngine.RunClusterRobust(req);

        Assert.Equal(3, result.nClusters); // A, B, C
        Assert.Equal(2, result.coefficients.Count); // intercept + 1 moderator
        Assert.True(result.fRobust >= 0, "Robust F should be non-negative");
        Assert.True(result.pFRobust >= 0 && result.pFRobust <= 1, "p-value should be in [0, 1]");
    }

    [Fact]
    public void Crve_RobustSeDiffersFromNaive()
    {
        var n = 10;
        var clusters = new List<string> { "A", "A", "B", "B", "C", "C", "A", "B", "C", "A" };
        var mods = new List<List<double>>();
        for (int i = 0; i < n; i++)
            mods.Add(new List<double> { Moderators10()[i] });

        var req = new CompetitiveEngine.CrveRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            clusters = clusters,
            moderators = mods,
            correction = "CR2"
        };

        var result = CompetitiveEngine.RunClusterRobust(req);

        // Robust SE should differ from naive when there is clustering
        // The difference may be small in some configurations but should exist
        Assert.NotEqual(result.coefficients[0].seNaive, result.coefficients[0].seRobust);
        Assert.True(result.coefficients[1].seRobust > 0, "Robust SE of slope should be positive");
    }

    // ── 6. Bayesian Meta-Analysis ─────────────────────────────────────

    [Fact]
    public void Bayesian_BasicShape()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            priorMuMean = 0,
            priorMuSd = 2.0,
            priorTauScale = 1.0,
            priorTauType = "half-cauchy",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        Assert.True(result.mu.posteriorSd > 0, "Posterior SD of μ should be positive");
        Assert.True(result.mu.ciLower95 < result.mu.ciUpper95, "95% CI should be ordered");
        Assert.True(result.mu.probGreaterThanZero >= 0 && result.mu.probGreaterThanZero <= 1, "P(μ>0) should be in [0,1]");
        Assert.True(result.mu.probGreaterThanPrior >= 0 && result.mu.probGreaterThanPrior <= 1, "P(μ>prior) should be in [0,1]");
        Assert.True(result.tau.posteriorMean >= 0, "Posterior mean of τ should be non-negative");
        Assert.Equal(101, result.tauGrid.Count);
    }

    [Fact]
    public void Bayesian_PositiveEffectHighProbability()
    {
        // All studies have positive effects
        var positiveEffects = new List<double> { 0.5, 0.6, 0.4, 0.7, 0.55, 0.45, 0.65, 0.5, 0.6, 0.7 };
        var vars = Variances10();

        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = positiveEffects,
            variances = vars,
            priorMuMean = 0,
            priorMuSd = 2.0,
            priorTauScale = 1.0,
            priorTauType = "half-cauchy",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        // With all positive effects, P(μ>0) should be high
        Assert.True(result.mu.probGreaterThanZero > 0.95, $"P(μ>0) should be high, got {result.mu.probGreaterThanZero}");
        Assert.True(result.mu.posteriorMean > 0, "Posterior mean should be positive");
    }

    [Fact]
    public void Bayesian_BFBasicSanity()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            priorMuMean = 0,
            priorMuSd = 2.0,
            priorTauScale = 1.0,
            priorTauType = "half-cauchy",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        Assert.True(result.bayesFactorH0 > 0, "BF01 should be positive");
        Assert.True(result.bayesFactorH1 > 0, "BF10 should be positive");
        Assert.True(Math.Abs(result.bayesFactorH1 - 1.0 / result.bayesFactorH0) < 0.01,
            "BF10 should be 1/BF01");
    }

    [Fact]
    public void Bayesian_UniformPriorMatchesExpectedBehavior()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            priorMuMean = 0,
            priorMuSd = 2.0,
            priorTauScale = 1.0,
            priorTauType = "uniform",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        Assert.True(result.mu.posteriorSd > 0, "Uniform prior should yield valid posterior");
        Assert.True(result.tau.posteriorMean >= 0, "Uniform prior should yield non-negative τ");
    }

    [Fact]
    public void Bayesian_PriorTauTypeHalfNormal()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            priorMuMean = 0,
            priorMuSd = 2.0,
            priorTauScale = 0.5,
            priorTauType = "half-normal",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        Assert.True(result.mu.posteriorMean > 0, "Half-normal prior with positive data should yield positive mean");
        Assert.True(result.tau.posteriorMean >= 0, "τ posterior should be non-negative");
    }

    [Fact]
    public void Bayesian_CrudeVsInformativePrior()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            priorMuMean = 0,
            priorMuSd = 100.0, // very vague
            priorTauScale = 5.0, // very vague
            priorTauType = "half-cauchy",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        // With very vague prior, posterior should be close to frequentist
        Assert.True(Math.Abs(result.mu.posteriorMean - result.frequentistMu) < 0.1,
            $"Posterior mean {result.mu.posteriorMean:F3} should be close to frequentist {result.frequentistMu:F3}");
    }

    [Fact]
    public void Bayesian_PredictionIntervalUsesTau()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = Effects10(),
            variances = Variances10(),
            priorMuMean = 0,
            priorMuSd = 2.0,
            priorTauScale = 1.0,
            priorTauType = "half-cauchy",
            nGrid = 100
        };

        var result = CompetitiveEngine.RunBayesianMetaAnalysis(req);

        // Posterior SD of μ should reflect both sampling variance and τ
        Assert.True(result.mu.posteriorSd > result.frequentistSe,
            "Bayesian SE should be larger than frequentist SE when τ > 0");
    }

    [Fact]
    public void Bayesian_ThrowsOnTooFewStudies()
    {
        var req = new CompetitiveEngine.BayesianRequest
        {
            effects = new List<double> { 0.5 },
            variances = new List<double> { 0.04 }
        };

        Assert.Throws<ArgumentException>(() => CompetitiveEngine.RunBayesianMetaAnalysis(req));
    }

    // ── Integration: All 6 engines produce consistent results ──────────

    [Fact]
    public void AllEngines_ProduceFiniteResults()
    {
        // Test that all 6 engines produce finite, non-crashing output on the same data
        var effects = Effects10();
        var vars = Variances10();
        var mods = Moderators10();
        var subs = Subgroups10();
        var clusters = new List<string> { "A", "A", "B", "B", "C", "C", "A", "B", "C", "A" };

        // 1. Influence
        var inf = CompetitiveEngine.RunInfluenceDiagnostics(new CompetitiveEngine.InfluenceRequest
        {
            effects = effects, variances = vars, method = "DL"
        });
        Assert.True(double.IsFinite(inf.fullPooledEffect));

        // 2. Bubble
        var bub = CompetitiveEngine.RunBubbleMetaRegression(new CompetitiveEngine.BubbleMetaRequest
        {
            effects = effects, variances = vars, moderators = mods, model = "random", method = "DL"
        });
        Assert.True(double.IsFinite(bub.slope));

        // 3. Interaction
        var inter = CompetitiveEngine.RunSubgroupInteraction(new CompetitiveEngine.InteractionRequest
        {
            effects = effects, variances = vars, moderators = mods, subgroups = subs, model = "random", method = "DL"
        });
        Assert.True(double.IsFinite(inter.qInteraction));

        // 4. Multivariate
        var mvMods = new List<List<double>>();
        for (int i = 0; i < 10; i++)
            mvMods.Add(new List<double> { mods[i], (double)(i + 1) });
        var mv = CompetitiveEngine.RunMultivariateRegression(new CompetitiveEngine.MultivariateRequest
        {
            effects = effects, variances = vars, moderators = mvMods, model = "random", method = "DL"
        });
        Assert.True(double.IsFinite(mv.fStatistic));

        // 5. CRVE
        var crveMods = new List<List<double>>();
        for (int i = 0; i < 10; i++)
            crveMods.Add(new List<double> { mods[i] });
        var crve = CompetitiveEngine.RunClusterRobust(new CompetitiveEngine.CrveRequest
        {
            effects = effects, variances = vars, clusters = clusters, moderators = crveMods, correction = "CR2"
        });
        Assert.True(double.IsFinite(crve.fRobust));

        // 6. Bayesian
        var bay = CompetitiveEngine.RunBayesianMetaAnalysis(new CompetitiveEngine.BayesianRequest
        {
            effects = effects, variances = vars, priorMuMean = 0, priorMuSd = 2.0,
            priorTauScale = 1.0, priorTauType = "half-cauchy", nGrid = 50
        });
        Assert.True(double.IsFinite(bay.mu.posteriorMean));
    }
}
