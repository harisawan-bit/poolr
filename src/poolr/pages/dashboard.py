"""
Dashboard page — overview, quick actions, and project KPIs.
"""

import customtkinter as ctk

from poolr import __version__
from poolr.pages.base import BasePage
from poolr.ui import (
    PAD_X,
    TEXT,
    TEXT_MUTED,
    Card,
    SecondaryButton,
    SectionHeader,
    StatTile,
    font,
)


class DashboardPage(BasePage):
    def __init__(self, master, app):
        super().__init__(master, app)
        self._build()

    def _build(self):
        SectionHeader(
            self,
            "Welcome to poolr",
            "Your systematic review & meta-analysis workspace — PRISMA 2020 compliant, no-code.",
        )

        # KPI tiles
        self.stat_cards = {}
        tiles = [
            ("Studies Found", "studies_found"),
            ("Studies Included", "studies_included"),
            ("Extraction Done", "extraction_done"),
            ("Meta-Analysis", "meta_done"),
        ]
        tile_row = ctk.CTkFrame(self, fg_color="transparent")
        tile_row.pack(fill="x", padx=PAD_X, pady=(12, 6))
        for i, (label, key) in enumerate(tiles):
            tile = StatTile(tile_row, label, "0")
            tile.grid(row=0, column=i, padx=8, pady=8, sticky="nsew")
            tile_row.grid_columnconfigure(i, weight=1)
            self.stat_cards[key] = tile

        # Quick actions
        actions_card = Card(self)
        actions_card.pack(fill="x", padx=PAD_X, pady=(14, 6))
        ctk.CTkLabel(actions_card, text="QUICK ACTIONS", font=font(10, "bold"), text_color=TEXT_MUTED).pack(
            anchor="w", padx=14, pady=(12, 2)
        )
        actions = [
            ("📋  Define PICO", "protocol"),
            ("🔍  Build Search", "search"),
            ("☑️  Start Screening", "screening"),
            ("📝  Extract Data", "extraction"),
            ("⚠️  Assess Bias", "rob"),
            ("📈  Run Meta-Analysis", "meta"),
        ]
        btn_grid = ctk.CTkFrame(actions_card, fg_color="transparent")
        btn_grid.pack(fill="x", padx=10, pady=(0, 12))
        for i, (label, key) in enumerate(actions):
            r, c = divmod(i, 3)
            SecondaryButton(btn_grid, text=label, command=lambda k=key: self.app._select_page(k), height=40).grid(
                row=r, column=c, padx=6, pady=6, sticky="nsew"
            )
            btn_grid.grid_columnconfigure(c, weight=1)

        # Project info
        info_card = Card(self)
        info_card.pack(fill="both", expand=True, padx=PAD_X, pady=(14, 12))
        ctk.CTkLabel(info_card, text="PROJECT INFORMATION", font=font(10, "bold"), text_color=TEXT_MUTED).pack(
            anchor="w", padx=14, pady=(12, 2)
        )
        self.info_label = ctk.CTkLabel(
            info_card,
            text="",
            font=font(12),
            text_color=TEXT,
            justify="left",
            anchor="nw",
            wraplength=1100,
        )
        self.info_label.pack(fill="both", expand=True, padx=14, pady=(4, 14))

    def refresh(self):
        self._update_stats()
        self._update_info()

    def _update_stats(self):
        data = self.app.project_data
        ta_count = len(data.get("screening", {}).get("title_abstract", []))
        ft_count = len(data.get("screening", {}).get("full_text", []))
        ext_count = len(data.get("extraction", {}).get("studies", []))
        meta_done = bool(data.get("meta", {}).get("results", {}))

        self.stat_cards["studies_found"].winfo_children()[1].configure(text=str(ta_count))
        self.stat_cards["studies_included"].winfo_children()[1].configure(text=str(ft_count))
        self.stat_cards["extraction_done"].winfo_children()[1].configure(text=f"{ext_count}")
        self.stat_cards["meta_done"].winfo_children()[1].configure(text="Yes" if meta_done else "No")

    def _update_info(self):
        if not self.app.project_path:
            text = (
                "No project open.\n\n"
                "poolr is a modern, no-code desktop application for systematic reviews and meta-analyses.\n\n"
                "Features:\n"
                "  • PRISMA 2020 compliant workflow\n"
                "  • Advanced meta-analysis engine (OR, RR, RD, MD, SMD, HR)\n"
                "  • Publication-ready figures (forest / funnel / PRISMA flow)\n"
                "  • GRADE evidence profiling\n"
                "  • PubMed direct import & RIS/EndNote/Zotero compatibility\n"
                "  • Word / LaTeX manuscript export\n\n"
                "Your data stays on your machine. No cloud required."
            )
        else:
            meta = self.app.project_data.get("metadata", {})
            lines = [
                f"Project: {self.app.project_name}",
                f"Location: {self.app.project_path}",
                f"Created: {meta.get('created', 'Unknown')}",
                f"Last saved: {meta.get('last_saved', meta.get('modified', 'Unknown'))}",
                f"Version: {meta.get('version', __version__)}",
                "",
            ]
            pico = self.app.project_data.get("pico", {})
            if any(pico.values()):
                lines.append("PICO Summary:")
                for k, v in pico.items():
                    if v:
                        lines.append(f"  {k.capitalize()}: {v[:80]}{'...' if len(v) > 80 else ''}")
            else:
                lines.append("PICO not yet defined.")
            text = "\n".join(lines)

        self.info_label.configure(text=text)
