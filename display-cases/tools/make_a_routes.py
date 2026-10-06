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
    body.append(text(px + 8, py, "base magnets", 9.5, RED))

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
    body.append(text(460, y + 62, "16 total: 4 pairs lid + 4 pairs base", 10, MID))
    body.append(text(460, y + 78, "Finger joint: 7.5 mm fingers, 15 mm pitch, 9 up", 10, MID))
    body.append(text(460, y + 94, "Radius every internal corner R2 minimum", 10, GREEN))

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
    """Drill the magnet pockets - while everything is still flat."""
    t, OX, OY = g["t"], g["OX"], g["OY"]
    IZ = g["IZ"] if "IZ" in g else globals()["IZ"]
    sc = 1.30
    ox, oy = 40.0, 76.0
    W, H = OX * sc, IZ * sc
    d = [rect(ox, oy, W, H, "#f7f9fd", INK)]
    # pockets: one in the top edge, one in the bottom edge, centred
    for yy, lbl in ((oy + 6, "lid pocket"), (oy + H - 6, "base pocket")):
        d.append(rect(ox + W / 2 - 8, yy - 5, 16, 10, "#fca5a5", "#991b1b", 1.2))
    d.append(dim(ox, oy + H + 16, ox + W, oy + H + 16, f"{OX:.0f} mm  ({OX/10:.1f} cm)", GREEN, 12))
    d.append(dim(ox - 16, oy, ox - 16, oy + H, f"{IZ:.0f} mm", GREEN, -4))
    d.append(text(ox + W + 14, oy + 14, f"{t:.0f} mm", 10, MID))
    d.append(text(ox + W + 14, oy + 28, "thick", 10, MID))
    d.append(text(ox + W + 14, oy + 50, "pocket:", 10, RED, weight="bold"))
    if t <= 5:
        d.append(text(ox + W + 14, oy + 66, "3 &#215; 8 mm slot,", 10, MID))
        d.append(text(ox + W + 14, oy + 80, "cut flush to the", 10, MID))
        d.append(text(ox + W + 14, oy + 94, "INNER face, so", 10, MID))
        d.append(text(ox + W + 14, oy + 108, "2 mm of acrylic", 10, MID))
        d.append(text(ox + W + 14, oy + 122, "is left outside.", 10, MID))
    else:
        d.append(text(ox + W + 14, oy + 66, "4 mm dia &#215; 2 mm", 10, MID))
        d.append(text(ox + W + 14, oy + 80, "deep, centred, so", 10, MID))
        d.append(text(ox + W + 14, oy + 94, "2 mm of acrylic", 10, MID))
        d.append(text(ox + W + 14, oy + 108, "is left each side.", 10, MID))
    d.append(text(ox, oy + H + 100, "Every wall gets 2 pockets; each plate gets 4.",
                  9.5, MID))
    d.append(text(ox, oy + H + 116, "Do it while the panels are flat, not after.",
                  9.5, MID))
    return step_sheet(
        2, "Drill the 16 magnet pockets",
        "Brad-point bit, ~500 rpm, panel clamped to a backer board.",
        "".join(d),
        "Radius every internal corner R2 - that is where cracks start.")


def step3(g):
    """Bond the wall magnets."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.85, 200.0, 204.0
    d = [walls(g, s, cx, cy)]
    for (x, y) in ((OX / 2, 0), (OX / 2, OY), (0, OY / 2), (OX, OY / 2)):
        d.append(mag(x, y, OZ - 4, s, cx, cy))
        d.append(mag(x, y, t + 4, s, cx, cy))
    d.append(text(24, 326, "Top edge: 4 magnets, one per wall - holds the lid.",
                  9.5, MID))
    d.append(text(24, 342, "Bottom edge: 4 more, holding the base plate.",
                  9.5, MID))
    d.append(text(24, 358, "Epoxy them flush. Proud magnets stop the lid seating.",
                  9.5, RED))
    return step_sheet(
        3, "Bond the 8 wall magnets",
        "Two-part epoxy or CA gel. Set them flush, not proud.",
        "".join(d),
        "Polarity: walls first, then let each magnet find its own way round.")


def step4(g):
    """Bond the lid and base magnets."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    s, cx, cy = 0.85, 200.0, 204.0
    d = [box(0, 0, OZ + 60, OX, OY, TOP + 60, s, cx, cy, *F_LID)]
    d.append(box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE))
    for (x, y) in ((OX / 2, 0), (OX / 2, OY), (0, OY / 2), (OX, OY / 2)):
        d.append(mag(x, y, t - 2, s, cx, cy))
        d.append(mag(x, y, OZ + 62, s, cx, cy))
    d.append(text(24, 330, "The same four positions on both flat plates.",
                  9.5, MID))
    d.append(text(24, 346, "Offer them dry and let the wall magnets pull each",
                  9.5, MID))
    d.append(text(24, 362, "one round the right way. That solves polarity.",
                  9.5, GREEN))
    return step_sheet(
        4, "Bond the lid and base magnets",
        "8 more magnets, at the matching positions on both plates.",
        "".join(d),
        "Work on a non-magnetic surface - spare magnets chip when they snap.")



