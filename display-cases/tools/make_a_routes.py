#!/usr/bin/env python3
"""
Route A5 / A8 comparison drawings + step-by-step assembly sequence for the
flush magnetic-lid self-assembly display case.

    python3 tools/make_a_routes.py

Writes
    ../variants/a5.svg, ../variants/a8.svg
    ../variants/assembly-01.svg ... assembly-08.svg
"""
import math
import os

COS, SIN = math.cos(math.radians(30.0)), 0.5

INK, MID, DIM, LINE = "#111827", "#4b5563", "#9aa0ae", "#e5e7eb"
BLUE, RED, AMBER, GREEN = "#1d4ed8", "#b91c1c", "#b45309", "#15803d"

# sealed booster box, then a 5 mm EVA foam liner all round
BOX_W, BOX_D, BOX_H = 140.0, 80.0, 125.0
FOAM = 5.0
IX, IY, IZ = BOX_W + 2 * FOAM, BOX_D + 2 * FOAM, BOX_H + 2 * FOAM   # 150 x 90 x 135
OZ_MINUS = None  # placeholder, geometry comes from geom()


def geom(t):
    """Everything derives from the wall thickness t."""
    return {
        "t": t, "IZ": IZ,
        "OX": IX + 2 * t,          # outside width
        "OY": IY + 2 * t,          # outside depth
        "OZ": t + IZ,              # top of the walls
        "TOP": 2 * t + IZ,         # top of the lid plate
    }


def proj(x, y, z, s, cx, cy):
    return (cx + (x - y) * COS * s, cy + ((x + y) * SIN - z) * s)


def quad(pts, s, cx, cy, fill, stroke, sw=0.8):
    p = " ".join(f"{proj(v[0], v[1], v[2], s, cx, cy)[0]:.2f},"
                 f"{proj(v[0], v[1], v[2], s, cx, cy)[1]:.2f}" for v in pts)
    return (f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-linejoin="round"/>')


def box(x0, y0, z0, x1, y1, z1, s, cx, cy, top, right, front, sw=0.8):
    """One convex box: the three faces you can see from this angle."""
    return (
        quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], s, cx, cy, right, INK, sw)
        + quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], s, cx, cy, front, INK, sw)
        + quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], s, cx, cy, top, INK, sw)
    )


def text(x, y, s, size=10, fill=MID, anchor="start", weight="normal"):
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}">{s}</text>')


