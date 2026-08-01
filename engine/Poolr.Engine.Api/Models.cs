namespace Poolr.Engine.Api;

public class Study
{
    public string? study { get; set; }
    public string? type { get; set; } // "binary" | "continuous" | "survival"
    // binary
    public int? int_events { get; set; }
    public int? int_n { get; set; }
    public int? ctrl_events { get; set; }
    public int? ctrl_n { get; set; }
    // continuous
    public double? int_mean { get; set; }
    public double? int_sd { get; set; }
    public double? ctrl_mean { get; set; }
    public double? ctrl_sd { get; set; }
    // survival
    public double? hr { get; set; }
    public double? hr_lower { get; set; }
    public double? hr_upper { get; set; }
    // shared / optional
    public string? subgroup { get; set; }
    public string? design { get; set; }
    public int? year { get; set; }
}

public class MetaRequest
{
    public string model { get; set; } = "random"; // "random" | "fixed"
    public string measure { get; set; } = "OR";   // OR | RR | RD | MD | SMD | HR
    public string method { get; set; } = "DL";      // DL | REML | PM | HS | ML | EB
    public string subgroup { get; set; } = "none";
    public string pub_bias { get; set; } = "none";  // none | egger | begg | all
    public List<Study>? data { get; set; }
}

public class StudyResult
{
    public string study { get; set; } = "";
    public double effect { get; set; }
    public double ci_lower { get; set; }
    public double ci_upper { get; set; }
    public double weight { get; set; }
    public string subgroup { get; set; } = "";
}

public class PooledResult
{
    public double effect { get; set; }
    public double ci_lower { get; set; }
    public double ci_upper { get; set; }
    public double se { get; set; }
    public double z { get; set; }
    public double p { get; set; }
    public string model { get; set; } = "";
}

public class Heterogeneity
{
    public double q { get; set; }
    public int df { get; set; }
    public double q_p { get; set; }
    public double i2 { get; set; }
    public double tau2 { get; set; }
    public double tau { get; set; }
}

public class SubgroupResult
{
    public string name { get; set; } = "";
    public string measure { get; set; } = "";
    public double effect { get; set; }
    public double ci_lower { get; set; }
    public double ci_upper { get; set; }
    public int k { get; set; }
}

public class EggerResult
{
    public double intercept { get; set; }
    public double p_value { get; set; }
    public bool significant { get; set; }
    public string? note { get; set; }
}

public class BeggResult
{
    public double tau { get; set; }
    public double p_value { get; set; }
    public bool significant { get; set; }
}

public class PublicationBias
{
    public EggerResult? egger { get; set; }
    public BeggResult? begg { get; set; }
    public object? trimfill { get; set; }
}

public class MetaRegressionResult
{
    public string covariate { get; set; } = "";
    public double slope { get; set; }
    public double se { get; set; }
    public double z { get; set; }
    public double p { get; set; }
}

public class MetaResponse
{
    public string model { get; set; } = "";
    public string measure { get; set; } = "";
    public string method { get; set; } = "";
    public int k { get; set; }
    public List<StudyResult> studies { get; set; } = new();
    public PooledResult pooled { get; set; } = new();
    public Heterogeneity heterogeneity { get; set; } = new();
    public List<SubgroupResult>? subgroups { get; set; }
    public PublicationBias? publication_bias { get; set; }
    public MetaRegressionResult? meta_regression { get; set; }
}
