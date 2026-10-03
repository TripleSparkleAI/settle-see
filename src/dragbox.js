// settle-see · dragbox - THE DRAG BOX (lane HERODRAG, navigator 2026-10-02: "When I click and drag on the hero, it
// must make a BOUNDING BOX, a pulsing one. When it is dropped, it makes FOUR, and they interact inside the rectangle
// for some short time, but the rectangle drawn disappears gradually over 4 to 7 seconds. Thus we have a single click
// and a drag type."). THE ESCAPE (lane HERODRAG2, navigator 2026-10-02: "the 4 pulses so powerful they continue for
// twice as long: after the rectangle disappears they go all their own way ... interference? ... the first part
// (inside the rectangle) is 20% of the time, and the escaped, mixed waves are 80% of the time"). The pure half: the
// gesture's rules, the rectangle, where the four are born, how they move inside, split, escape and interfere.
// mount.js wires it to the pointer and the lights; the page draws the rectangle itself (onDrag).
//
// <claudes_code_comments>
// ** Function List **
// DRAG                              - the numbers: threshold 6 px, touch long-press 300 ms, touch slop 10 px, four
//                                     children, a life of 5.6 s (+-10% per drag), 20% of it inside the box, at most
//                                     3 groups alive, a ring every 8 frames, at most 96 drag rings
// createDragGesture(cfg)            - the press state machine: idle -> pressed -> (armed) -> dragging
//   .down(p) .move(p) .tick(t) .up(p) .cancel() - each returns what happened ('click', 'drop', 'start', ...)
//   .state / .box() / .origin       - where it is, the rectangle from the press to the pointer, the press point
// rectFrom(a, b, bounds)            - the rectangle with corners a and b, clamped inside bounds: { x, y, w, h }
// dragTiming(r, fps, cfg)           - one drag's clock for r in [0, 1): { lifeMs, insideMs, fadeMs, lifeFrames,
//                                     insideFrames }; the box's fade IS the inside phase (insideShare of the life)
// dragFadeMs(r, cfg)                - the rectangle's fade alone: dragTiming(r).fadeMs
// placeChildren(box, n, rng)        - n children at spread spots inside box (the quadrant centres for four), each
//                                     moving round the box's centre
// stepChildren(kids, box, opts)     - one frame: repel early, attract late, swirl, bounce off the walls, merge on
//                                     touching; returns { kids, merges }. opts.room (boxes) widens the walls to the
//                                     room's union, opts.others (other boxes' twinkles) push as the pair force does
// splitChildren(kids, rng, cfg)     - THE FRACTAL TOUCH: each child becomes two of half the mass, heading apart
//                                     at +-spread from its course, each with its own steady turn (its own path)
// stepEscape(kids, bounds, opts)    - one escaped frame: turn, ease to the escape speed, bounce off the picture's
//                                     edges; no pull inside a group (each goes its own way), and opts.others (the
//                                     other boxes' escaped twinkles) bend its course toward them; ends at `life`
// createInterference(w, h)          - a reusable sum over the grid: .ring(spec) adds a crest (+amp at r) and a
//                                     trough (-0.7 amp at r - lambda / 2), each light counted once per ring, clipped;
//                                     .flush(fn) hands fn(index, sum) for every touched light and clears
// capList(list, max)                - drop the oldest beyond max
// boxesTouch(a, b, gap)             - two light boxes { x0, y0, x1, y1 } overlap (or come within gap)
// rooms(boxes)                      - THE ONE ROOM (lane MULTIRECT): a room number per box; boxes that overlap, directly
//                                     or through a chain of overlaps, share one number
// nudgeKids(kids, at, opts)         - THE NUDGE: each child's velocity kicked away from `at` by strength exp(-d / reach)
// createNoiseGate(opts)             - THE NOISE GATE: a token bucket; .take(nowMs) is true while a noise may sound
//
// ** Technical Review **
// - THE TWO GESTURES. A mouse or a pen: the press does nothing yet; moving `threshold` px (6) from it starts a drag;
//   a release before that is a CLICK at the press point, the same click the settle has always made (mount.js runs its
//   own click function with the press event). A drag released is a DROP. A non-primary button is not a gesture.
// - THE TOUCH RULE. A finger that moves past `touchSlop` (10 px) before `longPressMs` (300 ms) is a SCROLL: the
//   gesture gives up and the page scrolls as it always did. A finger held still for 300 ms is ARMED (tick() says so);
//   from then a move past the threshold drags and mount.js cancels the page's touch scrolling. A tap is a click, on
//   release. Why a long-press: a scroll starts moving within about 100 ms, so 300 ms of stillness is a deliberate
//   act, and it is shorter than the phones' own long-press menus (about 400 to 500 ms), which mount.js holds back
//   while armed.
// - THE CHILDREN live in light units. Each carries x, y, vx, vy, mass, age. Every frame: a pair force k m1 m2 / (d^2 +
//   soft), pushing apart for the first half of the life and pulling together after it; a swirl that turns each child
//   round the box's centre; a damping; then the walls, which reflect the velocity and clamp the child inside. Two
//   children closer than mergeR in the pulling half MERGE into one at their mass-weighted centre, carrying both
//   masses (merges lists where). A child dies at `life` frames. The rng is the caller's, so a test sees exact numbers.
// - THE TWO PHASES (HERODRAG2): a drag's life is DRAG.lifeS x (0.9 .. 1.1), twice the first version's 2.8 s. The
//   first insideShare (20%) is INSIDE: stepChildren inside the box, and the box's fade lasts exactly that long. Then
//   the box is gone and the rest (80%) is ESCAPED: every child splits once into two (the fractal touch, 4 -> 8), and
//   each goes its own way across the whole picture on a gently curving path, bouncing off its edges.
// - THE INTERFERENCE: each ring is two analytic circles, a crest and a trough half a wavelength behind it. Every
//   light a circle crosses gets the circle's amplitude ADDED into one scratch sum (each light once per ring). Where
//   two crests cross the sum doubles (brighter); where a crest meets a trough it cancels (the picture shows through);
//   mount.js holds a light ON or OFF by the sum's sign and strength. The cost is the rings' circumferences, the same
//   order as the click's rings: no per-light wave equation, no pass over the whole grid.
// - MANY BOXES (lane MULTIRECT, navigator 2026-10-04: "I want to be able to click and drag multiple! Don't cycle
//   colours! Just have MULTI RECTANGLES ability, one after another. And those can interact with each other too!").
//   Up to maxBoxes (10) live; an eleventh drops the oldest group, never the new one. Every box wears the one neon.
//   THE THREE INTERACTIONS, each a pure function here: (1) THE ONE ROOM: boxes in their inside phase that overlap form
//   one room (rooms()): its twinkles swirl round the room's centre (one vortex), wander through the overlap into the
//   neighbour, are reflected only where they would leave the room, and push each other as one group does. (2) THE NUDGE: a new box
//   kicks the twinkles already alive away from its centre (nudgeKids), strongest near it. (3) THE CROSS PULL: escaped
//   twinkles of different boxes bend toward each other (stepEscape's others), so their rings cross more; every ring
//   of every box is summed in ONE interference scratch, so crossings across boxes brighten or cancel. THE NOISE GATE
//   (createNoiseGate): a burst of drags plays at most noiseBurst noises, then noisePerSecond; the rest pulse silent.
// </claudes_code_comments>

