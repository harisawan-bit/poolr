using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// Citation Network Analysis engine (v0.6.0).
/// Co-citation analysis, bibliographic coupling, and citation mapping.
/// Used in systematic reviews to identify seminal papers and research clusters.
/// </summary>
public static class CitationNetworkEngine
{
    public class CitationEntry
    {
        public string id { get; set; } = "";
        public string title { get; set; } = "";
        public List<string> references { get; set; } = new();
        public int? year { get; set; }
        public string? journal { get; set; }
    }

    public class CitationNetworkRequest
    {
        public List<CitationEntry> papers { get; set; } = new();
        public int minCoCitation { get; set; } = 2;
        public bool includeBibliographicCoupling { get; set; } = true;
    }

    public class CoCitationPair
    {
        public string paper1 { get; set; } = "";
        public string paper2 { get; set; } = "";
        public int count { get; set; }
        public double jaccard { get; set; }
    }

    public class BibliographicCouplingPair
    {
        public string paper1 { get; set; } = "";
        public string paper2 { get; set; } = "";
        public int sharedReferences { get; set; }
        public double couplingStrength { get; set; }
    }

    public class ResearchCluster
    {
        public int clusterId { get; set; }
        public List<string> paperIds { get; set; } = new();
        public string label { get; set; } = "";
        public int totalCitations { get; set; }
    }

    public class CitationNetworkResult
    {
        public List<CoCitationPair> coCitations { get; set; } = new();
        public List<BibliographicCouplingPair> bibliographicCouplings { get; set; } = new();
        public List<ResearchCluster> clusters { get; set; } = new();
        public List<CentralityScore> centrality { get; set; } = new();
        public int totalPapers { get; set; }
        public int totalUniqueReferences { get; set; }
    }

    public class CentralityScore
    {
        public string paperId { get; set; } = "";
        public string title { get; set; } = "";
        public int citationCount { get; set; }
        public int referenceCount { get; set; }
        public double degreeCentrality { get; set; }
        public double betweennessCentrality { get; set; }
    }

    public static CitationNetworkResult Analyze(CitationNetworkRequest req)
    {
        var result = new CitationNetworkResult { totalPapers = req.papers.Count };

        // Build reference sets
        var referenceSets = new Dictionary<string, HashSet<string>>();
        foreach (var paper in req.papers)
            referenceSets[paper.id] = new HashSet<string>(paper.references);

        // Co-citation analysis
        var coCitationCounts = new Dictionary<(string, string), int>();
        foreach (var paper in req.papers)
        {
            var refs = paper.references.Distinct().ToList();
            for (int i = 0; i < refs.Count; i++)
            {
                for (int j = i + 1; j < refs.Count; j++)
                {
                    var key = string.Compare(refs[i], refs[j]) < 0 ? (refs[i], refs[j]) : (refs[j], refs[i]);
                    if (!coCitationCounts.ContainsKey(key))
                        coCitationCounts[key] = 0;
                    coCitationCounts[key]++;
                }
            }
        }

        foreach (var kv in coCitationCounts.Where(kv => kv.Value >= req.minCoCitation))
        {
            result.coCitations.Add(new CoCitationPair
            {
                paper1 = kv.Key.Item1,
                paper2 = kv.Key.Item2,
                count = kv.Value,
                jaccard = CalculateJaccard(referenceSets, kv.Key.Item1, kv.Key.Item2)
            });
        }

        // Bibliographic coupling
        if (req.includeBibliographicCoupling)
        {
            for (int i = 0; i < req.papers.Count; i++)
            {
                for (int j = i + 1; j < req.papers.Count; j++)
                {
                    var shared = referenceSets[req.papers[i].id].Intersect(referenceSets[req.papers[j].id]).Count();
                    if (shared > 0)
                    {
                        result.bibliographicCouplings.Add(new BibliographicCouplingPair
                        {
                            paper1 = req.papers[i].id,
                            paper2 = req.papers[j].id,
                            sharedReferences = shared,
                            couplingStrength = (double)shared / Math.Max(
                                referenceSets[req.papers[i].id].Count + referenceSets[req.papers[j].id].Count - shared, 1)
                        });
                    }
                }
            }
        }

        // Centrality analysis
        var citationCounts = new Dictionary<string, int>();
        foreach (var paper in req.papers)
            citationCounts[paper.id] = 0;

        foreach (var paper in req.papers)
            foreach (var reference in paper.references)
                if (citationCounts.ContainsKey(reference))
                    citationCounts[reference]++;

        result.centrality = req.papers.Select(p => new CentralityScore
        {
            paperId = p.id,
            title = p.title,
            citationCount = citationCounts.ContainsKey(p.id) ? citationCounts[p.id] : 0,
            referenceCount = p.references.Count,
            degreeCentrality = CalculateDegreeCentrality(p.id, coCitationCounts)
        }).OrderByDescending(c => c.citationCount).ToList();

        // Simple clustering (connected components via co-citation)
        result.clusters = FindClusters(req.papers, coCitationCounts, req.minCoCitation);

        result.totalUniqueReferences = req.papers.SelectMany(p => p.references).Distinct().Count();
        return result;
    }

