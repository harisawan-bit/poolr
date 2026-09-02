using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Living Systematic Review engine (v0.5.7).
/// Cumulative MA with automated re-search, ML priority screening.
/// </summary>
public static class LivingReviewEngine
{
    public class CumulativeStudy
    {
        public string study { get; set; } = "";
        public string pmid { get; set; } = "";
        public double? effect { get; set; }
        public double? se { get; set; }
        public int? year { get; set; }
        public DateTime? dateAdded { get; set; }
    }

    public class CumulativeRequest
    {
        public List<CumulativeStudy> studies { get; set; } = new();
        public bool chronological { get; set; } = true;
    }

    public class CumulativeEntry
    {
        public string study { get; set; } = "";
        public int k { get; set; }
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public DateTime? dateAdded { get; set; }
    }

    public class CumulativeResult
    {
        public List<CumulativeEntry> cumulative { get; set; } = new();
        public double finalPooledEffect { get; set; }
        public double finalCiLower { get; set; }
        public double finalCiUpper { get; set; }
        public double finalI2 { get; set; }
    }

    public class PriorityScreeningRequest
    {
        public List<StudyRecord> records { get; set; } = new();
        public List<ScreeningDecision> priorDecisions { get; set; } = new();
    }

    public class StudyRecord
    {
        public string id { get; set; } = "";
        public string title { get; set; } = "";
        public string? abstractText { get; set; }
    }

    public class ScreeningDecision
    {
        public string recordId { get; set; } = "";
        public string decision { get; set; } = ""; // include, exclude
    }

    public class PriorityResult
    {
        public string recordId { get; set; } = "";
        public double probability { get; set; }
        public int rank { get; set; }
    }

    public class PriorityScreeningResult
    {
        public List<PriorityResult> rankedRecords { get; set; } = new();
        public int suggestedStopAfter { get; set; }
        public string stoppingReason { get; set; } = "";
    }

    public static CumulativeResult RunCumulative(CumulativeRequest req)
    {
        var sorted = req.chronological
            ? req.studies.Where(s => s.effect.HasValue && s.se.HasValue).OrderBy(s => s.dateAdded ?? DateTime.MinValue).ToList()
            : req.studies.Where(s => s.effect.HasValue && s.se.HasValue).OrderBy(s => s.year ?? 0).ToList();

        if (sorted.Count < 2) throw new ArgumentException("At least 2 studies required");

        var cumulative = new List<CumulativeEntry>();
        double runningEffect = 0;

        for (int i = 1; i <= sorted.Count; i++)
        {
            var subset = sorted.Take(i).ToList();
            var effects = subset.Select(s => s.effect.Value).ToList();
            var vars = subset.Select(s => s.se.Value * s.se.Value).ToArray();

            double tau2 = EstimateTau2(effects.ToArray(), vars);
            var weights = vars.Select(v => 1.0 / (v + tau2)).ToList();
            double sw = weights.Sum();
            double pooled = weights.Zip(effects, (w, e) => w * e).Sum() / sw;
            double se = Math.Sqrt(1.0 / sw);
            double crit = 1.959964;

            // Q and I²
            double q = weights.Zip(effects, (w, e) => w * Math.Pow(e - pooled, 2)).Sum();
            int df = i - 1;
            double i2 = (q > df && q > 0) ? Math.Max(0, (q - df) / q * 100) : 0;

            cumulative.Add(new CumulativeEntry
            {
                study = subset.Last().study,
                k = i,
                pooledEffect = pooled,
                ciLower = pooled - crit * se,
                ciUpper = pooled + crit * se,
                i2 = i2,
                dateAdded = subset.Last().dateAdded
            });

            runningEffect = pooled;
        }

        return new CumulativeResult
        {
            cumulative = cumulative,
            finalPooledEffect = runningEffect,
            finalCiLower = cumulative.Last().ciLower,
            finalCiUpper = cumulative.Last().ciUpper,
            finalI2 = cumulative.Last().i2
        };
    }

