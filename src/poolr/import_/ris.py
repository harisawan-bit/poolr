"""
RIS (Research Information Systems) format import/export
Used by EndNote, Zotero, Mendeley, RefWorks, etc.
"""

import re
from typing import List, Dict, Any, Optional, TextIO
from pathlib import Path
from datetime import datetime


# RIS tag mapping to our internal fields
RIS_TAG_MAP = {
    "TY": "type",
    "AU": "authors",
    "TI": "title",
    "JO": "journal",
    "JA": "journal_abbrev",
    "VL": "volume",
    "IS": "issue",
    "SP": "start_page",
    "EP": "end_page",
    "PY": "year",
    "DA": "date",
    "AB": "abstract",
    "KW": "keywords",
    "DO": "doi",
    "UR": "url",
    "PB": "publisher",
    "SN": "issn",
    "L1": "pdf_url",
    "L2": "full_text_url",
    "N1": "notes",
    "ER": "end_record",
}


# Common RIS types
RIS_TYPES = {
    "JOUR": "Journal Article",
    "BOOK": "Book",
    "CHAP": "Book Chapter",
    "CONF": "Conference Paper",
    "THES": "Thesis",
    "RPRT": "Report",
    "NEWS": "Newspaper Article",
    "WEB": "Web Page",
    "GEN": "Generic",
}


def parse_ris(file_path: str) -> List[Dict[str, Any]]:
    """
    Parse RIS file and return list of records
    
    Args:
        file_path: Path to .ris file
        
    Returns:
        List of record dictionaries
    """
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    return parse_ris_string(content)


def parse_ris_string(content: str) -> List[Dict[str, Any]]:
    """Parse RIS content from string"""
    records = []
    current_record = {}
    current_tag = None
    current_value = []
    
    lines = content.split('\n')
    
    for line in lines:
        line = line.rstrip('\r\n')
        
        if not line:
            continue
        
        # RIS format: TAG  - VALUE (two spaces, hyphen, space)
        match = re.match(r'^([A-Z0-9]{2})\s{2}-\s(.*)$', line)
        
        if match:
            # Save previous tag's value
            if current_tag and current_value:
                if current_tag in current_record:
                    if isinstance(current_record[current_tag], list):
                        current_record[current_tag].extend(current_value)
                    else:
                        current_record[current_tag] = [current_record[current_tag]] + current_value
                else:
                    current_record[current_tag] = current_value if len(current_value) > 1 else current_value[0]
            
            tag = match.group(1)
            value = match.group(2)
            
            if tag == "ER":  # End of record
                if current_record:
                    records.append(_normalize_record(current_record))
                current_record = {}
                current_tag = None
                current_value = []
            else:
                current_tag = tag
                current_value = [value]
        
        elif line.startswith("   "):  # Continuation line (6 spaces)
            if current_tag and current_value:
                current_value.append(line.strip())
    
    # Handle last record if no ER
    if current_record and current_tag and current_value:
        if current_tag in current_record:
            if isinstance(current_record[current_tag], list):
                current_record[current_tag].extend(current_value)
            else:
                current_record[current_tag] = [current_record[current_tag]] + current_value
        else:
            current_record[current_tag] = current_value if len(current_value) > 1 else current_value[0]
        
        if current_record:
            records.append(_normalize_record(current_record))
    
    return records