export const DRAG = Object.freeze({
  threshold: 6, // CSS px a mouse or pen must move from the press before it is a drag
  touchSlop: 10, // CSS px a finger may wander while held before it counts as a scroll
  longPressMs: 300, // a finger held still this long arms the drag
  children: 4,
  maxBoxes: 10, // boxes alive at once (lane MULTIRECT; was 3): a new drag never waits, the oldest group goes
  nudge: 0.9, // lights a frame: the kick a new box gives the twinkles of the boxes already alive, at its centre
  nudgeReach: 0.25, // the kick falls as exp(-d / reach), reach a share of the picture's shorter side
  crossPull: 0.06, // escaped twinkles of different boxes bend toward each other, at most this share of the speed a frame
  noiseBurst: 6, // THE NOISE GATE: at most this many drag noises at once ...
  noisePerSecond: 3, // ... refilled at this rate; a birth over the limit still pulses the page, silent
  lifeS: 5.6, // seconds the children live: twice the first version's 2.8 (navigator 2026-10-02)
  lifeJitter: 0.1, // a drag's life is lifeS x (1 - jitter .. 1 + jitter)
  insideShare: 0.2, // the share of the life inside the box; the box fades over exactly this
  splitSpread: 0.55, // radians either side of a child's course its two halves take
  escapeSpeed: 1 / 90, // escaped speed, as a share of the picture's shorter side per frame
  maxRings: 128, // drag rings alive at once, every group together (was 96 for three groups)
  pulseEvery: 8, // frames between a child's rings (past four boxes live, stretched by boxes / 4: the ring budget holds)
  soundGapMs: 90, // the four births are heard one after another, this far apart
  minBox: 8, // CSS px: a box narrower or shorter than this is grown to it around its centre
});

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function rectFrom(a, b, bounds = null) {
  let x0 = Math.min(a.x, b.x);
  let y0 = Math.min(a.y, b.y);
  let x1 = Math.max(a.x, b.x);
  let y1 = Math.max(a.y, b.y);
  if (bounds) {
    const cl = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    x0 = cl(x0, 0, bounds.w);
    x1 = cl(x1, 0, bounds.w);
    y0 = cl(y0, 0, bounds.h);
    y1 = cl(y1, 0, bounds.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function createDragGesture(cfg = {}) {
  const C = { ...DRAG, ...cfg };
  let state = 'idle';
  let origin = null;
  let at = null;
  let type = 'mouse';
  const box = () => (origin && at ? rectFrom(origin, at, C.bounds ?? null) : null);
  return {
    get state() { return state; },
    get origin() { return origin; },
    get type() { return type; },
    box,
    down(p) {
      if (p.button != null && p.button !== 0 && p.type !== 'touch') {
        state = 'idle';
        return 'ignore';
      }
      type = p.type ?? 'mouse';
      origin = { x: p.x, y: p.y, t: p.t ?? 0 };
      at = { x: p.x, y: p.y };
      state = 'pressed';
      return 'press';
    },
    tick(t) {
      if (state === 'pressed' && type === 'touch' && t - origin.t >= C.longPressMs) {
        state = 'armed';
        return 'arm';
      }
      return 'none';
    },
    move(p) {
      if (state === 'idle' || state === 'scroll') return 'none';
      if (state === 'pressed' && type === 'touch' && p.t != null && p.t - origin.t >= C.longPressMs && dist(p, origin) <= C.touchSlop) state = 'armed';
      at = { x: p.x, y: p.y };
      const d = dist(at, origin);
      if (state === 'dragging') return 'move';
      if (state === 'pressed' && type === 'touch') {
        if (d > C.touchSlop) {
          state = 'scroll';
          return 'scroll';
        }
        return 'none';
      }
      if (d >= C.threshold) {
        state = 'dragging';
        return 'start';
      }
      return 'none';
    },
    up(p) {
      if (p) at = { x: p.x, y: p.y };
      const was = state;
      state = 'idle';
      if (was === 'dragging') return 'drop';
      if (was === 'pressed' || was === 'armed') return 'click';
      return 'none';
    },
    cancel() {
      const was = state;
      state = 'idle';
      return was === 'dragging' || was === 'armed' ? 'cancel' : 'none';
    },
  };
}

export function dragTiming(r, fps = 24, cfg = {}) {
  const C = { ...DRAG, ...cfg };
  const u = Math.min(0.999999, Math.max(0, Number.isFinite(r) ? r : 0.5));
  const lifeMs = Math.round(C.lifeS * 1000 * (1 - C.lifeJitter + 2 * C.lifeJitter * u));
  const insideMs = Math.round(lifeMs * C.insideShare);
  const lifeFrames = Math.max(12, Math.round((lifeMs / 1000) * fps));
  const insideFrames = Math.max(2, Math.round(lifeFrames * C.insideShare));
  return { lifeMs, insideMs, fadeMs: insideMs, lifeFrames, insideFrames };
}

export function dragFadeMs(r, cfg = {}) {
  return dragTiming(r, 24, cfg).fadeMs;
}

// box in lights: { x0, y0, x1, y1 }
export function placeChildren(box, n = DRAG.children, rng = Math.random) {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const spots = n === 4
    ? [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]]
    : Array.from({ length: n }, (_, k) => [0.5 + 0.28 * Math.cos((k / n) * 2 * Math.PI), 0.5 + 0.28 * Math.sin((k / n) * 2 * Math.PI)]);
  const sp = Math.max(0.15, Math.min(w, h) / 50);
  return spots.map(([fx, fy], k) => {
    const x = box.x0 + w * (fx + (rng() - 0.5) * 0.1);
    const y = box.y0 + h * (fy + (rng() - 0.5) * 0.1);
    // a start round the centre: the tangent of the circle through the child, all turning the same way
    const dx = x - cx;
    const dy = y - cy;
    const L = Math.hypot(dx, dy) || 1;
    return { id: k, x, y, vx: (-dy / L) * sp, vy: (dx / L) * sp, mass: 1, age: 0 };
  });
}

export function stepChildren(kids, box, opts = {}) {
  const life = opts.life ?? 67;
  const w = Math.max(1e-6, box.x1 - box.x0);
  const h = Math.max(1e-6, box.y1 - box.y0);
  const size = Math.min(w, h);
  // the swirl turns round the room's centre (the mean of its boxes' centres), so one room is one vortex
  const cx = opts.room && opts.room.length > 1 ? opts.room.reduce((t, B) => t + (B.x0 + B.x1) / 2, 0) / opts.room.length : (box.x0 + box.x1) / 2;
  const cy = opts.room && opts.room.length > 1 ? opts.room.reduce((t, B) => t + (B.y0 + B.y1) / 2, 0) / opts.room.length : (box.y0 + box.y1) / 2;
  const k = opts.k ?? 0.02 * size * size;
  const soft = opts.soft ?? (0.05 * size) ** 2 + 0.25;
  const swirl = opts.swirl ?? 0.004;
  const damp = opts.damp ?? 0.985;
  const vmax = opts.vmax ?? Math.max(0.3, size / 12);
  const mergeR = opts.mergeR ?? Math.max(0.8, size / 14);
  const marginOf = (B) => Math.min(0.5, (B.x1 - B.x0) / 4, (B.y1 - B.y0) / 4);
  // THE ONE ROOM (lane MULTIRECT): the walls are the union of the room's boxes; one box alone is the old walls exactly
  const room = opts.room && opts.room.length ? opts.room : [box];
  const others = opts.others ?? [];
  const inBox = (x, y, B) => { const m = marginOf(B); return x >= B.x0 + m && x <= B.x1 - m && y >= B.y0 + m && y <= B.y1 - m; };
  let live = kids.map((c) => ({ ...c })).filter((c) => c.age < life);
  const merges = [];
  const sources = others.length ? live.concat(others) : live;
  for (const a of live) {
    const pull = a.age / life >= 0.5 ? -1 : 1; // +1 repel, -1 attract
    let fx = 0;
    let fy = 0;
    for (const b of sources) {
      if (a === b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy + soft;
      const f = (pull * k * a.mass * (b.mass ?? 1)) / d2;
      const d = Math.sqrt(d2);
      fx += (f * dx) / d;
      fy += (f * dy) / d;
    }
    // the swirl: a small push along the tangent round the centre
    const rx = a.x - cx;
    const ry = a.y - cy;
    const rl = Math.hypot(rx, ry) || 1;
    fx += (-ry / rl) * swirl * size;
    fy += (rx / rl) * swirl * size;
    a.vx = (a.vx + fx / a.mass) * damp;
    a.vy = (a.vy + fy / a.mass) * damp;
    const v = Math.hypot(a.vx, a.vy);
    if (v > vmax) {
      a.vx *= vmax / v;
      a.vy *= vmax / v;
    }
  }
  for (const a of live) {
    const ox = a.x;
    const oy = a.y;
    a.x += a.vx;
    a.y += a.vy;
    a.age++;
    // free anywhere inside the room; at its edge, reflected by the box it stood in
    if (room.length > 1 && room.some((B) => inBox(a.x, a.y, B))) continue;
    const B = room.length > 1 ? (room.find((R) => inBox(ox, oy, R)) ?? box) : box;
    const margin = marginOf(B);
    if (a.x < B.x0 + margin) { a.x = B.x0 + margin; a.vx = Math.abs(a.vx); }
    if (a.x > B.x1 - margin) { a.x = B.x1 - margin; a.vx = -Math.abs(a.vx); }
    if (a.y < B.y0 + margin) { a.y = B.y0 + margin; a.vy = Math.abs(a.vy); }
    if (a.y > B.y1 - margin) { a.y = B.y1 - margin; a.vy = -Math.abs(a.vy); }
  }
  // merging, in the pulling half only
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < live.length && !merged; i++) {
      for (let j = i + 1; j < live.length && !merged; j++) {
        const a = live[i];
        const b = live[j];
        if (a.age / life < 0.5 || dist(a, b) >= mergeR) continue;
        const m = a.mass + b.mass;
        const c = {
          id: Math.min(a.id, b.id),
          x: (a.x * a.mass + b.x * b.mass) / m,
          y: (a.y * a.mass + b.y * b.mass) / m,
          vx: (a.vx * a.mass + b.vx * b.mass) / m,
          vy: (a.vy * a.mass + b.vy * b.mass) / m,
          mass: m,
          age: Math.max(a.age, b.age),
        };
        merges.push({ x: c.x, y: c.y, mass: m });
        live = live.filter((x) => x !== a && x !== b).concat(c);
        merged = true;
      }
    }
  }
  live = live.filter((c) => c.age < life);
  return { kids: live, merges };
}

export function splitChildren(kids, rng = Math.random, cfg = {}) {
  const C = { ...DRAG, ...cfg };
  const out = [];
  for (const c of kids) {
    const sp = Math.hypot(c.vx, c.vy);
    const course = sp > 1e-9 ? Math.atan2(c.vy, c.vx) : rng() * Math.PI * 2;
    for (const side of [-1, 1]) {
      const a = course + side * C.splitSpread;
      const turn = side * (0.008 + 0.02 * rng());
      out.push({ id: c.id * 2 + (side > 0 ? 1 : 0), x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, mass: c.mass / 2, age: c.age, turn, gen: (c.gen ?? 0) + 1 });
    }
  }
  return out;
}

export function stepEscape(kids, bounds, opts = {}) {
  const life = opts.life ?? 134;
  const w = Math.max(1e-6, bounds.x1 - bounds.x0);
  const h = Math.max(1e-6, bounds.y1 - bounds.y0);
  const target = opts.speed ?? Math.max(0.3, Math.min(w, h) * DRAG.escapeSpeed);
  // THE CROSS PULL (lane MULTIRECT): the other boxes' escaped twinkles bend this one's course toward them, within a
  // reach of a sixth of the shorter side, the whole pull capped at `crossPull` of the speed a frame
  const others = opts.others ?? [];
  const cross = (opts.crossPull ?? DRAG.crossPull) * target;
  const reach2 = (Math.min(w, h) / 6) ** 2;
  const out = [];
  for (const k of kids) {
    if (k.age >= life) continue;
    const c = { ...k };
    const t = c.turn ?? 0;
    const cs = Math.cos(t);
    const sn = Math.sin(t);
    let vx = c.vx * cs - c.vy * sn;
    let vy = c.vx * sn + c.vy * cs;
    if (others.length && cross > 0) {
      let ax = 0;
      let ay = 0;
      for (const b of others) {
        const dx = b.x - c.x;
        const dy = b.y - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 1e-9) continue;
        const f = (cross * (b.mass ?? 1) * reach2) / (d2 + reach2);
        const d = Math.sqrt(d2);
        ax += (f * dx) / d;
        ay += (f * dy) / d;
      }
      const a = Math.hypot(ax, ay);
      if (a > cross) { ax *= cross / a; ay *= cross / a; }
      vx += ax;
      vy += ay;
    }
    let sp = Math.hypot(vx, vy);
    if (sp < 1e-9) { vx = target; vy = 0; sp = target; }
    const want = sp + (target - sp) * 0.08; // ease to the escape speed
    c.vx = (vx / sp) * want;
    c.vy = (vy / sp) * want;
    c.x += c.vx;
    c.y += c.vy;
    c.age++;
    if (c.x < bounds.x0) { c.x = bounds.x0; c.vx = Math.abs(c.vx); }
    if (c.x > bounds.x1) { c.x = bounds.x1; c.vx = -Math.abs(c.vx); }
    if (c.y < bounds.y0) { c.y = bounds.y0; c.vy = Math.abs(c.vy); }
    if (c.y > bounds.y1) { c.y = bounds.y1; c.vy = -Math.abs(c.vy); }
    if (c.age < life) out.push(c);
  }
  return out;
}

