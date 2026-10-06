// =============================================================================
//  Pokemon Booster Box Display Case  --  magnetic slip-on cap lid
//  Parametric OpenSCAD model.  Units: millimetres.
//
//  HOW TO USE
//    1. Measure your sealed booster box (outer cardboard, in mm).
//    2. Put those three numbers in BOX_W / BOX_D / BOX_H below.
//    3. Press F5 to preview, F6 to render.  The console echoes the cut list.
//
//  See ../SPEC.md for the matching written spec and ../cut-plan.svg for the
//  flat sheet layout.
// =============================================================================

/* [Booster box - MEASURE YOURS] */
BOX_W = 140;    // width  (X)
BOX_D =  80;    // depth  (Y)
BOX_H = 125;    // height (Z)

/* [Clearance] */
FIT       = 2.0;   // air each side of the booster box
HEAD      = 5.0;   // headroom above the booster box
LID_CLR   = 0.5;   // lid-to-body clearance, each side

/* [Material] */
t = 5.0;           // acrylic thickness (body walls, bottom, lid)

/* [Lid] */
SKIRT       = 22.0;  // how far the lid skirt drops over the body
SKIRT_SHORT = 0;     // 0 = same as SKIRT; set 18 for a finger reveal on the
                     // two short sides

/* [Magnets] */
MAG_ON       = true;
MAG_DIA      = 6.2;   // pocket diameter (0.2 mm over the magnet)
MAG_DEPTH    = 2.0;   // blind pocket depth -- keep <= t - 3
MAG_INSET    = 11.0;  // pocket centre, measured down from the top rim
MAG_PER_WALL = 1;     // 1 = one centred magnet per wall; 2 = two per wall
MAG_SPREAD   = 40.0;  // centre spacing when MAG_PER_WALL = 2

/* [Details] */
FINGER_NOTCH = false;  // scallop in the body's front top edge
NOTCH_DIA    = 25.0;
NOTCH_DEPTH  = 5.0;

/* [View] */
SHOW_LID     = true;   // draw the lid
SHOW_MAGNETS = false;  // red = body magnets, blue = lid magnets
EXPLODE      = 0;      // mm to lift the lid for a preview render
SHOW_GHOST   = false;  // translucent stand-in for the booster box

$fn = 64;

// ---------------------------------------------------------------- derived ----
Ix  = BOX_W + 2*FIT;          // interior width
Iy  = BOX_D + 2*FIT;          // interior depth
Iz  = BOX_H + HEAD;           // interior height (bottom-panel top -> rim)

Ox  = Ix + 2*t;               // body outer width
Oy  = Iy + 2*t;               // body outer depth
Oz  = t + Iz;                 // body outer height

L_ix = Ox + 2*LID_CLR;        // lid skirt inner width
L_iy = Oy + 2*LID_CLR;        // lid skirt inner depth
L_ox = L_ix + 2*t;            // lid outer width
L_oy = L_iy + 2*t;            // lid outer depth
L_hz = t + SKIRT;             // lid total height

SS    = (SKIRT_SHORT > 0 && SKIRT_SHORT < SKIRT) ? SKIRT_SHORT : SKIRT;
LID_Z = Oz - SKIRT;           // lid origin: skirt bottom sits here

echo(str("Interior         : ", Ix, " x ", Iy, " x ", Iz));
echo(str("Body outer       : ", Ox, " x ", Oy, " x ", Oz));
echo(str("Lid outer        : ", L_ox, " x ", L_oy, " x ", L_hz));
echo(str("Assembled height : ", Oz + t));
echo(str("--- CUT LIST (", t, " mm acrylic) ---"));
echo(str("  Bottom         : ", Ox, " x ", Oy, "   x1"));
echo(str("  Front/back wall: ", Ox, " x ", Iz, "   x2"));
echo(str("  Left/right wall: ", Iy, " x ", Iz, "   x2"));
echo(str("  Lid top        : ", L_ox, " x ", L_oy, "   x1"));
echo(str("  Lid skirt F/B  : ", L_ox, " x ", SKIRT, "   x2"));
echo(str("  Lid skirt L/R  : ", L_iy, " x ", SS, "   x2"));
echo(str("  Magnet pockets : d", MAG_DIA, " x ", MAG_DEPTH, " deep, ",
         4*MAG_PER_WALL, " off, ", MAG_INSET, " mm below the rim"));

// symmetric magnet centre offsets along each wall
function offsets() =
  MAG_PER_WALL <= 1 ? [0]
  : [ for (i = [0 : MAG_PER_WALL-1])
        i*MAG_SPREAD - MAG_SPREAD*(MAG_PER_WALL-1)/2 ];

// magnet centre height
mag_z_body = Oz - MAG_INSET;          // absolute
mag_z_lid  = SKIRT - MAG_INSET;       // local, "down from the skirt's top edge"

