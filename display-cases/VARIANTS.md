# Three ways to make it self-assembly (no glue)

Same booster box, same acrylic, same magnetic lid — three different ways of
joining the walls. All three:

- ship flat and are assembled by the customer, with **no glue and no fasteners**
- end up as a closed rectangular case with a **magnetic cap lid** (4 magnet pairs)
- use the same 140 × 80 × 125 mm booster-box envelope, so they are directly
  comparable

Illustrations: [`variants/boxjoint.svg`](variants/boxjoint.svg),
[`variants/groove.svg`](variants/groove.svg),
[`variants/tabs.svg`](variants/tabs.svg) — or open
[`compare.html`](compare.html) to see all three side by side.

---

## The trade-off you are choosing

Acrylic breaks at ~2–3% strain and every notch concentrates stress, so a real
**snap-fit will crack** — usually on the second or third assembly. Every
glue-free option below is therefore a **press fit**, not a click. Expect to
tune the fit to your laser's kerf (typically 0.1–0.2 mm) with a test cut.

Given that, the three variants differ in one thing only: **where the joint
shows.**

| | **A · Box joint** | **B · Routed groove** | **C · Exposed tabs** |
|---|---|---|---|
| Cutting process | Laser only | Laser **+ router** | Laser only |
| Pieces | 9 | 9 | 9 |
| Distinct part shapes | 6 | 6 | 6 |
| Assembly moves | 3 | 4 | 4 |
| Glue / fasteners | none | none | none |
| What you see | flush, crisp zigzag seam at each corner | **nothing** — hairline seams only | proud tabs on the front and back |
| Silhouette | 154 × 94 × 140, lid overhangs to 165 × 105 | 165 × 105 × 140, walls recessed (plinth base) | 154 × 100 × 140, lid overhangs |
| Rigidity | excellent — self-locking | good — clamped by the lid | good |
| Kerf sensitivity | **high** — the fingers must be right | low — 0.2 mm of slop is invisible | medium |
| Forgiving of mistakes | low | **high** | high |
| "Build" experience | **best** — a real 3-move puzzle | minimal — drop 4 walls in | good |
| Weak point | 5 mm fingers chip if forced | needs a second machine | tabs are the look |

**My pick: A**, unless you want the finished object to be as clean as possible,
in which case B. C is the one to choose if you want the cheapest possible
production and the most forgiving tolerances.

---

## A · Box-jointed walls — *pure laser, flush zigzag corners*

The four walls finger-joint into each other. Each corner is a 5 × 5 mm cube
that changes owner every 5 mm up the height, so the two panels trap each other
and the case cannot splay, shear or lift.

**Cut list** (5 mm cast acrylic)

| # | Part | Qty | Size | Joint feature |
|---|---|---|---|---|
| 1 | Front / back wall | 2 | 154 × 130 | castellated both vertical ends |
| 2 | Left / right wall | 2 | 94 × 130 | castellated both vertical ends |
| 3 | Base plate | 1 | 154 × 94 | plain |
| 4 | Lid top | 1 | 165 × 105 | plain |
| 5 | Lid skirt front / back | 2 | 165 × 22 | magnet pockets |
| 6 | Lid skirt left / right | 2 | 95 × 22 | magnet pockets |

**Joint spec:** 10 mm pitch — a 5 mm finger, then a 5 mm notch, repeated 13
times over the 130 mm wall. Front/back walls keep the fingers at z-bands
0–5, 10–15, … ; left/right walls keep them at 5–10, 15–20, … . The two patterns
must be complementary.

**Assembly — three moves, no tools**

1. Left wall + front wall → slide the front wall **in −X** until the fingers mesh.
2. Right wall + back wall → slide the back wall **in +X**.
3. Slide the two halves together **in −X**. Both remaining corners mesh at once.

Then drop the base plate underneath and set the magnetic lid on top.

**Watch out for:** the finger width *is* your kerf setting. Cut one corner
first and adjust until it is a light hand press. Too tight and the fingers chip
when you push them home; too loose and the case rattles.

---

## B · Routed-groove base — *truly seamless, needs a router*

The walls are plain rectangles that butt at the corners. A 5.2 mm × 5 mm
channel routed around the base plate captures their bottom edges; the lid's
skirt captures the top. The base lip stops the walls splaying outward, so the
corners stay shut.

**Cut list**

| # | Part | Qty | Size | Notes |
|---|---|---|---|---|
| 1 | Front / back wall | 2 | 154 × 130 | plain, butt corners |
| 2 | Left / right wall | 2 | 84 × 130 | plain, fits *between* the others |
| 3 | Base plate | 1 | **165 × 105 × 10** | routed channel, see below |
| 4 | Lid top | 1 | 165 × 105 | plain |
| 5 | Lid skirt front / back | 2 | 165 × 22 | magnet pockets |
| 6 | Lid skirt left / right | 2 | 95 × 22 | magnet pockets |

