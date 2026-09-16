#!/usr/bin/env python3
"""Poolr stress test - exercises API endpoints with edge cases and real datasets."""
import json, requests, sys, time, traceback

BASE = "http://127.0.0.1:5180"
results = []

def test(name, fn):
    try:
        fn()
        results.append(("PASS", name, ""))
        print(f"  PASS: {name}")
    except Exception as e:
        tb = traceback.format_exc()
        results.append(("FAIL", name, str(e)))
        print(f"  FAIL: {name} -> {e}")

def post(path, data, method="POST"):
    r = requests.post(f"{BASE}{path}", json=data, timeout=30)
    return r

def ok(r, name):
    if r.status_code != 200:
        raise AssertionError(f"{name} -> HTTP {r.status_code}: {r.text[:300]}")
    return r.json() if r.text else {}

# ─── Test: /health ──────────────────────────────────────────────────────────
def test_health():
    r = requests.get(f"{BASE}/health", timeout=5)
    j = ok(r, "health")
    assert j["ok"] == True
    assert j["version"] == "0.6.1"

test("GET /health", test_health)

# ─── Test: Basic meta-analysis (BCG dataset from demo-project.json) ──────────
def test_basic_meta():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "data": [
            {"study": "Aronson 1948", "type": "binary", "int_events": 4, "int_n": 123, "ctrl_events": 11, "ctrl_n": 139},
            {"study": "Ferguson 1949", "type": "binary", "int_events": 6, "int_n": 306, "ctrl_events": 29, "ctrl_n": 303},
            {"study": "Rosenthal 1960", "type": "binary", "int_events": 3, "int_n": 231, "ctrl_events": 11, "ctrl_n": 220},
            {"study": "Hart 1977", "type": "binary", "int_events": 62, "int_n": 13598, "ctrl_events": 248, "ctrl_n": 12867},
        ]
    }
    j = ok(post("/api/meta", data), "basic_meta")
    assert "pooled" in j
    assert "heterogeneity" in j
    assert j["k"] == 4
    assert 0 < j["pooled"]["effect"] < 2
    assert j["heterogeneity"]["i2"] >= 0

test("POST /api/meta (BCG dataset)", test_basic_meta)

# ─── Test: Empty data ───────────────────────────────────────────────────────
def test_empty_data():
    data = {"model": "random", "measure": "OR", "method": "DL", "data": []}
    j = ok(post("/api/meta", data), "empty_data")
    # Should handle gracefully (NaN or error)
    assert "pooled" in j or "error" in j

test("POST /api/meta (empty data)", test_empty_data)

# ─── Test: Single study ─────────────────────────────────────────────────────
def test_single_study():
    data = {
        "model": "fixed", "measure": "OR", "method": "DL",
        "data": [{"study": "Only", "type": "binary", "int_events": 10, "int_n": 100, "ctrl_events": 20, "ctrl_n": 100}]
    }
    j = ok(post("/api/meta", data), "single_study")
    assert j["k"] == 1

test("POST /api/meta (single study)", test_single_study)

# ─── Test: Zero cells (continuity correction) ───────────────────────────────
def test_zero_cells():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "data": [
            {"study": "A", "type": "binary", "int_events": 0, "int_n": 50, "ctrl_events": 10, "ctrl_n": 50},
            {"study": "B", "type": "binary", "int_events": 5, "int_n": 50, "ctrl_events": 0, "ctrl_n": 50},
        ]
    }
    j = ok(post("/api/meta", data), "zero_cells")
    assert "pooled" in j
    assert j["k"] == 2

test("POST /api/meta (zero cells)", test_zero_cells)

# ─── Test: Continuous data ─────────────────────────────────────────────────
def test_continuous():
    data = {
        "model": "random", "measure": "MD", "method": "DL",
        "data": [
            {"study": "C1", "type": "continuous", "int_mean": 10.5, "int_sd": 2.1, "int_n": 50, "ctrl_mean": 12.0, "ctrl_sd": 2.3, "ctrl_n": 50},
            {"study": "C2", "type": "continuous", "int_mean": 8.2, "int_sd": 1.8, "int_n": 40, "ctrl_mean": 9.5, "ctrl_sd": 2.0, "ctrl_n": 40},
        ]
    }
    j = ok(post("/api/meta", data), "continuous")
    assert j["k"] == 2
    assert "pooled" in j

test("POST /api/meta (continuous MD)", test_continuous)

# ─── Test: Survival data ───────────────────────────────────────────────────
def test_survival():
    data = {
        "model": "random", "measure": "HR", "method": "DL",
        "data": [
            {"study": "S1", "type": "survival", "hr": 0.75, "hr_lower": 0.60, "hr_upper": 0.94},
            {"study": "S2", "type": "survival", "hr": 0.82, "hr_lower": 0.65, "hr_upper": 1.03},
        ]
    }
    j = ok(post("/api/meta", data), "survival")
    assert j["k"] == 2

test("POST /api/meta (survival HR)", test_survival)

# ─── Test: All tau2 estimators ─────────────────────────────────────────────
def test_tau2_estimators():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "data": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
            {"study": "C", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200},
        ]
    }
    for method in ["DL", "REML", "PM", "HS", "EB", "ML", "SJ"]:
        data["method"] = method
        j = ok(post("/api/meta", data), f"tau2_{method}")
        assert "pooled" in j, f"Failed for {method}"

test("POST /api/meta (all tau2 estimators)", test_tau2_estimators)

# ─── Test: All measures ────────────────────────────────────────────────────
def test_measures():
    data = {
        "model": "random", "method": "DL",
        "data": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
        ]
    }
    for measure in ["OR", "RR", "RD", "AS", "PETO"]:
        data["measure"] = measure
        j = ok(post("/api/meta", data), f"measure_{measure}")
        assert "pooled" in j, f"Failed for {measure}"

test("POST /api/meta (all measures)", test_measures)

# ─── Test: Extended meta with Knapp-Hartung ────────────────────────────────
def test_extended_kh():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "knapp_hartung": True,
        "data": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
            {"study": "C", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200},
        ]
    }
    j = ok(post("/api/meta2", data), "extended_kh")
    assert "pooled" in j

test("POST /api/meta2 (Knapp-Hartung)", test_extended_kh)

# ─── Test: Extended meta with subgroups ────────────────────────────────────
def test_subgroups():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "subgroup": "region",
        "data": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100, "subgroup": "Asia"},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50, "subgroup": "Europe"},
            {"study": "C", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200, "subgroup": "Asia"},
            {"study": "D", "type": "binary", "int_events": 12, "int_n": 80, "ctrl_events": 20, "ctrl_n": 80, "subgroup": "Europe"},
        ]
    }
    j = ok(post("/api/meta2", data), "subgroups")
    assert "subgroup_results" in j or "pooled" in j

test("POST /api/meta2 (subgroups)", test_subgroups)

# ─── Test: Sensitivity analysis ────────────────────────────────────────────
def test_sensitivity():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "sensitivity": True,
        "data": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
            {"study": "C", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200},
        ]
    }
    j = ok(post("/api/meta2", data), "sensitivity")
    assert "leave_one_out" in j or "pooled" in j

test("POST /api/meta2 (sensitivity)", test_sensitivity)

# ─── Test: Effect size conversions ─────────────────────────────────────────
def test_conversions():
    data = {"from": "OR", "to": "RR", "or": 2.0, "p0": 0.3}
    j = ok(post("/api/convert", data), "convert_or_rr")
    assert "result" in j or "value" in j

test("POST /api/convert (OR->RR)", test_conversions)