def rect(x, y, w, h, fill, stroke=INK, sw=0.8, dash=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')


def sheet(w, h, title, sub, body, foot=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
            f'viewBox="0 0 {w} {h}" font-family="Helvetica, Arial, sans-serif">\n'
            f'<rect width="{w}" height="{h}" fill="#ffffff"/>\n'
            + text(20, 28, title, 15, INK, weight="bold")
            + text(20, 46, sub, 10.5, MID)
            + f'<line x1="20" y1="58" x2="{w-20}" y2="58" stroke="{LINE}"/>\n'
            + body
            + (text(20, h - 14, foot, 9.5, DIM) if foot else "")
            + "\n</svg>\n")


def zigzag(p0, p1, bands, amp, colour, sw=1.8):
    """Finger-joint seam drawn as an alternating ladder."""
    out = []
    (x0, y0), (x1, y1) = p0, p1
    for i in range(bands):
        t0, t1 = i / bands, (i + 1) / bands
        ax, ay = x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0
        bx, by = x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1
        d = amp if i % 2 == 0 else -amp
        out.append(f'<line x1="{ax+d:.2f}" y1="{ay:.2f}" x2="{bx+d:.2f}" '
                   f'y2="{by:.2f}" stroke="{colour}" stroke-width="{sw}" '
                   f'stroke-linecap="round"/>')
    return "".join(out)


def arrow(x0, y0, x1, y1, colour=BLUE):
    """A short straight arrow with a head."""
    ang = math.atan2(y1 - y0, x1 - x0)
    L, W = 7.0, 3.4
    hx, hy = x1 - L * math.cos(ang), y1 - L * math.sin(ang)
    p = [(x1, y1),
         (hx - W * math.sin(ang), hy + W * math.cos(ang)),
         (hx + W * math.sin(ang), hy - W * math.cos(ang))]
    pts = " ".join(f"{a:.2f},{b:.2f}" for a, b in p)
    return (f'<line x1="{x0:.2f}" y1="{y0:.2f}" x2="{hx:.2f}" y2="{hy:.2f}" '
            f'stroke="{colour}" stroke-width="1.6"/>'
            f'<polygon points="{pts}" fill="{colour}"/>')


def dim(x0, y0, x1, y1, label, colour=GREEN, off=0):
    """A dimension line with a centred label."""
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    return (f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" '
            f'stroke="{colour}" stroke-width="1" stroke-dasharray="3 2"/>'
            + text(mx, my + off, label, 9.5, colour, "middle"))


# ------------------------------------------------------------------ drawing --
F_WALL = ("#f7f9fd", "#e3e9f4", "#d2dbec")
F_BASE = ("#eef2f9", "#cfd8e8", "#bcc7db")
F_LID = ("#f7f9fd", "#dde5f2", "#cbd6ea")
F_FOAM = ("#fef3c7", "#f59e0b", "#d97706")
F_MAG = ("#fca5a5", "#991b1b", "#7f1d1d")


def walls(g, s, cx, cy, style=F_WALL, seams=True):
    """The four walls as a closed tube, with the corner seams drawn on."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    out = []
    # front / back (full width) then left / right (between them)
    out.append(box(0, OY - t, t, OX, OY, OZ, s, cx, cy, *style))
    out.append(box(0, 0, t, OX, t, OZ, s, cx, cy, *style))
    out.append(box(0, 0, t, t, OY, OZ, s, cx, cy, *style))
    out.append(box(OX - t, 0, t, OX, OY, OZ, s, cx, cy, *style))
    if seams:
        for (x, y) in ((OX, OY), (OX, 0), (0, OY)):
            out.append(zigzag(proj(x, y, t, s, cx, cy), proj(x, y, OZ, s, cx, cy),
                              9, 1.6, BLUE, 1.5))
    return "".join(out)


def case_closed(g, s, cx, cy):
    """Finished case: base plate, tube, flush lid plate."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    out = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    out.append(walls(g, s, cx, cy))
    out.append(box(0, 0, OZ, OX, OY, TOP, s, cx, cy, *F_LID))
    # the two horizontal seams - this is all you see of the lid
    out.append(zigzag(proj(OX, OY, OZ, s, cx, cy), proj(OX, 0, OZ, s, cx, cy), 1, 0, LINE, 1))
    return "".join(out)


def route_image(t, name):
    g = geom(t)
    OX, OY, OZ, TOP = g["OX"], g["OY"], g["OZ"], g["TOP"]
    S, CX, CY = 1.00, 220.0, 275.0
    body = [case_closed(g, S, CX, CY)]
    # magnet callouts on the rim
    px, py = proj(OX, OY / 2, OZ - 6, S, CX, CY)
    body.append(text(px + 8, py, "lid magnets", 9.5, RED))
    px, py = proj(OX, OY / 2, 6, S, CX, CY)
    body.append(text(px + 8, py, "base: keyed, no magnet", 9.5, GREEN))

    # ---- side panel: cut list + the key numbers ----
    rows = [
        ("Outside", f'{OX:.0f} &#215; {OY:.0f} &#215; {TOP:.0f} mm',
         f'{OX/10:.1f} &#215; {OY/10:.1f} &#215; {TOP/10:.1f} cm'),
        ("Interior", f'{IX:.0f} &#215; {IY:.0f} &#215; {IZ:.0f} mm',
         f'{IX/10:.1f} &#215; {IY/10:.1f} &#215; {IZ/10:.1f} cm'),
        ("Wall thickness", f'{t:.0f} mm', f'{t/10:.1f} cm'),
        ("Front / back wall &#215;2", f'{OX:.0f} &#215; {IZ:.0f} mm',
         f'{OX/10:.1f} &#215; {IZ/10:.1f} cm'),
        ("Left / right wall &#215;2", f'{OY:.0f} &#215; {IZ:.0f} mm',
         f'{OY/10:.1f} &#215; {IZ/10:.1f} cm'),
        ("Lid plate", f'{OX:.0f} &#215; {OY:.0f} &#215; {t:.0f} mm',
         f'{OX/10:.1f} &#215; {OY/10:.1f} &#215; {t/10:.1f} cm'),
        ("Base plate", f'{OX:.0f} &#215; {OY:.0f} &#215; {t:.0f} mm',
         f'{OX/10:.1f} &#215; {OY/10:.1f} &#215; {t/10:.1f} cm'),
    ]
    body.append(text(580, 90, "mm", 10, MID, "start", "bold"))
    body.append(text(700, 90, "cm", 10, MID, "start", "bold"))
    y = 112
    for label, mm, cm in rows:
        body.append(text(460, y, label, 10, INK))
        body.append(text(580, y, mm, 10, MID))
        body.append(text(700, y, cm, 10, MID))
        body.append(f'<line x1="460" y1="{y+6}" x2="840" y2="{y+6}" stroke="{LINE}"/>')
        y += 26

    mag = (["3 &#215; 8 &#215; 2 mm blocks in slot pockets cut",
            "flush to the inner face - 2 mm of acrylic outside."]
           if t <= 5 else
           ["4 mm dia &#215; 2 mm discs in round pockets,",
            "2 mm of acrylic left all round."])
    body.append(text(460, y + 14, "MAGNETS", 10, RED, weight="bold"))
    body.append(text(460, y + 30, mag[0], 10, MID))
    body.append(text(460, y + 44, mag[1], 10, MID))
    body.append(text(460, y + 62, "8 total, 4 pairs - lid only. Base is mechanical.", 10, GREEN))
    body.append(text(460, y + 78, "Corner joint: 7.5 mm fingers, 15 mm pitch, 9 up", 10, MID))
    body.append(text(460, y + 94, "Base: 4 corner notches + 4 keyhole hooks", 10, MID))
    body.append(text(460, y + 110, "Radius every internal corner R2 minimum", 10, GREEN))

    sub = ("5 mm walls &#183; slot pockets &#183; keeps the thin profile"
           if t <= 5 else
           "8 mm walls &#183; round pockets &#183; 1.6&#215; the impact strength")
    foot = ("Assembled size " + f'{OX/10:.1f} &#215; {OY/10:.1f} &#215; {TOP/10:.1f} cm '
            f'({OX:.0f} &#215; {OY:.0f} &#215; {TOP:.0f} mm). '
            "Flush on all six faces - a true rectangular prism.")
    return sheet(860, 520, f'Route {name} &#183; flush magnetic lid', sub,
                 "".join(body), foot)



# ----------------------------------------------------------- assembly steps --
def step_sheet(n, title, sub, body, foot=""):
    return sheet(400, 400, f"STEP {n} &#183; {title}", sub, body, foot)


def mag(x, y, z, s, cx, cy, r=3.2, colour=RED):
    px, py = proj(x, y, z, s, cx, cy)
    return (f'<circle cx="{px:.1f}" cy="{py:.1f}" r="{r}" fill="{colour}" '
            f'stroke="#7f1d1d" stroke-width="0.9"/>')


def step1(g):
    """Lay out every part."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    s, cx, cy = 0.64, 200.0, 228.0
    d = 26.0
    o = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    o.append(box(0, -d, t + 40, OX, t - d, OZ + 40, s, cx, cy, *F_WALL))
    o.append(box(0, OY + d, t + 40, OX, OY + t + d, OZ + 40, s, cx, cy, *F_WALL))
    o.append(box(-d, 0, t + 40, t - d, OY, OZ + 40, s, cx, cy, *F_WALL))
    o.append(box(OX + d, 0, t + 40, OX + t + d, OY, OZ + 40, s, cx, cy, *F_WALL))
    o.append(box(0, 0, OZ + 96, OX, OY, TOP + 96, s, cx, cy, *F_LID))
    o.append(box(IX / 2 - 20, IY / 2 - 20, t + 12, IX / 2 + 20, IY / 2 + 20, t + 16,
                 s, cx, cy, *F_FOAM))
    return step_sheet(
        1, "Lay out every part",
        "9 acrylic panels, 16 magnets, 5 foam pads - no factory glue.",
        "".join(o),
        "Check the panels against the cut list before you touch a drill.")


def step2(g):
    """Drill the 8 magnet pockets - wall top edges and the lid plate."""
    t, OX = g["t"], g["OX"]
    IZ = g["IZ"]
    sc, ox, oy = 1.30, 40.0, 76.0
    W, H = OX * sc, IZ * sc
    d = [rect(ox, oy, W, H, "#f7f9fd", INK)]
    d.append(rect(ox + W / 2 - 8, oy + 3, 16, 10, "#fca5a5", "#991b1b", 1.2))
    d.append(dim(ox, oy + H + 18, ox + W, oy + H + 18,
                 f"{OX:.0f} mm  ({OX/10:.1f} cm)", GREEN, 12))
    d.append(dim(ox - 18, oy, ox - 18, oy + H, f"{IZ:.0f} mm", GREEN, -4))
    d.append(text(ox + W + 14, oy + 16, f"{t:.0f} mm", 10, MID))
    d.append(text(ox + W + 14, oy + 30, "thick", 10, MID))
    d.append(text(ox + W + 14, oy + 52, "Pocket:", 10, RED, weight="bold"))
    if t <= 5:
        rows = ["3 &#215; 8 mm slot,", "flush to the INNER", "face, so 2 mm of",
                "acrylic stays outside."]
    else:
        rows = ["4 mm dia &#215; 2 mm", "deep, centred, so", "2 mm of acrylic",
                "is left each side."]
    for k, s in enumerate(rows):
        d.append(text(ox + W + 14, oy + 68 + k * 14, s, 10, MID))
    d.append(text(ox, oy + H + 100,
                  "One pocket in the top edge of each wall; four in the lid plate.",
                  9.5, MID))
    d.append(text(ox, oy + H + 116,
                  "The base needs no pockets at all - that joint is mechanical.",
                  9.5, GREEN))
    return step_sheet(2, "Drill the 8 magnet pockets",
                      "Brad-point bit, ~500 rpm, panel clamped to a backer board.",
                      "".join(d),
                      "Only the top is magnetic. Radius every pocket rim R2.")


def step3(g):
    """Bond the 4 wall magnets."""
    OX, OY, OZ = g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.85, 200.0, 204.0
    d = [walls(g, s, cx, cy)]
    for (x, y) in ((OX / 2, 0), (OX / 2, OY), (0, OY / 2), (OX, OY / 2)):
        d.append(mag(x, y, OZ - 4, s, cx, cy))
    d.append(text(24, 326, "Four magnets, one centred in the top edge of each wall.",
                  9.5, MID))
    d.append(text(24, 342, "Epoxy them flush. Proud magnets stop the lid seating.",
                  9.5, MID))
    d.append(text(24, 358, "Nothing is magnetic below the rim - the base is keyed.",
                  9.5, GREEN))
    return step_sheet(3, "Bond the 4 wall magnets",
                      "Two-part epoxy or CA gel. Set them flush with the edge.",
                      "".join(d),
                      "Walls first, then let each lid magnet find its own way round.")


def step4(g):
    """Bond the 4 lid magnets."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    s, cx, cy = 0.80, 200.0, 200.0
    d = [box(0, 0, OZ + 62, OX, OY, TOP + 62, s, cx, cy, *F_LID)]
    d.append(box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE))
    for (x, y) in ((OX / 2, 0), (OX / 2, OY), (0, OY / 2), (OX, OY / 2)):
        d.append(mag(x, y, OZ + 64, s, cx, cy))
    d.append(text(24, 322, "Four magnets in the lid plate, at the matching points.",
                  9.5, MID))
    d.append(text(24, 338, "Offer them up dry and let the wall magnets pull each one",
                  9.5, MID))
    d.append(text(24, 354, "round the right way before you glue. Polarity solved.",
                  9.5, GREEN))
    return step_sheet(4, "Bond the 4 lid magnets",
                      "8 magnets in the whole case, and every one of them is at the top.",
                      "".join(d),
                      "Work on a non-magnetic surface - spare magnets chip when they snap.")


