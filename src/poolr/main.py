"""
poolr — Main application module

Premium desktop shell for systematic reviews & meta-analyses:
  • branded sidebar with hover + active-states
  • header bar (section title + global actions)
  • persistent bottom status bar
  • page cache preserved across navigation (responsive, no rebuild flicker)
"""

import json
import tkinter as tk
import webbrowser
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Any, Dict, Optional

import customtkinter as ctk

from poolr import __version__

# Local imports
from poolr.pages.dashboard import DashboardPage
from poolr.pages.extraction import ExtractionPage
from poolr.pages.meta import MetaPage
from poolr.pages.prisma import PrismaPage
from poolr.pages.protocol import ProtocolPage
from poolr.pages.rob import RoBPage
from poolr.pages.screening import ScreeningPage
from poolr.pages.search import SearchPage
from poolr.ui import (
    ACCENT,
    ACCENT_HOVER,
    BORDER,
    TEXT,
    TEXT_MUTED,
    SecondaryButton,
    font,
    set_theme,
)

set_theme()

NAV_ITEMS = [
    ("📊", "Dashboard", "dashboard"),
    ("📋", "Protocol / PICO", "protocol"),
    ("🔍", "Search", "search"),
    ("☑️", "Screening", "screening"),
    ("📝", "Extraction", "extraction"),
    ("⚠️", "Risk of Bias", "rob"),
    ("📈", "Meta-Analysis", "meta"),
    ("📄", "PRISMA", "prisma"),
]


class PoolrApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title(f"poolr v{__version__} — Systematic Review & Meta-Analysis")
        self.geometry("1440x900")
        self.minsize(1120, 760)
        self.configure(fg_color="#16171A")

        self.project_path: Optional[Path] = None
        self.project_name: str = ""
        self.project_data = self._get_empty_project()
        self._current_page_key: Optional[str] = None
        self._pages: Dict[str, Any] = {}
        self._nav_buttons: Dict[str, ctk.CTkButton] = {}

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=0)  # status bar row

        self._build_sidebar()
        self._build_main_area()
        self._build_status_bar()
        self._build_menu()

        self.after_idle(self._load_dashboard)

    def _load_dashboard(self):
        self._select_page("dashboard")

    def _get_empty_project(self) -> Dict[str, Any]:
        return {
            "pico": {},
            "search_strategies": {},
            "screening": {"title_abstract": [], "full_text": []},
            "extraction": {"studies": []},
            "rob": {"assessments": []},
            "meta": {"results": {}},
            "metadata": {"created": "", "modified": "", "version": __version__},
        }

    # ── Sidebar ───────────────────────────────────────────────────────────
    def _build_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=264, corner_radius=0, fg_color="#1A1B1E")
        self.sidebar.grid(row=0, column=0, rowspan=2, sticky="nsew")
        self.sidebar.grid_rowconfigure(10, weight=1)
        self.sidebar.grid_propagate(False)

        # Brand
        brand = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        brand.grid(row=0, column=0, sticky="ew", padx=18, pady=(20, 6))
        ctk.CTkLabel(brand, text="poolr", font=font(26, "bold"), text_color=TEXT).pack(anchor="w")
        ctk.CTkLabel(brand, text="SRMA Studio", font=font(12), text_color=ACCENT).pack(anchor="w")

        ctk.CTkFrame(self.sidebar, height=1, fg_color=BORDER).grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 10))

        # Nav items
        for idx, (icon, label, key) in enumerate(NAV_ITEMS, start=2):
            btn = ctk.CTkButton(
                self.sidebar,
                text=f"  {icon}  {label}",
                anchor="w",
                height=42,
                corner_radius=10,
                fg_color="transparent",
                hover_color="#26282E",
                text_color=TEXT_MUTED,
                font=font(13),
                command=lambda k=key: self._select_page(k),
            )
            btn.grid(row=idx, column=0, sticky="ew", padx=12, pady=3)
            self._nav_buttons[key] = btn

        # Project actions
        actions = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        actions.grid(row=11, column=0, sticky="ew", padx=12, pady=(8, 8))
        SecondaryButton(actions, text="📁  Open Project", command=self._open_project, height=38).pack(fill="x", pady=4)
        SecondaryButton(actions, text="➕  New Project", command=self._new_project, height=38).pack(fill="x", pady=4)

        # Progress card
        self.progress_card = ctk.CTkFrame(
            self.sidebar, fg_color="#24262B", corner_radius=12, border_color=BORDER, border_width=1
        )
        self.progress_card.grid(row=12, column=0, sticky="ew", padx=12, pady=(8, 12))
        self.progress_card.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self.progress_card, text="REVIEW PROGRESS", font=font(10, "bold"), text_color=TEXT_MUTED).pack(
            anchor="w", padx=14, pady=(12, 2)
        )
        self.progress_bar = ctk.CTkProgressBar(self.progress_card, height=8, corner_radius=4, progress_color=ACCENT)
        self.progress_bar.pack(fill="x", padx=14, pady=(4, 2))
        self.progress_bar.set(0)
        self.progress_label = ctk.CTkLabel(self.progress_card, text="0% complete", font=font(10), text_color=TEXT_MUTED)
        self.progress_label.pack(anchor="w", padx=14, pady=(2, 12))

        # Project status
        self.sidebar_status = ctk.CTkLabel(self.sidebar, text="No project loaded", font=font(11), text_color=TEXT_MUTED)
        self.sidebar_status.grid(row=13, column=0, sticky="ew", padx=18, pady=(0, 18))

    # ── Main area ─────────────────────────────────────────────────────────
    def _build_main_area(self):
        self.main_area = ctk.CTkFrame(self, corner_radius=0, fg_color="#16171A")
        self.main_area.grid(row=0, column=1, sticky="nsew")
        self.main_area.grid_rowconfigure(1, weight=1)
        self.main_area.grid_columnconfigure(0, weight=1)

        # Header bar
        header = ctk.CTkFrame(self.main_area, height=72, fg_color="#1A1B1E", corner_radius=0)
        header.grid(row=0, column=0, sticky="ew", padx=0, pady=0)
        header.grid_columnconfigure(0, weight=1)
        header.grid_propagate(False)

        self.title_label = ctk.CTkLabel(header, text="Dashboard", font=font(22, "bold"), text_color=TEXT)
        self.title_label.grid(row=0, column=0, sticky="w", padx=24, pady=0)

        hdr_actions = ctk.CTkFrame(header, fg_color="transparent")
        hdr_actions.grid(row=0, column=1, sticky="e", padx=18)
        SecondaryButton(hdr_actions, text="📂  Open", command=self._open_project, height=34).pack(side="left", padx=4)
        SecondaryButton(hdr_actions, text="📄  New", command=self._new_project, height=34).pack(side="left", padx=4)

        # Scrollable page content (row 1 expands; vertical separator hint via card bg)
        self.page_container = ctk.CTkFrame(self.main_area, fg_color="transparent")
        self.page_container.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        self.page_container.grid_columnconfigure(0, weight=1)
        self.page_container.grid_rowconfigure(0, weight=1)

    # ── Status bar ──────────────────────────────────────────────────────────
    def _build_status_bar(self):
        self.status_bar = ctk.CTkFrame(self, height=28, corner_radius=0, fg_color="#1A1B1E")
        self.status_bar.grid(row=1, column=1, sticky="ew")
        self.status_bar.grid_columnconfigure(0, weight=1)
        self.status_label = ctk.CTkLabel(self.status_bar, text="Ready", font=font(11), text_color=TEXT_MUTED)
        self.status_label.grid(row=0, column=0, sticky="w", padx=18, pady=0)
        ctk.CTkLabel(self.status_bar, text=f"v{__version__}", font=font(11), text_color=TEXT_MUTED).grid(
            row=0, column=1, sticky="e", padx=18, pady=0
        )

    def _build_menu(self):
        menubar = tk.Menu(self)
        self.config(menu=menubar)

        file_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="File", menu=file_menu)
        file_menu.add_command(label="New Project", command=self._new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="Open Project", command=self._open_project, accelerator="Ctrl+O")
        file_menu.add_separator()
        file_menu.add_command(label="Save Project", command=self.save_project, accelerator="Ctrl+S")
        file_menu.add_command(label="Export Report", command=self._export_report)
        file_menu.add_separator()
        file_menu.add_command(label="Exit", command=self.quit)

        edit_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Edit", menu=edit_menu)
        edit_menu.add_command(label="Preferences", command=self._show_preferences)

        view_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="View", menu=view_menu)
        self._theme_var = tk.StringVar(value="dark")
        view_menu.add_radiobutton(
            label="Dark Mode", variable=self._theme_var, value="dark", command=lambda: self._set_theme("dark")
        )
        view_menu.add_radiobutton(
            label="Light Mode", variable=self._theme_var, value="light", command=lambda: self._set_theme("light")
        )
        view_menu.add_radiobutton(
            label="System", variable=self._theme_var, value="system", command=lambda: self._set_theme("system")
        )

        help_menu = tk.Menu(menubar, tearoff=0)
        menubar.add_cascade(label="Help", menu=help_menu)
        help_menu.add_command(
            label="Documentation", command=lambda: webbrowser.open("https://github.com/harisawan-bit/poolr")
        )
        help_menu.add_command(
            label="Report Issue", command=lambda: webbrowser.open("https://github.com/harisawan-bit/poolr/issues")
        )
        help_menu.add_separator()
        help_menu.add_command(label="About", command=self._show_about)

        self.bind("<Control-n>", lambda e: self._new_project())
        self.bind("<Control-o>", lambda e: self._open_project())
        self.bind("<Control-s>", lambda e: self.save_project())

    def _set_theme(self, mode: str):
        ctk.set_appearance_mode(mode)

    # ── Navigation ──────────────────────────────────────────────────────────
    def _select_page(self, key: str):
        if self._current_page_key and self._current_page_key in self._pages:
            page = self._pages[self._current_page_key]
            if hasattr(page, "on_leave"):
                page.on_leave()

        for widget in self.page_container.winfo_children():
            widget.pack_forget()

        page = self._pages.get(key)
        if page is not None and not page.winfo_exists():
            del self._pages[key]
            page = None
        if page is None:
            if key == "dashboard":
                page = DashboardPage(self.page_container, app=self)
            elif key == "protocol":
                page = ProtocolPage(self.page_container, app=self)
            elif key == "search":
                page = SearchPage(self.page_container, app=self)
            elif key == "screening":
                page = ScreeningPage(self.page_container, app=self)
            elif key == "extraction":
                page = ExtractionPage(self.page_container, app=self)
            elif key == "rob":
                page = RoBPage(self.page_container, app=self)
            elif key == "meta":
                page = MetaPage(self.page_container, app=self)
            elif key == "prisma":
                page = PrismaPage(self.page_container, app=self)
            else:
                page = ctk.CTkLabel(self.page_container, text="Coming soon")
            self._pages[key] = page

        page.pack(fill="both", expand=True, padx=4, pady=4)
        label = next((lbl for (_, lbl, k) in NAV_ITEMS if k == key), "Dashboard")
        self.title_label.configure(text=label)
        self._current_page_key = key

        if hasattr(page, "on_enter"):
            page.on_enter()

        for k, btn in self._nav_buttons.items():
            if k == key:
                btn.configure(fg_color=ACCENT, hover_color=ACCENT_HOVER, text_color="#FFFFFF")
            else:
                btn.configure(fg_color="transparent", hover_color="#26282E", text_color=TEXT_MUTED)

        self._update_progress()

    # ── Project I/O ──────────────────────────────────────────────────────────
    def _new_project(self):
        path = filedialog.askdirectory(title="Create new poolr project folder")
        if path:
            self.project_path = Path(path)
            self.project_name = self.project_path.name
            self.project_data = self._get_empty_project()
            self.project_data["metadata"]["created"] = datetime.now().isoformat()
            self.project_data["metadata"]["modified"] = datetime.now().isoformat()
            self.sidebar_status.configure(text=f"Project: {self.project_name}")
            self.status_label.configure(text=f"New project created: {self.project_name}")
            self.save_project()
            self._refresh_all_pages()
            messagebox.showinfo("Success", f"New project created at:\n{self.project_path}")

    def _open_project(self):
        path = filedialog.askdirectory(title="Open poolr project folder")
        if path:
            self.project_path = Path(path)
            self.project_name = self.project_path.name
            pool_json = self.project_path / "poolr.json"
            if pool_json.exists():
                try:
                    with open(pool_json, "r", encoding="utf-8") as fh:
                        self.project_data = json.load(fh)
                    for key in self._get_empty_project():
                        if key not in self.project_data:
                            self.project_data[key] = self._get_empty_project()[key]
                    self.sidebar_status.configure(text=f"Project: {self.project_name}")
                    self.status_label.configure(text=f"Project loaded: {self.project_name}")
                    self._refresh_all_pages()
                    messagebox.showinfo("Success", f"Project loaded:\n{self.project_path}")
                except Exception as e:
                    messagebox.showerror("Error", f"Failed to load project:\n{e}")
            else:
                messagebox.showerror("Error", "No poolr.json found in this folder")

    def save_project(self):
        if not self.project_path:
            return
        self.project_data["metadata"]["modified"] = datetime.now().isoformat()
        out = self.project_path / "poolr.json"
        try:
            with open(out, "w", encoding="utf-8") as fh:
                json.dump(self.project_data, fh, indent=2)
            self._update_progress()
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save project:\n{e}")

    def _refresh_all_pages(self):
        for page in self._pages.values():
            if hasattr(page, "refresh"):
                page.refresh()

    def _update_progress(self):
        steps = [
            ("pico", bool(self.project_data.get("pico", {}))),
            ("search_strategies", bool(self.project_data.get("search_strategies", {}))),
            (
                "screening",
                len(self.project_data.get("screening", {}).get("title_abstract", [])) > 0
                or len(self.project_data.get("screening", {}).get("full_text", [])) > 0,
            ),
            ("extraction", len(self.project_data.get("extraction", {}).get("studies", [])) > 0),
            ("rob", len(self.project_data.get("rob", {}).get("assessments", [])) > 0),
            ("meta", bool(self.project_data.get("meta", {}).get("results", {}))),
            ("prisma", bool(self.project_data.get("prisma", {}))),
        ]
        completed = sum(1 for _, done in steps if done)
        total = len(steps)
        progress = completed / total if total > 0 else 0
        self.progress_bar.set(progress)
        self.progress_label.configure(text=f"{int(progress * 100)}% complete ({completed}/{total})")

    def _export_report(self):
        if not self.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        report_path = self.project_path / "poolr_report.json"
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(self.project_data, fh, indent=2)
        messagebox.showinfo("Exported", f"Report saved to:\n{report_path}")

    def _show_preferences(self):
        messagebox.showinfo("Preferences", "Preferences dialog coming soon")

    def _show_about(self):
        messagebox.showinfo(
            "About poolr",
            f"poolr v{__version__}\n\n"
            "Standalone GUI for systematic reviews and meta-analyses.\n\n"
            "Built with CustomTkinter, pandas, matplotlib, statsmodels, and Python.\n\n"
            "https://github.com/harisawan-bit/poolr",
        )

    def on_closing(self):
        if self.project_path and self.project_data:
            self.save_project()
        self.quit()


def main():
    app = PoolrApp()
    app.protocol("WM_DELETE_WINDOW", app.on_closing)
    app.mainloop()


if __name__ == "__main__":
    main()