def step5(g):
    """Build the two L-halves."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.72, 213.0, 182.0
    gap = 18.0
    d = []
    # left + front  (slides in -X)
    d.append(box(0, 0, t, t, OY, OZ, s, cx, cy, *F_WALL))
    d.append(box(gap, 0, t, OX + gap, t, OZ, s, cx, cy, *F_WALL))
    d.append(arrow(*proj(OX * 0.62 + gap, t / 2, OZ * 0.6, s, cx, cy),
                   *proj(OX * 0.62, t / 2, OZ * 0.6, s, cx, cy)))
    # right + back (slides in +X)
    d.append(box(OX - t, OY + gap, t, OX, OY + gap + OY, OZ, s, cx, cy, *F_WALL))
    d.append(box(0, OY + gap, t, OX - t - gap, OY + t + gap, OZ, s, cx, cy, *F_WALL))
    d.append(text(24, 350, "Half 1: left + front wall, front slides in &#8722;X.",
                  9.5, MID))
    d.append(text(24, 366, "Half 2: right + back wall, back slides in +X.",
                  9.5, MID))
    return step_sheet(
        5, "Build the two halves",
        "Two L-shapes. Each locks with one straight slide.",
        "".join(d),
        "A press fit goes by hand. If you need a mallet, the kerf is wrong.")


def step6(g):
    """Slide the halves together into a tube."""
    t, OX, OY, OZ = g["t"], g["OX"], g["OY"], g["OZ"]
    s, cx, cy = 0.80, 172.0, 204.0
    d = [walls(g, s, cx, cy)]
    d.append(arrow(*proj(OX + 46, OY / 2, OZ * 0.55, s, cx, cy),
                   *proj(OX + 6, OY / 2, OZ * 0.55, s, cx, cy)))
    d.append(text(24, 326, "Slide the two halves together in &#8722;X. Both",
                  9.5, MID))
    d.append(text(24, 342, "remaining corners mesh at the same moment.", 9.5, MID))
    d.append(text(24, 360, "The tube is now rigid - a finger joint cannot",
                  9.5, GREEN))
    d.append(text(24, 376, "splay, shear or lift. It needs no base.", 9.5, GREEN))
    return step_sheet(
        6, "Slide into a rigid tube",
        "Three moves total. Self-locking once the fourth wall is home.",
        "".join(d),
        "Check both diagonals are equal before you go on.")


def step7(g):
    """Click the base on and fit the foam."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    s, cx, cy = 0.70, 195.0, 229.0
    d = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    d.append(box(0, 0, t + 26, OX, OY, OZ + 26, s, cx, cy, *F_WALL))
    # foam liner, drawn inside
    f = 4.0
    d.append(box(t, t, t + 28, OX - t, OY - t, t + 28 + f, s, cx, cy, *F_FOAM))
    d.append(arrow(*proj(OX / 2, OY / 2, OZ + 74, s, cx, cy),
                   *proj(OX / 2, OY / 2, OZ + 32, s, cx, cy), RED))
    d.append(text(24, 338, "Drop the tube onto the base; the magnets pull",
                  9.5, MID))
    d.append(text(24, 354, "it home. Then lay in the 5 mm foam liner.",
                  9.5, MID))
    d.append(text(24, 372, "The foam saves the box in a drop, not the acrylic.",
                  9.5, GREEN))
    return step_sheet(
        7, "Click on the base, fit the foam",
        "The base locates on four notches, then the magnets clamp.",
        "".join(d),
        "Foam is the single biggest drop-protection item in the whole build.")


def step8(g):
    """Box in, lid on."""
    t, OX, OY, OZ, TOP = g["t"], g["OX"], g["OY"], g["OZ"], g["TOP"]
    s, cx, cy = 0.70, 195.0, 229.0
    d = [box(0, 0, 0, OX, OY, t, s, cx, cy, *F_BASE)]
    d.append(box(0, 0, t, OX, OY, OZ, s, cx, cy, *F_WALL))
    # ghost of the booster box inside
    d.append(box(t + FOAM, t + FOAM, t + FOAM, t + FOAM + BOX_W, t + FOAM + BOX_D,
                 t + FOAM + BOX_H, s, cx, cy, "#fed7aa", "#ea580c", "#c2410c", 0.6))
    d.append(box(0, 0, OZ + 40, OX, OY, TOP + 40, s, cx, cy, *F_LID))
    d.append(arrow(*proj(OX / 2, OY / 2, OZ + 88, s, cx, cy),
                   *proj(OX / 2, OY / 2, OZ + 46, s, cx, cy), RED))
    d.append(text(24, 332, "Lower the lid on; the magnets self-centre it.",
                  9.5, MID))
    d.append(text(24, 350, "To open: press one corner and the far corner tips.",
                  9.5, GREEN))
    d.append(text(24, 368, "Or hook a nail into the front rim scallop.", 9.5, GREEN))
    return step_sheet(
        8, "Box in, lid on",
        "Slide the box into the foam cradle, then drop the lid on.",
        "".join(d),
        "Flush lid and base - a true rectangular prism.")



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

    for name, fn in files.items():
        p = os.path.join(out, name)
        with open(p, "w") as fh:
            fh.write(fn())
        print("wrote", os.path.normpath(p))

