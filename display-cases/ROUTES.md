# Route A5 and Route A8 — flush magnetic lid, mechanical base

Two versions of the same case, differing only in **wall thickness**. Everything
else — the corner joints, the base joint, the assembly, the lid — is identical.

**The base is no longer magnetic.** It is a mechanical keyed joint, trapped in
all three axes. **Only 8 magnets remain in the whole case, and every one of
them is in the lid.**

| | **Route A5** | **Route A8** |
|---|---|---|
| Wall thickness | 5 mm (0.5 cm) | 8 mm (0.8 cm) |
| Magnet pocket | 3 × 8 mm slot, cut flush to the inner face | 4 mm dia round hole, centred |
| Acrylic around the magnet | 2.0 mm, outside only | 2.0 mm on **both** sides |
| Magnets — lid only | 8 × 3 × 8 × 2 mm blocks | 8 × 4 mm dia × 2 mm discs |
| Outside size | **16.0 × 10.0 × 15.0 cm** (160 × 100 × 150 mm) | **16.6 × 10.6 × 16.0 cm** (166 × 106 × 160 mm) |
| Margin around the box | 10 mm (1.0 cm) per side | 13 mm (1.3 cm) per side |
| Impact strength | baseline | roughly **2.5×** |
| Material cost per case | baseline | about **+$2.50** |
| Look | thin, glassy, display case | chunky, instrument case |

Both are a **true rectangular prism** — flush lid, flush base, nothing
protruding anywhere on the outside.

---

## 1. The base joint, explained simply

See `variants/base-explained.svg` — four pictures, left to right.

### The one-sentence version

> The four walls lock together at the corners with interlocking fingers, which
> makes a stack of little alternating blocks up each corner. Leave one block out
> of the stack, and the base plate has a tab that slots into the gap — so it is
> sandwiched between the blocks above and below.

That is the whole thing. There is no hook, no keyhole, no magnet and no glue.

### The long version

**Start with the corners.** The walls do not butt together — they interlock,
like a box joint in woodworking. At each corner, wall A owns one 5 mm slice,
wall B owns the next, then wall A again, all the way up. Nine or ten slices on
A5, nineteen on A8.

**So each corner is a stack.** Picture a stack of Lego bricks up the corner,
alternating colour: blue, grey, blue, grey. Every brick is the full thickness of
the wall, so the stack is solid.

**Now leave one brick out.** Take the second brick from the bottom out of the
stack. You now have a rectangular gap, the exact size of a brick, with a blue
brick underneath it and a grey brick above it.

**The base plate has a tab that fits the gap.** At each of its four corners the
base plate has a little square tab sticking out — exactly brick-sized. Slide the
base plate in, and each tab sits in one of those gaps.

**Now it cannot move.**

| Direction | What stops it |
|---|---|
| Down | The brick below the gap |
| Up | The brick above the gap |
| Sideways | The walls' bodies, which surround the tab on both sides |

That is all four of the base plate's corners, so it is locked in every direction
at once.

### Why the floor is flat

The walls do not stop at the gap. They carry on down past it, all the way to
the floor. So the bottom of the case is the walls' own bottom edge — a
continuous rim, one wall-thickness wide, all the way round, with nothing
protruding anywhere.

```
  band 3   z = 2t .. 3t    front / back wall block    <- stops the tab rising
  band 2   z =  t .. 2t    BASE PLATE + its corner tabs
  band 1   z =  0 ..  t    side wall block           <- stops the tab dropping
  -----------------------  floor
```

The base plate ends up recessed one band inside the case. You cannot see that
from outside, and it lifts the booster box another 5–8 mm off the ground, which
is a small bonus.

### What the base plate actually looks like

Not a plain rectangle. It is a rectangle the size of the interior, with four
square tabs reaching out to the corners:

```
      +--+                        +--+
      |  +------------------------+  |
      |  |                        |  |     <- the four tabs
      +--|                        |--+
         |                        |
      +--|                        |--+
      |  |                        |  |
      |  +------------------------+  |
      +--+                        +--+
```

Same sheet, same thickness, cut in the same laser pass as everything else.

### The cost

One extra finger band of height. The case grows by 5 mm (A5) or 9 mm (A8):

| | Old hook design | This design |
|---|---|---|
| Route A5 total height | 145 mm (14.5 cm) | **150 mm (15.0 cm)** |
| Route A8 total height | 151 mm (15.1 cm) | **160 mm (16.0 cm)** |

That is the honest price of a flat bottom.

---

## 2. Why the walls slide the way they do

This matters, because it is what makes the corners *and* the base work in the
same motion.

I tested it. If a wall slides **along its own length**, it meshes the first
corner and then **jams solid at the second** — the wall's material runs into
the far wall's fingers part-way through the travel:

```
slide along the wall's length by  8 mm : first corner ok, second corner BLOCKED
slide along the wall's length by  4 mm : first corner ok, second corner BLOCKED
```

