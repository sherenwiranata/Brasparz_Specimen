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
// Hook up hover/focus to update the preview weight
(() => {
  const root = document.documentElement;         // in case you want globals later
  const section = document.getElementById('weights');
  const list = document.getElementById('weightsList');

  function setActive(w){
    section.style.setProperty('--active-w', w);
  }

  // Preview on hover/focus; persist on click (nice for touch)
  list.addEventListener('pointerover', (e) => {
    const li = e.target.closest('.weight-item');
    if (!li) return;
    setActive(li.style.getPropertyValue('--w') || 50);
  });
  list.addEventListener('focusin', (e) => {
    const li = e.target.closest('.weight-item');
    if (!li) return;
    setActive(li.style.getPropertyValue('--w') || 50);
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('.weight-item');
    if (!li) return;
    setActive(li.style.getPropertyValue('--w') || 50);
  });

  // Optional: reset when leaving the list
  list.addEventListener('pointerout', (e) => {
    if (!list.contains(e.relatedTarget)) setActive(50);
  });
})();








(() => {
  const spot  = document.getElementById('alphaSpot');
  if (!spot) return;

  // ---- 1) Maintain aspect-ratio from the image ----
  const lower = spot.querySelector('.lower'); // use the image that defines layout
  const upper = spot.querySelector('.upper');

  function setSpotRatio(img){
    const w = img?.naturalWidth, h = img?.naturalHeight;
    if (w && h) spot.style.aspectRatio = `${w} / ${h}`;
  }
  [lower, upper].forEach(img => {
    if (!img) return;
    if (img.complete) setSpotRatio(img);
    else img.addEventListener('load', () => setSpotRatio(img), { once: true });
  });

  // ---- 2) Smooth follow of the reveal center (CSS --mx / --my) ----
  let mx = 50, my = 50;   // current (what we set)
  let tx = 50, ty = 50;   // target (where the user pointed)

  function setFromEvent(e){
    const r = spot.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const x = ((p.clientX - r.left) / r.width)  * 100;
    const y = ((p.clientY - r.top)  / r.height) * 100;
    tx = Math.max(0, Math.min(100, x));
    ty = Math.max(0, Math.min(100, y));
  }

  // Mouse + touch
  spot.addEventListener('pointermove', setFromEvent, { passive: true });
  spot.addEventListener('pointerdown', setFromEvent, { passive: true });
  spot.addEventListener('touchmove',   setFromEvent, { passive: true });
  spot.addEventListener('touchstart',  setFromEvent, { passive: true });

  // When leaving, drift back to center (your CSS :hover can still control --r)
  spot.addEventListener('pointerleave', () => { tx = 50; ty = 50; }, { passive: true });

  // Respect reduced motion: jump instead of lerp
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = reduce ? 1 : 0.12;

  function tick(){
    mx += (tx - mx) * lerp;
    my += (ty - my) * lerp;
    spot.style.setProperty('--mx', mx.toFixed(2) + '%');
    spot.style.setProperty('--my', my.toFixed(2) + '%');
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- 3) Optional keyboard control ----
  spot.tabIndex = 0; // make focusable
  spot.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 5 : 2;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':  tx = Math.max(0,   tx - step); break;
      case 'ArrowRight': tx = Math.min(100, tx + step); break;
      case 'ArrowUp':    ty = Math.max(0,   ty - step); break;
      case 'ArrowDown':  ty = Math.min(100, ty + step); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });
})();







