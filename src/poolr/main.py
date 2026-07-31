"""
poolr — Main application module
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

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")


class PoolrApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title(f"poolr v{__version__} — Systematic Review & Meta-Analysis")
        self.geometry("1400x900")
        self.minsize(1100, 750)

        self.project_path: Optional[Path] = None
        self.project_data = self._get_empty_project()
        self._current_page_key: Optional[str] = None
        self._pages: Dict[str, Any] = {}

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self._build_sidebar()
        self._build_main_area()
        self._build_menu()

        # Defer initial page selection until all widgets are realized
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
            "metadata": {"created": "", "modified": "", "version": "0.3.0"},
        }

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
            label="Dark Mode", variable=self._theme_var, value="dark", command=lambda: ctk.set_appearance_mode("dark")
        )
        view_menu.add_radiobutton(
            label="Light Mode",
            variable=self._theme_var,
            value="light",
            command=lambda: ctk.set_appearance_mode("light"),
        )
        view_menu.add_radiobutton(
            label="System", variable=self._theme_var, value="system", command=lambda: ctk.set_appearance_mode("system")
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

        # Keyboard shortcuts
        self.bind("<Control-n>", lambda e: self._new_project())
        self.bind("<Control-o>", lambda e: self._open_project())
        self.bind("<Control-s>", lambda e: self.save_project())

    def _build_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=260, corner_radius=0)
        self.sidebar.grid(row=0, column=0, sticky="nsew")
        self.sidebar.grid_rowconfigure(8, weight=1)

        ctk.CTkLabel(self.sidebar, text="poolr", font=ctk.CTkFont(size=26, weight="bold")).grid(
            row=0, column=0, padx=20, pady=(20, 5)
        )
        ctk.CTkLabel(self.sidebar, text="SRMA Studio", font=ctk.CTkFont(size=12)).grid(
            row=1, column=0, padx=20, pady=(0, 20)
        )

        self.nav_buttons = {}
        pages = [
            ("📊 Dashboard", "dashboard"),
            ("📋 Protocol / PICO", "protocol"),
            ("🔍 Search", "search"),
            ("☑️ Screening", "screening"),
            ("📝 Extraction", "extraction"),
            ("⚠️ Risk of Bias", "rob"),
            ("📈 Meta-Analysis", "meta"),
            ("📄 PRISMA", "prisma"),
        ]
        for idx, (label, key) in enumerate(pages, start=2):
            btn = ctk.CTkButton(
                self.sidebar,
                text=label,
                anchor="w",
                height=44,
                font=ctk.CTkFont(size=13),
                command=lambda k=key: self._select_page(k),
            )
            btn.grid(row=idx, column=0, padx=12, pady=3, sticky="ew")
            self.nav_buttons[key] = btn

        self.project_btn = ctk.CTkButton(self.sidebar, text="📁 Open Project", command=self._open_project, height=36)
        self.project_btn.grid(row=10, column=0, padx=16, pady=(0, 8), sticky="ew")

        self.new_project_btn = ctk.CTkButton(self.sidebar, text="➕ New Project", command=self._new_project, height=36)
        self.new_project_btn.grid(row=11, column=0, padx=16, pady=(0, 8), sticky="ew")

        # Progress indicator
        self.progress_frame = ctk.CTkFrame(self.sidebar)
        self.progress_frame.grid(row=12, column=0, padx=16, pady=8, sticky="ew")
        self.progress_frame.grid_columnconfigure(0, weight=1)
        ctk.CTkLabel(self.progress_frame, text="Progress", font=ctk.CTkFont(size=11, weight="bold")).pack(
            anchor="w", padx=8, pady=(8, 2)
        )
        self.progress_bar = ctk.CTkProgressBar(self.progress_frame)
        self.progress_bar.pack(fill="x", padx=8, pady=(0, 8))
        self.progress_bar.set(0)
        self.progress_label = ctk.CTkLabel(self.progress_frame, text="0% complete", font=ctk.CTkFont(size=10))
        self.progress_label.pack(anchor="w", padx=8, pady=(0, 8))

        self.status_label = ctk.CTkLabel(self.sidebar, text="No project loaded", font=ctk.CTkFont(size=11))
        self.status_label.grid(row=13, column=0, padx=20, pady=(0, 20))

    def _build_main_area(self):
        self.main_area = ctk.CTkFrame(self, corner_radius=10)
        self.main_area.grid(row=0, column=1, sticky="nsew", padx=16, pady=16)
        self.main_area.grid_rowconfigure(1, weight=1)
        self.main_area.grid_columnconfigure(0, weight=1)

        self.title_label = ctk.CTkLabel(self.main_area, text="Dashboard", font=ctk.CTkFont(size=28, weight="bold"))
        self.title_label.grid(row=0, column=0, padx=24, pady=(24, 12), sticky="w")

        self.page_container = ctk.CTkFrame(self.main_area, fg_color="transparent")
        self.page_container.grid(row=1, column=0, sticky="nsew", padx=24, pady=(12, 24))

    def _select_page(self, key: str):
        # Save current page data if needed
        if self._current_page_key and self._current_page_key in self._pages:
            page = self._pages[self._current_page_key]
            if hasattr(page, "on_leave"):
                page.on_leave()

        # Hide (don't destroy) the current page so cached pages stay alive;
        # destroying them while keeping self._pages entries caused
        # "bad window path name" TclErrors on revisit.
        for widget in self.page_container.winfo_children():
            widget.pack_forget()

        page = self._pages.get(key)
        if page is not None and not page.winfo_exists():
            # Stale cache entry (widget was destroyed externally) — rebuild it
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

        page.pack(fill="both", expand=True)
        self.title_label.configure(text=self.nav_buttons[key].cget("text") if key != "dashboard" else "📊 Dashboard")
        self._current_page_key = key

        # Call on_enter if exists
        if hasattr(page, "on_enter"):
            page.on_enter()

        for k, btn in self.nav_buttons.items():
            btn.configure(fg_color=("gray75", "gray25") if k == key else "transparent")

        self._update_progress()

    def _new_project(self):
        path = filedialog.askdirectory(title="Create new poolr project folder")
        if path:
            self.project_path = Path(path)
            self.project_data = self._get_empty_project()
            self.project_data["metadata"]["created"] = datetime.now().isoformat()
            self.project_data["metadata"]["modified"] = datetime.now().isoformat()
            self.status_label.configure(text=f"Project: {self.project_path.name}")
            self.save_project()
            self._refresh_all_pages()
            messagebox.showinfo("Success", f"New project created at:\n{self.project_path}")

    def _open_project(self):
        path = filedialog.askdirectory(title="Open poolr project folder")
        if path:
            self.project_path = Path(path)
            pool_json = self.project_path / "poolr.json"
            if pool_json.exists():
                try:
                    with open(pool_json, "r", encoding="utf-8") as fh:
                        self.project_data = json.load(fh)
                    # Ensure all keys exist
                    for key in self._get_empty_project():
                        if key not in self.project_data:
                            self.project_data[key] = self._get_empty_project()[key]
                    self.status_label.configure(text=f"Project: {self.project_path.name}")
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
        # Calculate progress based on completed sections
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
        self.progress_label.configure(text=f"{int(progress * 100)}% complete ({completed}/{total} sections)")

    def _export_report(self):
        if not self.project_path:
            messagebox.showwarning("Warning", "No project open")
            return
        # Export all data to a comprehensive report
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
