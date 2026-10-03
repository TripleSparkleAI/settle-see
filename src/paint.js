// settle-see · paint - shapes painted in plain JavaScript, no canvas: discs, rings, segments, polylines and boxes on a
// w x h grid of +1 (lit) and -1 (unlit). These shapes are exact at every size and run under node, so their tests can
// settle every one at the sizes a page draws it.
//
// <claudes_code_comments>
// ** Function List **
// seeded(seed)          - a tiny deterministic generator (the same numbers in node and in a browser)
// Paint(w, h)           - a w x h target, all -1; .disc .ring .seg .poly .box light cells; .t is the Int8Array
//   .X(u) / .Y(v)       - a position in [0, 1] across / down the grid, in cells
//   .sq(ax, ay)         - a point in the centred S x S square (S = min(w, h)), ax and ay in [-1, 1], as (u, v)
// scatter(n, seed)      - n seeded points spread over the grid, as (u, v)
// curve(f, u0, v0, u1, v1, n) - the points of y = f(x), x in [0, 1], mapped into a plot box (v grows downward)
//
// ** Technical Review **
// - Sizes are fractions of S = min(w, h), so a circle stays round on a wide grid.
// - A lit feature is at least two lights across: a single lit light with four dark neighbours has input
//   0.9 - 1.2 < 0 at lean 0.9 and pull 0.3 and goes dark. Discs therefore never paint smaller than a 3 x 3 block and
//   lines never thinner than about 1.5 lights.
// - Moved here from settle-site's credits page (src/engine/creditshapes.js), where it was first written.
// </claudes_code_comments>

export function seeded(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

export class Paint {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.S = Math.min(w, h);
    this.t = new Int8Array(w * h).fill(-1);
  }
  X(u) {
    return u * (this.w - 1);
  }
  Y(v) {
    return v * (this.h - 1);
  }
  sq(ax, ay) {
    const half = (this.S - 1) / 2;
    return [(this.w - 1) / 2 / (this.w - 1) + (ax * half) / (this.w - 1), 0.5 + (ay * half) / (this.h - 1)];
  }
  // light every cell whose centre passes the test f(x, y) inside the box [x0, x1] x [y0, y1]
  each(x0, y0, x1, y1, f) {
    const a = Math.max(0, Math.floor(x0));
    const b = Math.min(this.w - 1, Math.ceil(x1));
    const c = Math.max(0, Math.floor(y0));
    const d = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) if (f(x, y)) this.t[y * this.w + x] = 1;
  }
  disc(u, v, r) {
    const cx = this.X(u);
    const cy = this.Y(v);
    const R = Math.max(1.45, r * this.S);
    this.each(cx - R, cy - R, cx + R, cy + R, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= R * R + 0.01);
  }
  ring(u, v, r, th = 0.05) {
    const cx = this.X(u);
    const cy = this.Y(v);
    const R = r * this.S;
    const hw = Math.max(0.75, (th * this.S) / 2);
    this.each(cx - R - hw, cy - R - hw, cx + R + hw, cy + R + hw, (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - R) <= hw);
  }
  seg(u0, v0, u1, v1, th = 0.05) {
    const x0 = this.X(u0);
    const y0 = this.Y(v0);
    const x1 = this.X(u1);
    const y1 = this.Y(v1);
    const hw = Math.max(0.75, (th * this.S) / 2);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L2 = dx * dx + dy * dy || 1e-9;
    this.each(Math.min(x0, x1) - hw, Math.min(y0, y1) - hw, Math.max(x0, x1) + hw, Math.max(y0, y1) + hw, (x, y) => {
      const k = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / L2));
      return Math.hypot(x - (x0 + k * dx), y - (y0 + k * dy)) <= hw;
    });
  }
  poly(pts, th = 0.05) {
    for (let k = 1; k < pts.length; k++) this.seg(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], th);
  }
  box(u0, v0, u1, v1) {
    this.each(this.X(u0), this.Y(v0), this.X(u1), this.Y(v1), (x, y) => x >= this.X(u0) - 0.01 && x <= this.X(u1) + 0.01 && y >= this.Y(v0) - 0.01 && y <= this.Y(v1) + 0.01);
  }
}

// n seeded points spread over the grid, as (u, v)
export function scatter(n, seed) {
  const r = seeded(seed);
  return [...Array(n)].map(() => [0.05 + r() * 0.9, 0.08 + r() * 0.84]);
}

// Points of a curve y = f(x) for x in [0, 1], mapped into the plot box [u0, u1] x [v0, v1] (v grows downward).
export function curve(f, u0, v0, u1, v1, n = 60) {
  return [...Array(n + 1)].map((_, k) => {
    const x = k / n;
    return [u0 + x * (u1 - u0), v1 - f(x) * (v1 - v0)];
  });
}
