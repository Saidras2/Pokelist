# SPEC — Magnetic-Lid Acrylic Booster Box Case

All dimensions in millimetres. Bracketed values are inches.

---

## 1. Design intent

- Display one **sealed** Pokémon booster box on a shelf without the cardboard
  getting sun-faded, scuffed or shelf-worn.
- The lid must be **fully removable** (so you can lift the box straight out)
  and must **latch closed on its own** with magnets — no clips, no screws,
  no visible hardware.
- Everything must be cuttable from flat sheet and assembled with solvent,
  so it needs no special tooling beyond a drill press and a syringe.

Chosen approach: a **cap lid with a skirt**. The skirt drops 22 mm down over
the walls, which hides the magnet line completely and gives the case a
clean 90° silhouette from any angle.

---

## 2. Step 1 — measure your box (do not skip this)

Booster box sizes drift between sets and between the English and Japanese
printings. Measure your actual box with a rule and use *those* numbers.

| Box type | Width (X) | Depth (Y) | Height (Z) |
| --- | --- | --- | --- |
| English 36-pack, SWSH/SV era | ~133 (5.24) | ~74 (2.91) | ~119 (4.69) |
| Japanese 30-pack, SV era | ~135 (5.31) | ~66 (2.60) | ~115 (4.53) |
| Booster bundle (6 packs) | ~135 (5.31) | ~48 (1.89) | ~72 (2.83) |
| Elite Trainer Box | ~171 (6.73) | ~91 (3.58) | ~171 (6.73) |
| Premium / special collections | varies a lot | varies | varies |

> Those are typical values gathered from the hobby, **not** manufacturer
> specs. Anything printed on the box is artwork; the numbers you want are the
> outer cardboard measurements. If your box is 1–2 mm off a value above,
> use yours.

The case is sized as `box dimension + clearance`, so as long as you feed in a
real measurement the case will fit. All the numbers below use the worked
example:

```
BOX_W = 140      (widest of the common 36-pack boxes, with margin)
BOX_D =  80
BOX_H = 125
```

---

## 3. Global parameters

| Symbol | Meaning | Value |
| --- | --- | --- |
| `FIT` | side clearance each side | 2.0 |
| `HEAD` | headroom above the box | 5.0 |
| `t` | acrylic thickness (walls, bottom, lid) | 5.0 |
| `LID_CLR` | lid-to-body clearance each side | 0.5 |
| `SKIRT` | skirt overlap height | 22.0 |
| `MAG_INSET` | magnet centre, measured down from the top of the body wall / the top of the skirt panel | 11.0 |

---

## 4. Derived dimensions

Interior (the pocket the booster box sits in):

```
IX = BOX_W + 2*FIT = 140 + 4  = 144   (5.67)
IY = BOX_D + 2*FIT =  80 + 4  =  84   (3.31)
IZ = BOX_H + HEAD  = 125 + 5  = 130   (5.12)
```

Body (exterior):

```
OX = IX + 2*t = 144 + 10 = 154   (6.06)
OY = IY + 2*t =  84 + 10 =  94   (3.70)
OZ = t + IZ   =   5 + 130 = 135  (5.31)   ← bottom panel + interior height
```

Lid (exterior):

```
LIX = OX + 2*LID_CLR = 154 + 1 = 155     (6.10)   inner width of skirt
LIY = OY + 2*LID_CLR =  94 + 1 =  95     (3.74)   inner depth of skirt
LOX = LIX + 2*t      = 155 + 10 = 165    (6.50)
LOY = LIY + 2*t      =  95 + 10 = 105    (4.13)
Lid height = t + SKIRT = 5 + 22 = 27     (1.06)
```

**Assembled case: 165 × 105 × 140 mm (6.50 × 4.13 × 5.51 in).**
The lid's top panel lands flush on the body's top rim, so total height is
`OZ + t` = 140. The skirt overhangs the outside of the body by 5.5 mm per
side, which is what makes the magnet line invisible.

Sits on a shelf taking up about the same footprint as a large hardback book.

---

## 5. Cut list (5 mm cast acrylic)

Nine panels. Grain/gloss direction is irrelevant for cast acrylic; for
extruded, keep the extrusion direction consistent.

