using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Phase 20-24 engines: Prognostic, Qualitative, Bibliometric, Sequential/TSA, Decision Curve (v0.5.7).
/// </summary>
public static class AdvancedEngine
{
    // ── Phase 20: Prognostic Factor / Model ──────────────────────────────

    public class PrognosticStudy
    {
        public string study { get; set; } = "";
        public double? logHr { get; set; }
        public double? se { get; set; }
        public double? cStatistic { get; set; }
        public double? eoRatio { get; set; }
        public double? calibrationSlope { get; set; }
    }

    public class PrognosticResult
    {
        public double pooledLogHr { get; set; }
        public double pooledHr { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double pooledCStatistic { get; set; }
        public double pooledCalibrationSlope { get; set; }
        public double i2 { get; set; }
        public int nStudies { get; set; }
    }

    public static PrognosticResult RunPrognostic(List<PrognosticStudy> studies)
    {
        var validHr = studies.Where(s => s.logHr.HasValue && s.se.HasValue && s.se.Value > 0).ToList();
        var validC = studies.Where(s => s.cStatistic.HasValue).ToList();
        var validCal = studies.Where(s => s.calibrationSlope.HasValue).ToList();

        if (validHr.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        var effects = validHr.Select(s => s.logHr!.Value).ToList();
        var vars = validHr.Select(s => s.se!.Value * s.se.Value).ToList();

        double tau2 = EstimateTau2(effects.ToArray(), vars.ToArray());
        var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
        double sw = weights.Sum();
        double pooledLogHr = weights.Zip(effects, (w, e) => w * e).Sum() / sw;
        double se = Math.Sqrt(1.0 / sw);
        double crit = 1.959964;

        return new PrognosticResult
        {
            pooledLogHr = pooledLogHr,
            pooledHr = Math.Exp(pooledLogHr),
            ciLower = Math.Exp(pooledLogHr - crit * se),
            ciUpper = Math.Exp(pooledLogHr + crit * se),
            pooledCStatistic = validC.Count > 0 ? validC.Average(s => s.cStatistic!.Value) : 0,
            pooledCalibrationSlope = validCal.Count > 0 ? validCal.Average(s => s.calibrationSlope!.Value) : 0,
            i2 = tau2 / (tau2 + vars.Average()) * 100,
            nStudies = validHr.Count
        };
    }

    // ── Phase 21: Qualitative Synthesis ──────────────────────────────────

    public class CodeEntry
    {
        public string study { get; set; } = "";
        public string code { get; set; } = "";
        public int frequency { get; set; }
    }

    public class QualitativeResult
    {
        public List<CodeFrequency> codeFrequencies { get; set; } = new();
        public int totalCodes { get; set; }
        public int uniqueCodes { get; set; }
    }

    public class CodeFrequency
    {
        public string code { get; set; } = "";
        public int count { get; set; }
        public int studies { get; set; }
        public double prevalence { get; set; }
    }

    public static QualitativeResult RunQualitative(List<CodeEntry> entries)
    {
        if (entries.Count == 0)
        {
            return new QualitativeResult();
        }

        int totalDistinctStudies = Math.Max(entries.Select(e => e.study).Distinct().Count(), 1);
        var grouped = entries.GroupBy(e => e.code.ToLower().Trim())
            .Select(g => new CodeFrequency
            {
                code = g.Key,
                count = g.Sum(e => e.frequency),
                studies = g.Select(e => e.study).Distinct().Count(),
                prevalence = (double)g.Select(e => e.study).Distinct().Count() / totalDistinctStudies
            })
            .OrderByDescending(c => c.count)
            .ToList();

        return new QualitativeResult
        {
            codeFrequencies = grouped,
            totalCodes = entries.Sum(e => e.frequency),
            uniqueCodes = grouped.Count
        };
    }

    // ── Phase 22: Bibliometric / Citation Analysis ───────────────────────

    public class CitationEntry
    {
        public string study { get; set; } = "";
        public List<string> references { get; set; } = new();
        public int? year { get; set; }
    }

    public class BibliometricResult
    {
        public List<CitationPair> coCitationMatrix { get; set; } = new();
        public List<RpysPeak> rpysPeaks { get; set; } = new();
        public int totalReferences { get; set; }
        public int uniqueReferences { get; set; }
    }

    public class CitationPair
    {
        public string ref1 { get; set; } = "";
        public string ref2 { get; set; } = "";
        public int count { get; set; }
    }

    public class RpysPeak
    {
        public int year { get; set; }
        public int citations { get; set; }
        public double noveltyScore { get; set; }
    }

    public static BibliometricResult RunBibliometric(List<CitationEntry> entries)
    {
        // Co-citation analysis
        var coCitations = new Dictionary<(string, string), int>();
        foreach (var entry in entries)
        {
            var refs = entry.references.Distinct().ToList();
            for (int i = 0; i < refs.Count; i++)
            {
                for (int j = i + 1; j < refs.Count; j++)
                {
                    var key = (refs[i].CompareTo(refs[j]) < 0) ? (refs[i], refs[j]) : (refs[j], refs[i]);
                    if (!coCitations.ContainsKey(key)) coCitations[key] = 0;
                    coCitations[key]++;
                }
            }
        }

        // RPYS (Reference Publication Year Spectroscopy)
        var yearCounts = entries.SelectMany(e => e.references.Select(r => e.year ?? 0))
            .Where(y => y > 1900)
            .GroupBy(y => y)
            .OrderBy(g => g.Key)
            .Select(g => new RpysPeak
            {
                year = g.Key,
                citations = g.Count(),
                noveltyScore = (double)g.Count() / entries.Count
            })
            .ToList();

        return new BibliometricResult
        {
            coCitationMatrix = coCitations.OrderByDescending(kv => kv.Value).Take(50)
                .Select(kv => new CitationPair { ref1 = kv.Key.Item1, ref2 = kv.Key.Item2, count = kv.Value }).ToList(),
            rpysPeaks = yearCounts,
            totalReferences = entries.Sum(e => e.references.Count),
            uniqueReferences = entries.SelectMany(e => e.references).Distinct().Count()
        };
    }

    // ── Phase 23: Sequential / TSA ───────────────────────────────────────

    public class SequentialStudy
    {
        public string study { get; set; } = "";
        public double? zScore { get; set; }
        public int? informationFraction { get; set; } // cumulative sample size
    }

    public class SequentialRequest
    {
        public List<SequentialStudy> studies { get; set; } = new();
        public double alpha { get; set; } = 0.05;
        public double beta { get; set; } = 0.20;
        public double expectedEffect { get; set; }
    }

    public class SequentialResult
    {
        public List<ZCurvePoint> zCurve { get; set; } = new();
        public double requiredInformationSize { get; set; }
        public double accruedFraction { get; set; }
        public bool crossedBoundary { get; set; }
        public string boundaryType { get; set; } = "O'Brien-Fleming";
    }

    public class ZCurvePoint
    {
        public int study { get; set; }
        public double zScore { get; set; }
        public double boundary { get; set; }
        public double futility { get; set; }
    }

    public static SequentialResult RunSequential(List<SequentialStudy> studies, double alpha, double beta, double expectedEffect)
    {
        var valid = studies.Where(s => s.zScore.HasValue).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        // RIS (Required Information Size)
        double zA = 1.959964; // alpha = 0.05
        double zB = 0.841621; // beta = 0.20
        double eff = Math.Abs(expectedEffect) < 1e-6 ? 0.2 : expectedEffect;
        double ris = Math.Pow(zA + zB, 2) / (eff * eff);

        var zCurve = new List<ZCurvePoint>();
        double cumulativeZ = 0;
        int cumulativeN = 0;

        for (int i = 0; i < valid.Count; i++)
        {
            cumulativeZ += valid[i].zScore!.Value;
            cumulativeN += valid[i].informationFraction ?? 100;

            double infoFraction = cumulativeN / ris;
            double boundary = zA / Math.Sqrt(Math.Max(infoFraction, 0.01));
            double futility = -zB / Math.Sqrt(Math.Max(infoFraction, 0.01));

            zCurve.Add(new ZCurvePoint
            {
                study = i + 1,
                zScore = cumulativeZ,
                boundary = boundary,
                futility = futility
            });
        }

        return new SequentialResult
        {
            zCurve = zCurve,
            requiredInformationSize = ris,
            accruedFraction = cumulativeN / ris,
            crossedBoundary = zCurve.Any(p => Math.Abs(p.zScore) > p.boundary),
            boundaryType = "O'Brien-Fleming"
        };
    }

    // ── Phase 24: Decision Curve Analysis ────────────────────────────────

    public class DcaStudy
    {
        public string study { get; set; } = "";
        public double? sensitivity { get; set; }
        public double? specificity { get; set; }
        public double? prevalence { get; set; }
    }

    public class DcaResult
    {
        public List<DcaPoint> netBenefitCurve { get; set; } = new();
        public double treatAllNb { get; set; }
        public double treatNoneNb { get; set; }
    }

    public class DcaPoint
    {
        public double threshold { get; set; }
        public double netBenefitModel { get; set; }
        public double netBenefitAll { get; set; }
        public double netBenefitNone { get; set; }
    }

    public static DcaResult RunDca(List<DcaStudy> studies)
    {
        var valid = studies.Where(s => s.sensitivity.HasValue && s.specificity.HasValue && s.prevalence.HasValue).ToList();
        if (valid.Count < 2) throw new ArgumentException("At least 2 valid studies required");

        double pooledSens = valid.Average(s => s.sensitivity!.Value);
        double pooledSpec = valid.Average(s => s.specificity!.Value);
        double pooledPrev = valid.Average(s => s.prevalence!.Value);

        var curve = new List<DcaPoint>();
        for (double pt = 0; pt < 0.995; pt = Math.Round(pt + 0.01, 2))
        {
            double odds = pt / Math.Max(1.0 - pt, 1e-6);
            double nbModel = pooledSens * pooledPrev - (1 - pooledSpec) * (1 - pooledPrev) * odds;
            double nbAll = pooledPrev - (1 - pooledPrev) * odds;
            double nbNone = 0;

            curve.Add(new DcaPoint
            {
                threshold = pt,
                netBenefitModel = nbModel,
                netBenefitAll = nbAll,
                netBenefitNone = nbNone
            });
        }

        return new DcaResult
        {
            netBenefitCurve = curve,
            treatAllNb = pooledPrev,
            treatNoneNb = 0
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
