#!/usr/bin/env python3
"""Generate the Chrome Web Store graphics for TimePrice (task 13).

Produces 4 screenshots (1280x800) + 1 promo tile (440x280) as SVGs, then renders them to
PNG with `rsvg-convert` (librsvg). All content is neutral/fictional ("Ukázkový obchod", made-up
products) so the store graphics carry no real brand or product names — see "Rizika" in
tasks/13-icons-and-store-listing.md.

Usage:  python3 marketing/store/generate.py     (or run marketing/store/render.sh)
Requires: librsvg  (brew install librsvg)
"""

import os
import shutil
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))

# --- Brand palette (mirrors entrypoints/popup/style.css) --------------------------------
BLUE = "#2563eb"
BLUE_DARK = "#1d4ed8"
BLUE_DEEP = "#1746c7"
INK = "#1a1a1a"
MUTED = "#666b73"
SURFACE = "#f6f6f7"
BORDER = "#d6d6db"
WHITE = "#ffffff"
FONT = "Helvetica, Arial, sans-serif"


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size, color=INK, weight="400", anchor="start", spacing=None):
    ls = f' letter-spacing="{spacing}"' if spacing is not None else ""
    return (
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
        f'font-weight="{weight}" fill="{color}" text-anchor="{anchor}"{ls}>{esc(s)}</text>'
    )


def clock_mark(cx, cy, r, ring=None, hands=BLUE_DARK, face=WHITE):
    """The TimePrice clock glyph (matches assets/icons/icon.svg), centered at (cx,cy).

    `ring` draws a disc outline so the clock still reads when `face` matches its background
    (e.g. a white disc on a white card). The app tile leaves it off — the white disc already
    pops on the blue square."""
    sw_min = r * 0.16
    sw_hr = r * 0.13
    outline = f' stroke="{ring}" stroke-width="{max(1, r*0.1)}"' if ring else ""
    return (
        f'<g>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{face}"{outline}/>'
        f'<line x1="{cx}" y1="{cy}" x2="{cx - r*0.44}" y2="{cy - r*0.24}" '
        f'stroke="{hands}" stroke-width="{sw_min}" stroke-linecap="round"/>'
        f'<line x1="{cx}" y1="{cy}" x2="{cx + r*0.59}" y2="{cy - r*0.35}" '
        f'stroke="{hands}" stroke-width="{sw_hr}" stroke-linecap="round"/>'
        f'<circle cx="{cx}" cy="{cy}" r="{r*0.11}" fill="{hands}"/>'
        f'</g>'
    )


def image_glyph(cx, cy, r, color="#9aa6bd"):
    """A neutral photo-placeholder (sun + mountains) for demo product thumbnails."""
    return (
        f'<g fill="none" stroke="{color}" stroke-width="{max(1.5, r*0.16)}" '
        f'stroke-linejoin="round" stroke-linecap="round">'
        f'<circle cx="{cx - r*0.42}" cy="{cy - r*0.4}" r="{r*0.22}" fill="{color}" stroke="none"/>'
        f'<path d="M {cx - r*0.8} {cy + r*0.6} L {cx - r*0.15} {cy - r*0.1} '
        f'L {cx + r*0.3} {cy + r*0.35} L {cx + r*0.55} {cy + r*0.1} L {cx + r*0.85} {cy + r*0.6} Z"/>'
        f'</g>'
    )


