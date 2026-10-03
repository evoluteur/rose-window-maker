// Rose Window Maker -- Gothic tracery built with compass and straightedge.
//
// A window is a recipe: a list of steps, each one a construction a mason
// could do on the tracing floor with a compass, a straightedge and a cord
// (strike a circle, divide it, raise an equilateral arch, set foils in a
// circle). Every step is drawn once in one sector and repeated around the
// center, which gives the radial symmetry. Steps can be added, tuned,
// removed, scrubbed through, or played back as the mason would draw them.
//
// Geometry is in units of the window's radius, with y pointing up and the
// first sector's axis straight up. Angles are in radians, counterclockwise.

const S = 800, C = S / 2, SC = 368; // drawing size, center, pixels per unit
const TAU = Math.PI * 2;

const PALETTES = {
  chartres: { name: "Chartres blue", glass: ["#1b3d8c", "#b3202e", "#e0a526", "#2f63c0", "#2a6b3f", "#8a2a6b", "#c75b21", "#3f86c9"] },
  ruby: { name: "Ruby", glass: ["#8e1b24", "#1d3f8f", "#d8a32a", "#c22f3a", "#1f6b5b", "#5b2a7a", "#e07b25", "#2d5fae"] },
  grisaille: { name: "Grisaille", glass: ["#c3c9b8", "#e6e3d3", "#9fb09b", "#d9d2b5", "#b2c0c4", "#ece2c8", "#a7b39f", "#d0c7a4"] },
  amber: { name: "Amber", glass: ["#b8661c", "#e8b23a", "#8e3b16", "#f0d27a", "#6b4a1e", "#d98a2b", "#fff1b8", "#a55a1a"] },
};
const VIEWS = { glass: { name: "Glass" }, drawing: { name: "Drawing" } };
const CONS = { none: { name: "None" }, current: { name: "Current step" }, all: { name: "All" } };
const DIVS = [3, 4, 5, 6, 8, 9, 10, 12, 16, 18, 24];
const FOIL_NAMES = { 3: "trefoil", 4: "quatrefoil", 5: "cinquefoil", 6: "sexfoil", 7: "septfoil", 8: "octofoil" };

// Each step type: its name, default parameters, the controls of its card
// ([key, label, min, max] for a slider in %, [key, label] for a checkbox),
// and how heavy its stone bars are.
const TYPES = {
  frame: { name: "Window circle", w: 1.8, def: {} , ctl: [] },
  ring: { name: "Ring", w: 1, def: { r: 30, fill: true }, ctl: [["r", "Radius", 5, 95], ["fill", "Glass of its own"]] },
  spokes: { name: "Spokes", w: 1, def: { r1: 30, r2: 100, offset: false }, ctl: [["r1", "From", 0, 95], ["r2", "To", 10, 100], ["offset", "Between the divisions"]] },
  lancets: { name: "Lancets", w: 1, def: { r1: 30, r2: 62, width: 80, offset: false }, ctl: [["r1", "Foot", 0, 90], ["r2", "Point of the arch", 15, 100], ["width", "Width", 30, 100], ["offset", "Between the divisions"]] },
  twin: { name: "Twin lights", w: 0.7, def: {}, ctl: [] },
  oculi: { name: "Oculi", w: 0.8, def: { r: 98, size: 100, double: false, offset: true }, ctl: [["r", "Touching the circle at", 20, 100], ["size", "Size", 40, 100], ["double", "Twice as many"], ["offset", "Between the divisions"]] },
  foils: { name: "Foils", w: 0.6, def: { k: 4, cusp: 15, turn: false }, ctl: [["k", "Lobes", 3, 8, 1], ["cusp", "Cusps", 0, 40], ["turn", "Turn half a lobe"]] },
  petals: { name: "Petals", w: 0.7, def: { r1: 30, r2: 70, width: 70, offset: false }, ctl: [["r1", "From", 0, 95], ["r2", "To", 10, 100], ["width", "Width", 20, 100], ["offset", "Between the divisions"]] },
};
const ADDABLE = ["ring", "spokes", "lancets", "twin", "oculi", "foils", "petals"];