    private static double CalculateJaccard(Dictionary<string, HashSet<string>> referenceSets, string id1, string id2)
    {
        if (!referenceSets.ContainsKey(id1) || !referenceSets.ContainsKey(id2)) return 0;
        var intersection = referenceSets[id1].Intersect(referenceSets[id2]).Count();
        var union = referenceSets[id1].Union(referenceSets[id2]).Count();
        return union > 0 ? (double)intersection / union : 0;
    }

    private static double CalculateDegreeCentrality(string paperId, Dictionary<(string, string), int> coCitations)
    {
        return coCitations.Count(kv => kv.Key.Item1 == paperId || kv.Key.Item2 == paperId);
    }

    private static List<ResearchCluster> FindClusters(List<CitationEntry> papers, Dictionary<(string, string), int> coCitations, int minCoCitation)
    {
        var clusters = new List<ResearchCluster>();
        var visited = new HashSet<string>();
        int clusterId = 0;

        foreach (var paper in papers)
        {
            if (visited.Contains(paper.id)) continue;

            var cluster = new ResearchCluster { clusterId = clusterId };
            var queue = new Queue<string>();
            queue.Enqueue(paper.id);
            visited.Add(paper.id);

            while (queue.Count > 0)
            {
                var current = queue.Dequeue();
                cluster.paperIds.Add(current);

                var neighbors = coCitations
                    .Where(kv => (kv.Key.Item1 == current || kv.Key.Item2 == current) && kv.Value >= minCoCitation)
                    .Select(kv => kv.Key.Item1 == current ? kv.Key.Item2 : kv.Key.Item1)
                    .Where(n => !visited.Contains(n));

                foreach (var neighbor in neighbors)
                {
                    visited.Add(neighbor);
                    queue.Enqueue(neighbor);
                }
            }

            if (cluster.paperIds.Count >= 2)
            {
                cluster.totalCitations = cluster.paperIds.Sum(p => papers.First(pp => pp.id == p).references.Count);
                clusters.Add(cluster);
                clusterId++;
            }
        }

        return clusters;
    }
}

/// <summary>
/// Adjusted Indirect Comparison (Bucher method) engine (v0.6.0).
/// Compares two treatments via a common comparator when direct comparison is unavailable.
/// Bucher et al. (1997) methodology.
/// </summary>
public static class BucherIndirectComparisonEngine
{
    public class BucherArm
    {
        public string treatment { get; set; } = "";
        public double? effectVsCommon { get; set; } // log-scale effect vs common comparator
        public double? seVsCommon { get; set; }
    }

    public class BucherRequest
    {
        public string treatmentA { get; set; } = "";
        public string treatmentB { get; set; } = "";
        public string commonComparator { get; set; } = "";
        public BucherArm armA { get; set; } = new();
        public BucherArm armB { get; set; } = new();
        public string measure { get; set; } = "OR"; // OR, RR, HR, MD
        public bool logScale { get; set; } = true;
    }

