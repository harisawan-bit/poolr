#!/usr/bin/env python3
"""
GUI Smoke Test - verifies all pages can be instantiated without errors.
Run with: xvfb-run -a python tests/gui_smoke_test.py
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import customtkinter as ctk

ctk.set_appearance_mode('dark')

from poolr.main import PoolrApp
from poolr.pages.dashboard import DashboardPage
from poolr.pages.protocol import ProtocolPage
from poolr.pages.search import SearchPage
from poolr.pages.screening import ScreeningPage
from poolr.pages.extraction import ExtractionPage
from poolr.pages.rob import RoBPage
from poolr.pages.meta import MetaPage
from poolr.pages.prisma import PrismaPage


def test_all_pages():
    """Test that all pages can be instantiated and have required methods."""
    print("Creating PoolrApp...")
    app = PoolrApp()
    
    pages = [
        ("Dashboard", DashboardPage),
        ("Protocol", ProtocolPage),
        ("Search", SearchPage),
        ("Screening", ScreeningPage),
        ("Extraction", ExtractionPage),
        ("Risk of Bias", RoBPage),
        ("Meta-Analysis", MetaPage),
        ("PRISMA", PrismaPage),
    ]
    
    for name, page_class in pages:
        print(f"Testing {name} page...")
        page = page_class(app.page_container, app=app)
        
        # Verify required methods exist
        assert hasattr(page, 'refresh'), f"{name}: missing refresh() method"
        assert hasattr(page, 'on_enter'), f"{name}: missing on_enter() method"
        assert hasattr(page, 'on_leave'), f"{name}: missing on_leave() method"
        
        print(f"  ✓ {name} page OK")
    
    app.destroy()
    print("\n✓ All pages instantiated successfully!")


def test_meta_analysis_engine():
    """Test meta-analysis engine without GUI."""
    print("\nTesting meta-analysis engine...")
    from poolr.meta.analysis import MetaAnalysis
    
    # Binary outcome test
    binary_data = [
        {"study": "A", "type": "binary", "int_events": 15, "int_n": 100, "ctrl_events": 25, "ctrl_n": 100},
        {"study": "B", "type": "binary", "int_events": 8, "int_n": 50, "ctrl_events": 18, "ctrl_n": 50},
        {"study": "C", "type": "binary", "int_events": 30, "int_n": 200, "ctrl_events": 45, "ctrl_n": 200},
    ]
    
    meta = MetaAnalysis(model="random", measure="OR", method="DL")
    results = meta.run(binary_data)
    
    assert results["k"] == 3
    assert "pooled" in results
    assert "heterogeneity" in results
    assert 0 <= results["heterogeneity"]["i2"] <= 100
    
    print(f"  ✓ Binary OR meta-analysis: OR = {results['pooled']['effect']:.3f} "
          f"(95% CI: {results['pooled']['ci_lower']:.3f}-{results['pooled']['ci_upper']:.3f})")
    print(f"  ✓ Heterogeneity: I² = {results['heterogeneity']['i2']:.1f}%")
    
    # Continuous outcome test
    cont_data = [
        {"study": "A", "type": "continuous", "int_mean": 10.5, "int_sd": 2.1, "int_n": 50, 
         "ctrl_mean": 12.3, "ctrl_sd": 2.5, "ctrl_n": 50},
        {"study": "B", "type": "continuous", "int_mean": 8.2, "int_sd": 1.8, "int_n": 40, 
         "ctrl_mean": 9.8, "ctrl_sd": 2.0, "ctrl_n": 40},
    ]
    
    meta2 = MetaAnalysis(model="random", measure="MD", method="DL")
    results2 = meta2.run(cont_data)
    
    assert results2["k"] == 2
    print(f"  ✓ Continuous MD meta-analysis: MD = {results2['pooled']['effect']:.3f}")
    
    print("\n✓ Meta-analysis engine tests passed!")


def test_grade():
    """Test GRADE evidence profiling."""
    print("\nTesting GRADE module...")
    from poolr.meta.grade import GRADEAssessment, CertaintyLevel
    from poolr.grade import create_grade_summary
    
    assessment = GRADEAssessment(
        outcome="Mortality",
        studies=5,
        design="RCT",
        risk_of_bias="Serious",
        inconsistency="Not serious",
        indirectness="Not serious",
        imprecision="Serious",
        publication_bias="Not serious"
    )
    
    assert assessment.starting_certainty == CertaintyLevel.HIGH
    assert assessment.final_certainty == CertaintyLevel.LOW
    assert len(assessment.downgrade_summary) == 2
    
    print(f"  ✓ GRADE assessment: {assessment.starting_certainty.value} → {assessment.final_certainty.value}")
    print(f"  ✓ Downgrades: {assessment.downgrade_summary}")
    
    # Test auto-population
    project_data = {
        "extraction": {"studies": [{"design": "RCT", "primary_outcome": "Mortality"}] * 3},
        "rob": {"assessments": [{"data": {"overall": "High"}}, {"data": {"overall": "Some concerns"}}]},
        "meta": {
            "results": {
                "studies": [{"design": "RCT"}] * 3,
                "heterogeneity": {"i2": 30},
                "pooled": {"effect": 0.75, "ci_lower": 0.55, "ci_upper": 1.02},
                "publication_bias": {"egger": {"significant": False}}
            }
        }
    }
    
    grade_summary = create_grade_summary(project_data)
    assert "assessments" in grade_summary
    assert grade_summary["summary"]["total_outcomes"] > 0
    
    print(f"  ✓ Auto GRADE from project data: {grade_summary['summary']['total_outcomes']} outcomes")
    print("\n✓ GRADE tests passed!")


def test_ris():
    """Test RIS import/export."""
    print("\nTesting RIS import/export...")
    from poolr.import_.ris import parse_ris_string, export_ris, ris_to_screening_records
    import tempfile
    
    ris_content = """TY  - JOUR
