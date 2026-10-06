# Acrylic Display Case for a Sealed Pokémon Booster Box — Magnetic Lid

A build-it-yourself display case: a solvent-welded cast-acrylic box with a
slip-on **cap lid** that is held closed by **hidden neodymium magnets** set
into the walls, so there is no visible latch, no hinge, and no screws.

```
        ┌───────────────────────────┐  ← lid top panel, 5 mm
        │                           │
   ┌────┴───┐                   ┌───┴────┐
   │  skirt │ ◄── magnet pair ──►│ skirt  │   ← lid skirt slides 22 mm over the body
   └────────┘                   └────────┘
   ┌───────────────────────────┐
   │                           │        ← body: 5 mm walls, solvent welded
   │      booster box sits     │
   │      on a felt pad        │
   │                           │
   └───────────────────────────┘
```

Assembled size (for a standard English 36-pack box): **165 × 105 × 140 mm
(6.5 × 4.1 × 5.5 in)** — about 12 mm bigger than the box in every direction.

## How to look at these files

**Easiest:** open [`view.html`](view.html) — one page with the preview, the cut plan,
the dimensions, the cut list and the magnet spec all together. It has no dependencies,
so just double-click it (or open it in any browser).

**Just the drawings:**

| Want to see | Do this |
| --- | --- |
| Isometric preview | Open `preview-iso.svg` in any browser — SVG *is* an image, so it just opens |
| Cut plan | Same — open `cut-plan.svg` in a browser |
| On GitHub | Click the file in the repo; GitHub renders SVG inline, no download needed |
| True-size template | Open `cut-plan.svg` and print at **100%** (not "fit to page") |
| The 3D model | Install [OpenSCAD](https://openscad.org) (free), open `openscad/booster_box_case.scad`, press <kbd>F5</kbd> |

## Files

| File | What it is |
| --- | --- |
| [`compare-a.html`](compare-a.html) | **Route A5 vs A8, flush magnetic lid, with the 8-step assembly sequence** — start here |
| [`ROUTES.md`](ROUTES.md) | Full spec for both flush-lid routes: dimensions in mm and cm, cut lists, drop analysis |
| [`compare.html`](compare.html) | The three earlier self-assembly variants side by side |
| [`VARIANTS.md`](VARIANTS.md) | Full spec for each self-assembly variant: cut lists, joint dimensions, assembly, trade-offs |
| [`view.html`](view.html) | The original glued version, all on one page |
| [`preview-iso.svg`](preview-iso.svg) | Isometric preview of the glued version |
| [`SPEC.md`](SPEC.md) | Spec for the glued version: dimensions, cut list, magnets, assembly |
| [`openscad/booster_box_case.scad`](openscad/booster_box_case.scad) | Parametric 3D model — change 3 numbers and it resizes itself |
| [`cut-plan.svg`](cut-plan.svg) | 1:1 sheet layout for the glued version |
| [`variants/`](variants) | Generated illustrations: the flush-lid routes, the 8 assembly steps, and the three joint types |
| [`tools/make_preview.py`](tools/make_preview.py) | Regenerates `preview-iso.svg` |
| [`tools/make_variants.py`](tools/make_variants.py) | Regenerates the three variant illustrations |
| [`tools/make_a_routes.py`](tools/make_a_routes.py) | Regenerates the flush-lid route images and the 8 assembly steps |

## Self-assembly, no glue

If the customer assembles it, the design forks three ways. All three share the same
booster box envelope, the same 5 mm acrylic and the same magnetic lid, and differ
only in how the walls join:

| | A · Box joint | B · Routed groove | C · Exposed tabs |
|---|---|---|---|
| Cutting | Laser only | Laser + router | Laser only |
| Look | Flush, zigzag corner seams | Seamless, plinth base | Proud tabs |
| Assembly | 3 moves | 4 moves | 4 moves |
| Kerf sensitivity | High | Low | Medium |

Full detail in [`VARIANTS.md`](VARIANTS.md), visuals in [`compare.html`](compare.html).


## TL;DR of the glued build

1. **Material:** cast acrylic (Perspex® / Plexiglas® G), **5 mm** thick.
   Not extruded — extrusion crazes when solvent welded.
2. **Body:** bottom panel + 4 walls, butt joints, solvent welded with
   Weld-On® 4 / dichloromethane by capillary action.
3. **Lid:** a "cap" — top panel + a 22 mm skirt that drops over the body with
   ~0.5 mm clearance per side.
4. **Magnets:** 8 × N42 neodymium discs, **6 mm dia × 2 mm thick**, in 2 mm-deep
   blind pockets (3 mm of acrylic left behind them). Four pairs, one per wall,
   centred in the skirt overlap. They pull the skirt onto the body.
5. **Do all the drilling before welding.** This is the single biggest time-saver.
6. **Pad the base** with 2 mm felt or neoprene so it doesn't scratch shelves.

Open `SPEC.md` for the exact numbers.

> These files are additive — nothing in `app.js`, `index.html` or `style.css`
> (the card inventory app) is touched.