# ─── Test: Figures ─────────────────────────────────────────────────────────
def test_figures():
    meta_resp = {
        "k": 3, "model": "Random-effects", "measure": "OR", "method": "DL",
        "pooled": {"effect": 0.75, "ci_lower": 0.55, "ci_upper": 1.02, "se": 0.12, "p": 0.06},
        "heterogeneity": {"tau2": 0.05, "i2": 45, "q": 5.5, "p_het": 0.06, "h2": 1.8, "h": 1.34, "df": 2},
        "studies": [
            {"study": "A", "effect": 0.8, "ci_lower": 0.5, "ci_upper": 1.3, "weight": 35},
            {"study": "B", "effect": 0.7, "ci_lower": 0.4, "ci_upper": 1.1, "weight": 40},
            {"study": "C", "effect": 0.9, "ci_lower": 0.6, "ci_upper": 1.4, "weight": 25},
        ]
    }
    for fig in ["forest", "funnel"]:
        r = post(f"/api/figure/{fig}", meta_resp)
        if r.status_code != 200:
            raise AssertionError(f"{fig}: HTTP {r.status_code}: {r.text[:200]}")
        assert "<svg" in r.text, f"{fig}: no SVG in response"

test("POST /api/figure/* (forest, funnel)", test_figures)

# ─── Test: Export formats ──────────────────────────────────────────────────
def test_exports():
    project = {
        "metadata": {"version": "0.6.1", "title": "Test"},
        "pico": {"population": "P", "intervention": "I", "comparator": "C", "outcomes": "O"},
        "extraction": {"studies": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
            {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
        ]},
        "meta": {"results": {"k": 2, "pooled": {"effect": 0.75, "ci_lower": 0.55, "ci_upper": 1.02}}},
    }
    for fmt in ["json", "md", "latex"]:
        r = requests.post(f"{BASE}/api/export?format={fmt}", json=project, timeout=30)
        if r.status_code != 200:
            raise AssertionError(f"export {fmt}: HTTP {r.status_code}: {r.text[:200]}")
        assert len(r.text) > 10, f"export {fmt}: empty response"

test("POST /api/export (json, md, latex)", test_exports)

# ─── Test: GRADE SoF ──────────────────────────────────────────────────────
def test_grade_sof():
    data = {
        "comparisons": [{
            "intervention": "Drug A",
            "comparator": "Placebo",
            "outcomes": [
                {"outcome": "Mortality", "n": 200, "k": 3, "effect": 0.8, "ci_lower": 0.6, "ci_upper": 1.1, "baseline_risk": 0.15, "direction": "lower_better"},
                {"outcome": "Adverse events", "n": 200, "k": 3, "effect": 1.2, "ci_lower": 0.9, "ci_upper": 1.6, "baseline_risk": 0.10, "direction": "lower_better"},
            ]
        }]
    }
    j = ok(post("/api/grade/sof", data), "grade_sof")
    assert "rows" in j or "markdown" in j

test("POST /api/grade/sof", test_grade_sof)

# ─── Test: NMA ─────────────────────────────────────────────────────────────
def test_nma():
    data = {
        "studies": [
            {"study": "S1", "treatment1": "A", "treatment2": "B", "effect": -0.5, "se": 0.2},
            {"study": "S2", "treatment1": "A", "treatment2": "C", "effect": -0.3, "se": 0.25},
            {"study": "S3", "treatment1": "B", "treatment2": "C", "effect": 0.2, "se": 0.3},
            {"study": "S4", "treatment1": "A", "treatment2": "B", "effect": -0.4, "se": 0.15},
        ],
        "treatments": ["A", "B", "C"],
        "measure": "OR"
    }
    j = ok(post("/api/nma", data), "nma")
    assert "relative_effects" in j or "league" in j or "pooled" in j

test("POST /api/nma", test_nma)

# ─── Test: Dose-Response ───────────────────────────────────────────────────
def test_dose_response():
    data = {
        "studies": [
            {"study": "D1", "dose": 0, "effect": 0, "se": 0.1},
            {"study": "D2", "dose": 10, "effect": -0.3, "se": 0.15},
            {"study": "D3", "dose": 20, "effect": -0.5, "se": 0.12},
            {"study": "D4", "dose": 30, "effect": -0.6, "se": 0.18},
        ],
        "measure": "MD"
    }
    j = ok(post("/api/dose", data), "dose_response")
    assert "predicted" in j or "curve" in j or "pooled" in j

test("POST /api/dose", test_dose_response)

# ─── Test: IPD ─────────────────────────────────────────────────────────────
def test_ipd():
    data = {
        "studies": [
            {"study": "I1", "time": [1, 3, 6, 12], "events": [0, 1, 1, 0], "n": [50, 48, 45, 42]},
            {"study": "I2", "time": [1, 3, 6, 12], "events": [0, 2, 1, 1], "n": [60, 57, 54, 50]},
        ],
        "tau2": 0.05
    }
    j = ok(post("/api/ipd", data), "ipd")
    assert "pooled" in j or "km" in j or "studies" in j

test("POST /api/ipd", test_ipd)

# ─── Test: DTA ─────────────────────────────────────────────────────────────
def test_dta():
    data = {
        "studies": [
            {"study": "T1", "tp": 45, "fp": 10, "fn": 5, "tn": 40},
            {"study": "T2", "tp": 80, "fp": 15, "fn": 10, "tn": 95},
        ]
    }
    j = ok(post("/api/dta", data), "dta")
    assert "pooled" in j or "sens" in j or "spec" in j

test("POST /api/dta", test_dta)

# ─── Test: Proportion ──────────────────────────────────────────────────────
def test_proportion():
    data = {
        "studies": [
            {"study": "P1", "events": 15, "n": 100},
            {"study": "P2", "events": 25, "n": 200},
            {"study": "P3", "events": 8, "n": 80},
        ],
        "method": "GLMM"
    }
    j = ok(post("/api/proportion", data), "proportion")
    assert "pooled" in j or "effect" in j

test("POST /api/proportion", test_proportion)

# ─── Test: Bayesian MCMC ───────────────────────────────────────────────────
def test_bayesian():
    data = {
        "studies": [
            {"study": "B1", "effect": -0.5, "se": 0.2},
            {"study": "B2", "effect": -0.3, "se": 0.25},
            {"study": "B3", "effect": -0.4, "se": 0.15},
        ],
        "n_iter": 1000, "n_burnin": 200, "n_chains": 2
    }
    j = ok(post("/api/bayesian", data), "bayesian")
    assert "pooled" in j or "mcmc" in j or "effect" in j

test("POST /api/bayesian (MCMC)", test_bayesian)

# ─── Test: Bootstrap ───────────────────────────────────────────────────────
def test_bootstrap():
    data = {
        "studies": [
            {"study": "BS1", "effect": -0.5, "se": 0.2},
            {"study": "BS2", "effect": -0.3, "se": 0.25},
            {"study": "BS3", "effect": -0.4, "se": 0.15},
        ],
        "n_boot": 500
    }
    j = ok(post("/api/bootstrap", data), "bootstrap")
    assert "ci_lower" in j or "pooled" in j

test("POST /api/bootstrap", test_bootstrap)

# ─── Test: Influence ───────────────────────────────────────────────────────
def test_influence():
    data = {
        "studies": [
            {"study": "INF1", "effect": -0.5, "se": 0.2},
            {"study": "INF2", "effect": -0.3, "se": 0.25},
            {"study": "INF3", "effect": -0.4, "se": 0.15},
            {"study": "INF4", "effect": -0.6, "se": 0.18},
        ]
    }
    j = ok(post("/api/influence", data), "influence")
    assert "influence" in j or "studies" in j or "pooled" in j

test("POST /api/influence", test_influence)

# ─── Test: Permutation ─────────────────────────────────────────────────────
def test_permutation():
    data = {
        "studies": [
            {"study": "PERM1", "effect": -0.5, "se": 0.2},
            {"study": "PERM2", "effect": -0.3, "se": 0.25},
            {"study": "PERM3", "effect": -0.4, "se": 0.15},
        ],
        "n_perm": 1000
    }
    j = ok(post("/api/permutation", data), "permutation")
    assert "p_value" in j or "pooled" in j