| # | Part | Qty | Size (mm) | Notes |
| --- | --- | --- | --- | --- |
| 1 | Bottom | 1 | 154 × 94 | full footprint; the four walls sit **on** it |
| 2 | Front / back wall | 2 | 154 × 130 | full outer width; outer face gets a magnet pocket |
| 3 | Left / right wall | 2 | 84 × 130 | fits **between** the front/back walls |
| 4 | Lid top | 1 | 165 × 105 | full outer footprint |
| 5 | Lid skirt, front/back | 2 | 165 × 22 | fits on the outer Y faces |
| 6 | Lid skirt, left/right | 2 | 95 × 22 | fits **between** the front/back skirts |

Why those numbers line up:

- `154 = 5 + 144 + 5` and `94 = 5 + 84 + 5` — the front/back walls span the
  full outer width, the left/right walls span the *interior* depth (`94 − 2×5 = 84`).
- Lid skirt: outer footprint `165 × 105`; the front/back skirt panels span the
  full 165, so the gap left between them is `105 − 2×5 = 95` for the side
  skirt panels.

**Sheet requirement:** total part area ≈ **105 000 mm²**. A single
**400 × 620 mm** offcut is enough; a 600 × 900 mm sheet leaves plenty of slack
for a spare and for a second case. See `cut-plan.svg`.

---

## 6. The magnet system

### 6.1 Spec

| Item | Value |
| --- | --- |
| Type | Neodymium (NdFeB) disc, axially magnetised |
| Grade | N42 (N35 works; N52 is overkill and chips more easily) |
| Size | 6 mm dia × **2 mm** thick |
| Quantity | **8** (4 matched pairs) |
| Coating | Ni-Cu-Ni (standard). Epoxy-coated if you want extra corrosion resistance |
| Pull force each | ~0.8–0.9 kg |
| Total hold (4 pairs) | ~3.4 kg — the lid weighs ~120 g, so this is a very secure latch |

**Why 2 mm thick and not 3 mm:** the wall is 5 mm. A 2 mm-deep pocket leaves
3 mm of acrylic behind the magnet, which will not crack. A 3 mm-deep pocket
leaves 2 mm, which is where acrylic starts star-cracking around the hole under
load. If you want 3 mm magnets, step the walls up to 6 mm acrylic.

### 6.2 Where they go

Four pairs, one per wall, **centred** along the wall and sitting in the middle
of the skirt overlap:

- Body front/back walls: pocket in the **outer ±Y face**, 11 mm below the top rim.
- Body left/right walls: pocket in the **outer ±X face**, 11 mm below the top rim.
- Lid front/back skirt panels: pocket in the **inner ±Y face**, 11 mm below the
  panel's top edge (i.e. dead centre of the 22 mm panel).
- Lid left/right skirt panels: same, on the **inner ±X face**.

Because the magnet axes are all horizontal and normal to the wall, once the
lid is on, each body magnet touches its lid magnet face-to-face. The attraction
pulls the skirt **sideways onto the body** in all four directions at once, so
the lid cannot rock, cannot lift, and self-centres as it closes.

If your box is heavier or longer than the example (say a 3-box-wide case), use
**8 pairs** (two per wall, at ±40 mm from centre) instead of 4. The lid will
then "snap" with much more authority and the corners will not lift.

### 6.3 Pocket geometry

```
diameter : 6.2 mm   (0.2 mm oversize — lets the magnet drop in with epoxy around it)
depth    : 2.0 mm
centre   : 11 mm below the top rim (body walls) / below the top edge (skirt panels)
           and centred along the wall
```

Drill a **blind** pocket — never through. If the pocket breaks through the wall
you will see the magnet from the outside and the case is scrap. Mark the depth
on the drill bit with a wrap of masking tape.

### 6.4 Drilling acrylic without cracking it

1. Drill **before** you weld anything. Flat panels are trivial to clamp and
   back up; an assembled box is not.
2. Use a **brad-point bit** (or a 6 mm end mill in a router) — a standard twist
   bit grabs and shatters acrylic.
3. Drill press, **~400–600 rpm**, very light feed pressure, and let the bit cut.
   Never push.
4. Clamp the panel to a **sacrificial MDF/ply backer** so the panel cannot flex.
5. A drop of water or a squirt of isopropyl as coolant keeps the swarf from
   re-welding to the hole.
