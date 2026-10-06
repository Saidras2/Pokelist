#!/usr/bin/env python3
"""
Generate an isometric preview SVG for the magnetic-lid booster box display case.

The geometry is derived from the same numbers as SPEC.md / booster_box_case.scad,
so if you change the parameters here (or in the .scad) the drawing stays honest.

    python3 tools/make_preview.py > ../preview-iso.svg
"""
import math

# ---- parameters (must match openscad/booster_box_case.scad) -----------------
BOX_W, BOX_D, BOX_H = 140.0, 80.0, 125.0
FIT, HEAD, T, LID_CLR = 2.0, 5.0, 5.0, 0.5
SKIRT, MAG_INSET = 22.0, 11.0

IX, IY, IZ = BOX_W + 2 * FIT, BOX_D + 2 * FIT, BOX_H + HEAD
OX, OY, OZ = IX + 2 * T, IY + 2 * T, T + IZ
L_IX, L_IY = OX + 2 * LID_CLR, OY + 2 * LID_CLR
L_OX, L_OY = L_IX + 2 * T, L_IY + 2 * T
LID_Z = OZ - SKIRT
TOP_Z = OZ + T

COS, SIN = math.cos(math.radians(30.0)), 0.5


def proj(x, y, z, s):
    """Isometric projection.  +x goes right-down, +y goes left-down, +z goes up."""
    return ((x - y) * COS * s, ((x + y) * SIN - z) * s)


def box_pts(x0, y0, z0, x1, y1, z1):
    return [(x, y, z) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]


def face(pts, idx, fill, stroke="#1f2937", sw=1.0):
    p = " ".join(f"{pts[i][0]:.2f},{pts[i][1]:.2f}" for i in idx)
    return f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def draw_box(x0, y0, z0, x1, y1, z1, s, top, right, front):
    """Draw one convex box: top face, +x face, +y face (the three visible ones)."""
    C = {(x, y, z): proj(x, y, z, s) for (x, y, z) in box_pts(x0, y0, z0, x1, y1, z1)}
    out = []
    # +x face (x = x1)
    out.append(face(C, [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], right))
    # +y face (y = y1)
    out.append(face(C, [(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], front))
    # top face (z = z1)
    out.append(face(C, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], top))
    return "".join(out)


def render_view(cx, cy, s, explode=0.0, show_magnets=False):
    """cx,cy = where the projected origin should land."""
    parts = []
    # body (drawn first, the lid will overdraw its top)
    parts.append(draw_box(0, 0, 0, OX, OY, OZ, s, "#eef2f9", "#cfd8e8", "#bcc7db"))
    # lid
    parts.append(
        draw_box(0, 0, LID_Z + explode, L_OX, L_OY, TOP_Z + explode, s,
                 "#f7f9fd", "#dde5f2", "#cbd6ea")
    )

    if show_magnets:
        body_mag = [(OX, OY / 2, OZ - MAG_INSET), (OX / 2, OY, OZ - MAG_INSET)]
        lid_mag = [(L_OX, L_OY / 2, LID_Z + explode + MAG_INSET),
                   (L_OX / 2, L_OY, LID_Z + explode + MAG_INSET)]
        for x, y, z in body_mag:
            px, py = proj(x, y, z, s)
            parts.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{3.0*s:.2f}" '
                         f'fill="#dc2626" stroke="#7f1d1d" stroke-width="0.8"/>')
        for x, y, z in lid_mag:
            px, py = proj(x, y, z, s)
            parts.append(f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{3.0*s:.2f}" '
                         f'fill="#2563eb" stroke="#1e3a8a" stroke-width="0.8"/>')

    # centre the drawing on (cx, cy) using the true extents of both boxes
    pts = box_pts(0, 0, 0, OX, OY, OZ) + \
          box_pts(0, 0, LID_Z + explode, L_OX, L_OY, TOP_Z + explode)
    xs = [proj(x, y, z, s)[0] for (x, y, z) in pts]
    ys = [proj(x, y, z, s)[1] for (x, y, z) in pts]
    dx = cx - (min(xs) + max(xs)) / 2
    dy = cy - (min(ys) + max(ys)) / 2
    return f'<g transform="translate({dx:.2f},{dy:.2f})">' + "".join(parts) + "</g>"


W, H = 900, 580
out = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
    f'viewBox="0 0 {W} {H}" font-family="Helvetica, Arial, sans-serif">',
    f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
    '<text x="30" y="38" font-size="19" font-weight="bold" fill="#111827">'
    'MagnaCase &#8212; Pokémon Booster Box Display Case</text>',
    '<text x="30" y="58" font-size="11" fill="#6b7280">'
    '165 &#215; 105 &#215; 140 mm assembled &#183; 5 mm cast acrylic &#183; '
    'magnetic slip-on cap lid &#183; 4 magnet pairs</text>',
    '<line x1="30" y1="72" x2="870" y2="72" stroke="#e5e7eb"/>',
]

SCALE = 1.15

# --- view A : closed ---------------------------------------------------------
out.append(render_view(250, 280, SCALE))
out.append('<text x="250" y="500" font-size="12" fill="#374151" text-anchor="middle">'
           'A &#8212; closed</text>')
out.append('<text x="250" y="518" font-size="11" fill="#6b7280" text-anchor="middle">'
           'The 22 mm skirt hides the magnet line</text>')

# --- view B : exploded -------------------------------------------------------
out.append('<line x1="450" y1="95" x2="450" y2="480" stroke="#e5e7eb"/>')
out.append(render_view(665, 280, SCALE, explode=45.0, show_magnets=True))
out.append('<text x="665" y="500" font-size="12" fill="#374151" text-anchor="middle">'
           'B &#8212; lid lifted 45 mm</text>')
out.append('<text x="665" y="518" font-size="11" fill="#374151" text-anchor="middle">'
           '<tspan fill="#dc2626">&#9679;</tspan> body magnets in the outer wall faces'
           ' &#160; <tspan fill="#2563eb">&#9679;</tspan> lid magnets in the skirt</text>')
out.append('<text x="665" y="534" font-size="11" fill="#6b7280" text-anchor="middle">'
           'Each pair sits 11 mm below the rim, on the same axis, so the skirt is '
           'pulled onto the body.</text>')

out.append('<text x="30" y="566" font-size="10" fill="#9aa0ae">'
           'Generated by tools/make_preview.py &#8212; regenerate after changing any '
           'parameter in openscad/booster_box_case.scad.</text>')
out.append("</svg>")

print("\n".join(out))