test("POST /api/permutation", test_permutation)

# ─── Test: GOSH ────────────────────────────────────────────────────────────
def test_gosh():
    data = {
        "studies": [
            {"study": "G1", "effect": -0.5, "se": 0.2},
            {"study": "G2", "effect": -0.3, "se": 0.25},
            {"study": "G3", "effect": -0.4, "se": 0.15},
            {"study": "G4", "effect": -0.6, "se": 0.18},
            {"study": "G5", "effect": -0.2, "se": 0.22},
        ]
    }
    j = ok(post("/api/gosh", data), "gosh")
    assert "clusters" in j or "pooled" in j or "matrix" in j

test("POST /api/gosh", test_gosh)

# ─── Test: Multilevel ──────────────────────────────────────────────────────
def test_multilevel():
    data = {
        "studies": [
            {"study": "ML1", "effect": -0.5, "se": 0.2, "cluster": "C1"},
            {"study": "ML2", "effect": -0.3, "se": 0.25, "cluster": "C1"},
            {"study": "ML3", "effect": -0.4, "se": 0.15, "cluster": "C2"},
            {"study": "ML4", "effect": -0.6, "se": 0.18, "cluster": "C2"},
        ]
    }
    j = ok(post("/api/multilevel", data), "multilevel")
    assert "pooled" in j or "tau2" in j

test("POST /api/multilevel", test_multilevel)

# ─── Test: Prediction Interval ─────────────────────────────────────────────
def test_prediction():
    data = {
        "pooled_effect": -0.4, "tau2": 0.05, "k": 5, "alpha": 0.05
    }
    j = ok(post("/api/prediction", data), "prediction")
    assert "interval" in j or "lower" in j or "pi_lower" in j

test("POST /api/prediction", test_prediction)

# ─── Test: Model Averaging ─────────────────────────────────────────────────
def test_model_average():
    data = {
        "studies": [
            {"study": "MA1", "effect": -0.5, "se": 0.2},
            {"study": "MA2", "effect": -0.3, "se": 0.25},
            {"study": "MA3", "effect": -0.4, "se": 0.15},
        ]
    }
    j = ok(post("/api/modelaverage", data), "model_average")
    assert "pooled" in j or "weights" in j or "effects" in j

test("POST /api/modelaverage", test_model_average)

# ─── Test: Living Review ───────────────────────────────────────────────────
def test_living_cumulative():
    data = {
        "studies": [
            {"year": 2018, "effect": -0.5, "se": 0.2},
            {"year": 2019, "effect": -0.3, "se": 0.25},
            {"year": 2020, "effect": -0.4, "se": 0.15},
            {"year": 2021, "effect": -0.6, "se": 0.18},
        ]
    }
    j = ok(post("/api/living/cumulative", data), "living_cumulative")
    assert "cumulative" in j or "pooled" in j

test("POST /api/living/cumulative", test_living_cumulative)

# ─── Test: Niche engines ───────────────────────────────────────────────────
def test_niche_correlation():
    data = [
        {"study": "CORR1", "r": 0.4, "n": 50},
        {"study": "CORR2", "r": 0.3, "n": 60},
        {"study": "CORR3", "r": 0.5, "n": 40},
    ]
    j = ok(post("/api/niche/correlation", data), "niche_correlation")
    assert "pooled" in j or "effect" in j

test("POST /api/niche/correlation", test_niche_correlation)

def test_niche_sced():
    data = [
        {"study": "SCED1", "phase_A": [3, 4, 5], "phase_B": [7, 8, 9]},
        {"study": "SCED2", "phase_A": [2, 3, 4], "phase_B": [6, 7, 8]},
    ]
    j = ok(post("/api/niche/sced", data), "niche_sced")
    assert "effect" in j or "smd" in j or "pnd" in j

test("POST /api/niche/sced", test_niche_sced)

# ─── Test: Specialized engines ─────────────────────────────────────────────
def test_specialized_genetic():
    data = [
        {"study": "GEN1", "or": 1.5, "ci_lower": 1.1, "ci_upper": 2.0, "n": 200},
        {"study": "GEN2", "or": 1.3, "ci_lower": 0.9, "ci_upper": 1.8, "n": 300},
    ]
    j = ok(post("/api/specialized/genetic", data), "specialized_genetic")
    assert "pooled" in j or "effect" in j

test("POST /api/specialized/genetic", test_specialized_genetic)

def test_specialized_adverse():
    data = [
        {"study": "AE1", "int_events": 5, "int_n": 100, "ctrl_events": 10, "ctrl_n": 100},
        {"study": "AE2", "int_events": 8, "int_n": 150, "ctrl_events": 12, "ctrl_n": 150},
    ]
    j = ok(post("/api/specialized/adverse", data), "specialized_adverse")
    assert "pooled" in j or "effect" in j

test("POST /api/specialized/adverse", test_specialized_adverse)

# ─── Test: Advanced engines ────────────────────────────────────────────────
def test_advanced_prognostic():
    data = [
        {"study": "PROG1", "hr": 1.5, "hr_lower": 1.1, "hr_upper": 2.1, "n": 200},
        {"study": "PROG2", "hr": 1.3, "hr_lower": 0.9, "hr_upper": 1.8, "n": 300},
    ]
    j = ok(post("/api/advanced/prognostic", data), "advanced_prognostic")
    assert "pooled" in j or "effect" in j

test("POST /api/advanced/prognostic", test_advanced_prognostic)

def test_advanced_dca():
    data = [
        {"study": "DCA1", "threshold": 0.1, "tp": 80, "fp": 20, "n": 200},
        {"study": "DCA2", "threshold": 0.2, "tp": 70, "fp": 15, "n": 200},
    ]
    j = ok(post("/api/advanced/dca", data), "advanced_dca")
    assert "net_benefit" in j or "thresholds" in j

test("POST /api/advanced/dca", test_advanced_dca)

# ─── Test: Collaboration ───────────────────────────────────────────────────
def test_collab_snapshot():
    data = {"project": {"title": "Test"}, "message": "Initial snapshot"}
    j = ok(post("/api/collaboration/snapshot", data), "collab_snapshot")
    assert "id" in j

test("POST /api/collaboration/snapshot", test_collab_snapshot)

def test_collab_snapshots():
    j = ok(post("/api/collaboration/snapshots", {}), "collab_snapshots")
    assert isinstance(j, list) or "snapshots" in j

test("POST /api/collaboration/snapshots", test_collab_snapshots)

# ─── Test: Reporting ───────────────────────────────────────────────────────
def test_report_latex():
    data = {
        "title": "Test Report",
        "authors": ["Author A"],
        "background": "Test background",
        "methods": "Test methods",
        "results": "Test results",
        "conclusion": "Test conclusion",
    }
    r = post("/api/report/latex", data)
    if r.status_code != 200:
        raise AssertionError(f"latex: HTTP {r.status_code}: {r.text[:200]}")
    assert "\\documentclass" in r.text or "\\begin" in r.text

test("POST /api/report/latex", test_report_latex)

def test_report_html():
    data = {"title": "Test", "sections": [{"heading": "Intro", "body": "Test"}]}
    r = post("/api/report/html", data)
    if r.status_code != 200:
        raise AssertionError(f"html: HTTP {r.status_code}: {r.text[:200]}")
    assert "<html" in r.text or "<!DOCTYPE" in r.text

test("POST /api/report/html", test_report_html)

# ─── Test: RevMan import/export ────────────────────────────────────────────
def test_revman_export():
    data = {
        "title": "Test Review",
        "comparisons": [{
            "title": "Drug vs Placebo",
            "outcomes": [{"title": "Mortality", "type": "dichotomous"}]
        }]
    }
    r = post("/api/revman/export", data)
    if r.status_code != 200:
        raise AssertionError(f"revman export: HTTP {r.status_code}: {r.text[:200]}")
    assert len(r.text) > 10