6. Deburr the rim with a sharp countersink turned *by hand*.

### 6.5 Gluing them in — and getting polarity right

Polarity is the one thing that can ruin the build, so do it this way:

1. Clean the pockets with isopropyl.
2. Drop the four **body** magnets in with a touch of 2-part epoxy or
   cyanoacrylate gel, face flush with the surface. Do not let them stand proud
   or the skirt will not slide on.
3. Put a small **steel screwdriver tip** against each body magnet to confirm
   which pole is showing — note it, then reverse the screwdriver.
4. Slide the lid on dry. For each lid pocket, drop in a magnet and let the
   body magnet **pull it into the correct orientation by itself**. That magnet
   is now guaranteed to attract. Mark the pocket, lift the lid off, and glue it
   in that exact orientation.
5. Work on a **non-magnetic** surface, keep spare magnets far away from each
   other (they snap together and chip), and use a brass or aluminium drift to
   seat them, never fingers.

Alternative if you would rather not drill at all: glue a strip of
self-adhesive **1.5 mm magnetic tape** to the body's outer face inside the
skirt engagement zone, and a matching steel tape inside the lid skirt. It is
weaker, but it is completely hidden and it needs no drilling.

---


## 7. Assembly

Weld order matters — always weld flat, always build up from the bottom.

1. **Lay out** all nine panels and confirm the cut list. Label the inside face
   of each panel with a pencil on the side that will be hidden.
2. **Dry-fit everything** with masking tape into body + lid. Check both
   diagonals with a steel rule (they must be equal) and check squareness with a
   machinist square. Fix now, not later.
3. **Weld the body.** Bottom flat on the bench → left/right walls → front/back
   walls. Use **Weld-On® 4** or dichloromethane applied by **capillary action**
   with a 25 G needle and a syringe: hold the joint closed, run the needle
   along the seam, and let capillary pull the solvent in. It sets in
   seconds — hold for 30 s, then let it cure.
   - Do not flood it. Excess solvent runs down the face and leaves a permanent
     white "ghost" mark.
   - For a more forgiving job, use **Weld-On® 16** (thicker, gap-filling) on
     the lid, where the joints are short.
4. **Weld the lid skirt** into a ring first (parts 5 + 6), let it cure, then
   weld the ring to the lid top (part 4). Doing the ring first keeps the skirt
   square.
5. Wait **24–48 hours** before loading the case. Fresh solvent welds are
   surprisingly weak.
6. **Optional anneal:** 2 h at 80 °C in an oven, then cool slowly inside the
   oven. This relieves the stress left by drilling and welding and is the best
   insurance against later crazing.

---

## 8. Finishing touches

- **Base pad:** 2 mm black felt or neoprene sheet bonded to the underside with
  3M 467 or contact adhesive. Stops shelf scratching and kills the hollow
  "clack" when you set it down.
- **Cradle pad:** a 2 mm felt pad on the inside floor protects the booster box's
  bottom corners. Cut it 144 × 84 so it is a snug drop-in.
- **Edges:** the top rim of the lid skirt and the top edges of the body are the
  only edges that show. Flame-polish them with a small torch (fast, sweeping
  passes, ~150 mm away) or wet-sand 800 → 1500 → 3000 and polish. Polished
  edges make the whole case read as "shop-bought".
- **Finger lift:** the skirt is a friction fit *plus* magnets, so you do want
  somewhere to hook a fingernail. Two easy options:
  - Cut the two short-side skirt panels at **18 mm instead of 22 mm**. That
    leaves a 4 mm reveal on the short sides only — looks deliberate, gives you
    a thumb gap.
  - Or keep all skirts at 22 mm and cut a **25 mm dia × 5 mm deep scallop** in
    the centre of the body's front top edge (the OpenSCAD file has a
    `finger_notch` switch for this).
- **UV:** plain acrylic passes UV and sealed box artwork *will* fade over years
  in a sunny room. Pay the small premium for a **UV-filtering cast acrylic**
  grade, or keep the case out of direct sun.
- **Labelling:** a 60 × 20 mm engraved or printed plate bonded to the front of
  the body reads nicely. Do not engrave the lid — it weakens the skirt.
