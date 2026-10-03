// settle-see/react · RadialPulse - the React face of THE RADIAL PULSE BUS (src/radialpulse.js).
//
// <claudes_code_comments>
// ** Function List **
// useRadialPulse(ref, respond, opts) - the element behind ref joins the page's bus while mounted; respond is a
//                                      function (called every frame the front crosses the element) or an object
//                                      { respond, arrive, leave, still }; opts: { id, rect, enabled }
//
// ** Technical Review **
// - Every <Settle> already joins the bus through settle() (mount.js, by way of global.js). useRadialPulse is for
//   anything else a page draws or plays: a background canvas, a wrap round a picture, a sound's on-screen anchor.
//   One line, and the thing answers every radial pulse on the page with the bus's delay, gradient and direction.
// - The handlers are read through a ref, so a page may pass fresh closures every render; the registration itself
//   is renewed only when the element, the id or the rect function changes, and unmount lets it go.
// - opts.rect may be a function returning a page-pixel rectangle, or the string 'viewport' for a thing that fills the
//   window (a fixed background, a page-wide sound), in which case ref may be null.
// </claudes_code_comments>

import { useEffect, useRef } from 'react';
import { radialPulse } from '../src/radialpulse.js';

export function useRadialPulse(ref, respond, opts = {}) {
  const handlers = useRef(respond);
  handlers.current = respond;
  const reg = useRef({ el: null, off: null });
  const { id = null, rect = null, enabled = true } = opts;
  useEffect(() => {
    const el = ref?.current ?? null;
    const r = reg.current;
    if (!enabled) {
      r.off?.();
      reg.current = { el: null, off: null };
      return;
    }
    if (el === r.el && r.off) return;
    r.off?.();
    const call = (name) => (w) => {
      const h = handlers.current;
      if (typeof h === 'function') { if (name === 'respond' || name === 'still') h(w); return; }
      h?.[name]?.(w);
    };
    const consumer = { id, el: rect ? undefined : el, rect: rect ?? undefined, respond: call('respond'), arrive: call('arrive'), leave: call('leave'), still: call('still') };
    if (!el && !rect) { reg.current = { el: null, off: null }; return; }
    reg.current = { el, off: radialPulse().register(consumer) };
  });
  useEffect(() => () => {
    reg.current.off?.();
    reg.current = { el: null, off: null };
  }, []);
}
