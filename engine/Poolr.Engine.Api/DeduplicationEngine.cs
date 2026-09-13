using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Poolr.Engine.Api;

/// <summary>
/// Automated Citation Deduplication engine (v0.6.0).
/// Detects duplicate citations from systematic review searches.
/// Uses multi-stage matching: exact DOI, exact PMID, fuzzy title+year+authors.
/// Based on ASySD (Automated Systematic Search Deduplicator) approach.
/// </summary>
public static class DeduplicationEngine
{
    public class Citation
    {
        public string Id { get; set; } = "";
        public string Title { get; set; } = "";
        public string Year { get; set; } = "";
        public string Authors { get; set; } = "";
        public string Doi { get; set; } = "";
        public string Pmid { get; set; } = "";
        public string Journal { get; set; } = "";
        public string Abstract { get; set; } = "";
    }

    public class DuplicateGroup
    {
        public List<string> CitationIds { get; set; } = new();
        public string CanonicalId { get; set; } = "";
        public string MatchType { get; set; } = ""; // doi, pmid, title_year, fuzzy
        public double Confidence { get; set; }
    }

    public class DeduplicationResult
    {
        public List<DuplicateGroup> Groups { get; set; } = new();
        public int TotalCitations { get; set; }
        public int UniqueCitations { get; set; }
        public int DuplicatesRemoved => TotalCitations - UniqueCitations;
    }

    public static DeduplicationResult Deduplicate(List<Citation> citations)
    {
        var result = new DeduplicationResult { TotalCitations = citations.Count };
        var processed = new HashSet<string>();
        var groups = new List<DuplicateGroup>();

        // Stage 1: Exact DOI matches
        var doiGroups = citations
            .Where(c => !string.IsNullOrWhiteSpace(c.Doi))
            .GroupBy(c => NormalizeDoi(c.Doi))
            .Where(g => g.Count() > 1)
            .ToList();

        foreach (var group in doiGroups)
        {
            var ids = group.Select(c => c.Id).ToList();
            groups.Add(new DuplicateGroup
            {
                CitationIds = ids,
                CanonicalId = ids[0],
                MatchType = "doi",
                Confidence = 1.0
            });
            foreach (var id in ids) processed.Add(id);
        }

        // Stage 2: Exact PMID matches
        var pmidGroups = citations
            .Where(c => !string.IsNullOrWhiteSpace(c.Pmid) && !processed.Contains(c.Id))
            .GroupBy(c => c.Pmid.Trim())
            .Where(g => g.Count() > 1)
            .ToList();

        foreach (var group in pmidGroups)
        {
            var ids = group.Select(c => c.Id).ToList();
            groups.Add(new DuplicateGroup
            {
                CitationIds = ids,
                CanonicalId = ids[0],
                MatchType = "pmid",
                Confidence = 1.0
            });
            foreach (var id in ids) processed.Add(id);
        }

        // Stage 3: Title + Year exact match
        var titleGroups = citations
            .Where(c => !processed.Contains(c.Id) && !string.IsNullOrWhiteSpace(c.Title))
            .GroupBy(c => new { Title = NormalizeTitle(c.Title), Year = c.Year?.Trim() })
            .Where(g => g.Count() > 1)
            .ToList();

        foreach (var group in titleGroups)
        {
            var ids = group.Select(c => c.Id).ToList();
            groups.Add(new DuplicateGroup
            {
                CitationIds = ids,
                CanonicalId = ids[0],
                MatchType = "title_year",
                Confidence = 0.95
            });
            foreach (var id in ids) processed.Add(id);
        }

        // Stage 4: Fuzzy title matching
        var remaining = citations.Where(c => !processed.Contains(c.Id)).ToList();
        var fuzzyGroups = FuzzyMatch(remaining);
        groups.AddRange(fuzzyGroups);
        foreach (var g in fuzzyGroups) foreach (var id in g.CitationIds) processed.Add(id);

        result.Groups = groups;
        result.UniqueCitations = citations.Count - groups.Sum(g => g.CitationIds.Count - 1);
        return result;
    }

    private static List<DuplicateGroup> FuzzyMatch(List<Citation> citations)
    {
        var groups = new List<DuplicateGroup>();
        var processed = new HashSet<string>();

        for (int i = 0; i < citations.Count; i++)
        {
            if (processed.Contains(citations[i].Id)) continue;

            var group = new List<string> { citations[i].Id };
            var norm1 = NormalizeTitle(citations[i].Title);

            for (int j = i + 1; j < citations.Count; j++)
            {
                if (processed.Contains(citations[j].Id)) continue;

                var norm2 = NormalizeTitle(citations[j].Title);

                // Year must match (or be missing)
                if (!string.IsNullOrWhiteSpace(citations[i].Year) && !string.IsNullOrWhiteSpace(citations[j].Year) &&
                    citations[i].Year.Trim() != citations[j].Year.Trim())
                    continue;

                double similarity = ComputeSimilarity(norm1, norm2);
                if (similarity >= 0.85)
                {
                    group.Add(citations[j].Id);
                }
            }

            if (group.Count > 1)
            {
                groups.Add(new DuplicateGroup
                {
                    CitationIds = group,
                    CanonicalId = group[0],
                    MatchType = "fuzzy",
                    Confidence = 0.85
                });
                foreach (var id in group) processed.Add(id);
            }
        }

        return groups;
    }

    private static double ComputeSimilarity(string s1, string s2)
    {
        if (string.IsNullOrEmpty(s1) || string.IsNullOrEmpty(s2)) return 0;

        // Token-based Jaccard similarity
        var tokens1 = new HashSet<char[]>(s1.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(t => t.ToCharArray()));
        var tokens2 = new HashSet<char[]>(s2.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(t => t.ToCharArray()));

        int intersection = tokens1.Count(t => tokens2.Any(t2 => t2.SequenceEqual(t)));
        int union = tokens1.Count + tokens2.Count - intersection;

        return union > 0 ? (double)intersection / union : 0;
    }

    private static string NormalizeDoi(string doi)
    {
        var d = doi.Trim().ToLowerInvariant();
        // Remove https://doi.org/ prefix
        if (d.StartsWith("https://doi.org/")) d = d.Substring("https://doi.org/".Length);
        if (d.StartsWith("http://doi.org/")) d = d.Substring("http://doi.org/".Length);
        if (d.StartsWith("doi:")) d = d.Substring(4);
        return d.Trim();
    }

    private static string NormalizeTitle(string title)
    {
        var t = title.Trim().ToLowerInvariant();
        // Remove punctuation
        t = Regex.Replace(t, @"[^\w\s]", " ");
        // Remove extra whitespace
        t = Regex.Replace(t, @"\s+", " ").Trim();
        // Remove common stop words
        var stopWords = new HashSet<string> { "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "with", "by", "from" };
        var tokens = t.Split(' ').Where(tk => !stopWords.Contains(tk) && tk.Length > 1).ToArray();
        return string.Join(" ", tokens);
    }
}