// ------------------------------------------------------------------ body ----
module body() {
  difference() {
    union() {
      // bottom panel: full footprint, the walls sit on top of it
      cube([Ox, Oy, t]);
      // four walls
      difference() {
        translate([0, 0, t]) cube([Ox, Oy, Iz]);
        translate([t, t, t - 0.01]) cube([Ix, Iy, Iz + 0.02]);
      }
    }

    if (MAG_ON) {
      for (o = offsets()) {
        // +X outer face of the right wall
        translate([Ox - MAG_DEPTH, Oy/2 + o, mag_z_body])
          rotate([0, 90, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
        // -X outer face of the left wall
        translate([MAG_DEPTH, Oy/2 + o, mag_z_body])
          rotate([0, -90, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
        // +Y outer face of the back wall
        translate([Ox/2 + o, Oy - MAG_DEPTH, mag_z_body])
          rotate([90, 0, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
        // -Y outer face of the front wall
        translate([Ox/2 + o, MAG_DEPTH, mag_z_body])
          rotate([-90, 0, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
      }
    }

    // optional finger scallop in the front top edge
    if (FINGER_NOTCH) {
      translate([Ox/2, 0, Oz]) rotate([-90, 0, 0])
        cylinder(d = NOTCH_DIA, h = NOTCH_DEPTH);
    }
  }
}

// ------------------------------------------------------------------- lid ----
// Local origin = bottom of the skirt.  Top panel occupies z = SKIRT .. SKIRT+t.
module lid() {
  difference() {
    union() {
      // skirt ring: front/back strips span the full width, side strips sit
      // between them (exactly the cut list in SPEC.md)
      difference() {
        cube([L_ox, L_oy, SKIRT]);
        translate([t, t, -0.01]) cube([L_ix, L_iy, SKIRT + 0.01]);
      }
      // top panel
      translate([0, 0, SKIRT]) cube([L_ox, L_oy, t]);
    }

    // trim the two side skirt strips down to SS (finger reveal)
    if (SS < SKIRT) {
      translate([-0.01, t - 0.01, -0.01]) cube([t + 0.02, L_iy + 0.02, SS + 0.01]);
      translate([L_ox - t - 0.01, t - 0.01, -0.01])
        cube([t + 0.02, L_iy + 0.02, SS + 0.01]);
    }

    if (MAG_ON) {
      for (o = offsets()) {
        // inner face of the left strip (-X)
        translate([t, L_oy/2 + o, mag_z_lid])
          rotate([0, -90, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
        // inner face of the right strip (+X)
        translate([L_ox - t, L_oy/2 + o, mag_z_lid])
          rotate([0, 90, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
        // inner face of the front strip (-Y)
        translate([L_ox/2 + o, t, mag_z_lid])
          rotate([-90, 0, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
        // inner face of the back strip (+Y)
        translate([L_ox/2 + o, L_oy - t, mag_z_lid])
          rotate([90, 0, 0]) cylinder(d = MAG_DIA, h = MAG_DEPTH + 1);
      }
    }
  }
}

// ---------------------------------------------------------------- magnets ---
module magnets() {
  color("crimson") for (o = offsets()) {
    translate([Ox - MAG_DEPTH/2, Oy/2 + o, mag_z_body])
      rotate([0, 90, 0]) cylinder(d = 5.8, h = 1.8, center = true);
    translate([MAG_DEPTH/2, Oy/2 + o, mag_z_body])
      rotate([0, 90, 0]) cylinder(d = 5.8, h = 1.8, center = true);
    translate([Ox/2 + o, Oy - MAG_DEPTH/2, mag_z_body])
      rotate([90, 0, 0]) cylinder(d = 5.8, h = 1.8, center = true);
    translate([Ox/2 + o, MAG_DEPTH/2, mag_z_body])
      rotate([-90, 0, 0]) cylinder(d = 5.8, h = 1.8, center = true);
  }
  color("royalblue") translate([0, 0, LID_Z + EXPLODE]) for (o = offsets()) {
    translate([t + MAG_DEPTH/2, L_oy/2 + o, mag_z_lid])
      rotate([0, 90, 0]) cylinder(d = 5.8, h = 1.8, center = true);
    translate([L_ox - t - MAG_DEPTH/2, L_oy/2 + o, mag_z_lid])
      rotate([0, 90, 0]) cylinder(d = 5.8, h = 1.8, center = true);
    translate([L_ox/2 + o, t + MAG_DEPTH/2, mag_z_lid])
      rotate([90, 0, 0]) cylinder(d = 5.8, h = 1.8, center = true);
    translate([L_ox/2 + o, L_oy - t - MAG_DEPTH/2, mag_z_lid])
      rotate([-90, 0, 0]) cylinder(d = 5.8, h = 1.8, center = true);
  }
}

// -------------------------------------------------------------- assembly ----
module ghost_box() {
  color("orange", 0.25)
    translate([t + FIT, t + FIT, t + FIT]) cube([BOX_W, BOX_D, BOX_H]);
}

body();
if (SHOW_MAGNETS) magnets();
if (SHOW_GHOST)  ghost_box();
if (SHOW_LID) translate([0, 0, LID_Z + EXPLODE]) lid();