const step = (type, p = {}) => ({ type, ...TYPES[type].def, ...p });
const PRESETS = {
  chartres: {
    name: "Twelve lights",
    n: 12,
    steps: [step("frame"), step("ring", { r: 27 }), step("foils", { k: 6, cusp: 20 }), step("lancets", { r1: 27, r2: 63, width: 86 }), step("twin"), step("foils", { k: 3, cusp: 18, turn: true }), step("oculi", { r: 98, offset: true }), step("foils", { k: 4, cusp: 15 })],
  },
  wheel: {
    name: "Wheel",
    n: 8,
    steps: [step("frame"), step("ring", { r: 20 }), step("foils", { k: 4, cusp: 20, turn: true }), step("spokes", { r1: 20, r2: 100, offset: true }), step("lancets", { r1: 20, r2: 92, width: 92 }), step("twin"), step("foils", { k: 4, cusp: 10 })],
  },
  rosette: {
    name: "Rosette",
    n: 6,
    steps: [step("frame"), step("oculi", { r: 98, offset: false }), step("foils", { k: 3, cusp: 20, turn: true }), step("ring", { r: 31 }), step("foils", { k: 6, cusp: 22 }), step("petals", { r1: 31, r2: 56, width: 55, offset: true })],
  },
  petals: {
    name: "Flower",
    n: 16,
    steps: [step("frame"), step("ring", { r: 22 }), step("foils", { k: 8, cusp: 25 }), step("petals", { r1: 22, r2: 70, width: 80 }), step("ring", { r: 72, fill: false }), step("oculi", { r: 98, size: 92, offset: true }), step("foils", { k: 4, cusp: 12 })],
  },
  blank: { name: "Blank", n: 12, steps: [step("frame")] },
};

const opts = { n: 12, palette: "chartres", view: "glass", cons: "current", stone: 45, speed: 5 };
let steps = PRESETS.chartres.steps.map((s) => ({ ...s }));
let cur = steps.length - 1; // the step shown last (scrubbing)
let built = []; // geometry of each step
let anim = null;

const $e = (id) => document.getElementById(id);

// ---------------------------------------------------------------- geometry helpers

const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const scr = (x, y) => [C + x * SC, C - y * SC];
const f1 = (v) => Math.round(v * 100) / 100;
const pol = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const copies = (count, offset = 0) => Array.from({ length: count }, (_, k) => offset + (k * TAU) / count);

// A shape is a list of commands in local coordinates: ["M", x, y],
// ["L", x, y], ["A", cx, cy, r, a0, a1] (an arc from angle a0 to a1 around
// a center), ["O", cx, cy, r] (a whole circle), ["Z"]. emit() turns it into
// SVG path data, rotated by angle a.
function emit(cmds, a = 0) {
  let d = "";
  const pt = (x, y) => {
    const [X, Y] = scr(...rot(x, y, a));
    return `${f1(X)} ${f1(Y)}`;
  };
  for (const c of cmds) {
    if (c[0] === "M" || c[0] === "L") d += c[0] + pt(c[1], c[2]);
    else if (c[0] === "Z") d += "Z";
    else if (c[0] === "A") {
      const [, cx, cy, r, a0, a1] = c;
      const delta = a1 - a0;
      // counterclockwise here looks counterclockwise on screen too, which is
      // SVG's negative direction (its y axis points down): sweep flag 0
      d += `A${f1(r * SC)} ${f1(r * SC)} 0 ${Math.abs(delta) > Math.PI ? 1 : 0} ${delta > 0 ? 0 : 1} ${pt(cx + r * Math.cos(a1), cy + r * Math.sin(a1))}`;
    } else if (c[0] === "O") {
      const [, cx, cy, r] = c;
      const R = f1(r * SC);
      d += `M${pt(cx + r, cy)}A${R} ${R} 0 1 1 ${pt(cx - r, cy)}A${R} ${R} 0 1 1 ${pt(cx + r, cy)}Z`;
    }
  }
  return d;
}

// ---------------------------------------------------------------- the steps

