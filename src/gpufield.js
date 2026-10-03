// settle-see · gpufield - the same p-bit field as field.js, swept by the GPU: a checkerboard Gibbs sweep as two
// fragment-shader passes. An exploration (lane PERFLADDER): measured, tested against the CPU sweep, not yet wired in.
//
// <claudes_code_comments>
// ** Function List **
// createGpuField(gl, opts)  - a w x h field on a WebGL2 context; returns
//   .sweep(beta)            - one full Gibbs sweep: the even colour, then the odd, each one draw into a ping-pong texture
//   .setTarget(t)           - a new Int8Array target (uploaded once)
//   .read()                 - an Int8Array of the lights (+1 / -1), read back with readPixels (a GPU-CPU sync)
//   .stats()                - { q overlap, r correlation, mean magnetisation, yes } from read()
//   .finish() / .sync()     - finish(); sync() reads one pixel, which truly waits for the GPU (for timing)
//   .destroy()
//
// ** Technical Review **
// - Each texel of an R8 texture is one light (0 = -1, 255 = +1). The grid is bipartite, so one pass updates every
//   light of one colour from its four neighbours, which all have the other colour and do not change in that pass:
//   two passes are an exact Gibbs sweep, the same schedule field.js runs on the CPU.
// - P(+1) = (1 + tanh(beta (lean t_i + pull sum_nb s_j))) / 2, as in field.js; the comparison draws a uniform from a
//   hash of (x, y, the sweep count, the colour, the seed): PCG's output function on a combined integer, so every
//   light draws an independent-looking number each pass with no state to carry. The RNG differs from the CPU's, so
//   the two agree in distribution, not draw for draw; the test compares mean magnetisation and the overlap with the
//   target after equilibration.
// - The field never leaves the GPU unless read() is called; a renderer could sample the state texture directly.
//   Pointer holds, clamps, per-light leans and the soft read (field.js) are not implemented here.
// </claudes_code_comments>

const VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D uS;
uniform highp usampler2D uT;
uniform ivec2 uGrid;
uniform int uColour;
uniform uint uStep;
uniform uint uSeed;
uniform float uBeta;
uniform float uLean;
uniform float uPull;
out uint outS;
uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float sp(ivec2 c) { return texelFetch(uS, c, 0).r > 0u ? 1.0 : -1.0; }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  uint me = texelFetch(uS, c, 0).r;
  if (((c.x + c.y) & 1) != uColour) { outS = me; return; }
  float nb = 0.0;
  if (c.x > 0) nb += sp(c - ivec2(1, 0));
  if (c.x + 1 < uGrid.x) nb += sp(c + ivec2(1, 0));
  if (c.y > 0) nb += sp(c - ivec2(0, 1));
  if (c.y + 1 < uGrid.y) nb += sp(c + ivec2(0, 1));
  float t = texelFetch(uT, c, 0).r > 0u ? 1.0 : -1.0;
  float p = 0.5 * (1.0 + tanh(uBeta * (uLean * t + uPull * nb)));
  uint idx = uint(c.y * uGrid.x + c.x);
  uint h = pcg(idx ^ pcg(uStep * 2u + uint(uColour) + pcg(uSeed)));
  float u = float(h >> 8u) * (1.0 / 16777216.0);
  outS = u < p ? 1u : 0u;
}`;

export function createGpuField(gl, { w, h, target = null, lean = 0.9, pull = 0.3, seed = 1, init = null }) {
  const n = w * h;
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`settle-see gpufield: ${gl.getShaderInfoLog(sh)}`);
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`settle-see gpufield: ${gl.getProgramInfoLog(prog)}`);
  const U = Object.fromEntries(['uS', 'uT', 'uGrid', 'uColour', 'uStep', 'uSeed', 'uBeta', 'uLean', 'uPull'].map((k) => [k, gl.getUniformLocation(prog, k)]));
  const vao = gl.createVertexArray();
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  const tex = (data) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8UI, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    if (data) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
    return t;
  };
  const toBytes = (a) => Uint8Array.from(a, (v) => (v > 0 ? 1 : 0));
  let t = target ?? new Int8Array(n).fill(-1);
  const texT = tex(toBytes(t));
  const start = init ?? Int8Array.from({ length: n }, (_, i) => ((Math.imul(i + 1, 2654435761) ^ seed) >>> 31 ? 1 : -1));
  const S = [tex(toBytes(start)), tex(null)];
  const fbo = S.map((tx) => {
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
    return f;
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  let cur = 0;
  let step = 0;
  const F = {
    w, h, n, lean, pull, seed,
    get sweeps() { return step; },
    setTarget(nt) {
      t = nt;
      gl.bindTexture(gl.TEXTURE_2D, texT);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED_INTEGER, gl.UNSIGNED_BYTE, toBytes(nt));
    },
    sweep(beta) {
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.viewport(0, 0, w, h);
      gl.uniform2i(U.uGrid, w, h);
      gl.uniform1ui(U.uStep, step);
      gl.uniform1ui(U.uSeed, seed >>> 0);
      gl.uniform1f(U.uBeta, beta);
      gl.uniform1f(U.uLean, F.lean);
      gl.uniform1f(U.uPull, F.pull);
      gl.uniform1i(U.uS, 0);
      gl.uniform1i(U.uT, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texT);
      for (let colour = 0; colour < 2; colour++) {
        gl.uniform1i(U.uColour, colour);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, S[cur]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        cur = 1 - cur;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      step++;
    },
    read() {
      const buf = new Uint32Array(n * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]);
      gl.readPixels(0, 0, w, h, gl.RGBA_INTEGER, gl.UNSIGNED_INT, buf);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const s = new Int8Array(n);
      for (let i = 0; i < n; i++) s[i] = buf[i * 4] > 0 ? 1 : -1;
      return s;
    },
    stats() {
      const s = F.read();
      let q = 0, ss = 0, st = 0, yes = 0;
      for (let i = 0; i < n; i++) {
        q += s[i] * t[i];
        ss += s[i];
        st += t[i];
        if (s[i] > 0) yes++;
      }
      const ms = ss / n;
      const mt = st / n;
      const d = (1 - ms * ms) * (1 - mt * mt);
      return { q: q / n, r: d > 0 ? (q / n - ms * mt) / Math.sqrt(d) : 0, m: ms, yes: yes / n };
    },
    finish() { gl.finish(); },
    sync() {
      // a one-pixel read waits for every queued pass: gl.finish() alone does not (Chrome returns at once)
      const one = new Uint32Array(4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[cur]);
      gl.readPixels(0, 0, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, one);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    destroy() {
      for (const x of S) gl.deleteTexture(x);
      gl.deleteTexture(texT);
      for (const f of fbo) gl.deleteFramebuffer(f);
      gl.deleteProgram(prog);
      gl.deleteVertexArray(vao);
    },
  };
  return F;
}