test("POST /api/revman/export", test_revman_export)

# ─── Test: Deduplication ───────────────────────────────────────────────────
def test_dedup():
    data = [
        {"title": "BCG vaccine for TB", "year": 1948, "authors": "Aronson"},
        {"title": "BCG vaccine for TB", "year": 1948, "authors": "Aronson"},
        {"title": "Different study", "year": 2020, "authors": "Smith"},
    ]
    j = ok(post("/api/deduplicate", data), "deduplicate")
    assert "unique" in j or "duplicates" in j or isinstance(j, list)

test("POST /api/deduplicate", test_dedup)

# ─── Test: P-value combination ─────────────────────────────────────────────
def test_pvalue_combine():
    data = {
        "p_values": [0.01, 0.03, 0.05, 0.10],
        "method": "fisher"
    }
    j = ok(post("/api/pvalue/combine", data), "pvalue_combine")
    assert "combined" in j or "p" in j or "statistic" in j

test("POST /api/pvalue/combine", test_pvalue_combine)

# ─── Test: Time Series ─────────────────────────────────────────────────────
def test_time_series():
    data = {
        "studies": [
            {"study": "TS1", "time": [1, 2, 3, 4, 5], "outcome": [10, 12, 11, 13, 15]},
            {"study": "TS2", "time": [1, 2, 3, 4, 5], "outcome": [8, 9, 10, 11, 12]},
        ]
    }
    j = ok(post("/api/time-series", data), "time_series")
    assert "effect" in j or "slope" in j or "pooled" in j

test("POST /api/time-series", test_time_series)

# ─── Test: Network Graph ───────────────────────────────────────────────────
def test_network_graph():
    data = {
        "treatments": ["A", "B", "C"],
        "edges": [
            {"from": "A", "to": "B", "weight": 3},
            {"from": "A", "to": "C", "weight": 2},
        ]
    }
    j = ok(post("/api/nma/graph", data), "network_graph")
    assert "svg" in j or "nodes" in j

test("POST /api/nma/graph", test_network_graph)

# ─── Test: Bubble Plot ─────────────────────────────────────────────────────
def test_bubble():
    data = {
        "studies": [
            {"study": "BP1", "effect": -0.5, "se": 0.2, "moderator": 1.0},
            {"study": "BP2", "effect": -0.3, "se": 0.25, "moderator": 2.0},
        ]
    }
    j = ok(post("/api/figure/bubble", data), "bubble")
    assert "svg" in j or "data" in j

test("POST /api/figure/bubble", test_bubble)

# ─── Test: League Matrix ───────────────────────────────────────────────────
def test_league_matrix():
    data = {
        "treatments": ["A", "B", "C"],
        "effects": [
            {"t1": "A", "t2": "B", "effect": -0.5},
            {"t1": "A", "t2": "C", "effect": -0.3},
            {"t1": "B", "t2": "C", "effect": 0.2},
        ]
    }
    j = ok(post("/api/figure/league-matrix", data), "league_matrix")
    assert "matrix" in j or "svg" in j

test("POST /api/figure/league-matrix", test_league_matrix)

# ─── Test: PRISMA-DTA ──────────────────────────────────────────────────────
def test_prisma_dta():
    data = {
        "identified": 100, "duplicates": 10, "screened": 90, "excluded": 70,
        "full_text": 20, "excluded_ft": 15, "included": 5
    }
    j = ok(post("/api/prisma-dta", data), "prisma_dta")
    assert "svg" in j or "flow" in j

test("POST /api/prisma-dta", test_prisma_dta)

# ─── Test: Bucher indirect comparison ──────────────────────────────────────
def test_bucher():
    data = {
        "ab_studies": [{"study": "AB1", "effect": -0.5, "se": 0.2}],
        "ac_studies": [{"study": "AC1", "effect": -0.3, "se": 0.25}],
    }
    j = ok(post("/api/bucher", data), "bucher")
    assert "bc_effect" in j or "effect" in j

test("POST /api/bucher", test_bucher)

# ─── Test: Component NMA ───────────────────────────────────────────────────
def test_cnma():
    data = {
        "studies": [
            {"study": "CNMA1", "components": ["A", "B"], "effect": -0.5, "se": 0.2},
            {"study": "CNMA2", "components": ["A", "C"], "effect": -0.3, "se": 0.25},
        ]
    }
    j = ok(post("/api/cnma", data), "cnma")
    assert "pooled" in j or "effects" in j

test("POST /api/cnma", test_cnma)

# ─── Test: PRISMA-ScR ──────────────────────────────────────────────────────
def test_prisma_scr():
    data = {
        "identified": 200, "duplicates": 20, "screened": 180, "excluded": 150,
        "full_text": 30, "excluded_ft": 25, "included": 5
    }
    j = ok(post("/api/scr/flow", data), "prisma_scr")
    assert "svg" in j or "flow" in j

test("POST /api/scr/flow", test_prisma_scr)

# ─── Test: Spatio-Temporal ─────────────────────────────────────────────────
def test_spatiotemporal():
    data = {
        "studies": [
            {"study": "ST1", "lat": 40.7, "lon": -74.0, "year": 2020, "effect": -0.5, "se": 0.2},
            {"study": "ST2", "lat": 51.5, "lon": -0.1, "year": 2021, "effect": -0.3, "se": 0.25},
        ]
    }
    j = ok(post("/api/spatiotemporal", data), "spatiotemporal")
    assert "pooled" in j or "map" in j

test("POST /api/spatiotemporal", test_spatiotemporal)

# ─── Test: Response Surface ────────────────────────────────────────────────
def test_response_surface():
    data = {
        "studies": [
            {"study": "RS1", "dose1": 10, "dose2": 0, "effect": -0.5, "se": 0.2},
            {"study": "RS2", "dose1": 0, "dose2": 10, "effect": -0.3, "se": 0.25},
            {"study": "RS3", "dose1": 10, "dose2": 10, "effect": -0.7, "se": 0.15},
        ]
    }
    j = ok(post("/api/response-surface", data), "response_surface")
    assert "surface" in j or "predicted" in j

test("POST /api/response-surface", test_response_surface)

# ─── Test: RoB 2 ──────────────────────────────────────────────────────────
def test_rob2():
    data = {
        "studies": [
            {"study": "R2_1", "domains": {"Randomization": "Low", "Deviations": "Low", "Missing": "Low", "Measurement": "Low", "Selection": "Low"}},
            {"study": "R2_2", "domains": {"Randomization": "Low", "Deviations": "Some concerns", "Missing": "Low", "Measurement": "Low", "Selection": "Low"}},
        ]
    }
    j = ok(post("/api/rob2", data), "rob2")
    assert "assessments" in j or "studies" in j

test("POST /api/rob2", test_rob2)

# ─── Test: ROBINS-I ────────────────────────────────────────────────────────
def test_robins_i():
    data = {
        "studies": [
            {"study": "RI_1", "domains": {"Confounding": "Low", "Selection": "Low", "Classification": "Low", "Deviations": "Low", "Missing": "Low", "Measurement": "Low", "Selection_report": "Low"}},
        ]
    }
    j = ok(post("/api/robins-i", data), "robins_i")
    assert "assessments" in j or "studies" in j

test("POST /api/robins-i", test_robins_i)

# ─── Test: QUADAS-2 ────────────────────────────────────────────────────────
def test_quadas():
    data = {
        "studies": [
            {"study": "Q_1", "domains": {"Patient selection": "Low", "Index test": "Low", "Reference standard": "Low", "Flow and timing": "Low"}},
        ]
    }
    j = ok(post("/api/quadas-2", data), "quadas")
    assert "assessments" in j or "studies" in j

test("POST /api/quadas-2", test_quadas)

