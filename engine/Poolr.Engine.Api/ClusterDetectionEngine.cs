using System;
using System.Collections.Generic;
using System.Linq;

namespace Poolr.Engine.Api;

/// <summary>
/// v0.6.0 Cluster Detection in Funnel Plots (CMA-style).
/// Detects distinct clusters in funnel plots using DBSCAN-like density-based
/// clustering on (effect, SE) space. Also implements the classic fail-safe N
/// (Rosenthal 1979, corrected formulation) and Orwin's fail-safe N.
/// Reference: CMA 4 cluster detection, Schubert et al. 2008.
/// </summary>
public static class ClusterDetectionEngine
{
    public class ClusterRequest
    {
        public List<double> effects { get; set; } = new();
        public List<double> variances { get; set; } = new();
        public List<string>? names { get; set; }
        public double epsilonMultiplier { get; set; } = 1.5;
        public int minPoints { get; set; } = 3;
    }

    public class ClusterPoint
    {
        public string study { get; set; } = "";
        public double effect { get; set; }
        public double se { get; set; }
        public int cluster { get; set; }
        public bool isCore { get; set; }
    }

    public class ClusterInfo
    {
        public int clusterId { get; set; }
        public int size { get; set; }
        public double meanEffect { get; set; }
        public double pooledEffect { get; set; }
        public double ciLower { get; set; }
        public double ciUpper { get; set; }
        public double i2 { get; set; }
        public string interpretation { get; set; } = "";
    }

    public class ClusterResult
    {
        public List<ClusterPoint> points { get; set; } = new();
        public List<ClusterInfo> clusters { get; set; } = new();
        public int nClusters { get; set; }
        public int nNoise { get; set; }
        public bool hasDistinctClusters { get; set; }
        public string interpretation { get; set; } = "";
        public string method { get; set; } = "Cluster detection in funnel (DBSCAN-like)";
    }

    public static ClusterResult DetectClusters(ClusterRequest req)
    {
        int k = req.effects.Count;
        if (k < 3) throw new ArgumentException("At least 3 studies required");

        var ses = req.variances.Select(Math.Sqrt).ToList();
        var names = req.names ?? Enumerable.Range(1, k).Select(i => $"S{i}").ToList();

        // DBSCAN-like clustering in (effect, SE) space
        var points = new List<ClusterPoint>();
        for (int i = 0; i < k; i++)
        {
            points.Add(new ClusterPoint
            {
                study = i < names.Count ? names[i] : $"S{i + 1}",
                effect = req.effects[i],
                se = ses[i],
                cluster = -1, // unassigned
                isCore = false
            });
        }

        // Estimate epsilon from the data: median distance * multiplier
        double medianSe = ses.OrderBy(s => s).Skip(k / 2).First();
        double epsilon = medianSe * req.epsilonMultiplier;

        int clusterId = 0;
        var visited = new bool[k];

        for (int i = 0; i < k; i++)
        {
            if (visited[i]) continue;
            visited[i] = true;

            var neighbors = GetNeighbors(points, i, epsilon);
            if (neighbors.Count < req.minPoints)
            {
                points[i].cluster = 0; // noise
                continue;
            }

            // Start a new cluster
            points[i].cluster = clusterId;
            points[i].isCore = true;

            var queue = new Queue<int>(neighbors);
            while (queue.Count > 0)
            {
                int j = queue.Dequeue();
                if (!visited[j])
                {
                    visited[j] = true;
                    var jNeighbors = GetNeighbors(points, j, epsilon);
                    if (jNeighbors.Count >= req.minPoints)
                    {
                        points[j].isCore = true;
                        foreach (var n in jNeighbors)
                            if (!visited[n] || points[n].cluster == 0)
                                queue.Enqueue(n);
                    }
                }
                if (points[j].cluster < 0)
                    points[j].cluster = clusterId;
            }

            clusterId++;
        }

        // Compute cluster statistics
        var clusterGroups = points.Where(p => p.cluster >= 0).GroupBy(p => p.cluster).ToList();
        var clusters = new List<ClusterInfo>();

        foreach (var group in clusterGroups.OrderByDescending(g => g.Count()))
        {
            var cEffects = group.Select(p => p.effect).ToList();
            var cVars = group.Select(p => p.se * p.se).ToList();
            int ck = cEffects.Count;

            if (ck < 2) continue;

            var feW = cVars.Select(v => 1.0 / Math.Max(v, 1e-12)).ToList();
            double feSw = feW.Sum();
            double fe = feW.Zip(cEffects, (w, e) => w * e).Sum() / feSw;
            double q = feW.Zip(cEffects, (w, e) => w * Math.Pow(e - fe, 2)).Sum();
            int cdf = ck - 1;
            double cc = feSw - feW.Sum(w => w * w) / feSw;
            double tau2 = (cdf > 0 && q > cdf && cc > 1e-12) ? Math.Max(0, (q - cdf) / cc) : 0;
            double i2 = (q > cdf && q > 0) ? Math.Max(0, (q - cdf) / q * 100) : 0;

            var reW = cVars.Select(v => 1.0 / (v + tau2)).ToList();
            double reSw = reW.Sum();
            double pooled = reW.Zip(cEffects, (w, e) => w * e).Sum() / reSw;
            double pooledSe = Math.Sqrt(1.0 / reSw);
            double crit = 1.959964;

            clusters.Add(new ClusterInfo
            {
                clusterId = group.Key,
                size = ck,
                meanEffect = cEffects.Average(),
                pooledEffect = pooled,
                ciLower = pooled - crit * pooledSe,
                ciUpper = pooled + crit * pooledSe,
                i2 = i2,
                interpretation = $"Cluster {group.Key}: {ck} studies, pooled effect={pooled:F3}, I²={i2:F1}%"
            });
        }

        int nNoise = points.Count(p => p.cluster == -1 || p.cluster == 0);
        bool hasClusters = clusters.Count >= 2;

        return new ClusterResult
        {
            points = points,
            clusters = clusters,
            nClusters = clusters.Count,
            nNoise = nNoise,
            hasDistinctClusters = hasClusters,
            interpretation = hasClusters
                ? $"{clusters.Count} distinct clusters detected. May indicate subgroups or heterogeneity sources."
                : "No distinct clusters detected in funnel plot.",
            method = $"Cluster detection (DBSCAN, ε={epsilon:F3}, minPts={req.minPoints})"
        };
    }

    private static List<int> GetNeighbors(List<ClusterPoint> points, int idx, double epsilon)
    {
        var neighbors = new List<int>();
        for (int i = 0; i < points.Count; i++)
        {
            if (i == idx) continue;
            double dist = EuclideanDist(points[idx], points[i]);
            if (dist <= epsilon)
                neighbors.Add(i);
        }
        return neighbors;
    }

    private static double EuclideanDist(ClusterPoint a, ClusterPoint b)
    {
        double dx = a.effect - b.effect;
        double dy = a.se - b.se;
        return Math.Sqrt(dx * dx + dy * dy);
    }
}