If a wall slides **across its own face** (perpendicular to its plane), both
corners mesh simultaneously with no sweep collision at all.

**So each front and back wall goes in with one straight push, and both of its
corners click home at once.** The whole assembly is two pushes.

---

## 3. Dimensions — millimetres and centimetres

**The booster box being protected:** 140 × 80 × 125 mm (14.0 × 8.0 × 12.5 cm)

**A 5 mm EVA foam liner** wraps it on all six faces, so the interior is
150 × 90 × 135 mm (15.0 × 9.0 × 13.5 cm) and the box sits in a snug
140 × 80 × 125 mm foam pocket.

### Route A5 — 5 mm walls

| | mm | cm |
|---|---|---|
| Interior | 150 × 90 × 135 | 15.0 × 9.0 × 13.5 |
| Outside | **160 × 100 × 150** | **16.0 × 10.0 × 15.0** |
| Front / back wall ×2 | 160 × 145 | 16.0 × 14.5 |
| Left / right wall ×2 | 100 × 145 | 10.0 × 14.5 |
| Lid plate | 160 × 100 × 5 | 16.0 × 10.0 × 0.5 |
| Base plate | 160 × 100 × 5 | 16.0 × 10.0 × 0.5 |
| Corner finger bands | 29 × 5 | 29 × 0.5 |

### Route A8 — 8 mm walls

| | mm | cm |
|---|---|---|
| Interior | 150 × 90 × 136 | 15.0 × 9.0 × 13.6 |
| Outside | **166 × 106 × 160** | **16.6 × 10.6 × 16.0** |
| Front / back wall ×2 | 166 × 152 | 16.6 × 15.2 |
| Left / right wall ×2 | 106 × 152 | 10.6 × 15.2 |
| Lid plate | 166 × 106 × 8 | 16.6 × 10.6 × 0.8 |
| Base plate | 166 × 106 × 8 | 16.6 × 10.6 × 0.8 |
| Corner finger bands | 19 × 8 | 19 × 0.8 |

### Shared detailing

| Feature | mm | cm |
|---|---|---|
| Corner finger height | = wall thickness | — |
| Corner finger depth | = wall thickness | — |
| Base plate body | 150 × 90 | 15.0 × 9.0 |
| Base corner tab | t × t | — |
| Magnet pocket inset from the rim | 4.0 | 0.40 |
| Internal corner radius, every corner | R2 minimum | R0.2 minimum |
| Foam thickness | 5.0 | 0.50 |
| Finger-lift scallop in the front rim | 20 × 4 | 2.0 × 0.4 |

---

## 4. Cut list

| # | Part | Qty | A5 | A8 |
|---|---|---|---|---|
| 1 | Front / back wall — notched both ends | 2 | 160 × 145 × 5 | 166 × 152 × 8 |
| 2 | Left / right wall — notched both ends | 2 | 100 × 145 × 5 | 106 × 152 × 8 |
| 3 | Lid plate — plain except 4 magnet pockets | 1 | 160 × 100 × 5 | 166 × 106 × 8 |
| 4 | Base plate — interior rectangle + 4 corner tabs | 1 | 160 × 100 × 5 | 166 × 106 × 8 |
| 5 | EVA foam, floor pad | 1 | 150 × 90 × 5 | 150 × 90 × 5 |
| 6 | EVA foam, front / back pads | 2 | 150 × 130 × 5 | 150 × 130 × 5 |
| 7 | EVA foam, left / right pads | 2 | 80 × 130 × 5 | 80 × 130 × 5 |
| 8 | EVA foam, lid pad | 1 | 150 × 90 × 5 | 150 × 90 × 5 |
| 9 | Neodymium magnets | **8** | 3 × 8 × 2 mm blocks | 4 mm dia × 2 mm discs |

No felt pad with holes any more, and no keyholes. Four distinct acrylic shapes.

## 5. Assembly — eight steps

Illustrations: `variants/assembly-01.svg` … `assembly-08.svg`, plus
`variants/base-joint.svg`. All of them in a row in
[`compare-a.html`](compare-a.html).

| # | Step | What to watch |
|---|---|---|
| 1 | **Lay out every part.** 9 acrylic panels, 8 magnets, 6 foam pads. | Check against the cut list |
| 2 | **Drill the 8 magnet pockets** — one in each wall's top edge, four in the lid plate. | The base needs none. Do it while the panels are flat |
| 3 | **Bond the 4 wall magnets.** | Flush, not proud |
| 4 | **Bond the 4 lid magnets.** | Offer them dry, let the wall magnets pull each one round, then glue |
| 5 | **Base plate in, side walls on.** The side walls stand up first; the base slides in at the second finger band and its corner tabs drop into the sockets. | The tabs land on the finger band below |
| 6 | **Front wall in.** One push across its face. | Both corners mesh at once |
| 7 | **Back wall in.** Same push, opposite direction. | The base is now boxed in on all four sides, above and below |
| 8 | **Foam, box, lid.** | The lid is the only magnetically-held part |