// the scratch sum the escaped rings interfere in: amplitudes are added per light, so crossings double or cancel
export function createInterference(w, h) {
  const n = w * h;
  const sum = new Float32Array(n);
  const seen = new Int32Array(n); // the ring serial that last touched a light: each light counts once per circle
  const touched = new Int32Array(n);
  let nt = 0;
  let serial = 0;
  const circle = (x, y, R, width, amp, clip) => {
    if (R <= 0 || !amp) return 0;
    const id = ++serial;
    const x0 = clip ? Math.max(0, clip.x0) : 0;
    const y0 = clip ? Math.max(0, clip.y0) : 0;
    const x1 = clip ? Math.min(w - 1, clip.x1) : w - 1;
    const y1 = clip ? Math.min(h - 1, clip.y1) : h - 1;
    let cells = 0;
    const half = Math.max(0.35, width / 2);
    // a circle wholly outside the clip touches nothing: skip its walk
    if (x + R + half < x0 - 1 || x - R - half > x1 + 1 || y + R + half < y0 - 1 || y - R - half > y1 + 1) return 0;
    for (let dr = -half; dr <= half + 1e-9; dr += 0.7) {
      const r = R + dr;
      if (r <= 0) continue;
      const steps = Math.max(8, Math.ceil(2 * Math.PI * r * 1.1));
      // the walk round the circle by a fixed rotation (lane MULTIRECT: no cos and sin per step, which was most of
      // the drag rings' cost with ten boxes live); renormalised every 64 steps so the radius never drifts
      const cd = Math.cos((Math.PI * 2) / steps);
      const sd = Math.sin((Math.PI * 2) / steps);
      let ca = 1;
      let sa = 0;
      for (let j = 0; j < steps; j++) {
        if (j) {
          const t = ca * cd - sa * sd;
          sa = ca * sd + sa * cd;
          ca = t;
          if ((j & 63) === 0) { const L = Math.hypot(ca, sa); ca /= L; sa /= L; }
        }
        const px = Math.round(x + ca * r);
        const py = Math.round(y + sa * r);
        if (px < x0 || py < y0 || px > x1 || py > y1) continue;
        const i = py * w + px;
        if (seen[i] === id) continue;
        seen[i] = id;
        if (sum[i] === 0) touched[nt++] = i;
        sum[i] += amp;
        if (sum[i] === 0) sum[i] = 1e-9; // a light that cancelled exactly stays on the touched list once
        cells++;
      }
    }
    return cells;
  };
  return {
    // a ring: a crest of +amp at r and a trough of -0.7 amp half a wavelength behind it
    ring({ x, y, r, width = 1, amp = 0.6, lambda = 6, clip = null }) {
      return circle(x, y, r, width, amp, clip) + circle(x, y, r - lambda / 2, width, -0.7 * amp, clip);
    },
    flush(fn) {
      for (let k = 0; k < nt; k++) {
        const i = touched[k];
        fn(i, sum[i]);
        sum[i] = 0;
      }
      const m = nt;
      nt = 0;
      return m;
    },
    get size() { return n; },
  };
}