// Builds every step in order. Each returns shapes ({ cmds, at: [angles],
// fill }), construction marks for the first sector (circles, arcs, lines,
// compass points), what it leaves for the next steps (circles for foils,
// lights for twin lights), and the mason's instruction.
function buildAll() {
  const n = opts.n;
  const half = Math.PI / n;
  let circles = null, lights = null;
  built = steps.map((s, i) => {
    const out = { shapes: [], cons: [], text: "", fill: i };
    const P = (v) => v / 100;
    const at = (offset, count = n) => copies(count, offset ? (TAU / count) / 2 : 0);
    if (s.type === "frame") {
      out.shapes.push({ cmds: [["O", 0, 0, 1]], at: [0], fill: true });
      out.cons.push({ c: "circle", x: 0, y: 0, r: 1 }, { c: "pt", x: 0, y: 0 });
      for (const a of copies(n)) out.cons.push({ c: "pt", x: -Math.sin(a), y: Math.cos(a) });
      out.text = `Drive a peg at the center and, with a cord, strike the circle of the window. Step the compass around it to divide it into ${n} equal parts.`;
    } else if (s.type === "ring") {
      const r = P(s.r);
      out.shapes.push({ cmds: [["O", 0, 0, r]], at: [0], fill: s.fill });
      out.cons.push({ c: "circle", x: 0, y: 0, r }, { c: "pt", x: 0, y: 0 });
      circles = [{ x: 0, y: 0, r, dir: Math.PI / 2 }];
      out.text = `With the compass point on the center, strike a circle at ${s.r}% of the radius.`;
    } else if (s.type === "spokes") {
      const r1 = P(Math.min(s.r1, s.r2)), r2 = P(Math.max(s.r1, s.r2));
      out.shapes.push({ cmds: [["M", 0, r1], ["L", 0, r2]], at: at(s.offset) });
      const a0 = s.offset ? half : 0;
      out.cons.push({ c: "line", x1: Math.sin(a0) * 1.04, y1: -Math.cos(a0) * 1.04, x2: -Math.sin(a0) * 1.04, y2: Math.cos(a0) * 1.04 });
      out.text = `With the straightedge, draw the ${n} spokes from the center through the divisions${s.offset ? ", halfway between them" : ""}.`;
    } else if (s.type === "lancets") {
      // a light between two radii, closed by an equilateral arch: each arc is
      // centered on the opposite springing point, with the span as radius
      const phi = half * P(s.width);
      const r1 = P(s.r1);
      let rs = P(s.r2) / (Math.cos(phi) + Math.sqrt(3) * Math.sin(phi));
      rs = Math.max(rs, r1 + 0.02);
      const a = rs * Math.sin(phi), b = rs * Math.cos(phi);
      const L = [-a, b], R = [a, b], top = [0, b + Math.sqrt(3) * a];
      const cmds = [
        ["M", -r1 * Math.sin(phi), r1 * Math.cos(phi)],
        ["L", ...L],
        ["A", ...R, 2 * a, Math.PI, (2 * Math.PI) / 3],
        ["A", ...L, 2 * a, Math.PI / 3, 0],
        ["L", r1 * Math.sin(phi), r1 * Math.cos(phi)],
        ...(r1 > 0.001 ? [["A", 0, 0, r1, Math.PI / 2 - phi, Math.PI / 2 + phi]] : []),
        ["Z"],
      ];
      const angles = at(s.offset);
      out.shapes.push({ cmds, at: angles, fill: true });
      const o = angles[0];
      const c = (x, y) => rot(x, y, o);
      out.cons.push(
        { c: "arc", x: c(...R)[0], y: c(...R)[1], r: 2 * a, a0: Math.PI + o + 0.08, a1: Math.PI / 2 + o - 0.15 },
        { c: "arc", x: c(...L)[0], y: c(...L)[1], r: 2 * a, a0: o - 0.08, a1: Math.PI / 2 + o + 0.15 },
        { c: "line", x1: c(-a * 1.3, b)[0], y1: c(-a * 1.3, b)[1], x2: c(a * 1.3, b)[0], y2: c(a * 1.3, b)[1] },
        { c: "line", x1: 0, y1: 0, x2: c(...top)[0], y2: c(...top)[1] },
        { c: "pt", x: c(...L)[0], y: c(...L)[1] },
        { c: "pt", x: c(...R)[0], y: c(...R)[1] },
      );
      lights = { phi, r1, a, b, angles };
      out.text = `In each of the ${n} sectors, draw a light with straight sides. Open the compass to its width and, from each springing point, strike an arc through the other: they meet at the point of an equilateral arch, the Gothic arch.`;
    } else if (s.type === "twin") {
      if (!lights) {
        out.text = "Twin lights divide lancets in two: add lancets before this step.";
        return out;
      }
      const { phi, r1, a, b, angles } = lights;
      const L = [-a, b], R = [a, b], M = [0, b];
      const left = [
        ["M", 0, r1],
        ...(r1 > 0.001 ? [["A", 0, 0, r1, Math.PI / 2, Math.PI / 2 + phi]] : [["L", 0, 0]]),
        ["L", ...L],
        ["A", ...M, a, Math.PI, (2 * Math.PI) / 3],
        ["A", ...L, a, Math.PI / 3, 0],
        ["Z"],
      ];
      const right = [
        ["M", 0, r1],
        ["L", ...M],
        ["A", ...R, a, Math.PI, (2 * Math.PI) / 3],
        ["A", ...M, a, Math.PI / 3, 0],
        ["L", r1 * Math.sin(phi), r1 * Math.cos(phi)],
        ...(r1 > 0.001 ? [["A", 0, 0, r1, Math.PI / 2 - phi, Math.PI / 2]] : [["L", 0, 0]]),
        ["Z"],
      ];
      // the circle touching the big arch and both small ones: the big arch
      // (radius 2a) and the inner small arch (radius a) share their center,
      // so the circle has radius a/2 and its center is 1.5a from it
      const oc = [0, b + (a * Math.sqrt(5)) / 2];
      out.shapes.push({ cmds: left, at: angles, fill: true }, { cmds: right, at: angles, fill: true, alt: true });
      out.shapes.push({ cmds: [["O", ...oc, a / 2]], at: angles, fill: true, alt2: true });
      const o = angles[0];
      const c = (x, y) => rot(x, y, o);
      out.cons.push(
        { c: "arc", x: c(...R)[0], y: c(...R)[1], r: 1.5 * a, a0: Math.PI + o - 0.1, a1: (2 * Math.PI) / 3 + o - 0.25 },
        { c: "circle", x: c(...oc)[0], y: c(...oc)[1], r: a / 2 },
        { c: "pt", x: c(...R)[0], y: c(...R)[1] },
        { c: "pt", x: c(...M)[0], y: c(...M)[1] },
        { c: "pt", x: c(...oc)[0], y: c(...oc)[1] },
      );
      circles = angles.map((g) => {
        const [x, y] = rot(...oc, g);
        return { x, y, r: a / 2, dir: Math.atan2(y, x) };
      });
      out.text = "Divide each light with a mullion and arch each half the same way, the compass opened to half the width. Then, from a springing point, strike an arc of one and a half half-widths to the axis: there is the center of a circle that touches all three arches.";
    } else if (s.type === "oculi") {
      const count = n * (s.double ? 2 : 1);
      const r = P(s.r);
      const sn = Math.sin(Math.PI / count);
      const rho0 = (r * sn) / (1 + sn); // circles touching each other and the outer circle
      const rho = rho0 * P(s.size), cr = r - rho;
      const angles = copies(count, s.offset ? Math.PI / count : 0);
      out.shapes.push({ cmds: [["O", 0, cr, rho]], at: angles, fill: true });
      const o = angles[0];
      const [x0, y0] = rot(0, cr, o);
      out.cons.push({ c: "circle", x: 0, y: 0, r: cr }, { c: "circle", x: 0, y: 0, r }, { c: "pt", x: x0, y: y0 });
      circles = angles.map((g) => {
        const [x, y] = rot(0, cr, g);
        return { x, y, r: rho, dir: Math.atan2(y, x) };
      });
      out.text = `Set out ${count} circles that touch each other and the circle at ${s.r}%: strike the circle of their centers, then step around it. Their radius is r·sin(π/${count}) / (1 + sin(π/${count})).`;
    } else if (s.type === "foils") {
      if (!circles) {
        out.text = "Foils are set inside circles: add a ring, oculi or twin lights before this step.";
        return out;
      }
      const k = s.k, sk = Math.sin(Math.PI / k);
      const cusp = P(s.cusp);
      for (const ci of circles) {
        // k lobes touching the circle from inside and cutting each other
        const d = (ci.r * 0.86) / (1 + sk * (1 + cusp));
        const f = d * sk * (1 + cusp);
        const base = ci.dir + (s.turn ? Math.PI / k : 0);
        const th = (j) => base + (j * TAU) / k;
        const t = d * Math.cos(Math.PI / k) + Math.sqrt(Math.max(0, f * f - d * d * sk * sk));
        const cuspPt = (j) => [ci.x + t * Math.cos(th(j) + Math.PI / k), ci.y + t * Math.sin(th(j) + Math.PI / k)];
        const lobe = (j) => [ci.x + d * Math.cos(th(j)), ci.y + d * Math.sin(th(j))];
        const cmds = [["M", ...cuspPt(k - 1)]];
        for (let j = 0; j < k; j++) {
          const [lx, ly] = lobe(j);
          const [px, py] = cuspPt(j - 1), [qx, qy] = cuspPt(j);
          const a0 = Math.atan2(py - ly, px - lx);
          let a1 = Math.atan2(qy - ly, qx - lx);
          while (a1 <= a0) a1 += TAU;
          cmds.push(["A", lx, ly, f, a0, a1]);
        }
        cmds.push(["Z"]);
        out.shapes.push({ cmds, at: [0], fill: true });
      }
      const c0 = circles[0];
      const dd = (c0.r * 0.86) / (1 + sk * (1 + cusp)), ff = dd * sk * (1 + cusp);
      out.cons.push({ c: "circle", x: c0.x, y: c0.y, r: dd }, { c: "pt", x: c0.x, y: c0.y });
      for (let j = 0; j < k; j++) {
        const g = c0.dir + (s.turn ? Math.PI / k : 0) + (j * TAU) / k;
        out.cons.push({ c: "circle", x: c0.x + dd * Math.cos(g), y: c0.y + dd * Math.sin(g), r: ff, faint: true });
      }
      out.text = `Inside each circle, set ${k} smaller circles that touch it from inside and cut each other. Their outer arcs make a ${FOIL_NAMES[k]}, and the points where they meet are the cusps.`;
      circles = null; // foils are not circles: the next foils need a new circle step
    } else if (s.type === "petals") {
      const r1 = P(Math.min(s.r1, s.r2)), r2 = P(Math.max(s.r1, s.r2) + 0.001);
      const l = (r2 - r1) / 2, rm = (r1 + r2) / 2;
      const sw = Math.max(0.005, P(s.width) * Math.min(l * 0.9, rm * Math.sin(half) * 0.95));
      const rho = (l * l + sw * sw) / (2 * sw), e = rho - sw;
      const beta = Math.atan2(l, e);
      const cmds = [["M", 0, r1], ["A", -e, rm, rho, -beta, beta], ["A", e, rm, rho, Math.PI - beta, Math.PI + beta], ["Z"]];
      const angles = at(s.offset);
      out.shapes.push({ cmds, at: angles, fill: true });
      const o = angles[0];
      const c = (x, y) => rot(x, y, o);
      out.cons.push(
        { c: "circle", x: c(-e, rm)[0], y: c(-e, rm)[1], r: rho, faint: true },
        { c: "circle", x: c(e, rm)[0], y: c(e, rm)[1], r: rho, faint: true },
        { c: "pt", x: c(-e, rm)[0], y: c(-e, rm)[1] },
        { c: "pt", x: c(e, rm)[0], y: c(e, rm)[1] },
      );
      out.text = `On each of the ${n} axes, strike two arcs of the same radius through the points at ${Math.round(r1 * 100)}% and ${Math.round(r2 * 100)}%: a pointed oval, the vesica, like a petal.`;
    }
    return out;
  });
}