# ─── Test: AMSTAR-2 ───────────────────────────────────────────────────────
def test_amstar():
    data = {
        "answers": {"q1": "Yes", "q2": "No", "q3": "Yes", "q4": "Partial Yes", "q5": "Yes", "q6": "Yes", "q7": "No", "q8": "Yes", "q9": "Yes", "q10": "No", "q11": "Yes", "q12": "No", "q13": "Yes", "q14": "Yes", "q15": "No", "q16": "Yes"}
    }
    j = ok(post("/api/amstar-2", data), "amstar")
    assert "rating" in j or "score" in j

test("POST /api/amstar-2", test_amstar)

# ─── Test: Newcastle-Ottawa ────────────────────────────────────────────────
def test_nos():
    data = {
        "studies": [
            {"study": "NOS1", "selection": 4, "comparability": 2, "outcome": 3},
        ]
    }
    j = ok(post("/api/nos", data), "nos")
    assert "score" in j or "studies" in j

test("POST /api/nos", test_nos)

# ─── Test: GRADE Evidence Profile ──────────────────────────────────────────
def test_grade_evidence():
    data = {
        "outcomes": [
            {"outcome": "Mortality", "n": 200, "k": 3, "risk_of_bias": "serious", "inconsistency": "not_serious", "indirectness": "not_serious", "imprecision": "serious", "publication_bias": "undetected"}
        ]
    }
    j = ok(post("/api/grade/evidence-profile", data), "grade_evidence")
    assert "profile" in j or "rows" in j

test("POST /api/grade/evidence-profile", test_grade_evidence)

# ─── Test: SUCRA ───────────────────────────────────────────────────────────
def test_sucra():
    data = {
        "treatments": [
            {"name": "A", "rank_probs": [0.6, 0.3, 0.1]},
            {"name": "B", "rank_probs": [0.2, 0.5, 0.3]},
            {"name": "C", "rank_probs": [0.2, 0.2, 0.6]},
        ]
    }
    j = ok(post("/api/sucra", data), "sucra")
    assert "sucra" in j or "rankings" in j

test("POST /api/sucra", test_sucra)

# ─── Test: Cumulative Forest ───────────────────────────────────────────────
def test_cumulative_forest():
    data = {
        "studies": [
            {"study": "CF1", "year": 2018, "effect": -0.5, "se": 0.2},
            {"study": "CF2", "year": 2019, "effect": -0.3, "se": 0.25},
            {"study": "CF3", "year": 2020, "effect": -0.4, "se": 0.15},
        ]
    }
    j = ok(post("/api/figure/cumulative-forest", data), "cumulative_forest")
    assert "svg" in j or "cumulative" in j

test("POST /api/figure/cumulative-forest", test_cumulative_forest)

# ─── Test: DTA DOR Forest ─────────────────────────────────────────────────
def test_dta_dor():
    data = {
        "studies": [
            {"study": "DOR1", "tp": 45, "fp": 10, "fn": 5, "tn": 40},
            {"study": "DOR2", "tp": 80, "fp": 15, "fn": 10, "tn": 95},
        ]
    }
    j = ok(post("/api/dta/dor-forest", data), "dta_dor")
    assert "svg" in j or "pooled" in j

test("POST /api/dta/dor-forest", test_dta_dor)

# ─── Test: Cluster-Robust Egger ────────────────────────────────────────────
def test_cluster_egger():
    data = {
        "studies": [
            {"study": "CE1", "effect": -0.5, "se": 0.2, "cluster": "C1"},
            {"study": "CE2", "effect": -0.3, "se": 0.25, "cluster": "C1"},
            {"study": "CE3", "effect": -0.4, "se": 0.15, "cluster": "C2"},
        ]
    }
    j = ok(post("/api/clusterrobust/egger", data), "cluster_egger")
    assert "egger" in j or "p" in j or "bias" in j

test("POST /api/clusterrobust/egger", test_cluster_egger)

# ─── Test: Cluster Detection ───────────────────────────────────────────────
def test_cluster_detect():
    data = {
        "effects": [-0.5, -0.3, -0.4, -0.8, -0.1, 0.5, 0.6],
        "ses": [0.2, 0.25, 0.15, 0.3, 0.2, 0.2, 0.25]
    }
    j = ok(post("/api/cluster/detect", data), "cluster_detect")
    assert "clusters" in j or "outliers" in j

test("POST /api/cluster/detect", test_cluster_detect)

# ─── Test: Powerhouse P-value ──────────────────────────────────────────────
def test_powerhouse_pval():
    data = {
        "p_values": [0.01, 0.03, 0.05, 0.10, 0.20],
        "methods": ["fisher", "stouffer", "edgington", "tippett"]
    }
    j = ok(post("/api/powerhouse/pvalue-combine", data), "powerhouse_pval")
    assert "results" in j or "combined" in j

test("POST /api/powerhouse/pvalue-combine", test_powerhouse_pval)

# ─── Test: Bayesian Multilevel ─────────────────────────────────────────────
def test_bayesian_multilevel():
    data = {
        "studies": [
            {"study": "BM1", "effect": -0.5, "se": 0.2, "cluster": "C1"},
            {"study": "BM2", "effect": -0.3, "se": 0.25, "cluster": "C1"},
        ],
        "n_iter": 500, "n_burnin": 100
    }
    j = ok(post("/api/bayesian-multilevel", data), "bayesian_multilevel")
    assert "pooled" in j or "mcmc" in j

test("POST /api/bayesian-multilevel", test_bayesian_multilevel)

# ─── Test: Bayesian DTA ────────────────────────────────────────────────────
def test_bayesian_dta():
    data = {
        "studies": [
            {"study": "BDTA1", "tp": 45, "fp": 10, "fn": 5, "tn": 40},
        ],
        "n_iter": 500, "n_burnin": 100
    }
    j = ok(post("/api/bayesian-dta", data), "bayesian_dta")
    assert "pooled" in j or "sens" in j

test("POST /api/bayesian-dta", test_bayesian_dta)

# ─── Test: Bayesian Prognostic ─────────────────────────────────────────────
def test_bayesian_prognostic():
    data = {
        "studies": [
            {"study": "BPROG1", "hr": 1.5, "hr_lower": 1.1, "hr_upper": 2.1},
        ],
        "n_iter": 500, "n_burnin": 100
    }
    j = ok(post("/api/bayesian-prognostic", data), "bayesian_prognostic")
    assert "pooled" in j or "mcmc" in j

test("POST /api/bayesian-prognostic", test_bayesian_prognostic)

# ─── Test: MCMC Diagnostics ────────────────────────────────────────────────
def test_mcmc_diagnostics():
    data = {
        "chains": [
            [-0.5, -0.4, -0.45, -0.42, -0.38, -0.41, -0.43, -0.40, -0.39, -0.41],
            [-0.3, -0.35, -0.32, -0.33, -0.31, -0.34, -0.32, -0.33, -0.31, -0.32],
        ]
    }
    j = ok(post("/api/mcmc/diagnostics", data), "mcmc_diagnostics")
    assert "rhat" in j or "ess" in j or "diagnostics" in j

test("POST /api/mcmc/diagnostics", test_mcmc_diagnostics)

# ─── Test: Qualitative Synthesis ───────────────────────────────────────────
def test_qualitative_synthesis():
    data = {
        "codes": [
            {"text": "Theme A", "category": "Benefit"},
            {"text": "Theme B", "category": "Barrier"},
        ]
    }
    j = ok(post("/api/qualitative/synthesis", data), "qualitative_synthesis")
    assert "themes" in j or "categories" in j

test("POST /api/qualitative/synthesis", test_qualitative_synthesis)

# ─── Test: Profile Likelihood ──────────────────────────────────────────────
def test_profile_likelihood():
    data = {
        "pooled_effect": -0.4, "tau2": 0.05, "k": 5, "alpha": 0.05
    }
    j = ok(post("/api/profile-likelihood", data), "profile_likelihood")
    assert "ci_lower" in j or "ci_upper" in j or "profile" in j

