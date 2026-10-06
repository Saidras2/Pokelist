#!/usr/bin/env python3
"""
Generate side-by-side comparison illustrations for the three glue-free
self-assembly variants of the booster box display case.

    python3 tools/make_variants.py

Writes ../variants/boxjoint.svg, ../variants/groove.svg, ../variants/tabs.svg

All three share the same booster-box envelope, so they are directly
comparable:
    interior 144 x 84 x 130 mm,  5 mm cast acrylic,  8 magnets
"""
import math

# ---- shared parameters ------------------------------------------------------
T = 5.0            # acrylic thickness
FIT, HEAD = 2.0, 5.0
LID_CLR, SKIRT = 0.5, 22.0
IX, IY, IZ = 144.0, 84.0, 130.0
OX, OY = IX + 2 * T, IY + 2 * T          # 154 x 94
OZ = T + IZ                              # 135
L_IX, L_IY = OX + 2 * LID_CLR, OY + 2 * LID_CLR
L_OX, L_OY = L_IX + 2 * T, L_IY + 2 * T  # 165 x 105
LID_Z = OZ - SKIRT                       # 113
TOP_Z = OZ + T                           # 140
LID_CX, LID_CY = OX / 2, OY / 2          # lid is centred on the walls

COS, SIN = math.cos(math.radians(30.0)), 0.5

INK, MID, DIM = "#111827", "#4b5563", "#9aa0ae"
A_FILL, A_LINE = "#dbeafe", "#1d4ed8"    # panel A (blue)
B_FILL, B_LINE = "#fee2e2", "#b91c1c"    # panel B (red)


def proj(x, y, z, s, cx, cy):
    """Isometric projection, centred on (cx, cy) px."""
    return (cx + (x - y) * COS * s, cy + ((x + y) * SIN - z) * s)


def box(x0, y0, z0, x1, y1, z1, s, cx, cy, top, right, front):
    """One convex box: the three visible faces, painted back to front."""
    P = lambda x, y, z: proj(x, y, z, s, cx, cy)
    out = []
    for pts, fill in (
        ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], right),
        ([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], front),
        ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top),
    ):
        p = " ".join(f"{P(*v)[0]:.2f},{P(*v)[1]:.2f}" for v in pts)
        out.append(f'<polygon points="{p}" fill="{fill}" '
                   f'stroke="{INK}" stroke-width="0.7" stroke-linejoin="round"/>')
    return "".join(out)


def lid_box(s, cx, cy):
    """The magnetic cap lid, centred on the walls."""
    return box(LID_CX - L_OX / 2, LID_CY - L_OY / 2, LID_Z,
               LID_CX + L_OX / 2, LID_CY + L_OY / 2, TOP_Z, s, cx, cy,
               "#f7f9fd", "#dde5f2", "#cbd6ea")


def zigzag(x, y, z0, z1, s, cx, cy, colour="#1d4ed8", pitch=10.0):
    """A finger-joint seam drawn as an alternating ladder up a vertical edge."""
    out = []
    z = z0
    i = 0
    while z < z1:
        za, zb = z, min(z + pitch / 2, z1)
        d = 3.0 if i % 2 == 0 else -3.0
        p1 = proj(x + d, y + d, za, s, cx, cy)
        p2 = proj(x + d, y + d, zb, s, cx, cy)
        out.append(f'<line x1="{p1[0]:.2f}" y1="{p1[1]:.2f}" '
                   f'x2="{p2[0]:.2f}" y2="{p2[1]:.2f}" stroke="{colour}" '
                   f'stroke-width="2.2" stroke-linecap="round"/>')
        z += pitch / 2
        i += 1
    return "".join(out)


def text(x, y, s, size=11, fill=INK, anchor="start", weight="normal"):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}">{s}</text>')