// ---------------------------------------------------------------- drawing

function consMarkup(c) {
  if (c.c === "pt") {
    const [X, Y] = scr(c.x, c.y);
    return `<circle class="pt" cx="${f1(X)}" cy="${f1(Y)}" r="3.2"/>`;
  }
  const cls = c.faint ? ' class="faint"' : "";
  if (c.c === "circle") {
    const [X, Y] = scr(c.x, c.y);
    return `<circle${cls} cx="${f1(X)}" cy="${f1(Y)}" r="${f1(c.r * SC)}" pathLength="1"/>`;
  }
  if (c.c === "line") {
    const [X1, Y1] = scr(c.x1, c.y1), [X2, Y2] = scr(c.x2, c.y2);
    return `<line${cls} x1="${f1(X1)}" y1="${f1(Y1)}" x2="${f1(X2)}" y2="${f1(Y2)}" pathLength="1"/>`;
  }
  // an arc
  const d = emit([["M", c.x + c.r * Math.cos(c.a0), c.y + c.r * Math.sin(c.a0)], ["A", c.x, c.y, c.r, c.a0, c.a1]]);
  return `<path${cls} d="${d}" pathLength="1"/>`;
}

function svgMarkup(forExport) {
  buildAll();
  const pal = PALETTES[opts.palette].glass;
  const glassView = opts.view === "glass";
  const w0 = 3 + (opts.stone / 100) * 13; // stone bar width in pixels, for a weight of 1
  const ink = "#3a2a1e";
  const last = forExport ? steps.length - 1 : cur;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}"${forExport ? "" : ' class="plain"'}>`;
  s += `<defs>
    <radialGradient id="wall" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#3a342d"/><stop offset="1" stop-color="#1c1915"/></radialGradient>
    <radialGradient id="glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.6" stop-color="#fff" stop-opacity="0.06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <filter id="mottle" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="n"/><feColorMatrix in="n" type="saturate" values="0" result="g"/><feComponentTransfer in="g" result="t"><feFuncR type="linear" slope="0.9" intercept="0.45"/><feFuncG type="linear" slope="0.9" intercept="0.45"/><feFuncB type="linear" slope="0.9" intercept="0.45"/></feComponentTransfer><feBlend in="SourceGraphic" in2="t" mode="multiply" result="b"/><feComposite in="b" in2="SourceAlpha" operator="in"/></filter>
  </defs>`;
  s += glassView ? `<rect width="${S}" height="${S}" fill="url(#wall)"/>` : `<rect width="${S}" height="${S}" fill="#efe7d4"/>`;

  // glass, in the order of the steps
  if (glassView) {
    s += `<g id="glass" filter="url(#mottle)">`;
    built.forEach((b, i) => {
      if (i > last) return;
      s += `<g class="s-glass" data-i="${i}">`;
      for (const sh of b.shapes) {
        if (!sh.fill) continue;
        const col = pal[(i + (sh.alt ? 3 : 0) + (sh.alt2 ? 1 : 0)) % pal.length];
        s += `<path d="${sh.at.map((a) => emit(sh.cmds, a)).join("")}" fill="${col}"/>`;
      }
      s += "</g>";
    });
    s += `</g><circle cx="${C}" cy="${C}" r="${SC}" fill="url(#glow)"/>`;
  }
  // stone bars: a dark joint, then the stone (or, on the drawing, ink and paper)
  const edge = glassView ? "#2a231b" : ink, stone = glassView ? "#cbbd9f" : "#efe7d4";
  s += `<g id="bars" fill="none" stroke-linejoin="round" stroke-linecap="round">`;
  built.forEach((b, i) => {
    if (i > last) return;
    const w = w0 * TYPES[steps[i].type].w;
    const d = b.shapes.map((sh) => sh.at.map((a) => emit(sh.cmds, a)).join("")).join("");
    if (!d) return;
    s += `<g class="s-bars" data-i="${i}"><path d="${d}" stroke="${edge}" stroke-width="${f1(w + (glassView ? 3 : 2.4))}"/><path d="${d}" stroke="${stone}" stroke-width="${f1(w)}"/></g>`;
  });
  s += "</g>";
  // the compass work
  if (!forExport && opts.cons !== "none") {
    s += `<g id="cons" class="${glassView ? "on-glass" : "on-paper"}">`;
    built.forEach((b, i) => {
      if (i > last || (opts.cons === "current" && i !== last)) return;
      s += `<g class="s-cons${i === last ? " now" : ""}" data-i="${i}">${b.cons.map(consMarkup).join("")}</g>`;
    });
    s += "</g>";
  }
  return s + "</svg>";
}

