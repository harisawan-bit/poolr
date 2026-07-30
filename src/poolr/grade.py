"""
GRADE (Grading of Recommendations Assessment, Development and Evaluation)
Evidence table generation for systematic reviews
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum
import json


class GRADEDomain(Enum):
    """GRADE domains for certainty assessment"""
    RISK_OF_BIAS = "Risk of Bias"
    INCONSISTENCY = "Inconsistency"
    INDIRECTNESS = "Indirectness"
    IMPRECISION = "Imprecision"
    PUBLICATION_BIAS = "Publication Bias"


class CertaintyLevel(Enum):
    """GRADE certainty levels"""
    HIGH = "High"
    MODERATE = "Moderate"
    LOW = "Low"
    VERY_LOW = "Very Low"


@dataclass
class GRADEAssessment:
    """Assessment for a single outcome"""
    outcome: str
    studies: int = 0
    design: str = "RCT"  # or "Observational"
    
    # Domain judgments
    risk_of_bias: str = "Not serious"  # "Not serious", "Serious", "Very serious"
    inconsistency: str = "Not serious"
    indirectness: str = "Not serious"
    imprecision: str = "Not serious"
    publication_bias: str = "Not serious"
    
    # Starting certainty
    @property
    def starting_certainty(self) -> CertaintyLevel:
        if self.design.upper() in ["RCT", "RANDOMIZED"]:
            return CertaintyLevel.HIGH
        return CertaintyLevel.LOW
    
    @property
    def final_certainty(self) -> CertaintyLevel:
        """Calculate final certainty based on downgrades"""
        downgrades = 0
        
        for domain in [self.risk_of_bias, self.inconsistency, self.indirectness, 
                      self.imprecision, self.publication_bias]:
            if domain == "Serious":
                downgrades += 1
            elif domain == "Very serious":
                downgrades += 2
        
        # Apply downgrades
        level = self.starting_certainty
        levels = [CertaintyLevel.HIGH, CertaintyLevel.MODERATE, CertaintyLevel.LOW, CertaintyLevel.VERY_LOW]
        idx = levels.index(level)
        idx = min(idx + downgrades, len(levels) - 1)
        
        return levels[idx]
    
    @property
    def downgrade_summary(self) -> List[str]:
        """Return list of domains that caused downgrades"""
        reasons = []
        for domain_name, judgment in [
            ("Risk of bias", self.risk_of_bias),
            ("Inconsistency", self.inconsistency),
            ("Indirectness", self.indirectness),
            ("Imprecision", self.imprecision),
            ("Publication bias", self.publication_bias),
        ]:
            if judgment in ["Serious", "Very serious"]:
                reasons.append(f"{domain_name}: {judgment}")
        return reasons


class GRADETableGenerator:
    """Generate GRADE evidence tables"""
    
    def __init__(self, project_data: Dict[str, Any]):
        self.project_data = project_data
        self.assessments: List[GRADEAssessment] = []
    
    def add_outcome(self, outcome: str, studies: int = 0, design: str = "RCT"):
        """Add an outcome for GRADE assessment"""
        assessment = GRADEAssessment(outcome=outcome, studies=studies, design=design)
        self.assessments.append(assessment)
        return assessment
    
    def auto_populate_from_meta(self):
        """Auto-populate from meta-analysis results"""
        meta = self.project_data.get("meta", {}).get("results", {})
        if not meta:
            return
        
        studies = meta.get("studies", [])
        k = len(studies)
        
        # Determine design
        designs = set(s.get("design", "") for s in studies)
        design = "RCT" if any("RCT" in d for d in designs) else "Observational"
        
        # Get outcomes from extraction
        outcomes = set()
        for s in self.project_data.get("extraction", {}).get("studies", []):
            if s.get("primary_outcome"):
                outcomes.add(s["primary_outcome"])
            if s.get("secondary_outcomes"):
                for o in s["secondary_outcomes"].split("; "):
                    outcomes.add(o)
        
        # If no outcomes specified, use generic
        if not outcomes:
            outcomes = ["Primary outcome", "Secondary outcome"]
        
        for outcome in outcomes:
            self.add_outcome(outcome, k, design)
        
        # Auto-assess domains based on meta-analysis results
        for assessment in self.assessments:
            self._auto_assess_domains(assessment, meta)
    
    def _auto_assess_domains(self, assessment: GRADEAssessment, meta: Dict[str, Any]):
        """Auto-assess GRADE domains from meta-analysis results"""
        hetero = meta.get("heterogeneity", {})
        pub_bias = meta.get("publication_bias", {})
        pooled = meta.get("pooled", {})
        
        # Risk of bias - check RoB assessments
        rob = self.project_data.get("rob", {}).get("assessments", [])
        high_rob = sum(1 for a in rob if a.get("data", {}).get("overall") == "High")
        some_rob = sum(1 for a in rob if a.get("data", {}).get("overall") == "Some concerns")
        total_rob = len(rob)
        
        if total_rob > 0:
            if high_rob / total_rob > 0.5:
                assessment.risk_of_bias = "Serious"
            elif (high_rob + some_rob) / total_rob > 0.5:
                assessment.risk_of_bias = "Serious"
            elif high_rob > 0 or some_rob > 0:
                assessment.risk_of_bias = "Not serious"
        
        # Inconsistency - based on I²
        i2 = hetero.get("i2", 0)
        if i2 > 75:
            assessment.inconsistency = "Serious"
        elif i2 > 50:
            assessment.inconsistency = "Serious"
        elif i2 > 25:
            assessment.inconsistency = "Not serious"
        
        # Imprecision - based on CI width and sample size
        ci_width = pooled.get("ci_upper", 0) - pooled.get("ci_lower", 0)
        effect = pooled.get("effect", 1)
        if effect > 0:
            rel_width = ci_width / effect
            if rel_width > 1.0:
                assessment.imprecision = "Serious"
            elif rel_width > 0.5:
                assessment.imprecision = "Not serious"
        
        # Also consider sample size
        total_n = sum(
            s.get("int_n", 0) + s.get("ctrl_n", 0) 
            for s in meta.get("studies", [])
        )
        if total_n < 100:
            assessment.imprecision = "Serious"
        elif total_n < 400:
            assessment.imprecision = "Not serious"
        
        # Publication bias
        if pub_bias:
            egger = pub_bias.get("egger", {})
            if egger.get("significant", False):
                assessment.publication_bias = "Serious"
    
    def to_dict(self) -> List[Dict[str, Any]]:
        """Convert to list of dicts for export"""
        result = []
        for a in self.assessments:
            result.append({
                "outcome": a.outcome,
                "studies": a.studies,
                "design": a.design,
                "starting_certainty": a.starting_certainty.value,
                "final_certainty": a.final_certainty.value,
                "risk_of_bias": a.risk_of_bias,
                "inconsistency": a.inconsistency,
                "indirectness": a.indirectness,
                "imprecision": a.imprecision,
                "publication_bias": a.publication_bias,
                "downgrade_reasons": a.downgrade_summary,
            })
        return result
    
    def generate_word_table(self, doc) -> None:
        """Add GRADE evidence table to Word document"""
        if not self.assessments:
            return
        
        doc.add_heading('GRADE Evidence Profile', level=2)
        
        # Table header
        headers = [
            "Outcome", "Studies", "Design", 
            "Risk of Bias", "Inconsistency", "Indirectness", "Imprecision", "Publication Bias",
            "Starting Certainty", "Final Certainty", "Downgrade Reasons"
        ]
        
        table = doc.add_table(rows=len(self.assessments) + 1, cols=len(headers))
        table.style = 'Table Grid'
        
        # Headers
        for i, header in enumerate(headers):
            cell = table.rows[0].cells[i]
            cell.text = header
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.bold = True
        
        # Data
        for row_idx, a in enumerate(self.assessments):
            data = [
                a.outcome,
                str(a.studies),
                a.design,
                a.risk_of_bias,
                a.inconsistency,
                a.indirectness,
                a.imprecision,
                a.publication_bias,
                a.starting_certainty.value,
                a.final_certainty.value,
                "; ".join(a.downgrade_summary) if a.downgrade_summary else "None",
            ]
            
            for col_idx, value in enumerate(data):
                cell = table.rows[row_idx + 1].cells[col_idx]
                cell.text = str(value)
        
        # Add footnote
        doc.add_paragraph()
        doc.add_paragraph(
            "GRADE Working Group grades of evidence: "
            "High certainty = further research is very unlikely to change our confidence in the estimate of effect. "
            "Moderate certainty = further research is likely to have an important impact on our confidence in the estimate of effect and may change the estimate. "
            "Low certainty = further research is very likely to have an important impact on our confidence in the estimate of effect and is likely to change the estimate. "
            "Very low certainty = we are very uncertain about the estimate.",
            style='Caption'
        )
    
    def generate_latex_table(self) -> str:
        """Generate LaTeX table for GRADE evidence profile"""
        if not self.assessments:
            return ""
        
        lines = []
        lines.append("\\begin{table}[htbp]")
        lines.append("\\centering")
        lines.append("\\caption{GRADE Evidence Profile}")
        lines.append("\\begin{tabular}{lllllllllll}")
        lines.append("\\toprule")
        lines.append("Outcome & Studies & Design & Risk of Bias & Inconsist. & Indirect. & Imprecision & Pub. Bias & Start & Final & Downgrades \\\\")
        lines.append("\\midrule")
        
        for a in self.assessments:
            row = (
                f"{a.outcome} & "
                f"{a.studies} & "
                f"{a.design} & "
                f"{a.risk_of_bias} & "
                f"{a.inconsistency} & "
                f"{a.indirectness} & "
                f"{a.imprecision} & "
                f"{a.publication_bias} & "
                f"{a.starting_certainty.value} & "
                f"\\textbf{{{a.final_certainty.value}}} & "
                f"{'; '.join(a.downgrade_summary) if a.downgrade_summary else 'None'} \\\\"
            )
            lines.append(row)
        
        lines.append("\\bottomrule")
        lines.append("\\end{tabular}")
        lines.append("\\label{tab:grade}")
        lines.append("\\end{table}")
        
        return "\n".join(lines)
    
    def generate_json(self) -> str:
        """Generate JSON for GRADE evidence"""
        return json.dumps(self.to_dict(), indent=2)


def create_grade_summary(project_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create complete GRADE summary for a project"""
    generator = GRADETableGenerator(project_data)
    generator.auto_populate_from_meta()
    
    return {
        "assessments": generator.to_dict(),
        "summary": {
            "total_outcomes": len(generator.assessments),
            "high_certainty": sum(1 for a in generator.assessments if a.final_certainty == CertaintyLevel.HIGH),
            "moderate_certainty": sum(1 for a in generator.assessments if a.final_certainty == CertaintyLevel.MODERATE),
            "low_certainty": sum(1 for a in generator.assessments if a.final_certainty == CertaintyLevel.LOW),
            "very_low_certainty": sum(1 for a in generator.assessments if a.final_certainty == CertaintyLevel.VERY_LOW),
        }
    }