test("POST /api/profile-likelihood", test_profile_likelihood)

# ─── Test: Test of Excess Significance ─────────────────────────────────────
def test_tes():
    data = {
        "studies": [
            {"study": "TES1", "effect": -0.5, "se": 0.2, "expected_effect": -0.3},
            {"study": "TES2", "effect": -0.3, "se": 0.25, "expected_effect": -0.3},
        ]
    }
    j = ok(post("/api/tes", data), "tes")
    assert "p" in j or "excess" in j

test("POST /api/tes", test_tes)

# ─── Test: Location-Scale ──────────────────────────────────────────────────
def test_location_scale():
    data = {
        "studies": [
            {"study": "LS1", "mean": 10, "sd": 2, "n": 50},
            {"study": "LS2", "mean": 12, "sd": 3, "n": 50},
        ]
    }
    j = ok(post("/api/locationscale", data), "location_scale")
    assert "location" in j or "scale" in j or "pooled" in j

test("POST /api/locationscale", test_location_scale)

# ─── Test: Multiple Imputation ─────────────────────────────────────────────
def test_mi():
    data = {
        "studies": [
            {"study": "MI1", "effect": -0.5, "se": 0.2},
            {"study": "MI2", "effect": -0.3, "se": 0.25},
        ],
        "n_imputations": 5
    }
    j = ok(post("/api/mi", data), "mi")
    assert "pooled" in j or "imputed" in j

test("POST /api/mi", test_mi)

# ─── Test: Restricted Cubic Splines ────────────────────────────────────────
def test_rcs():
    data = {
        "studies": [
            {"study": "RCS1", "dose": 0, "effect": 0, "se": 0.1},
            {"study": "RCS2", "dose": 10, "effect": -0.3, "se": 0.15},
            {"study": "RCS3", "dose": 20, "effect": -0.5, "se": 0.12},
        ],
        "knots": 3
    }
    j = ok(post("/api/rcs", data), "rcs")
    assert "predicted" in j or "curve" in j

test("POST /api/rcs", test_rcs)

# ─── Test: Cluster-Robust ──────────────────────────────────────────────────
def test_clusterrobust():
    data = {
        "studies": [
            {"study": "CR1", "effect": -0.5, "se": 0.2, "cluster": "C1"},
            {"study": "CR2", "effect": -0.3, "se": 0.25, "cluster": "C1"},
            {"study": "CR3", "effect": -0.4, "se": 0.15, "cluster": "C2"},
        ]
    }
    j = ok(post("/api/clusterrobust", data), "clusterrobust")
    assert "pooled" in j or "se" in j

test("POST /api/clusterrobust", test_clusterrobust)

# ─── Test: Prognostic Meta ─────────────────────────────────────────────────
def test_prognostic_meta():
    data = {
        "studies": [
            {"study": "PM1", "intercept": 0.5, "se_intercept": 0.1, "n": 200},
            {"study": "PM2", "intercept": 0.3, "se_intercept": 0.15, "n": 300},
        ]
    }
    j = ok(post("/api/prognostic/meta", data), "prognostic_meta")
    assert "pooled" in j or "intercept" in j

test("POST /api/prognostic/meta", test_prognostic_meta)

# ─── Test: Bivariate DTA ──────────────────────────────────────────────────
def test_bivariate_dta():
    data = {
        "studies": [
            {"study": "BDTA1", "tp": 45, "fp": 10, "fn": 5, "tn": 40},
            {"study": "BDTA2", "tp": 80, "fp": 15, "fn": 10, "tn": 95},
        ]
    }
    j = ok(post("/api/dta/bivariate", data), "bivariate_dta")
    assert "sens" in j or "spec" in j or "pooled" in j

test("POST /api/dta/bivariate", test_bivariate_dta)

# ─── Test: Multilevel NMA ──────────────────────────────────────────────────
def test_multilevel_nma():
    data = {
        "studies": [
            {"study": "MNMA1", "treatment1": "A", "treatment2": "B", "effect": -0.5, "se": 0.2, "cluster": "C1"},
        ],
        "treatments": ["A", "B", "C"]
    }
    j = ok(post("/api/nma/multilevel", data), "multilevel_nma")
    assert "pooled" in j or "relative_effects" in j

test("POST /api/nma/multilevel", test_multilevel_nma)

# ─── Test: HSROC ───────────────────────────────────────────────────────────
def test_hsroc():
    data = {
        "studies": [
            {"study": "HSROC1", "tp": 45, "fp": 10, "fn": 5, "tn": 40},
            {"study": "HSROC2", "tp": 80, "fp": 15, "fn": 10, "tn": 95},
        ]
    }
    j = ok(post("/api/dta/hsroc", data), "hsroc")
    assert "sens" in j or "spec" in j or "alpha" in j

test("POST /api/dta/hsroc", test_hsroc)

# ─── Test: Competing Risks ─────────────────────────────────────────────────
def test_competing_risks():
    data = {
        "studies": [
            {"study": "CR1", "events": 15, "n": 100, "time": 12},
            {"study": "CR2", "events": 25, "n": 200, "time": 12},
        ]
    }
    j = ok(post("/api/competing-risks", data), "competing_risks")
    assert "pooled" in j or "cif" in j

test("POST /api/competing-risks", test_competing_risks)

# ─── Test: Multi-Arm NMA ───────────────────────────────────────────────────
def test_multiarm_nma():
    data = {
        "studies": [
            {"study": "MANMA1", "treatments": ["A", "B", "C"], "effects": [-0.5, -0.3], "ses": [0.2, 0.25]},
        ],
        "all_treatments": ["A", "B", "C"]
    }
    j = ok(post("/api/nma/multiarm", data), "multiarm_nma")
    assert "pooled" in j or "relative_effects" in j

test("POST /api/nma/multiarm", test_multiarm_nma)

# ─── Test: Qualitative Meta ────────────────────────────────────────────────
def test_qualitative_meta():
    data = {
        "studies": [
            {"study": "QM1", "themes": ["Theme A", "Theme B"]},
            {"study": "QM2", "themes": ["Theme A", "Theme C"]},
        ]
    }
    j = ok(post("/api/qualitative/meta", data), "qualitative_meta")
    assert "themes" in j or "synthesis" in j

test("POST /api/qualitative/meta", test_qualitative_meta)

# ─── Test: Bayesian NMA ────────────────────────────────────────────────────
def test_bayesian_nma():
    data = {
        "studies": [
            {"study": "BNMA1", "treatment1": "A", "treatment2": "B", "effect": -0.5, "se": 0.2},
        ],
        "treatments": ["A", "B", "C"],
        "n_iter": 500, "n_burnin": 100
    }
    j = ok(post("/api/bayesian-nma", data), "bayesian_nma")
    assert "pooled" in j or "mcmc" in j

test("POST /api/bayesian-nma", test_bayesian_nma)

# ─── Test: Umbrella Review ─────────────────────────────────────────────────
def test_umbrella():
    data = {
        "reviews": [
            {"review": "U1", "effect": -0.5, "se": 0.2, "n": 500},
            {"review": "U2", "effect": -0.3, "se": 0.25, "n": 600},
        ]
    }
    j = ok(post("/api/umbrella", data), "umbrella")
    assert "pooled" in j or "reviews" in j

test("POST /api/umbrella", test_umbrella)

# ─── Test: IPD from KM ─────────────────────────────────────────────────────
def test_ipd_from_km():
    data = {
        "time": [0, 6, 12, 18, 24],
        "n_at_risk": [100, 80, 60, 40, 20],
        "total_n": 100,
        "n_events": 80
    }
    j = ok(post("/api/ipd/from-km", data), "ipd_from_km")
    assert "ipd" in j or "events" in j or "times" in j

test("POST /api/ipd/from-km", test_ipd_from_km)

