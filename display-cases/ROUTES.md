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
| Magnets | 8 × 3 × 8 × 2 mm blocks | 8 × 4 mm dia × 2 mm discs |
| Outside size | **16.0 × 10.0 × 14.5 cm** (160 × 100 × 145 mm) | **16.6 × 10.6 × 15.1 cm** (166 × 106 × 151 mm) |
| Margin around the box | 10 mm (1.0 cm) per side | 13 mm (1.3 cm) per side |
| Impact strength | baseline | roughly **2.5×** |
| Material cost per case | baseline | about **+$2.50** |
| Look | thin, glassy, display case | chunky, instrument case |

Both are a **true rectangular prism** — flush lid, flush base, nothing
protruding anywhere on the outside.

---

## 1. How the base actually attaches

This is the part you asked about, and it is the whole trick. The base plate is
a flat panel, so it can only carry features **in its own plane** — slots and
notches, nothing that sticks up. The walls are vertical panels, so they can
carry features in *their* plane. That asymmetry is what makes a mechanical
floor possible.

The base plate gets two different features:

| Feature | Qty | What it does |
|---|---|---|
| **Corner notches**, one per corner, t × t | 4 | The side walls' bottom corner fingers drop through them. This stops the base sliding in X, Y, or rotationally. |
| **Keyhole slots**, two near the front edge and two near the back | 4 | The front and back walls' bottom hooks pass through these. This stops the base dropping out. |

And the base ends up trapped in all three axes:

- **Sideways** — the four corner notches, filled by the side walls' fingers
- **Downwards** — the four hooks, whose heads sit *under* the base plate
- **Upwards** — the walls themselves sit on top of the base plate

No magnet, no glue, no extra part. See `variants/base-joint.svg` for the
enlarged section.

### The hook, exactly

Each front and back wall carries **two L-shaped hooks** cut from its own bottom
edge. A hook is a neck (the wall's full thickness, 9 mm wide) with a **26 mm
head** at the bottom.

- The hook drops through a keyhole slot in the base plate.
- The slot is **26 mm wide at the entry** (so the head passes through) and only
  **9 mm wide** where the neck ends up.
- The wall's slide moves the neck from the wide part into the narrow part, so
  the head finishes **under solid acrylic** and cannot pull back up.

The head sits 3 mm below the base plate, flush with a 3 mm felt pad on the
underside — so the case still sits dead flat.

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
corners click home at once.** That same push drives its two base hooks under
the base plate. The whole assembly is two pushes.

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
| Outside | **160 × 100 × 145** | **16.0 × 10.0 × 14.5** |
| Front / back wall ×2 | 160 × 135 | 16.0 × 13.5 |
| Left / right wall ×2 | 100 × 135 | 10.0 × 13.5 |
| Lid plate | 160 × 100 × 5 | 16.0 × 10.0 × 0.5 |
| Base plate | 160 × 100 × 5 | 16.0 × 10.0 × 0.5 |

### Route A8 — 8 mm walls

| | mm | cm |
|---|---|---|
| Interior | 150 × 90 × 135 | 15.0 × 9.0 × 13.5 |
| Outside | **166 × 106 × 151** | **16.6 × 10.6 × 15.1** |
| Front / back wall ×2 | 166 × 135 | 16.6 × 13.5 |
| Left / right wall ×2 | 106 × 135 | 10.6 × 13.5 |
| Lid plate | 166 × 106 × 8 | 16.6 × 10.6 × 0.8 |
| Base plate | 166 × 106 × 8 | 16.6 × 10.6 × 0.8 |

### Shared detailing

| Feature | mm | cm |
|---|---|---|
| Corner joint pitch | 15.0 | 1.50 |
| Finger width | 7.5 | 0.75 |
| Fingers per corner | 9 | — |
| Magnet pocket inset from the rim | 4.0 | 0.40 |
| Base corner notch | t × t | — |
| Keyhole entry / neck width | 26.0 / 9.0 | 2.60 / 0.90 |
| Hook head below the base plate | 3.0 | 0.30 |
| Internal corner radius, every corner | R2 minimum | R0.2 minimum |
| Foam thickness | 5.0 | 0.50 |
| Finger-lift scallop in the front rim | 20 × 4 | 2.0 × 0.4 |

---

## 4. Cut list

| # | Part | Qty | A5 | A8 |
|---|---|---|---|---|
| 1 | Front / back wall — full width, notched both ends, **2 hooks** on the bottom edge | 2 | 160 × 135 × 5 | 166 × 135 × 8 |
| 2 | Left / right wall — full depth, notched both ends, **corner fingers extend down** | 2 | 100 × 135 × 5 | 106 × 135 × 8 |
| 3 | Lid plate — plain except 4 magnet pockets | 1 | 160 × 100 × 5 | 166 × 106 × 8 |
| 4 | Base plate — 4 corner notches + 4 keyhole slots | 1 | 160 × 100 × 5 | 166 × 106 × 8 |
| 5 | EVA foam, floor pad | 1 | 150 × 90 × 5 | 150 × 90 × 5 |
| 6 | EVA foam, front / back pads | 2 | 150 × 130 × 5 | 150 × 130 × 5 |
| 7 | EVA foam, left / right pads | 2 | 80 × 130 × 5 | 80 × 130 × 5 |
| 8 | EVA foam, lid pad | 1 | 150 × 90 × 5 | 150 × 90 × 5 |
| 9 | Neodymium magnets | 8 | 3 × 8 × 2 mm blocks | 4 mm dia × 2 mm discs |
| 10 | Felt pad, 3 mm, with 4 holes for the hook heads | 1 | 150 × 90 | 156 × 96 |

Blank sizes are the panel outlines before the joint profiles are cut. The side
walls' blanks run t mm taller than the finished wall (the corner fingers extend
down through the base). The front and back walls' blanks run t + 3 mm taller
(the hooks reach 3 mm below the base plate).