def app_tile(x, y, size, r_icon):
    """The full app icon: blue rounded square + clock, top-left anchored at (x,y)."""
    rad = size * 0.22
    cx, cy = x + size / 2, y + size / 2
    return (
        f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{rad}" fill="url(#tileGrad)"/>'
        + clock_mark(cx, cy, r_icon)
    )


def header(title, subtitle):
    """White caption block at the top of a screenshot, with the app tile."""
    return (
        app_tile(64, 56, 64, 23)
        + text(148, 86, "TimePrice", 34, WHITE, "700")
        + text(148, 120, subtitle, 19, "#cfe0ff", "400")
        + text(64, 184, title, 30, WHITE, "600")
    )


def defs():
    return (
        "<defs>"
        f'<linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="800" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{BLUE}"/><stop offset="1" stop-color="{BLUE_DEEP}"/></linearGradient>'
        f'<linearGradient id="tileGrad" x1="0" y1="0" x2="1" y2="1">'
        f'<stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="{BLUE_DARK}"/></linearGradient>'
        f'<filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">'
        f'<feDropShadow dx="0" dy="14" stdDeviation="22" flood-color="#0b1f4d" flood-opacity="0.28"/></filter>'
        "</defs>"
    )


def screen_open(w=1280, h=800):
    return (
        f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">'
        + defs()
        + f'<rect width="{w}" height="{h}" fill="url(#bgGrad)"/>'
    )


def card(x, y, w, h, r=18, fill=WHITE, shadow=True):
    sh = ' filter="url(#cardShadow)"' if shadow else ""
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{sh}/>'


def browser_chrome(x, y, w, addr):
    """A minimal browser window top bar (traffic lights + address pill)."""
    out = [card(x, y, w, 0 + 56, r=18, fill="#eef0f3", shadow=False)]
    out.append(f'<rect x="{x}" y="{y+28}" width="{w}" height="28" fill="#eef0f3"/>')  # square bottom of bar
    for i, c in enumerate(["#ff5f57", "#febc2e", "#28c840"]):
        out.append(f'<circle cx="{x+26+i*22}" cy="{y+28}" r="6.5" fill="{c}"/>')
    out.append(f'<rect x="{x+108}" y="{y+15}" width="{w-150}" height="26" rx="13" fill="{WHITE}"/>')
    out.append(text(x + 124, y + 33, addr, 14, MUTED))
    return "".join(out)


# --- Product data (fictional). Rate = 1000 Kč/h, so Kč/1000 ≈ hours. --------------------
PRODUCTS = [
    ("Bezdrátová sluchátka", "4 990 Kč", "5 h"),
    ("Chytré hodinky", "7 490 Kč", "7 h"),
    ("Kávovar", "12 990 Kč", "13 h"),
    ("Herní notebook", "32 990 Kč", "33 h"),
]


def product_row(x, y, w, name, price, mode, highlight=False):
    """One shop list row. mode: 'kc' shows the price, 'time' shows work time (blue)."""
    out = [f'<rect x="{x}" y="{y}" width="{w}" height="72" rx="12" fill="{SURFACE}"/>']
    out.append(f'<rect x="{x+16}" y="{y+14}" width="44" height="44" rx="10" fill="#e3e8f0"/>')
    out.append(image_glyph(x + 38, y + 36, 13))
    out.append(text(x + 76, y + 33, name, 17, INK, "600"))
    out.append(text(x + 76, y + 55, "skladem", 13, MUTED))
    if mode == "kc":
        out.append(text(x + w - 20, y + 45, price, 20, INK, "700", anchor="end"))
    else:
        val = price  # time string
        out.append(
            f'<rect x="{x+w-118}" y="{y+22}" width="98" height="32" rx="16" '
            f'fill="#e7efff" stroke="{BLUE}" stroke-width="1.5"/>'
        )
        out.append(clock_mark(x + w - 100, y + 38, 9, ring=BLUE, hands=BLUE_DARK, face=WHITE))
        out.append(text(x + w - 32, y + 45, val, 18, BLUE_DARK, "700", anchor="end"))
    return "".join(out)


# ========================================================================================
# Screenshot 1 — before / after
# ========================================================================================
def shot_before_after():
    s = [screen_open()]
    s.append(header("Ceny rovnou v čase, který je musíš odpracovat", "Cena → čas"))
    cx, cy, cw, ch = 64, 224, 1152, 520
    s.append(card(cx, cy, cw, ch))
    s.append(browser_chrome(cx, cy, cw, "ukazkovy-obchod.cz/elektronika"))
    # two columns
    colw = (cw - 48 - 40) / 2
    lx = cx + 24
    rx = cx + 24 + colw + 40
    top = cy + 84
    s.append(text(lx + 8, top, "BEZ TimePrice", 15, MUTED, "700", spacing="1.5"))
    s.append(text(rx + 8, top, "S TimePrice", 15, BLUE, "700", spacing="1.5"))
    ry = top + 20
    for i, (name, price, t) in enumerate(PRODUCTS):
        yy = ry + i * 86
        s.append(product_row(lx, yy, colw, name, price, "kc"))
        s.append(product_row(rx, yy, colw, name, t, "time", highlight=True))
    # arrow between columns
    ax = cx + 24 + colw + 20
    ay = cy + ch / 2 + 20
    s.append(f'<circle cx="{ax}" cy="{ay}" r="22" fill="{BLUE}"/>')
    s.append(text(ax, ay + 8, "→", 26, WHITE, "700", anchor="middle"))
    s.append(text(cx + cw / 2, cy + ch - 26, "Sazba: 1 000 Kč/h  ·  vše se přepočítá samo", 16, MUTED, "400", anchor="middle"))
    s.append("</svg>")
    return "".join(s)


# ========================================================================================
# Popup mock (shared by shots 2 and 3)
# ========================================================================================
def popup_frame(x, y, w, inner):
    h = 0
    return inner


def shot_popup_rate():
    s = [screen_open()]
    s.append(header("Zadej svou čistou hodinovou sazbu", "Nastavení sazby"))
    pw, ph = 380, 440
    px, py = (1280 - pw) / 2, 250
    s.append(card(px, py, pw, ph, r=22))
    # popup header
    s.append(app_tile(px + 28, py + 28, 40, 14.5))
    s.append(text(px + 80, py + 46, "TimePrice", 22, INK, "700"))
    s.append(text(px + 80, py + 68, "Soukromí", 14, BLUE, "400"))
    # claim
    s.append(text(px + 28, py + 116, "Kolik vyděláš čistého za hodinu?", 16, INK, "600"))
    s.append(text(px + 28, py + 140, "Ceny na webech ti převedeme na čas.", 14, MUTED))
    # rate input
    s.append(text(px + 28, py + 184, "Tvoje sazba", 13, MUTED, "600", spacing="1"))
    s.append(f'<rect x="{px+28}" y="{py+196}" width="{pw-56}" height="56" rx="12" fill="{SURFACE}" stroke="{BORDER}" stroke-width="1.5"/>')
    s.append(text(px + 48, py + 232, "1 000", 28, INK, "700"))
    s.append(text(px + pw - 48, py + 232, "Kč/h", 18, MUTED, "600", anchor="end"))
    # presets
    s.append(text(px + 28, py + 286, "Rychlá volba sazby", 13, MUTED, "600", spacing="1"))
    presets = ["500", "1 000", "1 500"]
    bw = (pw - 56 - 24) / 3
    for i, p in enumerate(presets):
        bx = px + 28 + i * (bw + 12)
        sel = i == 1
        fill = BLUE if sel else SURFACE
        fg = WHITE if sel else INK
        stroke = BLUE if sel else BORDER
        s.append(f'<rect x="{bx}" y="{py+300}" width="{bw}" height="46" rx="11" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        s.append(text(bx + bw / 2, py + 329, p, 17, fg, "700", anchor="middle"))
    # CTA
    s.append(f'<rect x="{px+28}" y="{py+372}" width="{pw-56}" height="50" rx="12" fill="{BLUE}"/>')
    s.append(text(px + pw / 2, py + 403, "Hotovo", 18, WHITE, "700", anchor="middle"))
    s.append("</svg>")
    return "".join(s)


def toggle(x, y, on=True, w=46, h=26):
    track = BLUE if on else "#cbd2dc"
    knob_cx = x + w - h / 2 if on else x + h / 2
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{track}"/>'
        f'<circle cx="{knob_cx}" cy="{y+h/2}" r="{h/2-3}" fill="{WHITE}"/>'
    )


def shot_per_site():
    s = [screen_open()]
    s.append(header("Zapni globálně nebo jen pro konkrétní web", "Přepínače"))
    pw, ph = 380, 430
    px, py = (1280 - pw) / 2, 250
    s.append(card(px, py, pw, ph, r=22))
    s.append(app_tile(px + 28, py + 28, 40, 14.5))
    s.append(text(px + 80, py + 46, "TimePrice", 22, INK, "700"))
    s.append(text(px + 80, py + 68, "Soukromí", 14, BLUE, "400"))
    # rate summary row
    s.append(f'<rect x="{px+28}" y="{py+98}" width="{pw-56}" height="58" rx="12" fill="{SURFACE}"/>')
    s.append(text(px + 46, py + 124, "Tvoje sazba", 13, MUTED))
    s.append(text(px + 46, py + 146, "1 000 Kč/h", 18, INK, "700"))
    s.append(text(px + pw - 46, py + 134, "Změnit", 14, BLUE, "600", anchor="end"))
    # global toggle
    s.append(f'<rect x="{px+28}" y="{py+172}" width="{pw-56}" height="68" rx="12" fill="{WHITE}" stroke="{BORDER}" stroke-width="1.5"/>')
    s.append(text(px + 46, py + 200, "TimePrice zapnutý", 16, INK, "600"))
    s.append(text(px + 46, py + 222, "Na webech uvidíš čas místo cen.", 13, MUTED))
    s.append(toggle(px + pw - 46 - 46, py + 192, on=True))
    # per-site toggle
    s.append(f'<rect x="{px+28}" y="{py+252}" width="{pw-56}" height="68" rx="12" fill="{WHITE}" stroke="{BORDER}" stroke-width="1.5"/>')
    s.append(text(px + 46, py + 280, "TimePrice na alza.cz", 16, INK, "600"))
    s.append(text(px + 46, py + 302, "Na téhle doméně se ceny převádějí.", 13, MUTED))
    s.append(toggle(px + pw - 46 - 46, py + 272, on=True))
    # sensitive note
    s.append(f'<rect x="{px+28}" y="{py+336}" width="{pw-56}" height="62" rx="12" fill="#fff5f5" stroke="#f3c9c9" stroke-width="1.5"/>')
    s.append(text(px + 46, py + 362, "Na bankách a platbách", 14, "#b4232a", "700"))
    s.append(text(px + 46, py + 383, "se TimePrice nikdy nespustí.", 13, "#9b4a4f"))
    s.append("</svg>")
    return "".join(s)


def shot_tooltip():
    s = [screen_open()]
    s.append(header("Najedeš myší a uvidíš původní cenu", "Tooltip"))
    cx, cy, cw, ch = 64, 224, 1152, 520
    s.append(card(cx, cy, cw, ch))
    s.append(browser_chrome(cx, cy, cw, "ukazkovy-obchod.cz/herni-notebook"))
    # product detail
    px = cx + 56
    py = cy + 110
    s.append(f'<rect x="{px}" y="{py}" width="360" height="300" rx="16" fill="{SURFACE}"/>')
    s.append(image_glyph(px + 180, py + 150, 56))
    tx = px + 420
    s.append(text(tx, py + 56, "Herní notebook 15\"", 32, INK, "700"))
    s.append(text(tx, py + 92, "Ukázkový obchod", 17, MUTED))
    s.append(text(tx, py + 150, "Cena", 14, MUTED, "600", spacing="1"))
    # converted price (time) + tooltip
    s.append(clock_mark(tx + 18, py + 188, 14, ring=BLUE, hands=BLUE_DARK, face=WHITE))
    s.append(text(tx + 40, py + 198, "33 h", 40, BLUE_DARK, "800"))
    # underline dotted to suggest hover target
    s.append(f'<line x1="{tx+40}" y1="{py+208}" x2="{tx+150}" y2="{py+208}" stroke="{BLUE}" stroke-width="2" stroke-dasharray="2 4"/>')
    # tooltip bubble
    bx, by, bwid, bh = tx + 170, py + 168, 196, 56
    s.append(f'<rect x="{bx}" y="{by}" width="{bwid}" height="{bh}" rx="10" fill="{INK}"/>')
    s.append(f'<path d="M {bx-10} {by+28} L {bx} {by+18} L {bx} {by+38} Z" fill="{INK}"/>')
    s.append(text(bx + 18, by + 24, "Původní cena", 12, "#aab2c0"))
    s.append(text(bx + 18, by + 44, "32 990 Kč", 19, WHITE, "700"))
    # cursor
    curx, cury = tx + 96, py + 224
    s.append(
        f'<path d="M {curx} {cury} l 0 26 l 7 -7 l 5 11 l 5 -2 l -5 -11 l 10 0 Z" '
        f'fill="{WHITE}" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round"/>'
    )
    s.append(text(cx + cw / 2, cy + ch - 26, "Sazba: 1 000 Kč/h", 16, MUTED, "400", anchor="middle"))
    s.append("</svg>")
    return "".join(s)


def promo_tile():
    w, h = 440, 280
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">']
    s.append(defs().replace('y2="800"', 'y2="280"'))
    s.append(f'<rect width="{w}" height="{h}" fill="url(#bgGrad)"/>')
    s.append(app_tile(40, 92, 96, 35))
    s.append(text(168, 130, "TimePrice", 40, WHITE, "800"))
    s.append(text(170, 166, "Ceny e-shopů v čase,", 20, "#dbe7ff", "500"))
    s.append(text(170, 194, "který je musíš odpracovat.", 20, "#dbe7ff", "500"))
    # mini before/after chip
    s.append(f'<rect x="170" y="214" width="118" height="34" rx="17" fill="#ffffff" fill-opacity="0.16"/>')
    s.append(text(186, 236, "30 000 Kč", 15, WHITE, "600"))
    s.append(text(296, 233, "→", 18, WHITE, "700"))
    s.append(f'<rect x="318" y="214" width="64" height="34" rx="17" fill="#ffffff"/>')
    s.append(text(350, 236, "30 h", 15, BLUE_DARK, "800", anchor="middle"))
    s.append("</svg>")
    return "".join(s)


ASSETS = [
    ("01-before-after", shot_before_after(), 1280, 800),
    ("02-popup-rate", shot_popup_rate(), 1280, 800),
    ("03-per-site-toggle", shot_per_site(), 1280, 800),
    ("04-tooltip", shot_tooltip(), 1280, 800),
    ("promo-440x280", promo_tile(), 440, 280),
]


def main():
    rsvg = shutil.which("rsvg-convert")
    for name, svg, w, h in ASSETS:
        svg_path = os.path.join(HERE, name + ".svg")
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg)
        if rsvg:
            png_path = os.path.join(HERE, name + ".png")
            subprocess.run([rsvg, "-w", str(w), "-h", str(h), svg_path, "-o", png_path], check=True)
            print("rendered", png_path)
        else:
            print("wrote", svg_path, "(rsvg-convert missing; PNG skipped)")


if __name__ == "__main__":
    main()