function render() {
  stopAnim();
  $e("rose").innerHTML = svgMarkup(false);
  renderSteps();
  renderCaption();
  writeUrl();
}

function renderCaption(i = cur) {
  const b = built[i];
  $e("step-num").textContent = `Step ${i + 1} of ${steps.length}`;
  $e("step-title").textContent = TYPES[steps[i].type].name;
  $e("step-text").textContent = b.text;
  $e("scrub").max = steps.length;
  $e("scrub").value = i + 1;
}

// ---------------------------------------------------------------- the recipe

function renderSteps() {
  const box = $e("steps");
  box.innerHTML = steps
    .map((s, i) => {
      const T = TYPES[s.type];
      const ctl = T.ctl
        .map(([key, label, min, max, unit]) => {
          if (min === undefined)
            return `<label class="opt"><input type="checkbox" data-i="${i}" data-k="${key}"${s[key] ? " checked" : ""}/> ${label}</label>`;
          const val = unit ? s[key] : `${s[key]}%`;
          return `<div class="ctl"><label>${label}</label><span class="val">${val}</span><input type="range" data-i="${i}" data-k="${key}" min="${min}" max="${max}" step="1" value="${s[key]}"/></div>`;
        })
        .join("");
      return `<div class="step${i === cur ? " sel" : ""}${i > cur ? " later" : ""}" data-i="${i}">
        <div class="step-head"><button type="button" class="step-name" data-pick="${i}">${i + 1}. ${T.name}</button>${
          i > 0 ? `<button type="button" class="step-del" data-del="${i}" title="Remove this step" aria-label="Remove step ${i + 1}">&#x2715;</button>` : ""
        }</div>${i === cur ? ctl : ""}</div>`;
    })
    .join("");
}
function onStepsClick(e) {
  const pick = e.target.closest("[data-pick]");
  const del = e.target.closest("[data-del]");
  if (del) {
    const i = +del.dataset.del;
    steps.splice(i, 1);
    cur = Math.min(Math.max(1, i - 1), steps.length - 1);
    if (steps.length === 1) cur = 0;
    render();
  } else if (pick) {
    cur = +pick.dataset.pick;
    render();
  }
}
function onStepsInput(e) {
  const t = e.target;
  if (!t.dataset.k) return;
  const s = steps[+t.dataset.i];
  s[t.dataset.k] = t.type === "checkbox" ? t.checked : +t.value;
  if (t.type === "range") {
    const T = TYPES[s.type].ctl.find((c) => c[0] === t.dataset.k);
    t.previousElementSibling.textContent = T[4] ? s[t.dataset.k] : `${s[t.dataset.k]}%`;
  }
  // redraw the window only, so the slider keeps the focus
  stopAnim();
  $e("rose").innerHTML = svgMarkup(false);
  renderCaption();
  writeUrl();
}
function addStep(type) {
  steps.splice(cur + 1, 0, step(type, defaultsFor(type)));
  cur++;
  render();
}
// sensible starting values from what is already there
function defaultsFor(type) {
  const prevRing = [...steps.slice(0, cur + 1)].reverse().find((s) => s.type === "ring");
  const r = prevRing ? prevRing.r : 30;
  if (type === "lancets") return { r1: r, r2: Math.min(95, r + 35) };
  if (type === "spokes" || type === "petals") return { r1: r };
  if (type === "ring") return { r: Math.min(90, r + 25), fill: !prevRing };
  return {};
}

// ---------------------------------------------------------------- build it, step by step

function stopAnim() {
  if (anim) cancelAnimationFrame(anim.raf);
  anim = null;
  const b = $e("build");
  if (b) b.textContent = "Build it";
}
// Plays the recipe: for each step the compass work draws itself, then the
// stone and the glass appear.
function build() {
  if (anim) {
    stopAnim();
    cur = steps.length - 1;
    render();
    return;
  }
  const keepCons = opts.cons;
  if (opts.cons === "none") opts.cons = "all";
  cur = steps.length - 1;
  $e("rose").innerHTML = svgMarkup(false);
  opts.cons = keepCons;
  const root = $e("rose");
  const groups = (cls) => [...root.querySelectorAll(`.${cls}`)];
  const all = [...groups("s-glass"), ...groups("s-bars"), ...groups("s-cons")];
  all.forEach((g) => (g.style.opacity = 0));
  $e("build").textContent = "Stop";
  const dur = 3200 / (0.5 + opts.speed / 3);
  let i = 0, t0 = performance.now();
  anim = {};
  const frame = (now) => {
    let t = (now - t0) / dur;
    if (t >= 1) {
      i++;
      t0 = now;
      t = 0;
      if (i >= steps.length) {
        stopAnim();
        cur = steps.length - 1;
        render();
        return;
      }
    }
    renderCaption(i);
    const q = (cls) => root.querySelector(`.${cls}[data-i="${i}"]`);
    const cons = q("s-cons"), bars = q("s-bars"), glass = q("s-glass");
    // the construction of earlier steps fades out, the current one draws in
    root.querySelectorAll(".s-cons").forEach((g) => {
      const j = +g.dataset.i;
      if (j < i) g.style.opacity = keepCons === "all" ? 0.5 : Math.max(0, +g.style.opacity - 0.05);
    });
    if (cons) {
      cons.style.opacity = 1;
      const draw = Math.min(1, t / 0.55);
      cons.querySelectorAll("[pathLength]").forEach((el) => {
        el.style.strokeDasharray = "1 1";
        el.style.strokeDashoffset = 1 - draw;
      });
      cons.querySelectorAll(".pt").forEach((el) => (el.style.opacity = draw));
    }
    const show = Math.max(0, Math.min(1, (t - 0.5) / 0.35));
    if (bars) bars.style.opacity = show;
    if (glass) glass.style.opacity = Math.max(0, Math.min(1, (t - 0.65) / 0.3));
    anim.raf = requestAnimationFrame(frame);
  };
  anim.raf = requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- the window in the address

function writeUrl() {
  const data = { n: opts.n, s: steps.map((s) => ({ ...s })) };
  try {
    history.replaceState(null, "", "#w=" + btoa(JSON.stringify(data)).replace(/=+$/, ""));
  } catch (e) {}
}
function readUrl() {
  const m = location.hash.match(/w=([A-Za-z0-9+/]+)/);
  if (!m) return false;
  try {
    const data = JSON.parse(atob(m[1]));
    const ok = data.s.every((s) => TYPES[s.type]) && data.s[0].type === "frame";
    if (!ok || !DIVS.includes(data.n)) return false;
    opts.n = data.n;
    steps = data.s.map((s) => ({ ...TYPES[s.type].def, ...s }));
    cur = steps.length - 1;
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------- controls

const LS = "rose-window-maker";
function saveSettings() {
  try {
    const { palette, view, cons, stone, speed } = opts;
    localStorage.setItem(LS, JSON.stringify({ palette, view, cons, stone, speed }));
  } catch (e) {}
}
function loadSettings() {
  try {
    Object.assign(opts, JSON.parse(localStorage.getItem(LS)) || {});
  } catch (e) {}
  if (!PALETTES[opts.palette]) opts.palette = "chartres";
  if (!VIEWS[opts.view]) opts.view = "glass";
  if (!CONS[opts.cons]) opts.cons = "current";
}
function chips(id, items, key, onPick) {
  const el = $e(id);
  const sel = (k) => (key ? ` aria-pressed="${String(opts[key]) === String(k)}"` : "");
  el.innerHTML = Object.entries(items)
    .map(([k, v]) => `<button type="button" data-k="${k}"${sel(k)}>${v.name}</button>`)
    .join("");
  el.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (key) {
      opts[key] = isNaN(+b.dataset.k) ? b.dataset.k : +b.dataset.k;
      el.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    }
    onPick(b.dataset.k);
  };
}
function syncDivs() {
  $e("div-chips").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", +x.dataset.k === opts.n));
}

function download(name, href) {
  const a = document.createElement("a");
  a.download = name;
  a.href = href;
  a.click();
}
function saveSvg() {
  download("rose-window.svg", URL.createObjectURL(new Blob([svgMarkup(true)], { type: "image/svg+xml" })));
}
function savePng() {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 2000;
    c.getContext("2d").drawImage(img, 0, 0, 2000, 2000);
    download("rose-window.png", c.toDataURL("image/png"));
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup(true));
}

function initRose() {
  loadSettings();
  readUrl();
  chips("preset-chips", Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, { name: v.name }])), null, (k) => {
    opts.n = PRESETS[k].n;
    steps = PRESETS[k].steps.map((s) => ({ ...s }));
    cur = steps.length - 1;
    syncDivs();
    render();
  });
  chips("div-chips", Object.fromEntries(DIVS.map((d) => [d, { name: String(d) }])), "n", render);
  chips("palette-chips", PALETTES, "palette", () => (saveSettings(), render()));
  chips("view-chips", VIEWS, "view", () => (saveSettings(), render()));
  chips("cons-chips", CONS, "cons", () => (saveSettings(), render()));
  $e("add-chips").innerHTML = ADDABLE.map((t) => `<button type="button" data-k="${t}">+ ${TYPES[t].name}</button>`).join("");
  $e("add-chips").onclick = (e) => {
    const b = e.target.closest("button");
    if (b) addStep(b.dataset.k);
  };
  const stone = $e("stone");
  stone.value = opts.stone;
  stone.addEventListener("input", () => {
    opts.stone = +stone.value;
    saveSettings();
    $e("rose").innerHTML = svgMarkup(false);
  });
  const speed = $e("speed");
  speed.value = opts.speed;
  speed.addEventListener("input", () => ((opts.speed = +speed.value), saveSettings()));
  $e("scrub").addEventListener("input", (e) => {
    cur = +e.target.value - 1;
    render();
  });
  $e("prev").addEventListener("click", () => {
    cur = Math.max(0, cur - 1);
    render();
  });
  $e("next").addEventListener("click", () => {
    cur = Math.min(steps.length - 1, cur + 1);
    render();
  });
  $e("build").addEventListener("click", build);
  $e("steps").addEventListener("click", onStepsClick);
  $e("steps").addEventListener("input", onStepsInput);
  $e("export-png").addEventListener("click", savePng);
  $e("export-svg").addEventListener("click", saveSvg);
  render();
}
