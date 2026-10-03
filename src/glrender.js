// settle-see · glrender - the same neon dots as render.js, drawn by the GPU in one fragment-shader pass.
//
// <claudes_code_comments>
// ** Function List **
// glSupported()               - true when this browser can make a WebGL2 context (checked once on a scratch canvas)
// createGlRenderer(gl, opts)  - a renderer for one w x h field on a WebGL2 context; returns
//   .draw(field, extra, geom, background) - fill the cell colours, upload them, draw the whole canvas in one pass
//   .set(opts)                - change colour mode, neons, pitch, glow without rebuilding
//   .pitch, .direct (true), .kind ('gl'), .lost
// parseHex(hex)               - '#rgb' or '#rrggbb' to [r, g, b] in 0..1 (the background)
//
// ** Technical Review **
// - The 2D renderer (render.js) composites a full-size plate about nine times a frame: the bloom twice, the dot
//   layer (a scaled copy and a pattern cut), the core layer the same, then the plate onto the canvas. On a hero
//   2,880 x 1,672 device pixels that is the larger part of the GPU process's work and of the browser's compositing.
//   This renderer does the same picture in ONE pass over the canvas: each fragment finds its light, reads the
//   light's colour with texelFetch, cuts it to a round dot analytically, adds the hot core the same way, and adds
//   the bloom by sampling mip levels 1 and 2 of the same texture (the half- and quarter-size images the 2D renderer
//   builds by hand), with the same weights (0.38 and 0.5 times glow). The sum is clamped at 1, as 'lighter' clamps.
// - The CPU work is unchanged and shared: fillCells() from render.js writes the colour of every light (meaning,
//   echo, the pointer's trail, clamps, flashes) into a w x h RGBA array, and the core into a second; both are
//   uploaded with texSubImage2D (about 300 kB a frame for the hero) and the mip chain is rebuilt on the GPU.
// - The dot mask is the 2D renderer's radial gradient: alpha 1 out to 0.7 r, falling linearly to 0 at r, r = 0.46 P
//   for the dot and 0.22 P for the core, measured from the centre of the light in plate pixels. Below pitch 3 the dots
//   are squares and below 4 there is no core, as in render.js. A 'fit' grid (scale under 1) is sampled
//   analytically, so its dots stay round where the 2D renderer softens them.
// - clear (opts.clear, mount sets it for background 'transparent' and then asks for an alpha, premultiplied context):
//   outside the plate the fragment is vec4(0), and inside it the summed light is written premultiplied with
//   alpha = its brightest channel, so an unlit light and the gap between dots are see-through and a lit dot keeps its
//   colour. Without clear the output is vec4(colour, 1.0) on the background, byte for byte as before.
// - Context loss: the canvas's webglcontextlost is answered with preventDefault, draws are skipped, and everything
//   is rebuilt on webglcontextrestored.
// - A page may hold only a few WebGL contexts (browsers cap them around 16), so settle() uses this only when a settle
//   asks for it (opts.renderer = 'gl'): the hero and the footer, chosen by the site's perf ladder.
// </claudes_code_comments>

import { RENDER_DEFAULTS, makeColours, fillCells } from './render.js';

let supported = null;
export function glSupported() {
  if (supported !== null) return supported;
  try {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : typeof document !== 'undefined' ? document.createElement('canvas') : null;
    supported = !!(c && c.getContext('webgl2'));
  } catch {
    supported = false;
  }
  return supported;
}

export function parseHex(hex) {
  const h = String(hex ?? '#000').trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [0, 0, 0];
  return [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16) / 255);
}

