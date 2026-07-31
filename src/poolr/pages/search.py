"""
Search page - Search strategy builder
"""

from tkinter import messagebox

import customtkinter as ctk

from poolr.pages.base import BasePage
from poolr.ui import PAD_X, PrimaryButton, SecondaryButton, SectionHeader


class SearchPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._build()

    def _build(self):
        SectionHeader(
            self,
            "Search Strategy Builder",
            "Generate search strings for each database from your PICO. Edit as needed before exporting.",
        )

        self.scroll = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.scroll.pack(fill="both", expand=True, padx=PAD_X, pady=(8, 0))
        self.scroll.grid_columnconfigure(0, weight=1)

        PrimaryButton(
            self.scroll,
            text="🔄  Generate from PICO",
            command=self._generate_from_pico,
            height=40,
        ).grid(row=0, column=0, sticky="w", pady=(0, 16))

        # Database tabs
        self.db_textboxes = {}
        databases = [
            ("PubMed/MEDLINE", "pubmed"),
            ("Embase", "embase"),
            ("Cochrane CENTRAL", "cochrane"),
            ("Scopus", "scopus"),
            ("Web of Science", "wos"),
        ]

        for i, (label, key) in enumerate(databases):
            row = 1 + i * 2
            ctk.CTkLabel(self.scroll, text=label, font=ctk.CTkFont(size=14, weight="bold")).grid(
                row=row, column=0, sticky="w", pady=(12, 4)
            )
            tb = ctk.CTkTextbox(
                self.scroll, height=120, font=ctk.CTkFont(family="Consolas", size=11), border_color=("gray30", "gray30")
            )
            tb.grid(row=row + 1, column=0, sticky="ew", pady=(0, 4))
            self.db_textboxes[key] = tb

        # Save button
        PrimaryButton(
            self.scroll,
            text="💾  Save All Strategies",
            command=self._save,
            height=40,
        ).grid(row=11, column=0, sticky="ew", pady=20)

        # Export
        SecondaryButton(self.scroll, text="📤  Export All (.txt)", command=self._export, height=36).grid(
            row=12, column=0, sticky="ew", pady=(0, 20)
        )

    def on_enter(self):
        self.refresh()

    def refresh(self):
        strategies = self.app.project_data.get("search_strategies", {})
        for key, tb in self.db_textboxes.items():
            tb.delete("0.0", "end")
            if strategies.get(key):
                tb.insert("0.0", strategies[key])

    def _generate_from_pico(self):
        pico = self.app.project_data.get("pico", {})
        if not any(pico.values()):
            messagebox.showwarning("Warning", "Please define PICO in Protocol tab first")
            return

        pop = pico.get("population", "")
        interv = pico.get("intervention", "")
        comp = pico.get("comparator", "")
        outc = pico.get("outcomes", "")

        # PubMed
        pubmed = self._build_pubmed(pop, interv, comp, outc)
        self.db_textboxes["pubmed"].delete("0.0", "end")
        self.db_textboxes["pubmed"].insert("0.0", pubmed)

        # Embase
        embase = self._build_embase(pop, interv, comp, outc)
        self.db_textboxes["embase"].delete("0.0", "end")
        self.db_textboxes["embase"].insert("0.0", embase)

        # Cochrane
        cochrane = self._build_cochrane(pop, interv, comp, outc)
        self.db_textboxes["cochrane"].delete("0.0", "end")
        self.db_textboxes["cochrane"].insert("0.0", cochrane)

        # Scopus
        scopus = self._build_scopus(pop, interv, comp, outc)
        self.db_textboxes["scopus"].delete("0.0", "end")
        self.db_textboxes["scopus"].insert("0.0", scopus)

        # Web of Science
        wos = self._build_wos(pop, interv, comp, outc)
        self.db_textboxes["wos"].delete("0.0", "end")
        self.db_textboxes["wos"].insert("0.0", wos)

        messagebox.showinfo("Generated", "Search strategies generated from PICO. Review and edit as needed.")

    def _build_pubmed(self, pop, interv, comp, outc):
        parts = []
        if pop:
            parts.append(f"({pop}[MeSH Terms] OR {pop}[Title/Abstract])")
        if interv:
            parts.append(f"({interv}[MeSH Terms] OR {interv}[Title/Abstract])")
        if comp:
            parts.append(f"({comp}[MeSH Terms] OR {comp}[Title/Abstract])")
        if outc:
            parts.append(f"({outc}[MeSH Terms] OR {outc}[Title/Abstract])")
        return " AND\n".join(parts)

    def _build_embase(self, pop, interv, comp, outc):
        parts = []
        if pop:
            parts.append(f"('{pop}'/exp OR '{pop}':ti,ab)")
        if interv:
            parts.append(f"('{interv}'/exp OR '{interv}':ti,ab)")
        if comp:
            parts.append(f"('{comp}'/exp OR '{comp}':ti,ab)")
        if outc:
            parts.append(f"('{outc}'/exp OR '{outc}':ti,ab)")
        return " AND\n".join(parts)

    def _build_cochrane(self, pop, interv, comp, outc):
        lines = []
        idx = 1
        if pop:
            lines.append(f"#{idx} {pop}:ti,ab,kw")
            idx += 1
        if interv:
            lines.append(f"#{idx} {interv}:ti,ab,kw")
            idx += 1
        if comp:
            lines.append(f"#{idx} {comp}:ti,ab,kw")
            idx += 1
        if outc:
            lines.append(f"#{idx} {outc}:ti,ab,kw")
            idx += 1
        lines.append(f"#{idx} " + " AND ".join([f"#{i}" for i in range(1, idx)]))
        return "\n".join(lines)

    def _build_scopus(self, pop, interv, comp, outc):
        parts = []
        if pop:
            parts.append(f'TITLE-ABS-KEY("{pop}")')
        if interv:
            parts.append(f'TITLE-ABS-KEY("{interv}")')
        if comp:
            parts.append(f'TITLE-ABS-KEY("{comp}")')
        if outc:
            parts.append(f'TITLE-ABS-KEY("{outc}")')
        return " AND\n".join(parts)

    def _build_wos(self, pop, interv, comp, outc):
        parts = []
        if pop:
            parts.append(f'TS=("{pop}")')
        if interv:
            parts.append(f'TS=("{interv}")')
        if comp:
            parts.append(f'TS=("{comp}")')
        if outc:
            parts.append(f'TS=("{outc}")')
        return " AND\n".join(parts)

    def _save(self):
        strategies = {}
        for key, tb in self.db_textboxes.items():
            text = tb.get("0.0", "end").strip()
            if text:
                strategies[key] = text
        self.app.project_data["search_strategies"] = strategies
        self.app.save_project()
        messagebox.showinfo("Saved", "Search strategies saved to poolr.json")
        self.app._update_progress()

    def _export(self):
        if not self.app.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        strategies = {}
        for key, tb in self.db_textboxes.items():
            text = tb.get("0.0", "end").strip()
            if text:
                strategies[key] = text
        path = self.app.project_path / "search_strategies.txt"
        with open(path, "w", encoding="utf-8") as fh:
            for db, strat in strategies.items():
                fh.write(f"=== {db.upper()} ===\n{strat}\n\n")
        messagebox.showinfo("Exported", f"Strategies exported to:\n{path}")