    public static PriorityScreeningResult RunPriorityScreening(PriorityScreeningRequest req)
    {
        if (req.priorDecisions.Count < 10)
        {
            return new PriorityScreeningResult
            {
                rankedRecords = req.records.Select((r, i) => new PriorityResult
                {
                    recordId = r.id,
                    probability = 0.5,
                    rank = i + 1
                }).ToList(),
                suggestedStopAfter = req.records.Count,
                stoppingReason = "Insufficient prior decisions (<10) for ML ranking. Screen all records."
            };
        }

        // Simple logistic regression on title/abstract features
        var features = req.records.Select(r => ExtractFeatures(r.title + " " + (r.abstractText ?? ""))).ToList();
        var labels = req.records.Select(r =>
            req.priorDecisions.FirstOrDefault(d => d.recordId == r.id)?.decision == "include" ? 1.0 : 0.0
        ).ToList();

        // Train simple classifier
        var weights = TrainLogistic(features, labels);

        // Score all records
        var scores = new List<PriorityResult>();
        for (int i = 0; i < req.records.Count; i++)
        {
            double score = Predict(features[i], weights);
            scores.Add(new PriorityResult
            {
                recordId = req.records[i].id,
                probability = score,
                rank = 0
            });
        }

        // Rank by probability descending
        var ranked = scores.OrderByDescending(s => s.probability).ToList();
        for (int i = 0; i < ranked.Count; i++)
            ranked[i].rank = i + 1;

        // Stopping rule: after N consecutive predicted excludes
        int consecutiveExcludes = 0;
        int stopAfter = ranked.Count;
        for (int i = 0; i < ranked.Count; i++)
        {
            if (ranked[i].probability < 0.1)
            {
                consecutiveExcludes++;
                if (consecutiveExcludes >= 20)
                {
                    stopAfter = i + 1;
                    break;
                }
            }
            else
            {
                consecutiveExcludes = 0;
            }
        }

        return new PriorityScreeningResult
        {
            rankedRecords = ranked,
            suggestedStopAfter = stopAfter,
            stoppingReason = stopAfter < ranked.Count
                ? $"After {stopAfter} records, 20 consecutive predicted-excludes. Screening can likely stop."
                : "No clear stopping point found. Screen all records."
        };
    }

    private static double[] ExtractFeatures(string text)
    {
        // Simple keyword-based features
        var features = new List<double>();
        string lower = text.ToLower();

        // RCT-related
        features.Add(lower.Contains("random") ? 1 : 0);
        features.Add(lower.Contains("rct") ? 1 : 0);
        features.Add(lower.Contains("placebo") ? 1 : 0);
        features.Add(lower.Contains("double-blind") ? 1 : 0);

        // Study design
        features.Add(lower.Contains("cohort") ? 1 : 0);
        features.Add(lower.Contains("case-control") ? 1 : 0);
        features.Add(lower.Contains("cross-sectional") ? 1 : 0);

        // Sample size (proxy: numbers in text)
        features.Add(System.Text.RegularExpressions.Regex.Matches(lower, @"\b\d+\b").Count / 100.0);

        return features.ToArray();
    }

    private static double[] TrainLogistic(List<double[]> features, List<double> labels)
    {
        int nFeatures = features[0].Length;
        var weights = new double[nFeatures + 1]; // +1 for bias

        // Simple gradient descent
        double lr = 0.01;
        for (int iter = 0; iter < 100; iter++)
        {
            var gradients = new double[nFeatures + 1];

            for (int i = 0; i < features.Count; i++)
            {
                double prediction = Predict(features[i], weights);
                double error = prediction - labels[i];

                gradients[0] += error; // bias gradient
                for (int j = 0; j < nFeatures; j++)
                    gradients[j + 1] += error * features[i][j];
            }

            weights[0] -= lr * gradients[0] / features.Count;
            for (int j = 0; j < nFeatures; j++)
                weights[j + 1] -= lr * gradients[j + 1] / features.Count;
        }

        return weights;
    }

    private static double Predict(double[] features, double[] weights)
    {
        double z = weights[0]; // bias
        for (int i = 0; i < features.Length; i++)
            z += features[i] * weights[i + 1];
        return 1.0 / (1.0 + Math.Exp(-z));
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