def _normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize RIS record to our internal format"""
    normalized = {}
    
    # Type
    ty = record.get("TY", "")
    normalized["design"] = RIS_TYPES.get(ty, "Other")
    
    # Authors (AU can be multiple)
    authors = record.get("AU", [])
    if isinstance(authors, list):
        normalized["authors"] = "; ".join(authors)
    else:
        normalized["authors"] = authors
    
    # Title
    normalized["title"] = record.get("TI", "")
    
    # Journal
    journal = record.get("JO") or record.get("JA", "")
    normalized["journal"] = journal
    
    # Year
    py = record.get("PY", "")
    if isinstance(py, list):
        py = py[0]
    # Extract year from various formats
    year_match = re.search(r'\b(19|20)\d{2}\b', str(py))
    normalized["year"] = year_match.group(0) if year_match else str(py)
    
    # Volume/Issue/Pages
    normalized["volume"] = record.get("VL", "")
    normalized["issue"] = record.get("IS", "")
    normalized["start_page"] = record.get("SP", "")
    normalized["end_page"] = record.get("EP", "")
    
    # DOI
    normalized["doi"] = record.get("DO", "")
    
    # Abstract
    abstract = record.get("AB", "")
    if isinstance(abstract, list):
        abstract = " ".join(abstract)
    normalized["abstract"] = abstract
    
    # Keywords
    kw = record.get("KW", [])
    if isinstance(kw, list):
        normalized["keywords"] = "; ".join(kw)
    else:
        normalized["keywords"] = kw
    
    # URL
    normalized["url"] = record.get("UR", "")
    
    # ISSN
    normalized["issn"] = record.get("SN", "")
    
    # Publisher
    normalized["publisher"] = record.get("PB", "")
    
    # Notes
    notes = record.get("N1", [])
    if isinstance(notes, list):
        normalized["notes"] = "; ".join(notes)
    else:
        normalized["notes"] = notes
    
    # Generate study ID
    normalized["study_id"] = f"RIS_{hash(normalized.get('title', '') + normalized.get('year', '')) % 10000:04d}"
    
    # Keep original RIS fields for reference
    normalized["_ris_raw"] = record
    
    return normalized


def export_ris(records: List[Dict[str, Any]], file_path: str, 
               default_type: str = "JOUR") -> None:
    """
    Export records to RIS format
    
    Args:
        records: List of record dictionaries
        file_path: Output file path
        default_type: Default RIS type if not specified
    """
    with open(file_path, 'w', encoding='utf-8') as f:
        for record in records:
            _write_ris_record(f, record, default_type)


def _write_ris_record(f: TextIO, record: Dict[str, Any], default_type: str) -> None:
    """Write a single record in RIS format"""
    
    # Type
    ty = record.get("design", "")
    ris_type = "GEN"
    for k, v in RIS_TYPES.items():
        if v.lower() == ty.lower():
            ris_type = k
            break
    f.write(f"TY  - {ris_type}\n")
    
    # Authors
    authors = record.get("authors", "")
    if authors:
        # Split by semicolon or comma
        author_list = re.split(r'[;,] ?', authors)
        for author in author_list:
            author = author.strip()
            if author:
                f.write(f"AU  - {author}\n")
    
    # Title
    title = record.get("title", "")
    if title:
        # Wrap long titles
        for line in _wrap_text(title, 75):
            f.write(f"TI  - {line}\n")
    
    # Journal
    journal = record.get("journal", "")
    if journal:
        f.write(f"JO  - {journal}\n")
    
    # Year
    year = record.get("year", "")
    if year:
        f.write(f"PY  - {year}\n")
    
    # Volume
    volume = record.get("volume", "")
    if volume:
        f.write(f"VL  - {volume}\n")
    
    # Issue
    issue = record.get("issue", "")
    if issue:
        f.write(f"IS  - {issue}\n")
    
    # Pages
    sp = record.get("start_page", "")
    ep = record.get("end_page", "")
    if sp:
        f.write(f"SP  - {sp}\n")
    if ep:
        f.write(f"EP  - {ep}\n")
    
    # DOI
    doi = record.get("doi", "")
    if doi:
        f.write(f"DO  - {doi}\n")
    
    # Abstract
    abstract = record.get("abstract", "")
    if abstract:
        for line in _wrap_text(abstract, 75):
            f.write(f"AB  - {line}\n")
    
    # Keywords
    keywords = record.get("keywords", "")
    if keywords:
        kw_list = re.split(r'[;,] ?', keywords)
        for kw in kw_list:
            kw = kw.strip()
            if kw:
                f.write(f"KW  - {kw}\n")
    
    # URL
    url = record.get("url", "")
    if url:
        f.write(f"UR  - {url}\n")
    
    # DOI as link
    if doi:
        f.write(f"L1  - https://doi.org/{doi}\n")
    
    # ISSN
    issn = record.get("issn", "")
    if issn:
        f.write(f"SN  - {issn}\n")
    
    # End record
    f.write("ER  - \n\n")


def _wrap_text(text: str, width: int = 75) -> List[str]:
    """Wrap text to specified width for RIS continuation lines"""
    if len(text) <= width:
        return [text]
    
    words = text.split()
    lines = []
    current = []
    current_len = 0
    
    for word in words:
        if current_len + len(word) + 1 > width:
            lines.append(" ".join(current))
            current = [word]
            current_len = len(word)
        else:
            current.append(word)
            current_len += len(word) + 1
    
    if current:
        lines.append(" ".join(current))
    
    return lines


def ris_to_screening_records(ris_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert RIS records to screening format"""
    screening = []
    for r in ris_records:
        screening.append({
            "title": r.get("title", ""),
            "authors": r.get("authors", ""),
            "year": str(r.get("year", "")),
            "journal": r.get("journal", ""),
            "doi": r.get("doi", ""),
            "abstract": r.get("abstract", ""),
            "keywords": r.get("keywords", ""),
            "volume": r.get("volume", ""),
            "issue": r.get("issue", ""),
            "pages": f"{r.get('start_page', '')}-{r.get('end_page', '')}",
            "url": r.get("url", ""),
            "design": r.get("design", ""),
            "decision": None,
            "reason": ""
        })
    return screening