Still only **four distinct acrylic shapes**, which keeps the cutting simple.

---

## 5. Assembly — eight steps

Illustrations: `variants/assembly-01.svg` … `assembly-08.svg`, plus
`variants/base-joint.svg`. All of them in a row in
[`compare-a.html`](compare-a.html).

| # | Step | What to watch |
|---|---|---|
| 1 | **Lay out every part.** 9 acrylic panels, 8 magnets, 6 foam pads. | Check against the cut list |
| 2 | **Drill the 8 magnet pockets** — one in each wall's top edge, four in the lid plate. | The base needs no pockets. Do it while the panels are flat |
| 3 | **Bond the 4 wall magnets.** | Set them flush; proud magnets stop the lid seating |
| 4 | **Bond the 4 lid magnets.** | Offer them dry, let the wall magnets pull each one round, then glue |
| 5 | **Base plate down, side walls on.** | The side walls' corner fingers drop into the base's corner notches |
| 6 | **Front wall in.** One push across its face. | Both corners mesh at once and both hooks drive home |
| 7 | **Back wall in.** Same push, opposite direction. | The box is now closed on all six faces |
| 8 | **Foam, box, lid.** | The lid is the only magnetically-held part |

The base cannot slide, cannot drop and cannot rise. Every one of the six faces
is mechanically connected before the lid goes on.

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
- the inside of every hook
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
| Cast acrylic sheet | 1 | 5 mm, ~115 000 mm² of parts | 8 mm, ~125 000 mm² of parts |
| Neodymium magnets | **8** | 3 × 8 × 2 mm block, N42 | 4 mm dia × 2 mm disc, N42 |
| EVA foam, closed cell | — | 5 mm, ~0.1 m² | 5 mm, ~0.1 m² |
| Felt pad, 3 mm | 1 | with 4 holes for the hook heads | same |
| Two-part epoxy or CA gel | — | for the magnets | for the magnets |
| 3M 467 or contact adhesive | — | for the foam and felt | for the foam and felt |

**Down from 16 magnets to 8**, and all of them at the top where they are easy
to fit and easy to check.

---

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
- the exact hook and keyhole profile coordinates

Say the word and I will produce them for the route you pick.

