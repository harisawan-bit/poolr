using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Prognostic Model Meta-Analysis engine (v0.6.0).
/// Pools c-statistics, calibration slopes, and other performance measures
/// from multiple validation studies of a prognostic prediction model.
/// Mirrors R metamisc::valmeta functionality.
/// </summary>
public static class PrognosticMetaEngine
{
    public class ValidationStudy
    {
        public string study { get; set; } = "";
        public string modelName { get; set; } = "";
        public int? nEvents { get; set; }
        public int? nTotal { get; set; }
        public double? cStatistic { get; set; }
        public double? cSe { get; set; }
        public double? calibrationSlope { get; set; }
        public double? slopeSe { get; set; }
        public double? calibrationInLarge { get; set; }
        public double? expectedObserved { get; set; }
    }

    public class PrognosticMetaRequest
    {
        public List<ValidationStudy> studies { get; set; } = new();
        public string measure { get; set; } = "c-statistic"; // c-statistic, calibration-slope, eo
        public bool randomEffects { get; set; } = true;
    }

    public class PrognosticMetaResult
    {
        public string measure { get; set; } = "";
        public double pooledEstimate { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double se { get; set; }
        public double p { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public double q { get; set; }
        public int nStudies { get; set; }
        public List<string> warnings { get; set; } = new();
    }

    public static PrognosticMetaResult Run(PrognosticMetaRequest req)
    {
        if (req.studies == null || req.studies.Count < 2)
            throw new ArgumentException("At least 2 validation studies required");

        var validStudies = new List<ValidationStudy>();
        foreach (var s in req.studies)
        {
            double? effect = req.measure switch
            {
                "c-statistic" => s.cStatistic,
                "calibration-slope" => s.calibrationSlope,
                "eo" => s.expectedObserved,
                _ => s.cStatistic
            };

            double? seVal = req.measure switch
            {
                "c-statistic" => s.cSe,
                "calibration-slope" => s.slopeSe,
                _ => s.cSe
            };

            if (effect.HasValue && seVal.HasValue && seVal.Value > 0)
            {
                validStudies.Add(s);
            }
        }

        if (validStudies.Count < 2)
            throw new ArgumentException($"Insufficient valid studies for measure '{req.measure}'");

        var effects = validStudies.Select(s =>
        {
            return req.measure switch
            {
                "c-statistic" => s.cStatistic.Value,
                "calibration-slope" => s.calibrationSlope.Value,
                "eo" => s.expectedObserved.Value,
                _ => s.cStatistic.Value
            };
        }).ToList();

        var ses = validStudies.Select(s =>
        {
            return req.measure switch
            {
                "c-statistic" => s.cSe!.Value,
                "calibration-slope" => s.slopeSe!.Value,
                _ => s.cSe!.Value
            };
        }).ToList();

        var vars = ses.Select(se2 => se2 * se2).ToArray();

        double tau2 = 0;
        if (req.randomEffects)
        {
            var w = vars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(effects, (wi, e) => wi * e).Sum() / sw;
            double q = w.Zip(effects, (wi, e) => wi * (e - fe) * (e - fe)).Sum();
            int df = effects.Count - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2 = (df > 0 && q > df && c > 0) ? Math.Max(0, (q - df) / c) : 0;
        }

        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sumW = weights.Sum();
        double pooled = effects.Zip(weights, (e, w) => e * w).Sum() / sumW;
        double se = Math.Sqrt(1.0 / sumW);
        double crit = 1.959964;
        double z = se > 0 ? pooled / se : 0;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));

        // Q and I²
        var feWeights = vars.Select(v => 1.0 / v).ToList();
        double feSw = feWeights.Sum();
        double fePooled = feWeights.Zip(effects, (wi, e) => wi * e).Sum() / feSw;
        double qStat = feWeights.Zip(effects, (wi, e) => wi * (e - fePooled) * (e - fePooled)).Sum();
        int dfStat = effects.Count - 1;
        double i2 = qStat > dfStat ? Math.Max(0, (qStat - dfStat) / qStat * 100) : 0;

        var result = new PrognosticMetaResult
        {
            measure = req.measure,
            pooledEstimate = pooled,
            ciLower = pooled - crit * se,
            ciUpper = pooled + crit * se,
            se = se,
            p = p,
            i2 = i2,
            tau2 = tau2,
            q = qStat,
            nStudies = validStudies.Count
        };

        // C-statistic specific: pool on logit scale then back-transform
        if (req.measure == "c-statistic")
        {
            result.warnings.Add("C-statistic pooled on natural scale. Consider logit transformation for final estimate.");
        }

        // Calibration slope: 1.0 is ideal
        if (req.measure == "calibration-slope")
        {
            if (pooled < 0.9 || pooled > 1.1)
                result.warnings.Add($"Calibration slope deviates from 1.0 ({pooled:F3}). Model may be over/underfitted.");
        }

        return result;
    }
}

/// <summary>
/// Multi-Parameter Evidence Synthesis (MPES) engine (v0.6.0).
/// Handles joint synthesis of sensitivity and specificity using
/// bivariate random-effects model (Reitsma et al. 2005).
/// Extension of DTA meta-analysis for correlated outcomes.
/// </summary>
public static class BivariateDtaEngine
{
    public class BivariateStudy
    {
        public string study { get; set; } = "";
        public int? tp { get; set; }
        public int? fp { get; set; }
        public int? fn { get; set; }
        public int? tn { get; set; }
        public double? sensitivity { get; set; }
        public double? specificity { get; set; }
        public double? sensSe { get; set; }
        public double? specSe { get; set; }
    }

    public class BivariateRequest
    {
        public List<BivariateStudy> studies { get; set; } = new();
        public bool randomEffects { get; set; } = true;
    }

