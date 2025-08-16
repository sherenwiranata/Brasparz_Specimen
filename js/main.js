(async () => {
  const wrap = document.getElementById('wrap');

  function showScene(id){ document.getElementById(id)?.classList.add('is-visible'); }
function hideScene(id){ document.getElementById(id)?.classList.remove('is-visible'); }

  // ---- Load and inline your SVG ----
  const res = await fetch('assets/svg/openingtitle.svg');
  const svgText = await res.text();
  wrap.innerHTML = svgText;
  const svg = wrap.querySelector('svg');

  if (!svg || !svg.viewBox || !svg.viewBox.baseVal || svg.viewBox.baseVal.width === 0) {
    console.warn('SVG missing viewBox. Re-export with a proper viewBox for reliable physics.');
  } else {
    // pad viewBox using our util
    if (window.UTIL && typeof window.UTIL.padViewBox === 'function') {

    }
  }

  // ---- Select blocks ----
  let blocks = Array.from(svg.querySelectorAll('[id^="block-"]'));
  if (blocks.length === 0) {
    blocks = Array.from(svg.querySelectorAll('path'));
  }
  blocks.forEach(el => el.classList.add('block'));

  // ---- Physics state ----
  const S = blocks.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  let mode = 'repel';
  let raf;

  // Tunables
// ---- Repel feel (hover mode) ----
    const RADIUS   = 180;  // cursor influence radius
    const STRENGTH = 60;
    const SPRING   = 0.12; // a touch snappier pull-back
    const DAMP     = 0.62; // more damping so blocks settle quicker pre-click
    const MAX      = 55;

    // ---- Fall / Blast feel ----
    const GRAVITY        = 0.9;  // stronger gravity so they leave frame fast
    const DRAG_X         = 0.985; // air drag
    const DRAG_Y         = 0.992;
    const BOUNCE         = 0.0;  // no bounce in blast
    const FRICTION       = 0.70; // not really used when BOUNCE=0

    // ---- Blast impulse (on click) ----
    const BLAST_IMPULSE  = 5;   // base explosion force
    const BLAST_RANDOM   = 20;   // extra randomized kick
    const BLAST_UP_KICK  = 6;    // slight upward pop

  const vb = svg.viewBox?.baseVal;
  const viewHeight = vb ? vb.height : 300;
  const floor = viewHeight * 0.72;

  // ---- Pointer tracking ----
  let mouse = { x: -9999, y: -9999, active: false };
  const onMove = e => {
    mouse.active = true;
    const t = e.touches ? e.touches[0] : e;
    mouse.x = t.clientX; mouse.y = t.clientY;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('touchmove',   onMove, { passive: true });
  addEventListener('pointerleave', () => mouse.active = false, { passive: true });
  addEventListener('touchend',     () => mouse.active = false, { passive: true });

  function tick(){
  if (mode === 'repel'){
    for (let i=0;i<blocks.length;i++){
      const el = blocks[i], s = S[i];

      if (mouse.active){
        const c  = window.UTIL.getCenter(svg, el);
        const dx = c.x - mouse.x;
        const dy = c.y - mouse.y;
        const d  = Math.hypot(dx, dy);
        if (d < RADIUS && d > 0.0001){
          const f = (1 - d / RADIUS) * STRENGTH;
          s.vx += (dx / d) * f;
          s.vy += (dy / d) * f;
        }
      }
      // spring + damping (return to origin while in hover mode)
      s.vx += -s.x * SPRING;
      s.vy += -s.y * SPRING;
      s.vx *= DAMP; s.vy *= DAMP;

      // integrate + clamp (don't let hover displacements get too far)
      s.x += s.vx; s.y += s.vy;
      s.x = Math.max(-MAX, Math.min(MAX, s.x));
      s.y = Math.max(-MAX, Math.min(MAX, s.y));

      el.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;
    }
  }
  else if (mode === 'blast'){
    let allGone = true;

    for (let i=0;i<blocks.length;i++){
      const el = blocks[i], s = S[i];

      // gravity + air drag
      s.vy += GRAVITY;
      s.vx *= DRAG_X; s.vy *= DRAG_Y;

      // integrate (no floor collision; let them leave the frame)
      s.x += s.vx; s.y += s.vy;

      el.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;

      // If any piece is still vaguely on-screen, keep animating
      // (SVG space heuristic: off-screen when y translation is very large)
      if (s.y < (viewHeight * 1.2)) allGone = false;
    }

    // Optional: once everything is well off-screen, you could auto-advance more
    // if (allGone) { /* … */ }
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Auto-advance safety (in case user doesn't click)
setTimeout(() => { if (mode==='repel') { /* simulate a click center */ svg.dispatchEvent(new PointerEvent('pointerdown', {clientX: innerWidth/2, clientY: innerHeight/2})); } }, 6000);

  raf = requestAnimationFrame(tick);

  // ---- Collapse trigger ----
  svg.addEventListener('pointerdown', (e) => {
  // 1) switch to blast mode
  mode = 'blast';

  // 2) compute outward impulse from click point
  const click = { x: e.clientX, y: e.clientY };

  blocks.forEach((el, i) => {
    const c = window.UTIL.getCenter(svg, el);     // screen-space center
    let dx = c.x - click.x;
    let dy = c.y - click.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;                             // unit vector

    const k = BLAST_IMPULSE + Math.random() * BLAST_RANDOM;
    const s = S[i];
    s.vx += dx * k + (Math.random() - 0.5) * 4;   // outward + jitter
    s.vy += dy * k - BLAST_UP_KICK + (Math.random() - 0.5) * 3;
  });

  // 3) trigger scenes on a timeline
  // Wait a beat for the debris to clear, then show city
  setTimeout(() => { showScene('scene-city'); }, 600);

  // Hold the city message, then fade to black
  setTimeout(() => { hideScene('scene-city'); showScene('scene-black'); }, 3600);
}, { once:true });

  setTimeout(() => { if (mode === 'repel') mode = 'fall'; }, 6000); // auto-advance
})();