# ─── Test: RVE ─────────────────────────────────────────────────────────────
def test_rve():
    data = {
        "studies": [
            {"study": "RVE1", "effect": -0.5, "se": 0.2},
            {"study": "RVE2", "effect": -0.3, "se": 0.25},
            {"study": "RVE3", "effect": -0.4, "se": 0.15},
        ]
    }
    j = ok(post("/api/rve", data), "rve")
    assert "pooled" in j or "se" in j

test("POST /api/rve", test_rve)

# ─── Test: Citation Network ────────────────────────────────────────────────
def test_citation_network():
    data = {
        "papers": [
            {"id": "P1", "title": "Paper A", "references": ["P2", "P3"]},
            {"id": "P2", "title": "Paper B", "references": ["P3"]},
            {"id": "P3", "title": "Paper C", "references": []},
        ]
    }
    j = ok(post("/api/citation/network", data), "citation_network")
    assert "network" in j or "clusters" in j or "papers" in j

test("POST /api/citation/network", test_citation_network)

# ─── Test: GRADE SoF Table ─────────────────────────────────────────────────
def test_grade_sof_table():
    data = {
        "comparisons": [{
            "intervention": "Drug A",
            "outcomes": [
                {"outcome": "Mortality", "n": 200, "k": 3, "effect": 0.8, "ci_lower": 0.6, "ci_upper": 1.1, "baseline_risk": 0.15, "direction": "lower_better"},
            ]
        }]
    }
    j = ok(post("/api/grade/sof-table", data), "grade_sof_table")
    assert "table" in j or "rows" in j

test("POST /api/grade/sof-table", test_grade_sof_table)

# ─── Test: NMA Regression ──────────────────────────────────────────────────
def test_nma_regression():
    data = {
        "studies": [
            {"study": "NMAREG1", "treatment1": "A", "treatment2": "B", "effect": -0.5, "se": 0.2},
            {"study": "NMAREG2", "treatment1": "A", "treatment2": "C", "effect": -0.3, "se": 0.25},
        ],
        "referenceTreatment": "A",
        "measure": "OR"
    }
    j = ok(post("/api/nma/regression", data), "nma_regression")
    assert "coefficients" in j or "relativeEffects" in j

test("POST /api/nma/regression", test_nma_regression)

# ─── Test: BMA ─────────────────────────────────────────────────────────────
def test_bma():
    data = {
        "studies": [
            {"study": "BMA1", "effect": -0.5, "se": 0.2},
            {"study": "BMA2", "effect": -0.3, "se": 0.25},
        ]
    }
    j = ok(post("/api/bma", data), "bma")
    assert "pooled" in j or "model_averaged" in j

test("POST /api/bma", test_bma)

# ─── Test: Phylo ───────────────────────────────────────────────────────────
def test_phylo():
    data = {
        "studies": [
            {"study": "PHY1", "effect": -0.5, "se": 0.2, "species": "sp1"},
            {"study": "PHY2", "effect": -0.3, "se": 0.25, "species": "sp2"},
        ],
        "phylogeny": {"sp1": 0.5, "sp2": 0.5}
    }
    j = ok(post("/api/phylo", data), "phylo")
    assert "pooled" in j or "effect" in j

test("POST /api/phylo", test_phylo)

# ─── Test: Multivariate Dose-Response ──────────────────────────────────────
def test_multivariate_dose():
    data = {
        "studies": [
            {"study": "MVD1", "dose": 10, "effects": [-0.5, -0.3], "ses": [0.2, 0.25]},
        ]
    }
    j = ok(post("/api/dose/multivariate", data), "multivariate_dose")
    assert "pooled" in j or "effects" in j

test("POST /api/dose/multivariate", test_multivariate_dose)

# ─── Test: Living Review Automation ────────────────────────────────────────
def test_living_automate():
    data = {
        "databases": ["PubMed"],
        "query": "BCG vaccine",
        "frequency": "monthly"
    }
    j = ok(post("/api/living/automate", data), "living_automate")
    assert "status" in j or "config" in j

test("POST /api/living/automate", test_living_automate)

# ─── Test: Zotero/Mendeley (stub endpoints) ───────────────────────────────
def test_zotero_connect():
    data = {"api_key": "test", "library_id": "123", "library_type": "user"}
    j = ok(post("/api/zotero/connect", data), "zotero_connect")
    assert "status" in j or "connected" in j

test("POST /api/zotero/connect", test_zotero_connect)

def test_mendeley_connect():
    data = {"access_token": "test", "id": "123"}
    j = ok(post("/api/mendeley/connect", data), "mendeley_connect")
    assert "status" in j or "connected" in j

test("POST /api/mendeley/connect", test_mendeley_connect)

# ─── Test: Project save/load ───────────────────────────────────────────────
def test_project_save():
    data = {"path": "/tmp/test_poolr.json", "project": {"title": "Test", "version": "0.6.1"}}
    j = ok(post("/api/project/save", data), "project_save")
    assert "saved" in j

test("POST /api/project/save", test_project_save)

def test_project_load():
    data = {"path": "/tmp/test_poolr.json"}
    j = ok(post("/api/project/load", data), "project_load")
    assert "title" in j or "project" in j

test("POST /api/project/load", test_project_load)