    public class BucherResult
    {
        public string treatmentA { get; set; } = "";
        public string treatmentB { get; set; } = "";
        public string commonComparator { get; set; } = "";
        public string measure { get; set; } = "";
        public double indirectEffect { get; set; } // A vs B (negative favors A)
        public double se { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double z { get; set; }
        public double p { get; set; }
        public double i2 { get; set; }
        public double q { get; set; }
        public string interpretation { get; set; } = "";
    }

    public static BucherResult Compare(BucherRequest req)
    {
        if (!req.armA.effectVsCommon.HasValue || !req.armB.effectVsCommon.HasValue)
            throw new ArgumentException("Both arms must have effect estimates");

        if (!req.armA.seVsCommon.HasValue || !req.armB.seVsCommon.HasValue)
            throw new ArgumentException("Both arms must have standard errors");

        double effectA = req.armA.effectVsCommon.Value;
        double effectB = req.armB.effectVsCommon.Value;
        double seA = req.armA.seVsCommon.Value;
        double seB = req.armB.seVsCommon.Value;

        // Indirect comparison: A vs B = (A vs Common) - (B vs Common)
        double indirectEffect = effectA - effectB;
        double seIndirect = Math.Sqrt(seA * seA + seB * seB);

        double z = indirectEffect / seIndirect;
        double p = 2 * (1 - Stats.NormalCdf(Math.Abs(z)));
        double crit = 1.959964;

        double ciLower = indirectEffect - crit * seIndirect;
        double ciUpper = indirectEffect + crit * seIndirect;

        // Back-transform if needed
        if (!req.logScale)
        {
            indirectEffect = Math.Exp(indirectEffect);
            ciLower = Math.Exp(ciLower);
            ciUpper = Math.Exp(ciUpper);
        }

        // Heterogeneity (simplified: based on arm discrepancies)
        double q = (effectA - effectB) * (effectA - effectB) / (seA * seA + seB * seB);
        double i2 = Math.Max(0, (q - 1) / q * 100);

        string interp;
        if (p < 0.05)
            interp = $"{req.treatmentA} is significantly different from {req.treatmentB} (indirect comparison via {req.commonComparator}). ";
        else
            interp = $"No significant difference between {req.treatmentA} and {req.treatmentB} (indirect comparison via {req.commonComparator}). ";

        if (req.measure == "OR" || req.measure == "HR" || req.measure == "RR")
        {
            double nullValue = 1.0;
            interp += indirectEffect < nullValue
                ? $"{req.treatmentA} appears more effective."
                : indirectEffect > nullValue
                    ? $"{req.treatmentB} appears more effective."
                    : "No clear difference.";
        }

        return new BucherResult
        {
            treatmentA = req.treatmentA,
            treatmentB = req.treatmentB,
            commonComparator = req.commonComparator,
            measure = req.measure,
            indirectEffect = indirectEffect,
            se = seIndirect,
            ciLower = ciLower,
            ciUpper = ciUpper,
            z = z,
            p = p,
            i2 = i2,
            q = q,
            interpretation = interp
        };
    }
}

/// <summary>
/// Component Network Meta-Analysis (CNMA) engine (v0.6.0).
/// Decomposes multicomponent interventions into individual components.
/// Welton et al. (2009) methodology.
/// </summary>
public static class ComponentNmaEngine
{
    public class ComponentIntervention
    {
        public string name { get; set; } = "";
        public List<string> components { get; set; } = new();
        public double? effect { get; set; } // vs placebo
        public double? se { get; set; }
    }

    public class CnmaRequest
    {
        public List<ComponentIntervention> interventions { get; set; } = new();
        public string referenceGroup { get; set; } = "Placebo";
    }

    public class ComponentEffect
    {
        public string component { get; set; } = "";
        public double effect { get; set; }
        public double se { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double p { get; set; }
        public int nStudies { get; set; }
    }

