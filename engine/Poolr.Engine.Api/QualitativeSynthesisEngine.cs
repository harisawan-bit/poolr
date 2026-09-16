using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.1 Qualitative meta-synthesis engine.
/// Implements meta-ethnography (Noblit & Hare), thematic synthesis (Thomas & Harden),
/// framework synthesis (Ritchie & Spencer), and vote counting.
/// Reference: Noblit & Hare (1988), Thomas & Harden (2008), Ritchie & Spencer (1994).
/// </summary>
public static class QualitativeSynthesisEngine
{
    public class QualRequest
    {
        public string method { get; set; } = "thematic";
        public List<QualStudy> studies { get; set; } = new();
    }

    public class QualStudy
    {
        public string id { get; set; } = "";
        public List<string> codes { get; set; } = new();
        public List<string>? quotes { get; set; }
        public string? themeGroup { get; set; }
    }

    public class QualResult
    {
        public string method { get; set; } = "";
        public int totalStudies { get; set; }
        public int uniqueCodes { get; set; }
        public int totalCodeInstances { get; set; }
        public List<CodeFrequency> codeFrequencies { get; set; } = new();
        public List<Translation> translations { get; set; } = new();
        public List<ThemeGroup> themeGroups { get; set; } = new();
        public string interpretation { get; set; } = "";
    }

    public class CodeFrequency
    {
        public string code { get; set; } = "";
        public int count { get; set; }
        public int studyCount { get; set; }
        public double frequency { get; set; }
        public List<string> studyIds { get; set; } = new();
    }

    public class Translation
    {
        public string codeA { get; set; } = "";
        public string codeB { get; set; } = "";
        public string relation { get; set; } = ""; // "reciprocal", "refutational", "lines-of-argument"
        public double strength { get; set; }
    }

    public class ThemeGroup
    {
        public string name { get; set; } = "";
        public List<string> codes { get; set; } = new();
        public int studyCount { get; set; }
    }

    public static QualResult Run(QualRequest req)
    {
        if (req.studies.Count < 2)
            throw new ArgumentException("At least 2 studies required");

        var result = new QualResult { method = req.method, totalStudies = req.studies.Count };

        switch (req.method.ToLowerInvariant())
        {
            case "thematic":
                RunThematic(req, result);
                break;
            case "meta_ethnography":
                RunMetaEthnography(req, result);
                break;
            case "framework":
                RunFramework(req, result);
                break;
            case "vote_counting":
                RunVoteCounting(req, result);
                break;
            default:
                throw new ArgumentException($"Unknown method: {req.method}");
        }

        return result;
    }

    private static void RunThematic(QualRequest req, QualResult result)
    {
        // Count code frequencies across studies
        var allCodes = new Dictionary<string, HashSet<string>>();
        foreach (var study in req.studies)
        {
            foreach (var code in study.codes.Distinct())
            {
                if (!allCodes.ContainsKey(code))
                    allCodes[code] = new HashSet<string>();
                allCodes[code].Add(study.id);
            }
        }

        result.uniqueCodes = allCodes.Count;
        result.totalCodeInstances = req.studies.Sum(s => s.codes.Count);
        result.codeFrequencies = allCodes
            .OrderByDescending(kv => kv.Value.Count)
            .Select(kv => new CodeFrequency
            {
                code = kv.Key,
                count = req.studies.Sum(s => s.codes.Count(c => c == kv.Key)),
                studyCount = kv.Value.Count,
                frequency = (double)kv.Value.Count / req.studies.Count,
                studyIds = kv.Value.ToList()
            }).ToList();

        result.interpretation = $"Thematic synthesis: {result.uniqueCodes} unique codes across {result.totalStudies} studies. " +
            $"Top code: '{result.codeFrequencies.FirstOrDefault()?.code}' in {result.codeFrequencies.FirstOrDefault()?.studyCount} studies.";
    }

    private static void RunMetaEthnography(QualRequest req, QualResult result)
    {
        // Build reciprocal translations (codes shared across studies)
        var codeStudies = new Dictionary<string, HashSet<string>>();
        foreach (var study in req.studies)
        {
            foreach (var code in study.codes.Distinct())
            {
                if (!codeStudies.ContainsKey(code))
                    codeStudies[code] = new HashSet<string>();
                codeStudies[code].Add(study.id);
            }
        }

        result.uniqueCodes = codeStudies.Count;

        // Find pairs of codes that co-occur across studies (reciprocal translation)
        var codes = codeStudies.Keys.ToList();
        var translations = new List<Translation>();
        for (int i = 0; i < codes.Count; i++)
        {
            for (int j = i + 1; j < codes.Count; j++)
            {
                var shared = codeStudies[codes[i]].Intersect(codeStudies[codes[j]]).Count();
                if (shared > 0)
                {
                    translations.Add(new Translation
                    {
                        codeA = codes[i],
                        codeB = codes[j],
                        relation = "reciprocal",
                        strength = (double)shared / req.studies.Count
                    });
                }
            }
        }

        result.translations = translations;
        result.interpretation = $"Meta-ethnography: {translations.Count} reciprocal translations identified across {req.studies.Count} studies.";
    }

    private static void RunFramework(QualRequest req, QualResult result)
    {
        // Group codes by themeGroup if specified
        var groups = req.studies
            .Where(s => s.themeGroup != null)
            .GroupBy(s => s.themeGroup!)
            .Select(g => new ThemeGroup
            {
                name = g.Key,
                codes = g.SelectMany(s => s.codes).Distinct().ToList(),
                studyCount = g.Count()
            }).ToList();

        result.themeGroups = groups;
        result.interpretation = $"Framework synthesis: {groups.Count} thematic groups identified.";
    }

    private static void RunVoteCounting(QualRequest req, QualResult result)
    {
        // Count studies reporting each code as a "vote"
        var votes = new Dictionary<string, int>();
        foreach (var study in req.studies)
        {
            foreach (var code in study.codes.Distinct())
            {
                if (!votes.ContainsKey(code)) votes[code] = 0;
                votes[code]++;
            }
        }

        result.codeFrequencies = votes
            .OrderByDescending(kv => kv.Value)
            .Select(kv => new CodeFrequency
            {
                code = kv.Key,
                count = kv.Value,
                studyCount = kv.Value,
                frequency = (double)kv.Value / req.studies.Count
            }).ToList();

        result.uniqueCodes = votes.Count;
        result.interpretation = $"Vote counting: {votes.Count} codes, top code has {votes.Values.Max()}/{req.studies.Count} votes.";
    }
}
