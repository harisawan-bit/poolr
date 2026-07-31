"""poolr — shared UI style kit.

Centralises the visual language (colours, fonts, spacing) and a small set of
composable widgets so every page looks cohesive and renders faster. Everything
here is safe to instantiate headless (CI smoke test) — no top-level window or
display access, no blocking dialogs.
"""

from __future__ import annotations

import customtkinter as ctk

# ── Palette ────────────────────────────────────────────────────────────────
# CustomTkinter resolves tuple values as (light, dark). We keep a calm,
# professional "lab" aesthetic: deep indigo accent on a near-black surface.
ACCENT = "#5B8DEF"  # primary action / active nav
ACCENT_HOVER = "#6F9CF2"
ACCENT_PRESSED = "#4A77D0"
SURFACE = "#1A1B1E"  # app background (dark)
SURFACE_RAISED = "#24262B"  # cards / panels
SURFACE_SUNK = "#16171A"  # sunken wells (text areas)
BORDER = "#33363C"
TEXT = "#E6E8EC"
TEXT_MUTED = "#9AA0A8"
POSITIVE = "#3FB950"
POSITIVE_HOVER = "#46C758"
NEGATIVE = "#F05252"
NEGATIVE_HOVER = "#F76B6B"
WARNING = "#F2B84B"
WARNING_HOVER = "#F4C564"


# ── Fonts ──────────────────────────────────────────────────────────────────
def font(size: int, weight: str = "normal", family: str | None = None):
    return ctk.CTkFont(size=size, weight=weight, family=family)


# ── Spacing constants (keeps pages visually consistent) ─────────────────────
PAD_X = 20
PAD_Y = 14
GAP = 10


def fg(key: str) -> tuple[str, str]:
    """Return a (light, dark) tuple for the given colour key."""
    mapping = {
        "accent": (ACCENT, ACCENT),
        "surface": (SURFACE_RAISED, SURFACE_RAISED),
        "text": (TEXT, TEXT),
        "muted": (TEXT_MUTED, TEXT_MUTED),
        "border": (BORDER, BORDER),
    }
    return mapping[key]


# ── Composable widgets ──────────────────────────────────────────────────────
def PrimaryButton(master, text: str, command=None, **kwargs):
    """Branded call-to-action button with hover/press feedback."""
    height = kwargs.pop("height", 38)
    fg = kwargs.pop("fg_color", ACCENT)
    hover = kwargs.pop("hover_color", ACCENT_HOVER)
    btn = ctk.CTkButton(
        master,
        text=text,
        command=command,
        height=height,
        corner_radius=10,
        fg_color=fg,
        hover_color=hover,
        border_color=BORDER,
        text_color="#FFFFFF",
        font=font(13, "bold"),
        **kwargs,
    )
    return btn


def SecondaryButton(master, text: str, command=None, **kwargs):
    height = kwargs.pop("height", 38)
    fg = kwargs.pop("fg_color", SURFACE_SUNK)
    hover = kwargs.pop("hover_color", "#2C2F36")
    btn = ctk.CTkButton(
        master,
        text=text,
        command=command,
        height=height,
        corner_radius=10,
        fg_color=fg,
        hover_color=hover,
        border_color=BORDER,
        border_width=1,
        text_color=TEXT,
        font=font(13),
        **kwargs,
    )
    return btn


def GhostButton(master, text: str, command=None, **kwargs):
    height = kwargs.pop("height", 38)
    btn = ctk.CTkButton(
        master,
        text=text,
        command=command,
        height=height,
        corner_radius=10,
        fg_color="transparent",
        hover_color="#2C2F36",
        border_color=BORDER,
        border_width=1,
        text_color=TEXT_MUTED,
        font=font(13),
        **kwargs,
    )
    return btn


def SectionHeader(master, title: str, subtitle: str | None = None):
    """A bold title with an optional muted subtitle, plus a divider rule."""
    frame = ctk.CTkFrame(master, fg_color="transparent")
    frame.pack(fill="x", padx=PAD_X, pady=(0, 6))

    ctk.CTkLabel(frame, text=title, font=font(20, "bold"), text_color=TEXT).pack(anchor="w", padx=0, pady=(0, 2))
    if subtitle:
        ctk.CTkLabel(frame, text=subtitle, font=font(12), text_color=TEXT_MUTED, wraplength=900, justify="left").pack(
            anchor="w"
        )
    # divider
    ctk.CTkFrame(frame, height=1, fg_color=BORDER).pack(fill="x", pady=(10, 0))
    return frame


def Card(master, **kwargs):
    """A raised panel with consistent rounded corners."""
    corner = kwargs.pop("corner_radius", 12)
    return ctk.CTkFrame(
        master,
        fg_color=SURFACE_RAISED,
        corner_radius=corner,
        border_color=BORDER,
        border_width=1,
        **kwargs,
    )


def scrollable(master, **kwargs):
    """A scrollable frame with a thin, unobtrusive scrollbar (headless-safe)."""
    return ctk.CTkScrollableFrame(master, fg_color="transparent", **kwargs)


def StatTile(master, label: str, value: str, accent: bool = False):
    """A compact KPI tile for dashboards."""
    tile = Card(master, corner_radius=12)
    ctk.CTkLabel(
        tile,
        text=label.upper(),
        font=font(10, "bold"),
        text_color=TEXT_MUTED,
    ).pack(anchor="w", padx=14, pady=(12, 0))
    ctk.CTkLabel(
        tile,
        text=value,
        font=font(26, "bold"),
        text_color=(ACCENT if accent else TEXT),
    ).pack(anchor="w", padx=14, pady=(2, 12))
    return tile


def set_theme():
    """Apply the poolr visual theme once at startup."""
    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("dark-blue")