def step5(g):
    """Base plate down, then the two side walls drop onto it."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.66, 200.0, 188.0
    d = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    for (x, y) in ((0, 0), (OX, 0), (0, OY), (OX, OY)):
        px, py = proj(x, y, t + 0.4, s, cx, cy)
        d.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="none" '
                 f'stroke="{RED}" stroke-width="1.1"/>')
    for xf in (OX * 0.28, OX * 0.72):
        for yf in (t * 0.5, OY - t * 0.5):
            px, py = proj(xf, yf, t + 0.4, s, cx, cy)
            d.append(f'<rect x="{px-5:.1f}" y="{py-3.5:.1f}" width="10" height="7" '
                     f'fill="none" stroke="{AMBER}" stroke-width="1.1"/>')
    d.append(box(0, 0, t + 30, t, OY, OZ + 30, s, cx, cy, *F_WALL))
    d.append(box(OX - t, 0, t + 30, OX, OY, OZ + 30, s, cx, cy, *F_WALL))
    d.append(text(24, 300, "Base plate flat on the bench. Four corner notches (red)",
                  9.5, MID))
    d.append(text(24, 316, "and four keyhole slots (amber). Then the two side walls",
                  9.5, MID))
    d.append(text(24, 332, "drop onto it, inside the notches.", 9.5, MID))
    d.append(text(24, 350, "The base cannot move sideways: the notches lock it.", 9.5, GREEN))
    return step_sheet(5, "Base down, side walls on",
                      "The base is not magnetic. It is keyed, and the walls lock it.",
                      "".join(d),
                      "Cut the keyhole slots in the same laser pass as everything else.")


def step6(g):
    """Front wall slides in -Y: both corners mesh and both hooks lock."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.70, 200.0, 190.0
    gap = t + 14
    d = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    d.append(box(0, 0, t, t, OY, OZ, s, cx, cy, *F_WALL))
    d.append(box(OX - t, 0, t, OX, OY, OZ, s, cx, cy, *F_WALL))
    d.append(box(0, -gap, t, OX, t - gap, OZ, s, cx, cy, *F_WALL))
    d.append(arrow(*proj(OX / 2, -gap - 26, OZ * 0.62, s, cx, cy),
                   *proj(OX / 2, -gap - 4, OZ * 0.62, s, cx, cy)))
    d.append(text(24, 300, "Slide the front wall straight in along its own width.",
                  9.5, MID))
    d.append(text(24, 316, "Both corners mesh at once, because the wall travels",
                  9.5, MID))
    d.append(text(24, 332, "across its own face - not along it.", 9.5, MID))
    d.append(text(24, 350, "The same slide drives its two hooks under the base plate.",
                  9.5, GREEN))
    return step_sheet(6, "Front wall in - one move, two corners",
                      "A slide along the wall's length jams at the second corner. Across it, both mesh.",
                      "".join(d),
                      "You should feel it stop dead when the fingers bottom out.")