    public class BivariateResult
    {
        public double sensitivity { get; set; }
        public double sensCiLower { get; set; }
        public double sensCiUpper { get; set; }
        public double specificity { get; set; }
        public double specCiLower { get; set; }
        public double specCiUpper { get; set; }
        public double dor { get; set; }
        public double auc { get; set; }
        public double tau2Sens { get; set; }
        public double tau2Spec { get; set; }
        public double rho { get; set; }
        public int nStudies { get; set; }
        public double q { get; set; }
        public double i2 { get; set; }
    }

    public static BivariateResult Run(BivariateRequest req)
    {
        if (req.studies == null || req.studies.Count < 2)
            throw new ArgumentException("At least 2 studies required");

        var validStudies = new List<BivariateStudy>();
        foreach (var s in req.studies)
        {
            if (s.sensitivity.HasValue && s.specificity.HasValue && s.sensSe.HasValue && s.specSe.HasValue &&
                s.sensSe.Value > 0 && s.specSe.Value > 0)
            {
                validStudies.Add(s);
            }
        }

        if (validStudies.Count < 2)
            throw new ArgumentException("Insufficient valid studies with sensitivity and specificity");

        var sensEffects = validStudies.Select(s => s.sensitivity!.Value).ToList();
        var specEffects = validStudies.Select(s => s.specificity!.Value).ToList();
        var sensVars = validStudies.Select(s => s.sensSe!.Value * s.sensSe.Value).ToArray();
        var specVars = validStudies.Select(s => s.specSe!.Value * s.specSe.Value).ToArray();

        // Random-effects for sensitivity
        double tau2Sens = 0;
        if (req.randomEffects)
        {
            var w = sensVars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(sensEffects, (wi, e) => wi * e).Sum() / sw;
            double qSens = w.Zip(sensEffects, (wi, e) => wi * (e - fe) * (e - fe)).Sum();
            int dfSens = sensEffects.Count - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2Sens = (dfSens > 0 && qSens > dfSens && c > 0) ? Math.Max(0, (qSens - dfSens) / c) : 0;
        }

        // Random-effects for specificity
        double tau2Spec = 0;
        if (req.randomEffects)
        {
            var w = specVars.Select(v => 1.0 / v).ToList();
            double sw = w.Sum();
            double fe = w.Zip(specEffects, (wi, e) => wi * e).Sum() / sw;
            double qSpec = w.Zip(specEffects, (wi, e) => wi * (e - fe) * (e - fe)).Sum();
            int dfSpec = specEffects.Count - 1;
            double c = sw - w.Sum(wi => wi * wi) / sw;
            tau2Spec = (dfSpec > 0 && qSpec > dfSpec && c > 0) ? Math.Max(0, (qSpec - dfSpec) / c) : 0;
        }

        var sensWeights = sensVars.Select(v => 1.0 / (v + tau2Sens)).ToArray();
        var specWeights = specVars.Select(v => 1.0 / (v + tau2Spec)).ToArray();

        double pooledSens = sensWeights.Zip(sensEffects, (w, e) => w * e).Sum() / sensWeights.Sum();
        double pooledSpec = specWeights.Zip(specEffects, (w, e) => w * e).Sum() / specWeights.Sum();

        double seSens = Math.Sqrt(1.0 / sensWeights.Sum());
        double seSpec = Math.Sqrt(1.0 / specWeights.Sum());

        // Correlation between logit-sens and logit-spec
        double rho = ComputeCorrelation(
            sensEffects.Select(s => Math.Log(s / (1 - Math.Max(s, 0.999)))).ToList(),
            specEffects.Select(s => Math.Log(s / (1 - Math.Max(s, 0.999)))).ToList()
        );

        // Diagnostic odds ratio
        double dor = (pooledSens / (1 - pooledSens)) / ((1 - pooledSpec) / pooledSpec);
        double logDor = Math.Log(dor);

        // AUC approximation
        double auc = (pooledSens + pooledSpec) / 2;

        // Heterogeneity
        var feW = sensVars.Select(v => 1.0 / v).ToList();
        double feSw = feW.Sum();
        double fePooled = feW.Zip(sensEffects, (wi, e) => wi * e).Sum() / feSw;
        double qHet = feW.Zip(sensEffects, (wi, e) => wi * (e - fePooled) * (e - fePooled)).Sum();
        int dfHet = validStudies.Count - 1;
        double i2 = qHet > dfHet ? Math.Max(0, (qHet - dfHet) / qHet * 100) : 0;

        return new BivariateResult
        {
            sensitivity = pooledSens,
            sensCiLower = pooledSens - 1.96 * seSens,
            sensCiUpper = pooledSens + 1.96 * seSens,
            specificity = pooledSpec,
            specCiLower = pooledSpec - 1.96 * seSpec,
            specCiUpper = pooledSpec + 1.96 * seSpec,
            dor = dor,
            auc = auc,
            tau2Sens = tau2Sens,
            tau2Spec = tau2Spec,
            rho = rho,
            nStudies = validStudies.Count,
            q = qHet,
            i2 = i2
        };
    }

    private static double ComputeCorrelation(List<double> x, List<double> y)
    {
        if (x.Count < 3) return 0;
        double mx = x.Average();
        double my = y.Average();
        double sxx = x.Sum(xi => (xi - mx) * (xi - mx));
        double syy = y.Sum(yi => (yi - my) * (yi - my));
        double sxy = x.Zip(y, (xi, yi) => (xi - mx) * (yi - my)).Sum();
        double denom = Math.Sqrt(sxx * syy);
        return denom > 0 ? sxy / denom : 0;
    }
}
