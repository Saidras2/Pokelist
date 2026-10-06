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

## Files

| File | What it is |
| --- | --- |
| [`preview-iso.svg`](preview-iso.svg) | Isometric preview — closed and lid-lifted, with magnet positions |
| [`SPEC.md`](SPEC.md) | The full design: dimensions, cut list, magnet spec, drilling, assembly, variants |
| [`openscad/booster_box_case.scad`](openscad/booster_box_case.scad) | Parametric 3D model — change 3 numbers and it resizes itself |
| [`cut-plan.svg`](cut-plan.svg) | 2D layout on a 600 × 900 mm sheet, with magnet pockets marked |
| [`tools/make_preview.py`](tools/make_preview.py) | Regenerates `preview-iso.svg` from the same parameters |

## TL;DR of the build

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
