// js/main.js
(async () => {
  const wrap = document.getElementById('wrap');

  function showScene(id){ document.getElementById(id)?.classList.add('is-visible'); }
  function hideScene(id){ document.getElementById(id)?.classList.remove('is-visible'); }

  // ---- Load and inline your SVG ----
  const res = await fetch('assets/svg/openingtitle.svg');
  const svgText = await res.text();
  wrap.innerHTML = svgText;
  const svg = wrap.querySelector('svg');

  // Optional hover toggles for the cursor spotlight (guarded later during credits)
  svg.addEventListener('pointerenter', () => document.body.classList.add('spot-on'));
  svg.addEventListener('pointerleave', () => { if (!spotlightLocked) document.body.classList.remove('spot-on'); });

  // --- Credits overlay (one overlay reused for all lines) ---
  const credits = document.createElement('div');
  credits.id = 'scene-credits';
  credits.className = 'scene';
  credits.innerHTML = '<div class="scene__content"></div>';
  document.body.appendChild(credits);
  const creditsContent = credits.querySelector('.scene__content');

  // ---- Sanity on viewBox ----
  if (!svg?.viewBox?.baseVal?.width) {
    console.warn('SVG missing viewBox. Re-export with a proper viewBox for reliable physics.');
  }

  // ---- Select blocks ----
  let blocks = Array.from(svg.querySelectorAll('[id^="block-"]'));
  if (blocks.length === 0) blocks = Array.from(svg.querySelectorAll('path'));
  blocks.forEach(el => el.classList.add('block'));

  // ---- Physics state ----
  const S = blocks.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
  let mode = 'repel';
  let raf;

  // helpers / flags
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let spotlightLocked = false; // prevents onMove from hiding spotlight during credits

  // ---- Tunables ----
  // Repel feel (hover mode)
  const RADIUS   = 90;
  const STRENGTH = 10;
  const SPRING   = 0.12;
  const DAMP     = 0.62;
  const MAX      = 55;

  // Fall / Blast feel
  const GRAVITY  = 0.5;
  const DRAG_X   = 0.985;
  const DRAG_Y   = 0.992;
  const BOUNCE   = 0.0;
  const FRICTION = 0.70;

  // Blast impulse (on click)
  const BLAST_IMPULSE = 5;
  const BLAST_RANDOM  = 20;
  const BLAST_UP_KICK = 6;

  const vb = svg.viewBox?.baseVal;
  const viewHeight = vb ? vb.height : 300;

  // ---- Pointer tracking + spotlight ----
  let mouse = { x: -9999, y: -9999, active: false };
  const root = document.documentElement;
  let rafLight = null;

  const onMove = (e) => {
    mouse.active = true;
    const t = e.touches ? e.touches[0] : e;
    mouse.x = t.clientX; mouse.y = t.clientY;

    if (!rafLight) {
      rafLight = requestAnimationFrame(() => {
        root.style.setProperty('--mx', mouse.x + 'px');
        root.style.setProperty('--my', mouse.y + 'px');
        if (!spotlightLocked) {
          document.body.classList.toggle('spot-on', mode === 'repel' && mouse.active);
        }
        rafLight = null;
      });
    }
  };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('touchmove',   onMove, { passive: true });
  addEventListener('pointerleave', () => { mouse.active = false; if (!spotlightLocked) document.body.classList.remove('spot-on'); }, { passive: true });
  addEventListener('touchend',     () => { mouse.active = false; if (!spotlightLocked) document.body.classList.remove('spot-on'); }, { passive: true });

  // ---- Animation loop ----
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

        // integrate + clamp
        s.x += s.vx; s.y += s.vy;
        s.x = Math.max(-MAX, Math.min(MAX, s.x));
        s.y = Math.max(-MAX, Math.min(MAX, s.y));

        el.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;
      }
    }
    else if (mode === 'blast'){
      for (let i=0;i<blocks.length;i++){
        const el = blocks[i], s = S[i];
        s.vy += GRAVITY;
        s.vx *= DRAG_X; s.vy *= DRAG_Y;
        s.x += s.vx; s.y += s.vy;
        el.style.transform = `translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px)`;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick); // ✅ only once

  // ---- Click to explode only (single handler) ----
  svg.addEventListener('pointerdown', (e) => {
    // hide the cursor-follow spotlight
    document.body.classList.remove('spot-on');

    mode = 'blast';

    // outward impulse from click point
    const click = { x: e.clientX, y: e.clientY };
    blocks.forEach((el, i) => {
      const c = window.UTIL.getCenter(svg, el);
      let dx = c.x - click.x, dy = c.y - click.y;
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;

      const k = BLAST_IMPULSE + Math.random() * BLAST_RANDOM;
      const s = S[i];
      s.vx += dx * k + (Math.random() - 0.5) * 4;
      s.vy += dy * k - BLAST_UP_KICK + (Math.random() - 0.5) * 3;
    });

    // start credits after debris begins moving
    setTimeout(() => { playCredits(); }, 700);
  }, { once: true });

  // ---- Credits sequence ----
  async function playCredits(){
    // lock & center the spotlight
    spotlightLocked = true;
    document.body.classList.add('spot-on','spot-fixed'); // show spotlight centered

    const lines = [
      '<span class="role">Type designer & Type Foundry</span><br><span class="name">Charlie Le<br>Maignan</span>',
      '<span class="title"><span class="line1">INTRODUCING</span><span class="line2">DECO CITY</span></span>'
    ];

    // timings (tweak to taste)
    const HOLD = 2200;   // how long each line stays visible
    const GAP  = 1000;   // time between lines (matches your fade-out)

    for (const html of lines){
      creditsContent.innerHTML = html;
      credits.classList.add('is-visible');     // fade in (your .scene transition handles it)
      await sleep(HOLD);
      credits.classList.remove('is-visible');  // fade out
      await sleep(GAP);
    }

    // clear spotlight + overlay
    document.body.classList.remove('spot-on','spot-fixed');
    spotlightLocked = false;

    document.body.classList.remove('spot-on','spot-fixed');
    spotlightLocked = false;

     wrap.innerHTML = `
  <section class="landing-hero">
    <video id="bgvid" autoplay muted loop playsinline></video>
    <div class="grain-overlay" aria-hidden="true"></div>
  </section>
`;

const bgvid = document.getElementById("bgvid");
bgvid.src = "assets/video/weblanding.mp4";
bgvid.playbackRate = 0.5; // slow-mo



    // reveal the site + enable scrolling
    document.body.classList.add('app-on');
    document.documentElement.classList.add('app-on'); // for the html tag too
    const nav = document.getElementById('topnav');
function setNavH(){
  const h = nav ? nav.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--nav-h', `${h}px`);
}
setNavH();
addEventListener('resize', setNavH);
new ResizeObserver(setNavH).observe(nav);

  }
})();




// ********************************* UI hookups for specimen page *****************************
const root = document.documentElement;

// weight slider
const wght = document.getElementById('wght');
const wOut = document.getElementById('wghtVal');
if (wght && wOut){
  const upd = () => { root.style.setProperty('--wght', wght.value); wOut.textContent = wght.value; };
  wght.addEventListener('input', upd);
  upd();
}

// tester
const tIn  = document.getElementById('testerInput');
const tOut = document.getElementById('testerSample');
if (tIn && tOut){
  const sync = () => tOut.textContent = tIn.value;
  tIn.addEventListener('input', sync);
  sync();
}

// scroll-spy for the top nav
const links = Array.from(document.querySelectorAll('.topnav a'));
const map = new Map(links.map(a => [a.getAttribute('href'), a]));
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if (e.isIntersecting){
      links.forEach(l => l.classList.remove('active'));
      const a = map.get('#'+e.target.id);
      if (a) a.classList.add('active');
    }
  });
}, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
document.querySelectorAll('main .section').forEach(sec => io.observe(sec));
