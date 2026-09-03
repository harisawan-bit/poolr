using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Phase 13 — Niche meta-analysis types (v0.5.7).
/// Correlations (Hunter-Schmidt), variability ratios, SCED, Poisson GLMM, agreement (kappa/ICC).
/// </summary>
public static class NicheEngine
{
    // ── Correlations (Hunter-Schmidt) ─────────────────────────────────────

    public class CorrelationStudy
    {
        public string study { get; set; } = "";
        public double? r { get; set; }
        public int? n { get; set; }
        public double? reliabilityX { get; set; }
        public double? reliabilityY { get; set; }
    }

    public class CorrelationResult
    {
        public double pooledR { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double sdR { get; set; }
        public double tau2 { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
        public int totalN { get; set; }
        public double? credibilityLower { get; set; }
        public double? credibilityUpper { get; set; }
    }

    public static CorrelationResult RunCorrelationHunterSchmidt(List<CorrelationStudy> studies)
    {
        var valid = studies.Where(s => s.r.HasValue && s.n.HasValue && s.n.Value > 3).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        // Fisher z-transform
        var zs = valid.Select(s => Math.Atanh(Math.Max(-0.9999, Math.Min(0.9999, s.r!.Value)))).ToList();
        var ns = valid.Select(s => s.n!.Value).ToList();

        // Reliability correction (Hunter-Schmidt)
        var corrected = new List<double>();
        for (int i = 0; i < zs.Count; i++)
        {
            double correction = valid[i].reliabilityX.HasValue && valid[i].reliabilityY.HasValue
                ? Math.Sqrt(valid[i].reliabilityX!.Value * valid[i].reliabilityY!.Value)
                : 1.0;
            corrected.Add(zs[i] / correction);
        }

        // Weight by sample size
        var weights = ns.Select(n => (double)(n - 3)).ToList();
        double sw = weights.Sum();
        double pooledZ = weights.Zip(corrected, (w, z) => w * z).Sum() / sw;
        double pooledR = Math.Tanh(pooledZ);

        // Variance of z: 1/(n-3)
        var vars = ns.Select(n => 1.0 / (n - 3)).ToList();
        double tau2 = EstimateTau2(corrected.ToArray(), vars.ToArray());
        double se = Math.Sqrt(1.0 / sw + tau2);
        double crit = 1.959964;

        // Credibility interval (80%): rho ± 1.28 * sdR
        double sdR = Math.Sqrt(Math.Max(0, tau2));

        return new CorrelationResult
        {
            pooledR = pooledR,
            ciLower = Math.Tanh(pooledZ - crit * se),
            ciUpper = Math.Tanh(pooledZ + crit * se),
            sdR = sdR,
            tau2 = tau2,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = valid.Count,
            totalN = ns.Sum(),
            credibilityLower = Math.Tanh(pooledZ - 1.28 * sdR),
            credibilityUpper = Math.Tanh(pooledZ + 1.28 * sdR)
        };
    }

    // ── Variability Ratios (CVR) ─────────────────────────────────────────

    public class VariabilityStudy
    {
        public string study { get; set; } = "";
        public double? mean1 { get; set; }
        public double? sd1 { get; set; }
        public double? mean2 { get; set; }
        public double? sd2 { get; set; }
        public int? n1 { get; set; }
        public int? n2 { get; set; }
    }

    public class VariabilityResult
    {
        public double pooledLnCVR { get; set; }
        public double cvr { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static VariabilityResult RunVariabilityRatio(List<VariabilityStudy> studies)
    {
        var valid = studies.Where(s =>
            s.mean1.HasValue && s.sd1.HasValue && s.mean2.HasValue && s.sd2.HasValue &&
            s.n1.HasValue && s.n2.HasValue && s.mean1.Value > 0 && s.mean2.Value > 0).ToList();

        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var lnCVRs = valid.Select(s =>
        {
            double cv1 = s.sd1!.Value / s.mean1!.Value;
            double cv2 = s.sd2!.Value / s.mean2!.Value;
            return Math.Log(cv1 / cv2);
        }).ToList();

        var vars = valid.Select(s =>
        {
            double cv1 = s.sd1!.Value / s.mean1!.Value;
            double cv2 = s.sd2!.Value / s.mean2!.Value;
            return (cv1 * cv1) / (2.0 * s.n1!.Value) + (cv2 * cv2) / (2.0 * s.n2!.Value);
        }).ToList();

        double tau2 = EstimateTau2(lnCVRs.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLnCVR = weights.Zip(lnCVRs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        return new VariabilityResult
        {
            pooledLnCVR = pooledLnCVR,
            cvr = Math.Exp(pooledLnCVR),
            ciLower = Math.Exp(pooledLnCVR - crit * se),
            ciUpper = Math.Exp(pooledLnCVR + crit * se),
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = valid.Count
        };
    }

    // ── Single-Case Experimental Designs (SCED) ───────────────────────────

    public class ScdStudy
    {
        public string study { get; set; } = "";
        public double? baselineMean { get; set; }
        public double? treatmentMean { get; set; }
        public double? baselineSd { get; set; }
        public double? treatmentSd { get; set; }
        public int? n { get; set; }
        public double? tauU { get; set; }
    }

    public class ScdResult
    {
        public double pooledTauU { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static ScdResult RunScd(List<ScdStudy> studies)
    {
        var valid = studies.Where(s => s.tauU.HasValue).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var tauUs = valid.Select(s => s.tauU!.Value).ToList();
        var vars = tauUs.Select(t => Math.Max(1.0 - t * t, 0.05) / 10.0).ToList(); // approximate variance

        double tau2 = EstimateTau2(tauUs.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooled = weights.Zip(tauUs, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        return new ScdResult
        {
            pooledTauU = pooled,
            ciLower = pooled - crit * se,
            ciUpper = pooled + crit * se,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = valid.Count
        };
    }

    // ── Poisson GLMM for Incidence Rates ─────────────────────────────────

    public class PoissonStudy
    {
        public string study { get; set; } = "";
        public int? events { get; set; }
        public double? personTime { get; set; }
    }

    public class PoissonResult
    {
        public double pooledRate { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public double tau2 { get; set; }
        public int nStudies { get; set; }
    }

    public static PoissonResult RunPoissonGlmm(List<PoissonStudy> studies)
    {
        var valid = studies.Where(s => s.events.HasValue && s.personTime.HasValue && s.personTime.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var logRates = valid.Select(s =>
        {
            double ev = s.events!.Value <= 0 ? 0.5 : s.events.Value;
            return Math.Log(ev / s.personTime!.Value);
        }).ToList();
        var vars = valid.Select(s =>
        {
            double ev = s.events!.Value <= 0 ? 0.5 : s.events.Value;
            return 1.0 / ev;
        }).ToList();

        double tau2 = EstimateTau2(logRates.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLogRate = weights.Zip(logRates, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        return new PoissonResult
        {
            pooledRate = Math.Exp(pooledLogRate),
            ciLower = Math.Exp(pooledLogRate - crit * se),
            ciUpper = Math.Exp(pooledLogRate + crit * se),
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            tau2 = tau2,
            nStudies = valid.Count
        };
    }

    // ── Agreement (Cohen's kappa, ICC) ──────────────────────────────────

    public class AgreementStudy
    {
        public string study { get; set; } = "";
        public double? kappa { get; set; }
        public double? se { get; set; }
    }

    public class AgreementResult
    {
        public double pooledKappa { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static AgreementResult RunAgreement(List<AgreementStudy> studies)
    {
        var valid = studies.Where(s => s.kappa.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var kappas = valid.Select(s => s.kappa!.Value).ToList();
        var vars = valid.Select(s => s.se!.Value * s.se.Value).ToList();

        double tau2 = EstimateTau2(kappas.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooled = weights.Zip(kappas, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        return new AgreementResult
        {
            pooledKappa = pooled,
            ciLower = pooled - crit * se,
            ciUpper = pooled + crit * se,
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
