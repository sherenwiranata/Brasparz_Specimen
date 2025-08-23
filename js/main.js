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


(function () {
  const v = document.getElementById('brasparzModularity');
  if (!v) return;
  const setRate = () => { v.defaultPlaybackRate = 1.5; v.playbackRate = 1.5; };
  if (v.readyState >= 1) setRate();
  else v.addEventListener('loadedmetadata', setRate, { once: true });
  v.play().catch(()=>{});
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
  const videoEl = document.getElementById('glyphVideo');
  const msgEl   = document.getElementById('glyphMsg');
  const leftCol = document.querySelector('.charset__left');
  const box     = preview?.closest('.specimen-box');
  if (!section || !right || !preview || !leftCol || !box || !videoEl || !msgEl) return;

  /* ---------- Accent color sync (random each hover) ---------- */
  const COLORS = [
    { bg:'#D33A2C', border:'#BE2F23' }, // red
    { bg:'#0B61C6', border:'#094FA4' }, // blue
    { bg:'#E2B100', border:'#C89B08' }  // yellow
  ];
  const rand = n => Math.floor(Math.random() * n);
  function setPreviewColors(){
    const c = COLORS[rand(COLORS.length)];
    box.style.setProperty('--specimen-bg', c.bg);
    box.style.borderColor = c.border;
    section.style.setProperty('--accent', c.bg);
    section.style.setProperty('--accent-fg', 'var(--ink)');
  }

  /* ---------- Which groups use video instead of live glyph ---------- */
  const VIDEO_SOURCES = {
    'Initial Uppercase':                     'assets/video/InitialUppercase.mp4',
    'Initial Uppercase — Alternates & SS':   'assets/video/InitialUpperCasesAlternates.mp4'
  };

  /* ---------- Show glyph / Show video helpers ---------- */
  let activeFeat = 'normal';
  let msgTimer = null;

  function hideVideoUI(){
    // stop message & video UI, but don't touch glyph
    clearTimeout(msgTimer);
    msgTimer = null;
    msgEl.classList.add('is-hidden');
    videoEl.pause();
    videoEl.classList.add('is-hidden');
  }

  function showGlyph(text, feat = 'normal'){
    hideVideoUI();
    preview.classList.remove('is-hidden');
    preview.textContent = text;
    activeFeat = feat;
    preview.style.fontFeatureSettings = feat;
    setPreviewColors();
  }

  function showVideoFor(groupTitle){
    const src = VIDEO_SOURCES[groupTitle];
    if (!src) return false;

    // swap to video
    preview.classList.add('is-hidden');
    videoEl.classList.remove('is-hidden');

    // message: show then auto-hide after 3s (video keeps looping)
    clearTimeout(msgTimer);
    msgEl.classList.remove('is-hidden');
    msgTimer = setTimeout(() => {
      msgEl.classList.add('is-hidden');
    }, 3000);

    // prepare video
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;
    // only reload if changed to avoid stutter
    const abs = new URL(src, location.href).href;
    if (videoEl.src !== abs) {
      videoEl.src = src;
      videoEl.load();
    }
    // play (handle autoplay promises quietly)
    const tryPlay = () => videoEl.play().catch(()=>{ /* ignore */ });
    if (videoEl.readyState >= 3) {
      tryPlay();
    } else {
      const onCanPlay = () => { tryPlay(); videoEl.removeEventListener('canplay', onCanPlay); };
      videoEl.addEventListener('canplay', onCanPlay);
    }

    // still randomize the accent to match your behavior
    setPreviewColors();
    return true;
  }

  function handleHover(groupTitle, txt, feat){
    if (VIDEO_SOURCES[groupTitle]) {
      showVideoFor(groupTitle);
    } else {
      showGlyph(txt, feat);
    }
  }

  /* ================= Data (same as your working sets) ================= */
  const UC   = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
  const LC   = [..."abcdefghijklmnopqrstuvwxyz"];
  const NUM  = [..."0123456789"];
  const PUNC = [..."!?,.;:–—()'\"/%&"];

  const UC_SS = [..."AEGIMORSTWD"];               // keep
  const LC_SS01 = [..."abdemnrwy"];               // keep (ss01)
  const LC_SS_ITEMS = [
    ...LC_SS01.map(ch => ({ txt: ch, feat: '"ss01" 1' })),
    { txt: 'm', feat: '"ss02" 1' },               // extra ss02 variants in same grid
    { txt: 'n', feat: '"ss02" 1' }
  ];

  const LIGAS = ["ff","fi","fl","ft","ss","OO"];  // keep

  // We keep tiles for the two “Initial…” groups so the grid looks consistent,
  // but hovering them will play video instead of showing a live glyph.
  const INIT_UC     = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]; // shown via video on hover
  const INIT_UC_SS  = [..."AECGIMORSTW"];               // shown via video on hover

  /* ================= Builder ================= */
  const groups = []; // for sticky lock

  function addGroup({ title, chars, items, feature }) {
    const tiles = items
      ? items.map(it => (typeof it === 'string' ? ({ txt: it, feat: feature || 'normal' }) : it))
      : [...(chars ?? "")].map(ch => ({ txt: ch, feat: feature || 'normal' }));

    const group = document.createElement('div');
    group.className = 'group';
    group.innerHTML = `<h4>${title}</h4><div class="grid"></div>`;
    const grid = group.querySelector('.grid');

    tiles.forEach(({ txt, feat }) => {
      const cell = document.createElement('button');
      cell.className = 'tile';
      cell.type = 'button';
      cell.innerHTML = `<span>${txt}</span>`;
      cell.addEventListener('pointerenter', () => handleHover(title, txt, feat));
      cell.addEventListener('focus',        () => handleHover(title, txt, feat));
      cell.addEventListener('click',        () => handleHover(title, txt, feat));
      grid.appendChild(cell);
    });

    // Sticky sentinels
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

    const first = tiles[0] || { txt: '•', feat: 'normal' };
    groups.push({ title, firstText: first.txt, firstFeat: first.feat, startEl: start, endEl: end });
  }

  /* ================= Build groups ================= */
  addGroup({ title: "Uppercase",   chars: UC });
  addGroup({ title: "Lowercase",   chars: LC });
  addGroup({ title: "Numbers",     chars: NUM });
  addGroup({ title: "Punctuation", chars: PUNC });

 addGroup({
  title: "Initial Uppercase (TITL)",
  chars: INIT_UC,
  feature: '"titl" 1'
});

  addGroup({ title: "Initial Uppercase — Alternates & SS", chars: INIT_UC_SS, feature: 'normal' }); // hover plays video

  addGroup({ title: "Uppercase — Alternates & Stylistic Sets", chars: UC_SS, feature: '"ss01" 1' });
  addGroup({ title: "Lowercase — Alternates & Stylistic Sets", items: LC_SS_ITEMS });
  addGroup({ title: "Ligatures", items: LIGAS, feature: '"liga" 1, "dlig" 1' });

  /* ------------- Initial preview + sticky lock ------------- */
  function lockToGroup(i){
    const idx = Math.max(0, Math.min(i, groups.length - 1));
    const g = groups[idx];
    // When locking to a video group, show the video immediately; otherwise show glyph
    if (VIDEO_SOURCES[g.title]) {
      showVideoFor(g.title);
    } else {
      showGlyph(g.firstText, g.firstFeat);
    }
    lockedIdx = idx;
  }
  let lockedIdx = 0;
  lockToGroup(0);

  let lastScrollY = window.scrollY;
  const stickyTop = parseFloat(getComputedStyle(leftCol).top) || 0;
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      const idx  = +entry.target.dataset.idx;
      const type = entry.target.dataset.type;
      const down = window.scrollY > lastScrollY;
      lastScrollY = window.scrollY;
      if (!entry.isIntersecting) return;
      if (type==='end'   && down)  lockToGroup(Math.min(idx+1, groups.length-1));
      if (type==='start' && !down) lockToGroup(idx);
    });
  }, { root:null, threshold:0, rootMargin:`-${stickyTop}px 0px 0px 0px` });
  groups.forEach(g => { io.observe(g.startEl); io.observe(g.endEl); });

  right.addEventListener('pointerleave', ()=>lockToGroup(lockedIdx));
  right.addEventListener('focusout', e => { if (!right.contains(e.relatedTarget)) lockToGroup(lockedIdx); });

  /* -------- Optional: variable weight “breathing” -------- */
  const seq = [0,20,50,75,100,75,50,20];
  let wi = 0, timer = null;
  function stepWeight(){
    preview.style.setProperty('--wght', seq[wi]);
    preview.style.fontFeatureSettings = activeFeat;
    wi = (wi + 1) % seq.length;
  }
  function startAnim(){ if (!timer) timer = setInterval(stepWeight, 380); }
  function stopAnim(){ clearInterval(timer); timer = null; }
  startAnim();
  document.addEventListener('visibilitychange', () => document.hidden ? stopAnim() : startAnim());
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