def step7(g):
    """Back wall slides in +Y and completes the box."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.66, 200.0, 188.0
    gap = t + 14
    d = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    d.append(box(0, 0, t, OX, OY, OZ, s, cx, cy, *F_WALL))
    d.append(box(0, OY + gap, t, OX, OY + t + gap, OZ, s, cx, cy, *F_WALL))
    d.append(arrow(*proj(OX / 2, OY + gap + 30, OZ * 0.62, s, cx, cy),
                   *proj(OX / 2, OY + gap + 6, OZ * 0.62, s, cx, cy)))
    d.append(text(24, 300, "Same move for the back wall, the other way.", 9.5, MID))
    d.append(text(24, 316, "The case is now closed on all four sides, and the base",
                  9.5, MID))
    d.append(text(24, 332, "is trapped: notches stop it sliding, the hooks stop it",
                  9.5, MID))
    d.append(text(24, 350, "dropping, the walls above stop it rising.", 9.5, GREEN))
    return step_sheet(7, "Back wall in - the box is closed",
                      "Every one of the six faces is now mechanically connected.",
                      "".join(d),
                      "Check both diagonals are equal before going on.")


def step8(g):
    """Foam, box, lid."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    s, cx, cy = 0.66, 200.0, 192.0
    d = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    d.append(box(0, 0, t, OX, OY, OZ, s, cx, cy, *F_WALL))
    d.append(box(t, t, t, OX - t, OY - t, t + 4, s, cx, cy, *F_FOAM))
    d.append(box(t + FOAM, t + FOAM, t, t + FOAM + BOX_W, t + FOAM + BOX_D,
                 t + FOAM + BOX_H, s, cx, cy, "#fed7aa", "#ea580c", "#c2410c", 0.6))
    d.append(box(0, 0, OZ + 50, OX, OY, TOP + 50, s, cx, cy, *F_LID))
    d.append(arrow(*proj(OX / 2, OY / 2, OZ + 100, s, cx, cy),
                   *proj(OX / 2, OY / 2, OZ + 56, s, cx, cy), RED))
    d.append(text(24, 300, "Lay the 5 mm foam in, drop the booster box into its",
                  9.5, MID))
    d.append(text(24, 316, "cradle, then lower the lid on. The lid is the only",
                  9.5, MID))
    d.append(text(24, 332, "magnetically held part of the whole case.", 9.5, MID))
    d.append(text(24, 350, "To open: press one corner, or use the front rim scallop.",
                  9.5, GREEN))
    return step_sheet(8, "Foam, box, lid",
                      "One single magnetically-held part, and it is the lid.",
                      "".join(d),
                      "Flush lid and flush base - a true rectangular prism.")



