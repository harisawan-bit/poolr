namespace Poolr.Engine.Api;

/// <summary>
/// v0.5.1 extended models. All additions are additive/nullable so legacy
/// payloads and the legacy /api/meta contract remain byte-compatible.
/// </summary>

// ---- Request additions -------------------------------------------------

public class ExtendedMetaRequest : MetaRequest
{
    /// <summary>"DL"|"REML"|... plus "KH" flag handled separately</summary>
    public bool knapp_hartung { get; set; } = false;
    /// <summary>Study names to exclude from the pooled run (sensitivity).</summary>
    public List<string>? exclude { get; set; }
    /// <summary>Run leave-one-out + cumulative sensitivity suites.</summary>
    public bool sensitivity { get; set; } = true;
    /// <summary>Publication-bias depth: none|egger|begg|all|full (adds Peters/Harbord/PET-PEESE/p-curve/limit-meta/3PSM).</summary>
    public string bias_depth { get; set; } = "";
}

public class ConvertRequest
{
    /// <summary>"or2rr","rr2or","or2rd"? -> we need event rate context</summary>
    public string conversion { get; set; } = "";
    public double value { get; set; }
    /// <summary>Assumed control-group event proportion (for OR&lt;-&gt;RR/RD/NNT).</summary>
    public double? control_rate { get; set; }
    /// <summary>SMD delta for smd2or / or2smd.</summary>
    public double? delta { get; set; }
    // Wan median -> mean/SD
    public double? median { get; set; }
    public double? q1 { get; set; }
    public double? q3 { get; set; }
    public double? min { get; set; }
    public double? max { get; set; }
    public int? n { get; set; }
}

// ---- Response additions ------------------------------------------------

public class BetweenSubgroupTest
{
    public double q { get; set; }
    public int df { get; set; }
    public double p { get; set; }
    public string method { get; set; } = "Q-between (interaction)";
}

public class ExtendedSubgroupResult : SubgroupResult
{
    public double q_within { get; set; }
    public int df_within { get; set; }
    public double i2_within { get; set; }
    public double tau2_within { get; set; }
    public string? ci_method { get; set; }
}

public class FixedRandomComparison
{
    public double fe_effect { get; set; }
    public double fe_ci_lower { get; set; }
    public double fe_ci_upper { get; set; }
    public double fe_p { get; set; }
    public double re_effect { get; set; }
    public double re_ci_lower { get; set; }
    public double re_ci_upper { get; set; }
    public double re_p { get; set; }
    public bool divergent { get; set; }
}

public class LeaveOneOutEntry
{
    public string excluded { get; set; } = "";
    public int k { get; set; }
    public double effect { get; set; }
    public double ci_lower { get; set; }
    public double ci_upper { get; set; }
    public double p { get; set; }
    public double i2 { get; set; }
}

public class CumulativeEntry
{
    public string added { get; set; } = "";
    public int? year { get; set; }
    public int k { get; set; }
    public double effect { get; set; }
    public double ci_lower { get; set; }
    public double ci_upper { get; set; }
    public double p { get; set; }
}

public class SensitivityPack
{
    public List<LeaveOneOutEntry> leave_one_out { get; set; } = new();
    public List<CumulativeEntry> cumulative { get; set; } = new();
    public FixedRandomComparison? fixed_vs_random { get; set; }
    public double influence_max_change_pct { get; set; }
    public string? most_influential { get; set; }
}

public class FailsafeResult
{
    public string method { get; set; } = ""; // rosenthal | orwin
    public double n_required { get; set; }
    public double? target { get; set; }      // orwin target effect
    public string note { get; set; } = "";
}

public class PetPeeseResult
{
    public double pet_intercept { get; set; }
    public double pet_p { get; set; }
    public double peese_intercept { get; set; }
    public double peese_se { get; set; }
    public double peese_p { get; set; }
    public string interpretation { get; set; } = "";
}

public class PetersHarbordResult
{
    public double peters_intercept { get; set; }
    public double peters_p { get; set; }
    public double harbord_intercept { get; set; }
    public double harbord_p { get; set; }
    public string note { get; set; } = "";
}

public class LimitMetaResult
{
    public double effect { get; set; }
    public double ci_lower { get; set; }
    public double ci_upper { get; set; }
    public string note { get; set; } = "Henmi-Copas limit meta-analysis (publication-bias robust CI)";
}

public class PCurveResult
{
    public int k_significant { get; set; }
    public double uniform_p { get; set; }
    public double rightskew_p { get; set; }
    public string interpretation { get; set; } = "";
}

public class SelectionModelResult
{
    public double theta { get; set; }
    public double tau2 { get; set; }
    public double gamma1 { get; set; }   // log selection weight for p in (0.05, 0.10]
    public double gamma2 { get; set; }   // log selection weight for p > 0.10
    public string note { get; set; } = "Step-function 3PSM (Vevea-Hedges, steps .05/.10) - experimental";
}

public class ExtendedPublicationBias
{
    public EggerResult? egger { get; set; }
    public BeggResult? begg { get; set; }
    public TrimFillResult? trimfill { get; set; }
    public PetersHarbordResult? peters_harbord { get; set; }
    public PetPeeseResult? pet_peese { get; set; }
    public LimitMetaResult? limit_meta { get; set; }
    public PCurveResult? pcurve { get; set; }
    public SelectionModelResult? selection_3psm { get; set; }
    public List<FailsafeResult>? failsafe_n { get; set; }
}

public class TrimFillResult
{
    public int n_imputed { get; set; }
    public double adjusted_effect { get; set; }
    public double adjusted_ci_lower { get; set; }
    public double adjusted_ci_upper { get; set; }
    public double original_effect { get; set; }
    public string side { get; set; } = "";   // "left" = missing small negative studies etc.
    public List<StudyResult>? adjusted_studies { get; set; }
    public string method { get; set; } = "Duval-Tweedie L0 (linear)";
}

public class ExtendedHeterogeneity : Heterogeneity
{
    public double h { get; set; }
    public double h2 { get; set; }
    public double? i2_lower { get; set; }
    public double? i2_upper { get; set; }
    public string i2_ci_note { get; set; } = "Ioannidis non-central chi-square method";
}

public class ExtendedSubgroups
{
    public List<ExtendedSubgroupResult> groups { get; set; } = new();
    public BetweenSubgroupTest? between { get; set; }
}

public class ExtendedPooledResult : PooledResult
{
    public string ci_method { get; set; } = "Normal (Wald)";
    public double? t_value { get; set; }
    public double? df_t { get; set; }
}

public class ExtendedMetaResponse
{
    public string model { get; set; } = "";
    public string measure { get; set; } = "";
    public string method { get; set; } = "";
    public bool knapp_hartung { get; set; }
    public int k { get; set; }
    public List<StudyResult> studies { get; set; } = new();
    public ExtendedPooledResult pooled { get; set; } = new();
    public ExtendedHeterogeneity heterogeneity { get; set; } = new();
    public ExtendedSubgroups? subgroups { get; set; }
    public ExtendedPublicationBias? publication_bias { get; set; }
    public MetaRegressionResult? meta_regression { get; set; }
    public SensitivityPack? sensitivity { get; set; }
    public string? notes { get; set; }
}

public class ConvertResponse
{
    public string conversion { get; set; } = "";
    public double result { get; set; }
    public Dictionary<string, double>? extra { get; set; }
    public string note { get; set; } = "";
}
