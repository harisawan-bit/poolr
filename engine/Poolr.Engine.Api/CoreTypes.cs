namespace Poolr.Engine.Api;

/// <summary>One study prepared for pooling: standardised effect + variance.</summary>
public class MaWork
{
    public Study S = null!;
    public double Eff;
    public double Var;
}

/// <summary>Pooled-model result shared by the generic and special poolers.</summary>
public class CoreResult
{
    public double FeEff, FeSe, ReEff, ReSe, Tau2;
    public double Q; public int Df; public double Qp, I2;
    public List<double> StudyWeights = new();
    public double TotalWeight;
    public string Note = "";
    public bool IsSpecialPooler;
}