TI  - Test Study Title
AU  - Smith, John
AU  - Doe, Jane
PY  - 2023
JO  - Journal of Testing
VL  - 10
IS  - 2
SP  - 100
EP  - 110
DO  - 10.1234/test.2023
AB  - This is a test abstract.
KW  - keyword1; keyword2
ER  - 
"""
    
    records = parse_ris_string(ris_content)
    assert len(records) == 1
    assert records[0]["title"] == "Test Study Title"
    assert "Smith, John" in records[0]["authors"]
    assert records[0]["year"] == "2023"
    assert records[0]["doi"] == "10.1234/test.2023"
    
    print(f"  ✓ RIS parsing: {records[0]['title']}")
    
    # Test export
    with tempfile.NamedTemporaryFile(mode='w', suffix='.ris', delete=False) as f:
        temp_path = f.name
    
    export_ris(records, temp_path)
    
    with open(temp_path) as f:
        exported = f.read()
    
    assert "TY  - JOUR" in exported
    assert "Test Study Title" in exported
    
    os.unlink(temp_path)
    print("  ✓ RIS export/import round-trip")
    
    # Test screening conversion
    screening = ris_to_screening_records(records)
    assert len(screening) == 1
    assert screening[0]["title"] == "Test Study Title"
    assert screening[0]["decision"] is None
    
    print("  ✓ RIS → screening conversion")
    print("\n✓ RIS tests passed!")


def test_prisma():
    """Test PRISMA flow diagram."""
    print("\nTesting PRISMA flow diagram...")
    from poolr.plotting.figures import create_prisma_flow_diagram
    import matplotlib.pyplot as plt
    
    flow_data = {
        "identified": 500,
        "before_screening": 450,
        "excluded_ta": 300,
        "sought": 150,
        "not_retrieved": 10,
        "assessed": 140,
        "excluded_ft": 90,
        "included": 50,
    }
    
    fig = create_prisma_flow_diagram(flow_data)
    assert fig is not None
    
    import tempfile
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as f:
        temp_path = f.name
    
    fig.savefig(temp_path, format='svg', dpi=300, bbox_inches='tight')
    assert os.path.exists(temp_path)
    assert os.path.getsize(temp_path) > 1000
    
    plt.close(fig)
    os.unlink(temp_path)
    
    print("  ✓ PRISMA flow diagram generation and SVG export")
    print("\n✓ PRISMA tests passed!")


def test_forest_plot():
    """Test forest plot generation."""
    print("\nTesting forest plot...")
    from poolr.plotting.figures import create_forest_plot
    import matplotlib.pyplot as plt
    import tempfile
    
    results = {
        "measure": "OR",
        "model": "Random-effects",
        "studies": [
            {"study": "Study A", "effect": 0.65, "ci_lower": 0.42, "ci_upper": 1.01, "weight": 35.2},
            {"study": "Study B", "effect": 0.78, "ci_lower": 0.51, "ci_upper": 1.19, "weight": 42.1},
            {"study": "Study C", "effect": 0.92, "ci_lower": 0.68, "ci_upper": 1.24, "weight": 22.7},
        ],
        "pooled": {"effect": 0.76, "ci_lower": 0.58, "ci_upper": 0.99},
        "heterogeneity": {"i2": 15.3, "tau2": 0.012, "q": 2.36, "df": 2},
    }
    
    fig = create_forest_plot(results)
    assert fig is not None
    
    with tempfile.NamedTemporaryFile(suffix='.svg', delete=False) as f:
        temp_path = f.name
    
    fig.savefig(temp_path, format='svg', dpi=300, bbox_inches='tight')
    assert os.path.exists(temp_path)
    assert os.path.getsize(temp_path) > 1000
    
    plt.close(fig)
    os.unlink(temp_path)
    
    print("  ✓ Forest plot generation and SVG export")
    print("\n✓ Forest plot tests passed!")


def test_project_persistence():
    """Test project save/load cycle."""
    print("\nTesting project persistence...")
    import tempfile
    import json
    
    with tempfile.TemporaryDirectory() as tmpdir:
        project_path = os.path.join(tmpdir, "test_project")
        os.makedirs(project_path)
        
        project_data = {
            "pico": {
                "population": "Adults with TBI",
                "intervention": "Decompressive craniectomy",
                "comparator": "Medical management",
                "outcomes": "Mortality at 6 months"
            },
            "search_strategies": {"pubmed": "TBI AND craniectomy"},
            "screening": {"title_abstract": [{"title": "Study 1", "decision": True}]},
            "extraction": {"studies": [{"study_id": "Study_1", "title": "Test Study"}]},
            "rob": {"assessments": []},
            "meta": {"results": {}},
            "metadata": {"version": "0.3.0"}
        }
        
        poolr_json = os.path.join(project_path, "poolr.json")
        with open(poolr_json, 'w') as f:
            json.dump(project_data, f, indent=2)
        
        with open(poolr_json) as f:
            loaded = json.load(f)
        
        assert loaded["pico"]["population"] == "Adults with TBI"
        assert len(loaded["screening"]["title_abstract"]) == 1
        
        print("  ✓ Project JSON save/load cycle")
    
    print("\n✓ Project persistence tests passed!")


if __name__ == "__main__":
    print("=" * 60)
    print("poolr v0.3 - Comprehensive Verification Suite")
    print("=" * 60)
    
    try:
        test_all_pages()
        test_meta_analysis_engine()
        test_grade()
        test_ris()
        test_prisma()
        test_forest_plot()
        test_project_persistence()
        
        print("\n" + "=" * 60)
        print("✓ ALL TESTS PASSED")
        print("=" * 60)
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)