By the end of step 7 the case is a closed, rigid box with a captive floor, and
nothing protrudes below the bottom rim.

### Why the finger-lift scallop is there

A perfectly flush lid has **nothing to grip**. The 20 × 4 mm scallop in the
front wall's top rim is the one place the rectangle is not perfect — and it is
the difference between a case that opens easily and one that generates support
emails. You can also just press one corner and the opposite corner tips up.

---

## 6. Making it survive a drop

You asked for compact, connected and strong. Here is what actually does the
work, in order of how much it matters.

### 1. The foam liner — the single biggest factor

The foam is what saves the booster box. It decouples the box from the case, so
on impact the box decelerates over 5 mm of crush instead of instantly — roughly
**5–10× less peak force** on the box. It also stops the box rattling, which is
what causes the corner scuffing that costs a sealed box its value.

**Do not skip the foam to save 30 cents.** Everything else on this list is about
the case surviving; the foam is about the *box* surviving.

### 2. Wall thickness — this is why A8 exists

Impact resistance scales roughly with the **cube** of thickness for deflection.
Going from 5 mm to 8 mm is a 60% increase in thickness and about a **2.5×
increase in the energy the case takes before it cracks**.

If the case will be posted, or handled by anyone but you, take A8.

### 3. Radius every internal corner — R2 minimum

A sharp internal corner in acrylic has a theoretically **infinite** stress
concentration. It is where every crack starts. A laser can cut any radius, so
there is no excuse for a square internal corner anywhere:

- the root of every finger on the corner joints
- the rim of every magnet pocket
- the corners of the base plate's notches and keyhole slots
- the ends of the finger-lift scallop

### 4. Anneal after cutting — the cheapest upgrade there is

Laser cutting locks stress into the cut edge, and that stress is exactly why
laser-cut acrylic shatters instead of flexing. **2–3 hours at 80 °C, then cool
slowly inside the oven with the door shut.** This is a genuine, large
improvement in impact resistance and almost nobody does it.

### 5. Polish the cut edges

A laser-cut edge is a row of micro-cracks. A quick flame polish (small torch,
fast sweeping passes, ~150 mm away) or a wet sand to 1500 grit blunts them.
Micro-cracks are crack starters; remove them and the case gets noticeably
tougher.

### 6. Box-jointed corners spread the load

A butt joint fails along one line. A finger joint spreads the same impact
across nine interlocking fingers per corner, and each finger is trapped by its
neighbours. No glue means no weak link — the glue would fail before the acrylic
did.

### What will still happen — the honest part

**The lid will pop off in a hard drop.** The A8 lid plate weighs 168 g. A 1 m
drop onto concrete decelerates at roughly 500 g, so the lid sees about **84 kg
of inertial force**. Four magnet pairs hold about 1.4 kg. No practical magnet
array holds that.

This is exactly why the foam matters. When the lid comes off, the foam cradle
still holds the box. You lose a lid, not the contents.

Note that the **base** is now immune to this, because it is mechanical rather
than magnetic — that is a real drop-protection gain from the change you asked
for.

If you truly need the lid to stay on through a drop it has to be mechanically
retained — a tongue engaging a lip inside the walls — but then the case takes
the whole impact itself and cracks instead. A lid that pops off is a lid that
releases energy.

**Test it rather than trusting the numbers.** Drop a prototype 1 m onto
concrete in all six orientations. You are looking for: foam intact, box
undamaged, case cracked at most at a seam and not shattered into pieces.

---

## 7. Bill of materials

| Item | Qty | A5 | A8 |
|---|---|---|---|
| Cast acrylic sheet | 1 | 5 mm, ~125 000 mm² of parts | 8 mm, ~140 000 mm² of parts |
| Neodymium magnets | **8** | 3 × 8 × 2 mm block, N42 | 4 mm dia × 2 mm disc, N42 |
| EVA foam, closed cell | — | 5 mm, ~0.1 m² | 5 mm, ~0.1 m² |
| Two-part epoxy or CA gel | — | for the magnets | for the magnets |
| 3M 467 or contact adhesive | — | for the foam | for the foam |

**8 magnets**, all at the top, all easy to fit and easy to check. The floor uses
none.

## 8. Which route

- **A8** if the case will be shipped, handled by anyone but you, or you simply
  want the strongest object. About $2.50 more, 6 mm bigger each way, and it is
  the one I would put in a box and post.
- **A5** if you want the thinner, glassier look and the case lives on a shelf.
  It still works — the slot pockets are genuinely fine — but you are relying on
  a 2 mm wall, and 5 mm acrylic takes about 40% of the impact that 8 mm does.

---

## 9. What is not built yet

Specified and illustrated, but not modelled:

- a parametric OpenSCAD model of either route
- a 1:1 nested cut plan for the sheet
- the foam pad templates
- the exact corner tab and finger band coordinates

Say the word and I will produce them for the route you pick.