    public class CnmaResult
    {
        public List<ComponentEffect> componentEffects { get; set; } = new();
        public List<List<double>> interactionMatrix { get; set; } = new();
        public double residualInconsistency { get; set; }
        public int nComponents { get; set; }
        public int nInterventions { get; set; }
        public List<string> components { get; set; } = new();
    }

    public static CnmaResult Run(CnmaRequest req)
    {
        // Collect all components
        var allComponents = req.interventions.SelectMany(i => i.components).Distinct().OrderBy(c => c).ToList();

        // Build design matrix for each intervention
        var validInterventions = req.interventions.Where(i => i.effect.HasValue && i.se.HasValue && i.se.Value > 0).ToList();

        int K = allComponents.Count;
        int n = validInterventions.Count;

        // Design matrix: rows = interventions, cols = components
        var X = new double[n][];
        var y = new double[n];
        var sigma = new double[n];

        for (int i = 0; i < n; i++)
        {
            X[i] = new double[K];
            for (int j = 0; j < K; j++)
                X[i][j] = validInterventions[i].components.Contains(allComponents[j]) ? 1.0 : 0.0;

            y[i] = validInterventions[i].effect.Value;
            sigma[i] = validInterventions[i].se.Value;
        }

        // Weighted least squares
        var weights = sigma.Select(s => 1.0 / (s * s)).ToList();
        var XtWX = new double[K][];
        for (int j = 0; j < K; j++)
        {
            XtWX[j] = new double[K];
            for (int k = 0; k < K; k++)
            {
                double sum = 0;
                for (int i = 0; i < n; i++)
                    sum += X[i][j] * X[i][k] * weights[i];
                XtWX[j][k] = sum;
            }
        }

        var XtWy = new double[K];
        for (int j = 0; j < K; j++)
        {
            double sum = 0;
            for (int i = 0; i < n; i++)
                sum += X[i][j] * y[i] * weights[i];
            XtWy[j] = sum;
        }

        var beta = SolveLinear(XtWX, XtWy);

        // Component effects
        var componentEffects = new List<ComponentEffect>();
        for (int j = 0; j < K; j++)
        {
            double se = Math.Sqrt(XtWX[j][j] > 0 ? 1.0 / XtWX[j][j] : 1);
            double z = beta[j] / se;
            componentEffects.Add(new ComponentEffect
            {
                component = allComponents[j],
                effect = beta[j],
                se = se,
                ciLower = beta[j] - 1.96 * se,
                ciUpper = beta[j] + 1.96 * se,
                p = 2 * (1 - Stats.NormalCdf(Math.Abs(z))),
                nStudies = validInterventions.Count(i => i.components.Contains(allComponents[j]))
            });
        }

        return new CnmaResult
        {
            componentEffects = componentEffects,
            nComponents = K,
            nInterventions = n,
            components = allComponents
        };
    }

    private static double[] SolveLinear(double[][] A, double[] b)
    {
        int n = b.Length;
        var x = new double[n];

        for (int col = 0; col < n; col++)
        {
            int maxRow = col;
            double maxVal = Math.Abs(A[col][col]);
            for (int row = col + 1; row < n; row++)
                if (Math.Abs(A[row][col]) > maxVal) { maxVal = Math.Abs(A[row][col]); maxRow = row; }

            if (maxRow != col)
            {
                var temp = A[col]; A[col] = A[maxRow]; A[maxRow] = temp;
                double tempB = b[col]; b[col] = b[maxRow]; b[maxRow] = tempB;
            }

            for (int row = col + 1; row < n; row++)
            {
                double factor = A[row][col] / A[col][col];
                for (int j = col; j < n; j++) A[row][j] -= factor * A[col][j];
                b[row] -= factor * b[col];
            }
        }

        for (int row = n - 1; row >= 0; row--)
        {
            double sum = b[row];
            for (int j = row + 1; j < n; j++) sum -= A[row][j] * x[j];
            x[row] = sum / A[row][row];
        }

        return x;
    }
}