**Channel spec:** 5.2 mm wide × 5 mm deep, its outer edge 5.4 mm in from the
edge of the plate. That puts the walls' outer face 5.5 mm inboard, so the base
and the lid both overhang by the same amount and read as matching caps.

**Why the plinth is unavoidable:** a groove needs material *outboard* of the
wall, and that material is what you see from the side. If you cut the channel
flush with the plate edge it becomes an open rabbet and the wall can simply
slide off it. So "seamless" costs you a 5.5 mm plinth at the bottom — which,
honestly, looks deliberate.

**Assembly:** drop the four walls into the channel, butt the corners, set the
lid on. Four moves, ten seconds.

**Watch out for:** 10 mm plate is a second sheet thickness to stock, and the
channel is a second machining operation. If you are set up for CNC routing
anyway this is nothing; if you are a laser-only shop, it is a real cost.

---

## C · Exposed tab & slot — *cheapest and most forgiving*

The left and right walls carry 8 mm tabs on their vertical edges. The tabs pass
right through the front and back walls and stand 3 mm proud on the outside.
Big tabs mean big tolerances.

**Cut list**

| # | Part | Qty | Size | Joint feature |
|---|---|---|---|---|
| 1 | Front / back wall | 2 | 154 × 130 | 5 × 5 mm notches at both ends |
| 2 | Left / right wall | 2 | 100 × 130 | 8 mm tabs on both ends |
| 3 | Base plate | 1 | **160 × 100** | plain, matches the tab extents |
| 4 | Lid top | 1 | 165 × 105 | plain |
| 5 | Lid skirt front / back | 2 | 165 × 22 | magnet pockets |
| 6 | Lid skirt left / right | 2 | 95 × 22 | magnet pockets |

**Joint spec:** the tab is 5 mm wide × 5 mm tall × 8 mm long. It crosses the
5 mm wall and shows 3 mm. Notches are at the same z-bands as variant A's
fingers, so the two parts of a joint are cut with the same complementary
pattern.

**Assembly — four moves**

1. Stand the front and back walls up, parallel, notches facing in.
2. Slide the left wall **in +Y** — both its tabs drop into the notches.
3. Slide the right wall **in +Y** the same way.
4. Drop the base plate on and set the magnetic lid on top.

**Watch out for:** the tabs change the footprint. The case is 154 × 100 mm
rather than 154 × 94 mm, so the base plate grows with it. If you would rather
keep a square footprint, put the tabs on the front and back walls instead and
the case becomes 160 × 94 mm — same trade, different axis.

---


## What is shared by all three

Unchanged from the original design:

- **Acrylic:** 5 mm cast (Perspex® / Plexiglas® G). Do not drop to 3 mm — thin
  fingers chip and thin walls cannot hold a magnet pocket.
- **Interior:** 144 × 84 × 130 mm, sized for a 140 × 80 × 125 mm booster box.
- **Magnets:** 8 × N42 neodymium discs, 6 mm dia × 2 mm, in 6.2 mm dia × 2 mm
  deep blind pockets, 11 mm below the top rim, one pair centred on each wall.
  A 2 mm pocket leaves 3 mm of acrylic behind the magnet.
- **Lid:** a cap with a 22 mm skirt. Outer 165 × 105 mm, total height 27 mm.
- **Polarity trick:** glue the four body magnets first, then drop each lid
  magnet into its pocket and let the body magnet pull it into the right
  orientation before you glue it. That solves polarity with no marking up.

## Cost and complexity, ranked

1. **C — cheapest.** All straight cuts and simple notches. The largest
   tolerances, so the least scrap. Tabs are visible.
2. **A — middle.** Same machines as C, but 13 small fingers per wall end, so
   more laser time and a much tighter kerf requirement. Best finished feel.
3. **B — most expensive.** Needs a router or CNC for the channel and a 10 mm
   sheet as well as the 5 mm. Gives the cleanest object.

## What I would do

Build a **sample of A and C** first — they use the same machine and the same
material, so the only cost is the laser time, and the comparison will tell you
immediately whether your customers want a puzzle to solve or a box that just
goes together. Keep B in reserve as the premium SKU for people who want the
object, not the build.

Whatever you pick, cut **one corner test** before committing a full sheet.
Every glue-free acrylic design lives or dies on the kerf.

---

## Still to build

These three are specified and illustrated, not yet modelled. When you pick one
I will produce:

- a full parametric OpenSCAD model of that variant
- a 1:1 cut plan for the sheet
- the magnet-pocket drilling detail for the new wall sizes
- an updated assembly sheet with the finger/tab dimensions dimensioned