def screening_records_to_ris(screening_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert screening records to RIS format"""
    ris_records = []
    for r in screening_records:
        ris = {
            "TI": r.get("title", ""),
            "AU": r.get("authors", "").split("; ") if r.get("authors") else [],
            "PY": r.get("year", ""),
            "JO": r.get("journal", ""),
            "VL": r.get("volume", ""),
            "IS": r.get("issue", ""),
            "SP": r.get("pages", "").split("-")[0] if r.get("pages") else "",
            "EP": r.get("pages", "").split("-")[1] if "-" in r.get("pages", "") else "",
            "DO": r.get("doi", ""),
            "AB": r.get("abstract", ""),
            "KW": r.get("keywords", "").split("; ") if r.get("keywords") else [],
            "UR": r.get("url", ""),
            "TY": "JOUR" if r.get("design", "").lower() in ["rct", "randomized"] else "JOUR",
        }
        ris_records.append(ris)
    return ris_records


# Convenience functions
def import_ris_to_project(app, file_path: str, screening_mode: str = "title_abstract") -> int:
    """Import RIS file directly to project screening"""
    records = parse_ris(file_path)
    screening = ris_to_screening_records(records)
    
    mode_key = "title_abstract" if screening_mode == "title_abstract" else "full_text"
    existing = app.project_data.get("screening", {}).get(mode_key, [])
    existing.extend(screening)
    app.project_data.setdefault("screening", {})[mode_key] = existing
    app.save_project()
    
    return len(screening)


def export_project_to_ris(app, file_path: str, source: str = "extraction") -> int:
    """Export project records to RIS"""
    if source == "extraction":
        records = app.project_data.get("extraction", {}).get("studies", [])
    elif source == "screening":
        records = app.project_data.get("screening", {}).get("title_abstract", [])
    else:
        records = []
    
    ris_records = screening_records_to_ris(records)
    export_ris(ris_records, file_path)
    return len(ris_records)


# Command-line interface
def main():
    import argparse
    parser = argparse.ArgumentParser(description="RIS format converter")
    parser.add_argument("input", help="Input file")
    parser.add_argument("output", help="Output file")
    parser.add_argument("--format", choices=["ris", "json", "csv"], default="ris")
    args = parser.parse_args()
    
    if args.input.endswith(".ris"):
        records = parse_ris(args.input)
    else:
        # Try JSON
        import json
        with open(args.input) as f:
            records = json.load(f)
    
    if args.format == "ris":
        export_ris(records, args.output)
    elif args.format == "json":
        import json
        with open(args.output, "w") as f:
            json.dump(records, f, indent=2)
    elif args.format == "csv":
        import pandas as pd
        df = pd.DataFrame(records)
        df.to_csv(args.output, index=False)
    
    print(f"Converted {len(records)} records")


if __name__ == "__main__":
    main()