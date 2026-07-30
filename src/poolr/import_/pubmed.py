"""
PubMed Entrez API integration for direct literature search and import
"""

import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import threading
from queue import Queue

try:
    from Bio import Entrez
    BIOPYTHON_AVAILABLE = True
except ImportError:
    BIOPYTHON_AVAILABLE = False
    Entrez = None


@dataclass
class PubMedRecord:
    """Structured PubMed record"""
    pmid: str
    title: str
    authors: List[str]
    journal: str
    year: int
    month: str
    day: str
    doi: str
    abstract: str
    keywords: List[str]
    mesh_terms: List[str]
    publication_types: List[str]
    url: str


class PubMedClient:
    """Client for PubMed Entrez API"""
    
    def __init__(self, email: str = "user@example.com", api_key: Optional[str] = None):
        if not BIOPYTHON_AVAILABLE:
            raise ImportError("biopython not installed. Install with: pip install biopython")
        
        Entrez.email = email
        if api_key:
            Entrez.api_key = api_key
        
        self.email = email
        self.api_key = api_key
        self.last_request_time = 0
        self.min_interval = 0.34 if api_key else 1.0  # 3 req/s with key, 1/s without
    
    def _rate_limit(self):
        """Enforce rate limiting"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()
    
    def search(self, query: str, max_results: int = 100, 
               sort: str = "relevance", date_range: Optional[tuple] = None) -> List[str]:
        """
        Search PubMed and return list of PMIDs
        
        Args:
            query: PubMed query string
            max_results: Maximum number of results
            sort: "relevance", "pub_date", "most_recent"
            date_range: Optional tuple of (start_date, end_date) as "YYYY-MM-DD"
        """
        self._rate_limit()
        
        # Build query with date range if provided
        full_query = query
        if date_range:
            start, end = date_range
            full_query += f" AND ({start}[Date - Publication] : {end}[Date - Publication])"
        
        try:
            handle = Entrez.esearch(
                db="pubmed",
                term=full_query,
                retmax=max_results,
                sort=sort,
                usehistory="y"
            )
            result = Entrez.read(handle)
            handle.close()
            
            pmids = result.get("IdList", [])
            webenv = result.get("WebEnv")
            query_key = result.get("QueryKey")
            
            return pmids
        except Exception as e:
            raise RuntimeError(f"PubMed search failed: {e}")
    
    def fetch_records(self, pmids: List[str]) -> List[PubMedRecord]:
        """Fetch full records for given PMIDs"""
        if not pmids:
            return []
        
        self._rate_limit()
        
        try:
            # Fetch in batches of 200 (Entrez limit)
            batch_size = 200
            all_records = []
            
            for i in range(0, len(pmids), batch_size):
                batch = pmids[i:i + batch_size]
                self._rate_limit()
                
                handle = Entrez.efetch(
                    db="pubmed",
                    id=batch,
                    rettype="xml",
                    retmode="xml"
                )
                xml_content = handle.read()
                handle.close()
                
                records = self._parse_pubmed_xml(xml_content)
                all_records.extend(records)
            
            return all_records
        except Exception as e:
            raise RuntimeError(f"PubMed fetch failed: {e}")
    
    def _parse_pubmed_xml(self, xml_content: bytes) -> List[PubMedRecord]:
        """Parse PubMed XML response"""
        root = ET.fromstring(xml_content)
        records = []
        
        for article in root.findall(".//PubmedArticle"):
            try:
                record = self._parse_article(article)
                if record:
                    records.append(record)
            except Exception:
                continue
        
        return records
    
    def _parse_article(self, article) -> Optional[PubMedRecord]:
        """Parse a single PubmedArticle element"""
        try:
            # PMID
            pmid_elem = article.find(".//PMID")
            pmid = pmid_elem.text if pmid_elem is not None else ""
            
            # Title
            title_elem = article.find(".//ArticleTitle")
            title = title_elem.text if title_elem is not None else ""
            
            # Authors
            authors = []
            for author in article.findall(".//Author"):
                last = author.find("LastName")
                fore = author.find("ForeName")
                init = author.find("Initials")
                collective = author.find("CollectiveName")
                
                if collective is not None:
                    authors.append(collective.text or "")
                elif last is not None:
                    name = last.text or ""
                    if fore is not None:
                        name = f"{fore.text} {name}"
                    elif init is not None:
                        name = f"{init.text} {name}"
                    authors.append(name)
            
            # Journal
            journal_elem = article.find(".//Journal/Title")
            journal = journal_elem.text if journal_elem is not None else ""
            
            # Publication date
            pub_date = article.find(".//PubDate")
            year = ""
            month = ""
            day = ""
            if pub_date is not None:
                year_elem = pub_date.find("Year")
                month_elem = pub_date.find("Month")
                day_elem = pub_date.find("Day")
                year = year_elem.text if year_elem is not None else ""
                month = month_elem.text if month_elem is not None else ""
                day = day_elem.text if day_elem is not None else ""
            
            # DOI
            doi = ""
            for id_elem in article.findall(".//ArticleId"):
                if id_elem.get("IdType") == "doi":
                    doi = id_elem.text or ""
                    break
            
            # Abstract
            abstract = ""
            abstract_elem = article.find(".//Abstract/AbstractText")
            if abstract_elem is not None:
                abstract = abstract_elem.text or ""
            
            # Keywords
            keywords = []
            for kw in article.findall(".//Keyword"):
                if kw.text:
                    keywords.append(kw.text)
            
            # MeSH terms
            mesh_terms = []
            for mesh in article.findall(".//MeshHeading/DescriptorName"):
                if mesh.text:
                    mesh_terms.append(mesh.text)
            
            # Publication types
            pub_types = []
            for pt in article.findall(".//PublicationType"):
                if pt.text:
                    pub_types.append(pt.text)
            
            # URL
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else ""
            
            return PubMedRecord(
                pmid=pmid,
                title=title or "",
                authors=authors,
                journal=journal or "",
                year=int(year) if year.isdigit() else 0,
                month=month,
                day=day,
                doi=doi,
                abstract=abstract,
                keywords=keywords,
                mesh_terms=mesh_terms,
                publication_types=pub_types,
                url=url
            )
        except Exception:
            return None
    
    def search_and_fetch(self, query: str, max_results: int = 100, 
                         date_range: Optional[tuple] = None) -> List[PubMedRecord]:
        """Convenience method: search and fetch in one call"""
        pmids = self.search(query, max_results=max_results, date_range=date_range)
        return self.fetch_records(pmids)


class PubMedImporter:
    """High-level importer for integrating PubMed searches into poolr"""
    
    def __init__(self, email: str = "user@example.com", api_key: Optional[str] = None):
        self.client = PubMedClient(email, api_key)
    
    def import_to_project(self, app, query: str, max_results: int = 50,
                          date_range: Optional[tuple] = None,
                          screening_mode: str = "title_abstract") -> int:
        """
        Search PubMed and import records directly to screening
        
        Returns number of records imported
        """
        records = self.client.search_and_fetch(query, max_results, date_range)
        
        if not records:
            return 0
        
        # Convert to screening format
        screening_records = []
        for r in records:
            screening_records.append({
                "title": r.title,
                "authors": "; ".join(r.authors),
                "year": str(r.year) if r.year else "",
                "journal": r.journal,
                "doi": r.doi,
                "abstract": r.abstract,
                "pmid": r.pmid,
                "keywords": "; ".join(r.keywords),
                "mesh_terms": "; ".join(r.mesh_terms),
                "publication_types": "; ".join(r.publication_types),
                "url": r.url,
                "decision": None,
                "reason": ""
            })
        
        # Add to project
        mode_key = "title_abstract" if screening_mode == "title_abstract" else "full_text"
        existing = app.project_data.get("screening", {}).get(mode_key, [])
        existing.extend(screening_records)
        app.project_data.setdefault("screening", {})[mode_key] = existing
        app.save_project()
        
        return len(screening_records)


def show_pubmed_search_dialog(parent, app):
    """Show dialog for PubMed search and import"""
    import customtkinter as ctk
    import tkinter as tk
    from tkinter import messagebox
    
    if not BIOPYTHON_AVAILABLE:
        messagebox.showerror("Error", "biopython not installed. Install with: pip install biopython")
        return
    
    dialog = ctk.CTkToplevel(parent)
    dialog.title("PubMed Search & Import")
    dialog.geometry("600x500")
    dialog.grab_set()
    
    # Email/API key
    ctk.CTkLabel(dialog, text="NCBI Email (required):").pack(anchor="w", padx=20, pady=(20, 5))
    email_entry = ctk.CTkEntry(dialog, width=400)
    email_entry.pack(padx=20, pady=(0, 10))
    email_entry.insert(0, "user@example.com")
    
    ctk.CTkLabel(dialog, text="API Key (optional, for higher rate limits):").pack(anchor="w", padx=20, pady=(0, 5))
    api_entry = ctk.CTkEntry(dialog, width=400)
    api_entry.pack(padx=20, pady=(0, 10))
    
    # Query
    ctk.CTkLabel(dialog, text="PubMed Query:").pack(anchor="w", padx=20, pady=(10, 5))
    query_text = ctk.CTkTextbox(dialog, height=100)
    query_text.pack(fill="x", padx=20, pady=(0, 10))
    
    # Auto-fill from PICO if available
    pico = app.project_data.get("pico", {})
    if pico:
        parts = []
        for k in ["population", "intervention", "comparator", "outcomes"]:
            if pico.get(k):
                parts.append(f"({pico[k]})")
        query_text.insert("0.0", " AND\n".join(parts))
    
    # Options
    opts_frame = ctk.CTkFrame(dialog)
    opts_frame.pack(fill="x", padx=20, pady=10)
    
    ctk.CTkLabel(opts_frame, text="Max Results:").grid(row=0, column=0, padx=10, pady=10)
    max_entry = ctk.CTkEntry(opts_frame, width=80)
    max_entry.grid(row=0, column=1, padx=10, pady=10)
    max_entry.insert(0, "50")
    
    ctk.CTkLabel(opts_frame, text="Date Range (YYYY-MM-DD):").grid(row=0, column=2, padx=10, pady=10)
    date_start = ctk.CTkEntry(opts_frame, width=100)
    date_start.grid(row=0, column=3, padx=5, pady=10)
    date_start.insert(0, "2020-01-01")
    ctk.CTkLabel(opts_frame, text="to").grid(row=0, column=4, padx=5)
    date_end = ctk.CTkEntry(opts_frame, width=100)
    date_end.grid(row=0, column=5, padx=5, pady=10)
    date_end.insert(0, "2024-12-31")
    
    mode_var = tk.StringVar(value="title_abstract")
    ctk.CTkSegmentedButton(opts_frame, values=["Title/Abstract", "Full Text"], variable=mode_var).grid(row=1, column=0, columnspan=6, pady=10)
    
    # Progress
    progress = ctk.CTkProgressBar(dialog)
    progress.pack(fill="x", padx=20, pady=10)
    progress.set(0)
    
    status_label = ctk.CTkLabel(dialog, text="")
    status_label.pack(padx=20, pady=(0, 10))
    
    def run_search():
        query = query_text.get("0.0", "end").strip()
        if not query:
            messagebox.showwarning("Warning", "Enter a query")
            return
        
        try:
            max_results = int(max_entry.get())
        except ValueError:
            max_results = 50
        
        date_range = None
        if date_start.get() and date_end.get():
            date_range = (date_start.get(), date_end.get())
        
        email = email_entry.get().strip()
        api_key = api_entry.get().strip() or None
        
        # Run in background thread
        def worker():
            try:
                importer = PubMedImporter(email, api_key)
                status_label.configure(text="Searching PubMed...")
                progress.set(0.2)
                
                count = importer.import_to_project(
                    app, query, max_results, date_range, mode_var.get()
                )
                
                dialog.after(0, lambda: _on_complete(count))
            except Exception as e:
                dialog.after(0, lambda: _on_error(e))
        
        threading.Thread(target=worker, daemon=True).start()
    
    def _on_complete(count):
        progress.set(1.0)
        status_label.configure(text=f"Imported {count} records")
        messagebox.showinfo("Success", f"Imported {count} records from PubMed")
        app._refresh_all_pages()
    
    def _on_error(e):
        progress.set(0)
        status_label.configure(text="Error")
        messagebox.showerror("Error", f"PubMed search failed:\n{e}")
    
    btn_frame = ctk.CTkFrame(dialog, fg_color="transparent")
    btn_frame.pack(pady=20)
    ctk.CTkButton(btn_frame, text="🔍 Search & Import", command=run_search, height=40).pack(side="left", padx=10)
    ctk.CTkButton(btn_frame, text="Cancel", command=dialog.destroy, height=40, fg_color="gray").pack(side="left", padx=10)