export function capList(list, max = DRAG.maxBoxes) {
  return list.length > max ? list.slice(list.length - max) : list;
}

// THE ONE ROOM (lane MULTIRECT): two light boxes overlap, or come within `gap` lights of each other
export function boxesTouch(a, b, gap = 0) {
  return a.x0 <= b.x1 + gap && b.x0 <= a.x1 + gap && a.y0 <= b.y1 + gap && b.y0 <= a.y1 + gap;
}

// a room number per box: boxes that overlap, directly or through a chain, share one (union-find, numbered in order)
export function rooms(boxes, gap = 0) {
  const n = boxes.length;
  const up = Array.from({ length: n }, (_, i) => i);
  const find = (i) => { while (up[i] !== i) { up[i] = up[up[i]]; i = up[i]; } return i; };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (boxesTouch(boxes[i], boxes[j], gap)) up[find(j)] = find(i);
  const name = new Map();
  return boxes.map((_, i) => { const r = find(i); if (!name.has(r)) name.set(r, name.size); return name.get(r); });
}

// THE NUDGE (lane MULTIRECT): a new box kicks the twinkles already alive away from its centre
export function nudgeKids(kids, at, opts = {}) {
  const strength = opts.strength ?? DRAG.nudge;
  const reach = Math.max(1e-6, opts.reach ?? 20);
  return kids.map((c) => {
    const dx = c.x - at.x;
    const dy = c.y - at.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return { ...c };
    const kick = strength * Math.exp(-d / reach);
    return { ...c, vx: c.vx + (kick * dx) / d, vy: c.vy + (kick * dy) / d };
  });
}

// THE NOISE GATE (lane MULTIRECT): a token bucket over the drag noises, so a burst of drags never becomes a wall of
// sound; take(nowMs) spends one token and answers whether this noise may sound
export function createNoiseGate(opts = {}) {
  const burst = Math.max(1, opts.burst ?? DRAG.noiseBurst);
  const perMs = Math.max(0, opts.perSecond ?? DRAG.noisePerSecond) / 1000;
  let tokens = burst;
  let last = null;
  return {
    take(now) {
      if (last != null && now > last) tokens = Math.min(burst, tokens + (now - last) * perMs);
      if (last == null || now > last) last = now;
      if (tokens >= 1) { tokens -= 1; return true; }
      return false;
    },
    get tokens() { return tokens; },
  };
}