# ─── Test: Export R code ───────────────────────────────────────────────────
def test_export_r():
    data = {
        "response": {"k": 2, "model": "Random-effects", "measure": "OR", "pooled": {"effect": 0.75, "ci_lower": 0.55, "ci_upper": 1.02}},
        "data": [
            {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
        ]
    }
    r = post("/api/export/r_code", data)
    if r.status_code != 200:
        raise AssertionError(f"r_code: HTTP {r.status_code}: {r.text[:200]}")
    assert "metafor" in r.text or "library" in r.text

test("POST /api/export/r_code", test_export_r)

# ─── Test: Export citations ────────────────────────────────────────────────
def test_export_citations():
    data = {"data": [
        {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100, "year": 2020},
    ]}
    r = requests.post(f"{BASE}/api/export/citations?format=bibtex", json=data, timeout=30)
    if r.status_code != 200:
        raise AssertionError(f"citations: HTTP {r.status_code}: {r.text[:200]}")
    assert "@" in r.text or "author" in r.text

test("POST /api/export/citations (bibtex)", test_export_citations)

# ─── Test: Export methods ──────────────────────────────────────────────────
def test_export_methods():
    data = {"k": 5, "model": "Random-effects", "measure": "OR", "method": "DL", "pooled": {"effect": 0.75, "ci_lower": 0.55, "ci_upper": 1.02}}
    r = post("/api/export/methods", data)
    if r.status_code != 200:
        raise AssertionError(f"methods: HTTP {r.status_code}: {r.text[:200]}")
    assert len(r.text) > 20

test("POST /api/export/methods", test_export_methods)

# ─── Test: Rob figures ────────────────────────────────────────────────────
def test_rob_traffic():
    data = {
        "assessments": [
            {"study": "R1", "domains": {"Randomization": "Low", "Deviations": "Low", "Missing": "Low", "Measurement": "Low", "Selection": "Low"}},
        ]
    }
    r = post("/api/figure/rob_traffic", data)
    if r.status_code != 200:
        raise AssertionError(f"rob_traffic: HTTP {r.status_code}: {r.text[:200]}")
    assert "<svg" in r.text

test("POST /api/figure/rob_traffic", test_rob_traffic)

def test_rob_summary():
    data = {
        "assessments": [
            {"study": "R1", "domains": {"Randomization": "Low", "Deviations": "Low", "Missing": "Low", "Measurement": "Low", "Selection": "Low"}},
            {"study": "R2", "domains": {"Randomization": "Low", "Deviations": "Some concerns", "Missing": "Low", "Measurement": "Low", "Selection": "Low"}},
        ]
    }
    r = post("/api/figure/rob_summary", data)
    if r.status_code != 200:
        raise AssertionError(f"rob_summary: HTTP {r.status_code}: {r.text[:200]}")
    assert "<svg" in r.text

test("POST /api/figure/rob_summary", test_rob_summary)

# ─── Test: Diagnostic figures ─────────────────────────────────────────────
def test_galbraith():
    data = {
        "studies": [
            {"study": "G1", "effect": -0.5, "se": 0.2},
            {"study": "G2", "effect": -0.3, "se": 0.25},
        ]
    }
    r = post("/api/figure/galbraith", data)
    if r.status_code != 200:
        raise AssertionError(f"galbraith: HTTP {r.status_code}: {r.text[:200]}")
    assert "<svg" in r.text

test("POST /api/figure/galbraith", test_galbraith)

def test_baujat():
    data = {
        "studies": [
            {"study": "B1", "effect": -0.5, "se": 0.2},
            {"study": "B2", "effect": -0.3, "se": 0.25},
        ]
    }
    r = post("/api/figure/baujat", data)
    if r.status_code != 200:
        raise AssertionError(f"baujat: HTTP {r.status_code}: {r.text[:200]}")
    assert "<svg" in r.text

test("POST /api/figure/baujat", test_baujat)

def test_labbe():
    data = [
        {"name": "L1", "a": 15, "n1": 100, "c": 25, "n2": 100},
        {"name": "L2", "a": 8, "n1": 50, "c": 18, "n2": 50},
    ]
    r = post("/api/figure/labbe", data)
    if r.status_code != 200:
        raise AssertionError(f"labbe: HTTP {r.status_code}: {r.text[:200]}")
    assert "<svg" in r.text

test("POST /api/figure/labbe", test_labbe)

def test_contour_funnel():
    data = {
        "k": 3, "pooled": {"effect": 0.75, "se": 0.12},
        "studies": [
            {"study": "F1", "effect": 0.8, "se": 0.15},
            {"study": "F2", "effect": 0.7, "se": 0.18},
        ]
    }
    r = post("/api/figure/funnel_contour", data)
    if r.status_code != 200:
        raise AssertionError(f"contour_funnel: HTTP {r.status_code}: {r.text[:200]}")
    assert "<svg" in r.text

test("POST /api/figure/funnel_contour", test_contour_funnel)

# ─── Test: Export docx ────────────────────────────────────────────────────
def test_export_docx():
    data = {"metadata": {"title": "Test"}, "pico": {"population": "P", "intervention": "I", "comparator": "C", "outcomes": "O"}}
    r = requests.post(f"{BASE}/api/export?format=docx", json=data, timeout=30)
    if r.status_code != 200:
        raise AssertionError(f"docx: HTTP {r.status_code}: {r.text[:200]}")
    assert r.headers.get("content-type", "").startswith("application/vnd.openxmlformats")

test("POST /api/export?format=docx", test_export_docx)

# ─── Test: Export python ───────────────────────────────────────────────────
def test_report_python():
    data = {"title": "Test", "methods": "Test", "results": "Test"}
    r = post("/api/report/python", data)
    if r.status_code != 200:
        raise AssertionError(f"python: HTTP {r.status_code}: {r.text[:200]}")
    assert "import" in r.text or "scipy" in r.text or "numpy" in r.text

test("POST /api/report/python", test_report_python)

# ─── Test: Export stata ────────────────────────────────────────────────────
def test_report_stata():
    data = {"title": "Test", "methods": "Test", "results": "Test"}
    r = post("/api/report/stata", data)
    if r.status_code != 200:
        raise AssertionError(f"stata: HTTP {r.status_code}: {r.text[:200]}")
    assert "meta" in r.text or "metan" in r.text

test("POST /api/report/stata", test_report_stata)

# ─── Test: Survival RMST ───────────────────────────────────────────────────
def test_survival_rmst():
    data = {
        "type": "rmst",
        "request": {
            "studies": [
                {"study": "RMST1", "rmst_diff": 2.5, "se": 1.0, "tau": 12},
                {"study": "RMST2", "rmst_diff": 1.8, "se": 0.8, "tau": 12},
            ],
            "tau": 12
        }
    }
    r = post("/api/survival", data)
    if r.status_code != 200:
        raise AssertionError(f"survival_rmst: HTTP {r.status_code}: {r.text[:200]}")
    j = r.json()
    assert "pooled" in j or "effect" in j

test("POST /api/survival (RMST)", test_survival_rmst)

# ─── Test: AI screening (stub) ─────────────────────────────────────────────
def test_ai_screening():
    data = {"title": "BCG vaccine for TB", "abstract": "Test abstract"}
    r = post("/api/ai/screening", data)
    if r.status_code != 200:
        raise AssertionError(f"ai_screening: HTTP {r.status_code}: {r.text[:200]}")
    assert "message" in r.json()

test("POST /api/ai/screening", test_ai_screening)

# ─── Test: Large dataset stress ────────────────────────────────────────────
def test_large_dataset():
    import random
    random.seed(42)
    studies = []
    for i in range(100):
        n = random.randint(50, 500)
        ie = random.randint(0, n // 3)
        ce = random.randint(0, n // 3)
        studies.append({
            "study": f"Large_{i:03d}", "type": "binary",
            "int_events": ie, "int_n": n,
            "ctrl_events": ce, "ctrl_n": n,
        })
    data = {"model": "random", "measure": "OR", "method": "DL", "data": studies}
    j = ok(post("/api/meta", data), "large_dataset")
    assert j["k"] == 100
    assert "pooled" in j

test("POST /api/meta (100 studies stress)", test_large_dataset)

# ─── Test: Extreme values ─────────────────────────────────────────────────
def test_extreme_values():
    data = {
        "model": "random", "measure": "OR", "method": "DL",
        "data": [
            {"study": "E1", "type": "binary", "int_events": 1, "int_n": 10000, "ctrl_events": 999, "ctrl_n": 10000},
            {"study": "E2", "type": "binary", "int_events": 5000, "int_n": 10000, "ctrl_events": 1, "ctrl_n": 10000},
        ]
    }
    j = ok(post("/api/meta", data), "extreme_values")
    assert "pooled" in j
    assert j["k"] == 2

test("POST /api/meta (extreme values)", test_extreme_values)

# ─── Test: Missing fields ──────────────────────────────────────────────────
def test_missing_fields():
    data = {"model": "random", "measure": "OR", "method": "DL", "data": [{"study": "M1"}]}
    r = post("/api/meta", data)
    # Should either handle gracefully or return error
    assert r.status_code in [200, 400]

test("POST /api/meta (missing fields)", test_missing_fields)

# ─── Test: Invalid measure ─────────────────────────────────────────────────
def test_invalid_measure():
    data = {"model": "random", "measure": "INVALID", "method": "DL", "data": [
        {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
    ]}
    r = post("/api/meta", data)
    assert r.status_code in [200, 400]

test("POST /api/meta (invalid measure)", test_invalid_measure)

# ─── Test: Invalid model ───────────────────────────────────────────────────
def test_invalid_model():
    data = {"model": "INVALID", "measure": "OR", "method": "DL", "data": [
        {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
    ]}
    r = post("/api/meta", data)
    assert r.status_code in [200, 400]

test("POST /api/meta (invalid model)", test_invalid_model)

# ═══════════════════════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("POOLR STRESS TEST RESULTS")
print("=" * 70)

passed = sum(1 for r in results if r[0] == "PASS")
failed = sum(1 for r in results if r[0] == "FAIL")

for status, name, err in results:
    if status == "FAIL":
        print(f"  FAIL: {name} -> {err}")

print(f"\nTotal: {len(results)} | Passed: {passed} | Failed: {failed}")
if failed == 0:
    print("ALL TESTS PASSED")
else:
    print(f"FAILURE RATE: {failed}/{len(results)} ({100*failed/len(results):.1f}%)")
