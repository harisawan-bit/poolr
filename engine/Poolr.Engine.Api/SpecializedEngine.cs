using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Phase 14-19 engines: QoL, Economic, Genetics, Ecology, Education, Adverse Events (v0.5.7).
/// </summary>
public static class SpecializedEngine
{
    // ── Phase 14: QoL / Patient-Reported Outcomes ─────────────────────────

    public class QolStudy
    {
        public string study { get; set; } = "";
        public double? meanChange { get; set; }
        public double? sdChange { get; set; }
        public int? n { get; set; }
        public double? responders { get; set; }
    }

    public class QolRequest
    {
        public List<QolStudy> studies { get; set; } = new();
        public double pooledBaselineSd { get; set; }
    }

    public class QolResult
    {
        public double pooledMd { get; set; }
        public double pooledSmd { get; set; }
        public double respondersPooled { get; set; }
        public double respondersCiLower { get; set; }
        public double respondersCiUpper { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static QolResult RunQol(List<QolStudy> studies, double pooledBaselineSd)
    {
        var valid = studies.Where(s => s.meanChange.HasValue && s.n.HasValue && s.n.Value > 1).ToList();
        var validResponders = studies.Where(s => s.responders.HasValue && s.n.HasValue).ToList();

        if (valid.Count < 2 && validResponders.Count < 2) throw new ArgumentException("Insufficient data");

        var effects = valid.Select(s => s.meanChange.Value).ToList();
        var vars = valid.Select(s => Math.Pow(s.sdChange ?? pooledBaselineSd, 2) / s.n!.Value).ToList();

        double tau2 = vars.Count > 0 ? EstimateTau2(effects.ToArray(), vars.ToArray()) : 0;
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Count > 0 ? weights.Sum() : 1e-12;
        double pooledMd = weights.Zip(effects, (w, e) => w * e).Sum() / sw;
        double pooledSmd = pooledMd / Math.Max(pooledBaselineSd, 1e-12);

        double respondersPooled = 0, respondersCiLo = 0, respondersCiHi = 0;
        if (validResponders.Count >= 2)
        {
            respondersPooled = validResponders.Sum(s => (s.responders!.Value / 100.0) * s.n!.Value) / validResponders.Sum(s => s.n!.Value);
            double se = Math.Sqrt(respondersPooled * (1 - respondersPooled) / validResponders.Sum(s => s.n!.Value));
            respondersCiLo = Math.Max(0, respondersPooled - 1.96 * se);
            respondersCiHi = Math.Min(1, respondersPooled + 1.96 * se);
        }

        return new QolResult
        {
            pooledMd = pooledMd,
            pooledSmd = pooledSmd,
            respondersPooled = respondersPooled,
            respondersCiLower = respondersCiLo,
            respondersCiUpper = respondersCiHi,
            i2 = tau2 / (tau2 + vars.DefaultIfEmpty(1).Average()) * 100,
            nStudies = valid.Count
        };
    }

    // ── Phase 15: Economic Evaluation ────────────────────────────────────

    public class CostStudy
    {
        public string study { get; set; } = "";
        public double? costDiff { get; set; }
        public double? costSe { get; set; }
        public double? qalyDiff { get; set; }
        public double? qalySe { get; set; }
    }

    public class EconomicResult
    {
        public double pooledCostDiff { get; set; }
        public double costCiLower { get; set; }
        public double costCiUpper { get; set; }
        public double pooledQalyDiff { get; set; }
        public double qalyCiLower { get; set; }
        public double qalyCiUpper { get; set; }
        public double icer { get; set; }
        public int nStudies { get; set; }
    }

    public static EconomicResult RunEconomic(List<CostStudy> studies)
    {
        var costValid = studies.Where(s => s.costDiff.HasValue && s.costSe.HasValue && s.costSe.Value > 0).ToList();
        var qalyValid = studies.Where(s => s.qalyDiff.HasValue && s.qalySe.HasValue && s.qalySe.Value > 0).ToList();

        if (costValid.Count < 2 && qalyValid.Count < 2) throw new ArgumentException("Insufficient data");

        var logCosts = costValid.Select(s => Math.Log(Math.Abs(s.costDiff.Value) + 1)).ToList();
        var costVars = costValid.Select(s => s.costSe.Value * s.costSe.Value).ToList();
        double costTau2 = EstimateTau2(logCosts.ToArray(), costVars.ToArray());
        var costWeights = costVars.Select(v => 1.0 / (v + costTau2)).ToList();
        double pooledLogCost = costWeights.Zip(logCosts, (w, e) => w * e).Sum() / costWeights.Sum();
        double pooledCostDiff = Math.Exp(pooledLogCost) - 1;

        var qalyEffects = qalyValid.Select(s => s.qalyDiff.Value).ToList();
        var qalyVars = qalyValid.Select(s => s.qalySe.Value * s.qalySe.Value).ToList();
        double qalyTau2 = EstimateTau2(qalyEffects.ToArray(), qalyVars.ToArray());
        var qalyWeights = qalyVars.Select(v => 1.0 / (v + qalyTau2)).ToList();
        double pooledQaly = qalyWeights.Zip(qalyEffects, (w, e) => w * e).Sum() / qalyWeights.Sum();

        double costSe = Math.Sqrt(1.0 / costWeights.Sum());
        double qalySe = Math.Sqrt(1.0 / qalyWeights.Sum());

        return new EconomicResult
        {
            pooledCostDiff = pooledCostDiff,
            costCiLower = Math.Exp(pooledLogCost - 1.96 * costSe) - 1,
            costCiUpper = Math.Exp(pooledLogCost + 1.96 * costSe) - 1,
            pooledQalyDiff = pooledQaly,
            qalyCiLower = pooledQaly - 1.96 * qalySe,
            qalyCiUpper = pooledQaly + 1.96 * qalySe,
            icer = pooledCostDiff / Math.Max(pooledQaly, 1e-12),
            nStudies = Math.Max(costValid.Count, qalyValid.Count)
        };
    }

    // ── Phase 16: Genetics / Genomics ────────────────────────────────────

    public class GeneticStudy
    {
        public string study { get; set; } = "";
        public string model { get; set; } = "additive";
        public double? or { get; set; }
        public double? orLower { get; set; }
        public double? orUpper { get; set; }
    }

    public class GeneticResult
    {
        public double pooledOr { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public string bestModel { get; set; } = "additive";
        public int nStudies { get; set; }
    }

    public static GeneticResult RunGenetic(List<GeneticStudy> studies)
    {
        var valid = studies.Where(s => s.or.HasValue && s.orLower.HasValue && s.orUpper.HasValue && s.or.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var logOrs = valid.Select(s => Math.Log(s.or.Value)).ToList();
        var ses = valid.Select(s => (Math.Log(s.orUpper.Value) - Math.Log(s.orLower.Value)) / 3.92).ToList();
        var vars = ses.Select(se => se * se).ToList();

        double tau2 = EstimateTau2(logOrs.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLogOr = weights.Zip(logOrs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);

        return new GeneticResult
        {
            pooledOr = Math.Exp(pooledLogOr),
            ciLower = Math.Exp(pooledLogOr - 1.96 * se),
            ciUpper = Math.Exp(pooledLogOr + 1.96 * se),
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            bestModel = valid.GroupBy(s => s.model).OrderByDescending(g => g.Count()).First().Key,
            nStudies = valid.Count
        };
    }

    // ── Phase 17: Ecological / Environmental ─────────────────────────────

    public class EcologicalStudy
    {
        public string study { get; set; } = "";
        public double? meanControl { get; set; }
        public double? meanTreatment { get; set; }
        public double? sdControl { get; set; }
        public double? sdTreatment { get; set; }
        public int? nControl { get; set; }
        public int? nTreatment { get; set; }
    }

    public class EcologicalResult
    {
        public double responseRatio { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static EcologicalResult RunEcological(List<EcologicalStudy> studies)
    {
        var valid = studies.Where(s =>
            s.meanControl.HasValue && s.meanTreatment.HasValue &&
            s.meanControl.Value > 0 && s.meanTreatment.Value > 0 &&
            s.nControl.HasValue && s.nTreatment.HasValue).ToList();

        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var lnRr = valid.Select(s => Math.Log(s.meanTreatment.Value / s.meanControl.Value)).ToList();
        var vars = valid.Select(s =>
        {
            double sdC = s.sdControl ?? s.meanControl!.Value * 0.3;
            double sdT = s.sdTreatment ?? s.meanTreatment!.Value * 0.3;
            return (sdT * sdT) / (s.nTreatment!.Value * Math.Pow(s.meanTreatment!.Value, 2)) +
                   (sdC * sdC) / (s.nControl!.Value * Math.Pow(s.meanControl!.Value, 2));
        }).ToList();

        double tau2 = EstimateTau2(lnRr.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLnRr = weights.Zip(lnRr, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);

        return new EcologicalResult
        {
            responseRatio = Math.Exp(pooledLnRr),
            ciLower = Math.Exp(pooledLnRr - 1.96 * se),
            ciUpper = Math.Exp(pooledLnRr + 1.96 * se),
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = valid.Count
        };
    }

    // ── Phase 18: Education / Psychology (Pre-Post) ──────────────────────

    public class PrePostStudy
    {
        public string study { get; set; } = "";
        public double? meanPre { get; set; }
        public double? meanPost { get; set; }
        public double? sdPre { get; set; }
        public double? sdPost { get; set; }
        public double? prePostR { get; set; }
        public int? n { get; set; }
    }

    public class PrePostResult
    {
        public double pooledG { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static PrePostResult RunPrePost(List<PrePostStudy> studies)
    {
        var valid = studies.Where(s =>
            s.meanPre.HasValue && s.meanPost.HasValue &&
            s.sdPre.HasValue && s.sdPost.HasValue && s.n.HasValue && s.n.Value > 1).ToList();

        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var gs = valid.Select(s =>
        {
            double d = (s.meanPost!.Value - s.meanPre!.Value) / s.sdPre!.Value;
            double j = 1 - 3.0 / (4.0 * (2 * s.n!.Value - 2) - 1);
            return j * d;
        }).ToList();

        var vars = valid.Select(s =>
        {
            double r = s.prePostR ?? 0.5;
            return (2 * (1 - r)) / s.n!.Value + Math.Pow((s.meanPost!.Value - s.meanPre!.Value) / s.sdPre!.Value, 2) / (2 * s.n!.Value);
        }).ToList();

        double tau2 = EstimateTau2(gs.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooled = weights.Zip(gs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);

        return new PrePostResult
        {
            pooledG = pooled,
            ciLower = pooled - 1.96 * se,
            ciUpper = pooled + 1.96 * se,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = valid.Count
        };
    }

    // ── Phase 19: Adverse Events / Safety ────────────────────────────────

    public class AeStudy
    {
        public string study { get; set; } = "";
        public int? aeEventsInt { get; set; }
        public int? aeNInt { get; set; }
        public int? aeEventsCtrl { get; set; }
        public int? aeNCtrl { get; set; }
    }

    public class AeResult
    {
        public double pooledOr { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double pooledNnh { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static AeResult RunAdverseEvents(List<AeStudy> studies)
    {
        var valid = studies.Where(s =>
            s.aeEventsInt.HasValue && s.aeNInt.HasValue &&
            s.aeEventsCtrl.HasValue && s.aeNCtrl.HasValue &&
            s.aeNInt.Value > 0 && s.aeNCtrl.Value > 0).ToList();

        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var logOrs = new List<double>();
        var vars = new List<double>();

        foreach (var s in valid)
        {
            double a = s.aeEventsInt.Value + 0.5;
            double b = s.aeNInt.Value - s.aeEventsInt.Value + 0.5;
            double c = s.aeEventsCtrl.Value + 0.5;
            double d = s.aeNCtrl.Value - s.aeEventsCtrl.Value + 0.5;

            logOrs.Add(Math.Log((a * d) / (b * c)));
            vars.Add(1 / a + 1 / b + 1 / c + 1 / d);
        }

        double tau2 = EstimateTau2(logOrs.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLogOr = weights.Zip(logOrs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);

        double pCtrl = valid.Sum(s => s.aeEventsCtrl!.Value) / (double)valid.Sum(s => s.aeNCtrl!.Value);
        double pInt = valid.Sum(s => s.aeEventsInt!.Value) / (double)valid.Sum(s => s.aeNInt!.Value);
        double rd = pInt - pCtrl;
        double nnh = rd > 0 ? 1 / rd : double.PositiveInfinity;

        return new AeResult
        {
            pooledOr = Math.Exp(pooledLogOr),
            ciLower = Math.Exp(pooledLogOr - 1.96 * se),
            ciUpper = Math.Exp(pooledLogOr + 1.96 * se),
            pooledNnh = nnh,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = valid.Count
        };
    }

    private static double EstimateTau2(double[] effects, double[] vars)
    {
        int k = effects.Length;
        if (k < 2) return 0;
        var w = vars.Select(v => 1.0 / v).ToList();
        double sw = w.Sum();
        double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
        double q = w.Zip(effects, (wi, e) => wi * Math.Pow(e - fe, 2)).Sum();
        int df = k - 1;
        double c = sw - w.Sum(wi => wi * wi) / sw;
        return (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
    }
}