(() => {
  const section = document.getElementById('charset');
  const right   = document.getElementById('charsetRight');
  const preview = document.getElementById('glyphPreview');
  const leftCol = document.querySelector('.charset__left');
  const box     = preview?.closest('.specimen-box');

  if (!section || !right || !preview || !leftCol || !box) return;

  /* ===== helpers ===== */
  const COLORS = [
    {bg:'#D33A2C', border:'#BE2F23'}, // red
    {bg:'#0B61C6', border:'#094FA4'}, // blue
    {bg:'#E2B100', border:'#C89B08'}  // yellow
  ];
  const rand = (n) => Math.floor(Math.random() * n);
  const setPreviewColors = () => {
    const c = COLORS[rand(COLORS.length)];
    box.style.setProperty('--specimen-bg', c.bg);
    box.style.borderColor = c.border;
    // also tint guide line color a touch toward the border
    box.style.setProperty('--tile-border', c.border + 'cc');
  };

  /* ===== preview update (called on hover/focus/click) ===== */
  let activeFeat = 'normal';
  function updatePreview(char, featToken = 'normal'){
    preview.textContent = char;
    activeFeat = featToken;
    preview.style.fontFeatureSettings = featToken;
    setPreviewColors();
    if (window.__updateSpecimenGuides) window.__updateSpecimenGuides();
  }

  /* ===== build groups/tiles ===== */
  const groups = [];
  function addGroup({ title, chars, feature }) {
    const group = document.createElement('div');
    group.className = 'group';
    group.innerHTML = `<h4>${title}</h4><div class="grid"></div>`;
    const grid = group.querySelector('.grid');
    const featToken = feature || 'normal';

    [...chars].forEach(ch => {
      const cell = document.createElement('button');
      cell.className = 'tile';
      cell.type = 'button';
      cell.innerHTML = `<span>${ch}</span>`;
      cell.addEventListener('pointerenter', () => updatePreview(ch, featToken));
      cell.addEventListener('focus',        () => updatePreview(ch, featToken));
      cell.addEventListener('click',        () => updatePreview(ch, featToken));
      grid.appendChild(cell);
    });

    // sentinels for sticky lock
    const start = document.createElement('div');
    start.className = 'group-sentinel start';
    start.style.cssText = 'height:1px;margin-top:-1px;';
    start.dataset.type = 'start';
    start.dataset.idx  = groups.length;

    const end = document.createElement('div');
    end.className = 'group-sentinel end';
    end.style.cssText = 'height:1px;margin-bottom:-1px;';
    end.dataset.type = 'end';
    end.dataset.idx  = groups.length;

    group.prepend(start);
    group.appendChild(end);
    right.appendChild(group);
    groups.push({ title, chars, feature: featToken, startEl: start, endEl: end });
  }

  const UC   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const LC   = "abcdefghijklmnopqrstuvwxyz";
  const NUM  = "0123456789";
  const PUNC = "!?,.;:–—()[]{}'\"/@#$%&*+=<>^~•…";

  addGroup({ title:"Uppercase", chars:UC });
  addGroup({ title:"Lowercase", chars:LC });
  addGroup({ title:"Numbers",   chars:NUM });
  addGroup({ title:"Punctuation", chars:PUNC });

  // stylistic sets (adjust to your font)
  addGroup({ title:"Uppercase — SS01", chars:UC, feature:'"ss01" 1' });
  addGroup({ title:"Lowercase — SS01", chars:LC, feature:'"ss01" 1' });

  // initial lock
  updatePreview('A', 'normal');

  /* ===== sticky “lock to group when its end crosses” ===== */
  let lastScrollY = window.scrollY;
  let lockedIdx = 0;
  function lockToGroup(i){
    lockedIdx = Math.max(0, Math.min(i, groups.length-1));
    const g = groups[lockedIdx];
    updatePreview(g.chars[0] || '•', g.feature || 'normal');
  }
  const stickyTop = parseFloat(getComputedStyle(leftCol).top) || 0;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const idx = +entry.target.dataset.idx;
      const type = entry.target.dataset.type;
      const down = window.scrollY > lastScrollY;
      lastScrollY = window.scrollY;
      if (!entry.isIntersecting) return;
      if (type==='end' && down)  lockToGroup(Math.min(idx+1, groups.length-1));
      if (type==='start' && !down) lockToGroup(idx);
    });
  }, { root:null, threshold:0, rootMargin:`-${stickyTop}px 0px 0px 0px` });
  groups.forEach(g=>{ io.observe(g.startEl); io.observe(g.endEl); });

  right.addEventListener('pointerleave', ()=>lockToGroup(lockedIdx));
  right.addEventListener('focusout', e=>{
    if(!right.contains(e.relatedTarget)) lockToGroup(lockedIdx);
  });

  /* ===== animated weights: 0 → 20 → 50 → 75 → 100 → 75 → 50 → 20 → … ===== */
  const seq = [0,20,50,75,100,75,50,20];
  let wi = 0, timer = null;

  function stepWeight(){
    const w = seq[wi];
    preview.style.setProperty('--wght', w);
    // keep active features applied
    preview.style.fontFeatureSettings = activeFeat;
    if (window.__updateSpecimenGuides) window.__updateSpecimenGuides();
    wi = (wi + 1) % seq.length;
  }

  function startAnim(){ if (!timer) timer = setInterval(stepWeight, 380); }
  function stopAnim(){ clearInterval(timer); timer = null; }
  startAnim();
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stopAnim() : startAnim();
  });

  /* ===== metrics-driven guides (same idea as yours) ===== */
  async function fontsReady(){
    if (document.fonts && document.fonts.ready) { try{ await document.fonts.ready; }catch{} }
  }
  function measureGlyph(text, fontCSS){
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = fontCSS;
    const m = ctx.measureText(text);
    return { asc: m.actualBoundingBoxAscent||0, desc: m.actualBoundingBoxDescent||0 };
  }
  function currentCanvasFont(){
    const cs = getComputedStyle(preview);
    const size = '200px';
    const weight = cs.fontWeight || '400';
    const family = cs.fontFamily || 'sans-serif';
    return `${weight} ${size} ${family}`;
  }
  function setGuideVars({ ascTop, xTop, baseTop, descTop }){
    box.style.setProperty('--asc-y', `${ascTop.toFixed(2)}%`);
    box.style.setProperty('--xh-y', `${xTop.toFixed(2)}%`);
    box.style.setProperty('--base-y', `${baseTop.toFixed(2)}%`);
    box.style.setProperty('--desc-y', `${descTop.toFixed(2)}%`);
  }
  async function syncGuides(){
    await fontsReady();
    const fontCSS = currentCanvasFont();
    const cap = measureGlyph('H', fontCSS);
    const asc = measureGlyph('h', fontCSS);
    const x   = measureGlyph('x', fontCSS);
    const d   = measureGlyph('p', fontCSS);
    const ascent  = Math.max(cap.asc, asc.asc, x.asc);
    const descent = Math.max(d.desc, 0);
    const total   = ascent + descent || 1;
    const ascTop  = (ascent - asc.asc) / total * 100;
    const xTop    = (ascent - x.asc)   / total * 100;
    const baseTop =  ascent            / total * 100;
    const descTop = (ascent + d.desc)  / total * 100;
    setGuideVars({ ascTop, xTop, baseTop, descTop });
  }
  window.addEventListener('load', syncGuides);
  window.addEventListener('resize', syncGuides);
  window.__updateSpecimenGuides = syncGuides;
})();

  






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