- **Humidity:** the case is not airtight. If you are fussy about foil-curling,
  drop a 5 g silica gel sachet behind the booster box.

---


## 9. Variants

### 9.1 Budget / lighter — 3 mm walls
Halve the material cost and the weight. But a 3 mm wall cannot hold a 2 mm
pocket safely, so switch to the **magnetic tape** method in §6.5 instead of
drilled magnets. Cut list is otherwise identical once you set `t = 3` in the
OpenSCAD file.

### 9.2 Premium — 6 mm walls
Heavier, more "museum", and lets you use **3 mm-thick** magnets in 3 mm-deep
pockets. Also makes the top rim wide enough to look intentional. Set `t = 6`.

### 9.3 Multi-box display
For *n* boxes side by side, depth and height stay the same and only the width
changes:

```
IX = n*BOX_W + (n+1)*FIT
```

Use **2 magnet pairs per long wall** (offset ±40 mm from centre) once *n* ≥ 2,
otherwise the lid can rock on the long axis. A 3-wide case (≈ 460 mm across)
should also get a thicker bottom panel or a mid-span brace.

### 9.4 Stacked / double-height
Booster boxes stack flat two high (2 × 125 = 250 mm interior). Same plan,
`BOX_H = 250`, 8 magnet pairs. Add a full second bottom panel as a mid-deck.

### 9.5 Hinged lid instead of removable
If you would rather the lid stay attached:

- Weld two 20 × 30 mm acrylic hinge blocks to the back skirt and the back wall.
  Drill both 3 mm through, and pin with a **3 mm acrylic rod** or nylon screw —
  acrylic-on-acrylic pivots fine, no bearing needed.
- Fit 2 magnet pairs to the front skirt/wall as above to hold it shut.
- Leave a ~1 mm gap between the lid top panel and the body rim so it does not
  bind as it swings, and bevel the front skirt's bottom edge at 30°.
- Trade-off: the pivot holes are stress risers where a crack can start, and the
  lid can never be fully removed. For a display case the removable cap is
  usually the better answer.

### 9.6 Wall mount
Same box, but bond two 60 × 40 × 5 mm acrylic standoffs to the back wall and
screw through keyhole-slotted holes. Add a 20 mm lip along the interior front
bottom so the box cannot slide out. Do not hang acrylic on a hot or sunny wall —
it creeps under load.

### 9.7 Other sizes
- **Elite Trainer Box:** `BOX_W = 171, BOX_D = 91, BOX_H = 171`. Nearly square
  footprint, so use 8 magnet pairs.
- **Graded slab (PSA/BGS):** `BOX_W = 82, BOX_D = 15, BOX_H = 133` gives a tall
  thin case; 2 magnet pairs is plenty.
- **Booster bundle (6 packs):** `BOX_W = 135, BOX_D = 48, BOX_H = 72`.

---

## 10. Bill of materials

| Item | Qty | Notes |
| --- | --- | --- |
| Cast acrylic sheet, 5 mm, ~400 × 620 mm | 1 | Perspex® / Plexiglas® G; UV-filtering grade preferred |
| N42 neodymium disc 6 × 2 mm | 8 | buy 12, you will chip one |
| Weld-On® 4 (or dichloromethane) + 25 G syringe/needle | 1 | capillary welding |
| Weld-On® 16 | 1 | optional, for the lid |
| 2-part epoxy or CA gel | 1 | for the magnets |
| 2 mm black felt / neoprene, 200 × 150 mm | 1 | pads |
| 3M 467 or contact adhesive | — | pads |
| Masking tape, isopropyl, 6.2 mm brad-point bit | — | consumables |

---

## 11. Sanity checklist before you cut

- [ ] I measured **my** booster box, not a spec sheet.
- [ ] `IX/IY` are at least `BOX_W/BOX_D + 3`, so there is no wrestling fit.
- [ ] `IZ` gives at least 3 mm headroom above the box.
- [ ] `SKIRT` ≥ 18 mm, or the magnets have nothing to grip.
- [ ] Wall thickness ≥ magnet pocket depth + 3 mm.
- [ ] Magnet pockets drilled **before** welding.
- [ ] Both dry-fit diagonals equal.
- [ ] Polarity tested by letting the magnets find each other.

