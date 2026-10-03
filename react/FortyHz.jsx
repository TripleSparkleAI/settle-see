// settle-see/react · FortyHz - the React face of THE 40 Hz LIGHT, ONE MODE (src/fortyhz.js).
//
// <claudes_code_comments>
// ** Function List **
// useFortyHz()                 - { on, info, lights, set, toggle } from the page's one gate; restores this tab's
//                                session on first use (a reload keeps the mode, a fresh visit does not)
// useFortyHzLight(ref, name)   - a picture a page draws itself joins the page's one 40 Hz clock while mounted (an
//                                element that mounts late, or is swapped, is picked up on the next render)
//
// ** Technical Review **
// - Every <Settle> already joins the clock through settle() (mount.js). useFortyHzLight is for a picture drawn on
//   a page's own canvas or element (a film player, a hero wrap): one line, and it flickers with every other settle.
// - set() and toggle() are the gate's own: every off button on the site calls the same set(false).
// </claudes_code_comments>

import { useEffect, useRef, useState } from 'react';
import { fortyHz } from '../src/fortyhz.js';

export function useFortyHz() {
  const g = fortyHz();
  const [st, setSt] = useState(() => ({ on: g.on, info: g.info, lights: g.lights() }));
  useEffect(() => {
    const off = g.subscribe(setSt);
    g.restore();
    setSt({ on: g.on, info: g.info, lights: g.lights() });
    return off;
  }, [g]);
  return { ...st, set: g.set, toggle: g.toggle };
}

// the element behind ref may mount later than the component (a player that waits for its frames), so every render
// checks it, and the gate is told only when it changes; unmount lets it go
export function useFortyHzLight(ref, name = 'picture') {
  const reg = useRef({ el: null, name: null, off: null });
  useEffect(() => {
    const el = ref?.current ?? null;
    const r = reg.current;
    if (el === r.el && name === r.name) return;
    r.off?.();
    reg.current = { el, name, off: el ? fortyHz().register(el, name) : null };
  });
  useEffect(() => () => {
    reg.current.off?.();
    reg.current = { el: null, name: null, off: null };
  }, []);
}
