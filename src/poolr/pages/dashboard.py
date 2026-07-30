"""
Dashboard page
"""

import customtkinter as ctk
import tkinter as tk
from tkinter import messagebox
from poolr.pages.base import BasePage


class DashboardPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._build()

    def _build(self):
        # Welcome header
        header = ctk.CTkFrame(self)
        header.pack(fill="x", pady=(0, 20))
        ctk.CTkLabel(header, text="Welcome to poolr", font=ctk.CTkFont(size=24, weight="bold")).pack(anchor="w")
        ctk.CTkLabel(header, text="Your systematic review & meta-analysis workspace", font=ctk.CTkFont(size=13)).pack(anchor="w", pady=(4, 0))

        # Quick stats
        stats_frame = ctk.CTkFrame(self)
        stats_frame.pack(fill="x", pady=(0, 20))
        stats_frame.grid_columnconfigure((0,1,2,3), weight=1)
        
        self.stat_cards = {}
        for i, (label, key) in enumerate([
            ("Studies Found", "studies_found"),
            ("Studies Included", "studies_included"),
            ("Extraction Complete", "extraction_done"),
            ("Meta-Analysis Done", "meta_done"),
        ]):
            card = ctk.CTkFrame(stats_frame)
            card.grid(row=0, column=i, padx=8, pady=8, sticky="ew")
            ctk.CTkLabel(card, text=label, font=ctk.CTkFont(size=11)).pack(anchor="w", padx=12, pady=(10, 2))
            val = ctk.CTkLabel(card, text="0", font=ctk.CTkFont(size=28, weight="bold"))
            val.pack(anchor="w", padx=12, pady=(0, 10))
            self.stat_cards[key] = val

        # Recent activity / quick actions
        actions_frame = ctk.CTkFrame(self)
        actions_frame.pack(fill="x", pady=(0, 20))
        ctk.CTkLabel(actions_frame, text="Quick Actions", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=16, pady=(12, 8))
        
        actions = [
            ("📋 Define PICO", "protocol"),
            ("🔍 Build Search", "search"),
            ("☑️ Start Screening", "screening"),
            ("📝 Extract Data", "extraction"),
            ("⚠️ Assess Bias", "rob"),
            ("📈 Run Meta-Analysis", "meta"),
        ]
        btn_frame = ctk.CTkFrame(actions_frame, fg_color="transparent")
        btn_frame.pack(fill="x", padx=16, pady=(0, 16))
        for i, (label, key) in enumerate(actions):
            btn = ctk.CTkButton(btn_frame, text=label, height=36, 
                               command=lambda k=key: self.app._select_page(k))
            btn.grid(row=i//3, column=i%3, padx=6, pady=6, sticky="ew")
            btn_frame.grid_columnconfigure(i%3, weight=1)

        # Project info
        self.info_frame = ctk.CTkFrame(self)
        self.info_frame.pack(fill="both", expand=True)
        ctk.CTkLabel(self.info_frame, text="Project Information", font=ctk.CTkFont(size=16, weight="bold")).pack(anchor="w", padx=16, pady=(12, 8))
        
        # Use a label instead of textbox to avoid scrollbar issues in headless mode
        self.info_label = ctk.CTkLabel(self.info_frame, text="poolr v0.3\n\nA modern, no-code desktop application for systematic reviews and meta-analyses.\n\nFeatures:\n- PRISMA 2020 compliant workflow\n- Advanced meta-analysis engine (OR, RR, RD, MD, SMD, HR)\n- Publication-ready figures (forest plots, funnel plots, PRISMA flow)\n- GRADE evidence profiling\n- PubMed direct import\n- RIS/EndNote/Zotero compatibility\n- Word/LaTeX manuscript export\n\nYour data stays on your machine. No cloud required.", 
                                   font=ctk.CTkFont(size=12), justify="left", anchor="nw")
        self.info_label.pack(fill="both", expand=True, padx=16, pady=(0, 16))

    def refresh(self):
        self._update_stats()
        self._update_info()

    def _update_stats(self):
        data = self.app.project_data
        ta_count = len(data.get("screening", {}).get("title_abstract", []))
        ft_count = len(data.get("screening", {}).get("full_text", []))
        ext_count = len(data.get("extraction", {}).get("studies", []))
        rob_count = len(data.get("rob", {}).get("assessments", []))
        meta_done = bool(data.get("meta", {}).get("results", {}))

        self.stat_cards["studies_found"].configure(text=str(ta_count))
        self.stat_cards["studies_included"].configure(text=str(ft_count))
        self.stat_cards["extraction_done"].configure(text=f"{ext_count} studies")
        self.stat_cards["meta_done"].configure(text="Yes" if meta_done else "No")

    def _update_info(self):
        # Update label text
        if not self.app.project_path:
            text = "poolr v0.3\n\nA modern, no-code desktop application for systematic reviews and meta-analyses.\n\nFeatures:\n- PRISMA 2020 compliant workflow\n- Advanced meta-analysis engine (OR, RR, RD, MD, SMD, HR)\n- Publication-ready figures (forest plots, funnel plots, PRISMA flow)\n- GRADE evidence profiling\n- PubMed direct import\n- RIS/EndNote/Zotero compatibility\n- Word/LaTeX manuscript export\n\nYour data stays on your machine. No cloud required."
        else:
            text = f"Project: {self.app.project_name}\n\nCreated: {self.app.project_data.get('metadata', {}).get('created', 'Unknown')}\n\nLast saved: {self.app.project_data.get('metadata', {}).get('last_saved', 'Unknown')}"
        
        self.info_label.configure(text=text)
        info += f"Location: {self.app.project_path}\n\n"
        meta = self.app.project_data.get("metadata", {})
        info += f"Created: {meta.get('created', 'Unknown')}\n"
        info += f"Last Modified: {meta.get('modified', 'Unknown')}\n"
        info += f"Version: {meta.get('version', '0.3.0')}\n\n"

        pico = self.app.project_data.get("pico", {})
        if pico:
            info += "PICO Summary:\n"
            for k, v in pico.items():
                if v:
                    info += f"  {k.capitalize()}: {v[:80]}{'...' if len(v) > 80 else ''}\n"
        else:
            info += "PICO not yet defined."

        self.info_text.insert("0.0", info)