const VS = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uCells;
uniform sampler2D uCores;
uniform ivec2 uGrid;
uniform float uP;
uniform vec2 uOrigin;
uniform float uScale;
uniform float uCanvasH;
uniform vec3 uBg;
uniform float uGlow;
uniform int uDot;
uniform int uCore;
uniform int uClear;
out vec4 outColor;
float mask(vec2 inCell, float r) {
  float d = length(inCell - vec2(0.5 * uP));
  return clamp((r - d) / (0.3 * r), 0.0, 1.0);
}
void main() {
  vec2 px = vec2(gl_FragCoord.x, uCanvasH - gl_FragCoord.y);
  vec2 u = (px - uOrigin) / uScale;
  vec2 plate = vec2(uGrid) * uP;
  if (u.x < 0.0 || u.y < 0.0 || u.x >= plate.x || u.y >= plate.y) { outColor = uClear == 1 ? vec4(0.0) : vec4(uBg, 1.0); return; }
  vec2 cf = u / uP;
  ivec2 cell = min(ivec2(floor(cf)), uGrid - 1);
  vec2 inCell = (cf - vec2(cell)) * uP;
  vec3 col = texelFetch(uCells, cell, 0).rgb;
  vec3 sum = uDot == 1 ? col * mask(inCell, 0.46 * uP) : col;
  if (uCore == 1) sum += texelFetch(uCores, cell, 0).rgb * mask(inCell, 0.22 * uP);
  if (uGlow > 0.0) {
    vec2 uv = u / plate;
    sum += textureLod(uCells, uv, 2.0).rgb * (0.5 * uGlow) + textureLod(uCells, uv, 1.0).rgb * (0.38 * uGlow);
  }
  vec3 c = min(sum, vec3(1.0));
  outColor = uClear == 1 ? vec4(c, max(c.r, max(c.g, c.b))) : vec4(c, 1.0);
}`;

export function createGlRenderer(gl, opts) {
  const { w, h } = opts;
  const defined = (x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined));
  let o = { ...RENDER_DEFAULTS, ...defined(opts) };
  let colours = makeColours(o);
  const cellData = new Uint8ClampedArray(w * h * 4).fill(255);
  const coreData = new Uint8ClampedArray(w * h * 4).fill(255);
  const cellView = new Uint8Array(cellData.buffer);
  const coreView = new Uint8Array(coreData.buffer);
  const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
  let prog = null;
  let U = null;
  let texCells = null;
  let texCores = null;
  let sets = [];
  let flip = 0;
  const dbg = String(opts.glDebug ?? '');
  let vao = null;
  let lost = false;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`settle-see glrender: ${gl.getShaderInfoLog(sh)}`);
    return sh;
  };

  const build = () => {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`settle-see glrender: ${gl.getProgramInfoLog(prog)}`);
    U = Object.fromEntries(['uCells', 'uCores', 'uGrid', 'uP', 'uOrigin', 'uScale', 'uCanvasH', 'uBg', 'uGlow', 'uDot', 'uCore', 'uClear'].map((k) => [k, gl.getUniformLocation(prog, k)]));
    vao = gl.createVertexArray();
    sets = [];
    for (let k = 0; k < (dbg.includes('single') ? 1 : 2); k++) sets.push(makeSet());
  };
  const makeSet = () => {
    const texCells = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texCells);
    gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const texCores = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texCores);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    return { texCells, texCores };
  };
  build();

  const canvas = gl.canvas;
  const onLost = (e) => { e.preventDefault(); lost = true; };
  const onRestored = () => { lost = false; build(); };
  canvas?.addEventListener?.('webglcontextlost', onLost);
  canvas?.addEventListener?.('webglcontextrestored', onRestored);

  const setup = () => {
    o.pitch = Math.max(1, Math.round(o.pitch));
    colours = makeColours(o);
  };
  setup();

  const draw = (F, extra, geom, background) => {
    if (lost || gl.isContextLost()) return;
    const P = o.pitch;
    const useCore = !!(o.core && P >= 4);
    fillCells(F, extra, o, colours, cellData, useCore ? coreData : null);
    // two texture sets used in turn, so a frame never writes a texture the previous frame's draw may still read
    flip = (flip + 1) % sets.length;
    ({ texCells, texCores } = sets[flip]);
    gl.viewport(0, 0, geom.cw, geom.ch);
    gl.useProgram(prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texCells);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, cellView);
    if (o.glow > 0 && !dbg.includes('nomip')) gl.generateMipmap(gl.TEXTURE_2D);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texCores);
    if (useCore) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, coreView);
    gl.uniform1i(U.uCells, 0);
    gl.uniform1i(U.uCores, 1);
    gl.uniform2i(U.uGrid, w, h);
    gl.uniform1f(U.uP, P);
    gl.uniform2f(U.uOrigin, geom.ox, geom.oy);
    gl.uniform1f(U.uScale, geom.sc);
    gl.uniform1f(U.uCanvasH, geom.ch);
    gl.uniform3fv(U.uBg, parseHex(background));
    gl.uniform1f(U.uGlow, o.glow);
    gl.uniform1i(U.uDot, P >= 3 ? 1 : 0);
    gl.uniform1i(U.uCore, useCore ? 1 : 0);
    gl.uniform1i(U.uClear, o.clear ? 1 : 0);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    direct: true,
    kind: 'gl',
    draw,
    get lost() { return lost; },
    get pitch() { return o.pitch; },
    set(next) {
      o = { ...o, ...defined(next) };
      setup();
    },
    destroy() {
      canvas?.removeEventListener?.('webglcontextlost', onLost);
      canvas?.removeEventListener?.('webglcontextrestored', onRestored);
      if (!gl.isContextLost()) {
        for (const t of sets) {
          gl.deleteTexture(t.texCells);
          gl.deleteTexture(t.texCores);
        }
        gl.deleteProgram(prog);
        gl.deleteVertexArray(vao);
      }
    },
  };
}