def rect(x, y, w, h, fill, stroke=INK, sw=0.8, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')


def plan(shapes, ox, oy, s, w_mm, h_mm):
    """
    Draw a plan-view detail.  `shapes` is a list of
    (x, y, w, h, fill, stroke, dashed) in mm, y measured into the screen.
    """
    out = []
    for (x, y, w, h, fill, stroke, *rest) in shapes:
        dash = rest[0] if rest else None
        out.append(rect(ox + x * s, oy + y * s, w * s, h * s, fill, stroke, 1.0, dash))
    out.append(rect(ox, oy, w_mm * s, h_mm * s, "none", DIM, 0.8, "4 3"))
    return "".join(out)


def sheet(w, h, title, subtitle, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" '
            f'font-family="Helvetica, Arial, sans-serif">\n'
            f'<rect width="{w}" height="{h}" fill="#ffffff"/>\n'
            + text(20, 30, title, 16, INK, weight="bold")
            + text(20, 48, subtitle, 11, MID)
            + f'<line x1="20" y1="60" x2="{w-20}" y2="60" stroke="#e5e7eb"/>\n'
            + body + "\n</svg>\n")


def zigzag_screen(p0, p1, bands, amp, colour, sw=2.0):
    """Alternating ladder between two projected points - a finger-joint seam."""
    out = []
    x0, y0 = p0
    x1, y1 = p1
    for i in range(bands):
        t0, t1 = i / bands, (i + 1) / bands
        ax, ay = x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0
        bx, by = x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1
        d = amp if i % 2 == 0 else -amp
        out.append(f'<line x1="{ax+d:.2f}" y1="{ay:.2f}" x2="{bx+d:.2f}" '
                   f'y2="{by:.2f}" stroke="{colour}" stroke-width="{sw}" '
                   f'stroke-linecap="round"/>')
    return "".join(out)


def callout(x, y, tx, ty, label, colour=INK):
    """Leader line plus a label."""
    return (f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" '
            f'stroke="{colour}" stroke-width="0.8" stroke-dasharray="3 2"/>'
            + text(tx, ty - 4, label, 10, colour))


# ============================================================== VARIANT A ====
def variant_a():
    S, CX, CY = 0.75, 200.0, 225.0
    g = [box(0, 0, 0, OX, OY, T, S, CX, CY, "#eef2f9", "#cfd8e8", "#bcc7db")]
    g.append(box(0, 0, T, OX, OY, OZ, S, CX, CY, "#f7f9fd", "#e3e9f4", "#d2dbec"))
    g.append(lid_box(S, CX, CY))
    for (x, y) in ((OX, OY), (OX, 0), (0, OY)):
        g.append(zigzag_screen(proj(x, y, T, S, CX, CY),
                               proj(x, y, OZ, S, CX, CY), 12, 2.0, A_LINE))
    px, py = proj(OX, OY, 70, S, CX, CY)
    g.append(callout(px + 4, py + 4, 292, 250, "finger-jointed corners", A_LINE))

    d = []
    for k, (band, owner) in enumerate((("z = 0&#8211;5 mm", A_FILL),
                                       ("z = 5&#8211;10 mm", B_FILL))):
        ox, oy, sc = 45 + k * 190, 405, 3.0
        shapes = [(0, 0, 5, 17, A_FILL, A_LINE),
                  (0, 0, 17, 5, B_FILL, B_LINE),
                  (0, 0, 5, 5, owner, A_LINE if owner == A_FILL else B_LINE)]
        d.append(plan(shapes, ox, oy, sc, 17, 17))
        d.append(text(ox + 25, oy - 12, band, 10, MID))
    d.append(text(45, 480, "Section A&#8211;A: the 5 &#215; 5 mm corner cube changes",
                  9.5, MID))
    d.append(text(45, 493, "owner every 5 mm up the corner, so the two panels",
                  9.5, MID))
    d.append(text(45, 506, "trap each other and cannot splay or lift.", 9.5, MID))
    return sheet(400, 520, "A &#183; Box-jointed walls",
                 "Pure laser &#183; flush zigzag corners &#183; 3-move assembly",
                 "".join(g) + "".join(d))


# ============================================================== VARIANT B ====
def variant_b():
    S, CX, CY = 0.75, 200.0, 225.0
    bx0, by0 = LID_CX - L_OX / 2, LID_CY - L_OY / 2
    g = [box(bx0, by0, 0, bx0 + L_OX, by0 + L_OY, 10, S, CX, CY,
             "#eef2f9", "#cfd8e8", "#bcc7db")]
    g.append(box(0, 0, T, OX, OY, OZ, S, CX, CY, "#f7f9fd", "#e3e9f4", "#d2dbec"))
    g.append(lid_box(S, CX, CY))
    px, py = proj(bx0 + L_OX, by0 + L_OY / 2, 5, S, CX, CY)
    g.append(callout(px + 2, py, 292, 268, "base plinth +5.5 mm", B_LINE))
    px, py = proj(OX, OY / 2, 70, S, CX, CY)
    g.append(callout(px, py, 292, 196, "walls recessed in the groove", A_LINE))

    d = []
    ox, oy, sc = 55, 420, 1.9
    d.append(rect(ox, oy, 165 * sc, 10 * sc, "#eef2f9", INK))
    d.append(rect(ox + 10.6 * sc, oy, (165 - 10.6) * sc, 5 * sc, "#ffffff", DIM, 0.7))
    d.append(rect(ox, oy, 5.4 * sc, 10 * sc, "#dcfce7", "#15803d"))
    d.append(rect(ox + 5.4 * sc, oy, 5.2 * sc, 5 * sc, "#ffffff", B_LINE))
    d.append(rect(ox + 5.5 * sc, oy - 30 * sc, 5 * sc, 35 * sc, A_FILL, A_LINE))
    d.append(text(ox, oy + 10 * sc + 18, "SECTION B&#8211;B (left half shown)",
                  9.5, MID))
    d.append(callout(ox + 2.7 * sc, oy + 5 * sc, ox + 52, oy - 44,
                     "outer lip", "#15803d"))
    d.append(callout(ox + 8 * sc, oy + 8 * sc, ox + 120, oy + 30,
                     "routed channel 5.2 &#215; 5 mm", B_LINE))
    d.append(callout(ox + 8 * sc, oy - 22 * sc, ox + 120, oy - 44,
                     "wall drops in", A_LINE))
    d.append(text(55, 480, "The channel is the only machining step. The wall drops",
                  9.5, MID))
    d.append(text(55, 493, "in and butts at the corners; the outer lip stops the",
                  9.5, MID))
    d.append(text(55, 506, "walls splaying outward at the bottom.", 9.5, MID))
    return sheet(400, 520, "B &#183; Routed-groove base",
                 "Needs a router &#183; seamless walls &#183; plinth base",
                 "".join(g) + "".join(d))


# ============================================================== VARIANT C ====
def variant_c():
    S, CX, CY = 0.75, 200.0, 225.0
    TAB = 3.0
    g = [box(0, -TAB, 0, OX, OY + TAB, T, S, CX, CY,
             "#eef2f9", "#cfd8e8", "#bcc7db")]
    g.append(box(0, 0, T, OX, OY, OZ, S, CX, CY, "#f7f9fd", "#e3e9f4", "#d2dbec"))
    g.append(lid_box(S, CX, CY))
    for z in (8.0, 24.0, 40.0, 56.0):
        for x in (0.0, OX - T):
            g.append(box(x, -TAB, z, x + T, 0, z + 8, S, CX, CY,
                         "#fca5a5", "#b91c1c", "#991b1b"))
    px, py = proj(T / 2, -TAB, 44, S, CX, CY)
    g.append(callout(px - 6, py + 4, 34, 306,
                     "tabs pass through,<br/>stand proud 3 mm", B_LINE))

    d = []
    ox, oy, sc = 60, 420, 3.2
    shapes = [(0, 0, 22, T, B_FILL, B_LINE),
              (0, T, T, 17, A_FILL, A_LINE),
              (0, -TAB, T, T + TAB, "#fca5a5", "#991b1b")]
    d.append(plan(shapes, ox, oy, sc, 22, 22))
    d.append(f'<line x1="{ox}" y1="{oy - 4 * sc}" x2="{ox}" y2="{oy + 22 * sc}" '
             f'stroke="{DIM}" stroke-width="0.8" stroke-dasharray="4 3"/>')
    d.append(text(ox + 3 * sc, oy + 3 * sc, "tab", 9, "#991b1b"))
    d.append(text(ox + 15 * sc, oy + 3 * sc, "front wall", 9, B_LINE))
    d.append(text(55, 480, "Section C&#8211;C: the tab is 8 mm long, so it clears",
                  9.5, MID))
    d.append(text(55, 493, "the 5 mm wall and shows 3 mm on the outside. Big tabs",
                  9.5, MID))
    d.append(text(55, 506, "make this the most forgiving variant to cut.", 9.5, MID))
    d.append(text(ox + 3 * sc, oy + 13 * sc, "left wall", 9, A_LINE))
    return sheet(400, 520, "C &#183; Exposed tab &amp; slot",
                 "Pure laser &#183; visible tabs &#183; easiest to assemble",
                 "".join(g) + "".join(d))


if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "variants")
    os.makedirs(out, exist_ok=True)
    for name, fn in (("boxjoint", variant_a),
                     ("groove", variant_b),
                     ("tabs", variant_c)):
        path = os.path.join(out, name + ".svg")
        with open(path, "w") as f:
            f.write(fn())
        print("wrote", os.path.normpath(path))