def base_joint(t):
    """Enlarged section through one base keyhole and hook."""
    W, H = 460, 360
    sc = 6.0
    ox, oy = 70.0, 130.0
    d = []
    d.append(rect(ox, oy, 46 * sc, t * sc, "#eef2f9", INK))
    d.append(rect(ox + 16 * sc, oy - 46 * sc, t * sc, 46 * sc, "#f7f9fd", INK))
    d.append(rect(ox + 16 * sc, oy, t * sc, t * sc, "#fca5a5", "#991b1b", 1.2))
    d.append(rect(ox + 16 * sc, oy + t * sc, 26 * sc, 3 * sc, "#fca5a5", "#991b1b", 1.2))
    d.append(f'<line x1="{ox+16*sc:.1f}" y1="{oy-46*sc:.1f}" x2="{ox+16*sc:.1f}" '
             f'y2="{oy+t*sc+3*sc:.1f}" stroke="{RED}" stroke-width="1" '
             f'stroke-dasharray="4 3"/>')
    d.append(text(ox + 16 * sc + 8, oy - 40 * sc, "wall", 10, MID))
    d.append(text(ox + 4, oy + t * sc - 4, "base plate", 10, MID))
    d.append(text(ox + 16 * sc + 6, oy + t * sc + 3 * sc + 26,
                  "26 mm head, 3 mm below the base", 10, RED))
    d.append(text(20, 300, "The wall's own material is cut as an L-shaped hook. It drops through a",
                  10, MID))
    d.append(text(20, 318, "keyhole slot in the base plate: 26 mm wide at the entry, only 9 mm wide",
                  10, MID))
    d.append(text(20, 336, "where the neck ends up. The wall's slide is the assembly motion, so the",
                  10, MID))
    d.append(text(20, 354, "head ends up trapped under solid acrylic and cannot pull back up.", 10, MID))
    return sheet(W, H, "Base joint - enlarged section",
                 "Mechanical. No magnet, no glue. This is what holds the floor in.",
                 "".join(d),
                 "The head sits 3 mm below the base plate, flush with a 3 mm felt pad.")


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "variants")
    os.makedirs(out, exist_ok=True)

    files = {
        "a5.svg": lambda: route_image(5.0, "A5"),
        "a8.svg": lambda: route_image(8.0, "A8"),
    }
    for i, fn in enumerate((step1, step2, step3, step4, step5, step6, step7, step8), 1):
        files[f"assembly-{i:02d}.svg"] = (lambda f=fn: f(geom(8.0)))
    files["base-joint.svg"] = lambda: base_joint(8.0)

    for name, fn in files.items():
        p = os.path.join(out, name)
        with open(p, "w") as fh:
            fh.write(fn())
        print("wrote", os.path.normpath(p))

