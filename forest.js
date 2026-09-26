/* 수업 도구 숲 — 캔버스 숲 엔진 (2026-09-26)
   Forest({ box, canvas, lays, mode:'hero'|'full', trees, hubs, tour, onTree, track, onFrame })
   · hero : 한 화면짜리. 하늘·나무·땅 밑 뿌리 띠까지, 스크롤 연출 없음 (학생 입구 첫 화면)
   · full : track(긴 스크롤 상자) 진행도에 따라 카메라가 땅속으로 내려간다 + 질문 따라가기
   나무 def: { id, f(가로 위치 0~1), s(크기), name, sub, url | go, hue:[색상, 채도] }
   뿌리마디 def: { id, f, d(땅속 깊이 0~1), name, sub, links:[나무 id…] } */
(function(){
'use strict';
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function grow(r, len, w, depth, max){
  const n = { len, w, ang:0, kids:[], leaves:null, ph:r() * 6.28 };
  if(depth >= max - 2){ n.leaves = []; const k = depth >= max ? 9 + (r() * 6 | 0) : 4;
    for(let i = 0; i < k; i++){ const a = r() * 6.28, d = Math.sqrt(r()) * len * (depth >= max ? 1.5 : 1.1); n.leaves.push([Math.cos(a) * d, Math.sin(a) * d * .85, (.35 + r() * .6), r()]); }
    if(depth >= max) return n; }
  const kids = depth < 1 ? 3 : (r() < .32 ? 3 : 2);
  for(let i = 0; i < kids; i++){
    const spread = depth < 1 ? .5 : .42, c = grow(r, len * (.7 + r() * .12), w * .66, depth + 1, max);
    c.ang = (kids === 3 ? (i - 1) * spread : (i ? 1 : -1) * spread * .75) + (r() - .5) * .35;
    n.kids.push(c);
  }
  return n;
}
/* 역광 — 속은 어둡고, 해 쪽 가장자리만 따뜻하게 */
const palette = ([h, s]) => [`hsl(${h} ${s * .7}% 7%)`, `hsl(${h} ${s * .8}% 11%)`, `hsl(${h - 8} ${s}% 16%)`, `hsl(${h - 30} ${s + 6}% 26%)`, `hsl(${h - 80} 62% 58%)`];

function curvePts(ax, ay, bx, by, r, bend, W, H){
  const pts = [], mx = (ax + bx) / 2 + (r() - .5) * W * .08, my = (ay + by) / 2 + (r() - .2) * H * .08;
  for(let i = 0; i <= 90; i++){ const k = i / 90, u = 1 - k;
    const x = u * u * u * ax + 3 * u * u * k * ax + 3 * u * k * k * (mx + bend) + k * k * k * bx;
    const y = u * u * u * ay + 3 * u * u * k * (ay + (by - ay) * .55) + 3 * u * k * k * my + k * k * k * by;
    pts.push([x + Math.sin(k * 19 + ax) * 3.2, y + Math.cos(k * 13 + by) * 2.4]); }
  return pts;
}

window.Forest = function(o){
  const cv = o.canvas, ctx = cv.getContext('2d'), full = o.mode === 'full';
  let W, H, DPR, WH, GY, camY = 0, far, under, spr, trees = [], hubs = [], links = [], motes = [], flies = [], tour = null, alive = true, visible = true;
  const tById = id => trees.find(t => t.id === id), hById = id => hubs.find(h => h.id === id);
  const api = {};

  function mkTree(def, i){
    const r = rng(1009 + i * 7919), small = W < 640;
    const hgt = (full ? (small ? Math.min(H * .2, W * .3) : Math.min(H * .3, W * .19)) : (small ? Math.min(H * .19, W * .26) : Math.min(H * .23, W * .13))) * def.s;
    return Object.assign({}, def, { x:def.f * W, y:GY, h:hgt, root:grow(r, hgt * .34, hgt * .045, 0, 6), lit:0, litT:0, pal:palette(def.hue || [140, 36]), sun:def.f < .7 ? 1 : -1 });
  }
  function drawTree(t, now, cam){
    const sw = reduce ? 0 : now * .00085, buckets = [[], [], [], [], []]; let top = 1e9;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#0d0a07';
    (function walk(n, x, y, a, d){
      const wob = Math.sin(sw + n.ph + d * .5) * .022 * d + Math.sin(sw * 2.3 + n.ph) * .006 * d;
      const aa = a + n.ang + wob, x2 = x + Math.sin(aa) * n.len, y2 = y - Math.cos(aa) * n.len;
      ctx.lineWidth = Math.max(.8, n.w); ctx.beginPath(); ctx.moveTo(x, y - cam); ctx.lineTo(x2, y2 - cam); ctx.stroke();
      if(n.leaves) n.leaves.forEach(L => { const lx = x2 + L[0], ly = y2 + L[1];
        const lum = (lx - t.x) / (t.h * .7) * t.sun * .55 + (t.y - t.h * 1.05 - ly) / (t.h * .6) * .45 + (L[3] - .5) * .5;
        const bi = lum > .78 ? 4 : lum > .45 ? 3 : lum > .05 ? 2 : lum > -.4 ? 1 : 0;
        buckets[bi].push(lx, ly - cam, L[2] * t.h * .03 * (bi === 4 ? .7 : 1)); if(ly < top) top = ly; });
      n.kids.forEach(k => walk(k, x2, y2, aa, d + 1));
    })(t.root, t.x, t.y, 0, 0);
    t.top = top;
    for(let b = 0; b < 5; b++){ const arr = buckets[b]; if(!arr.length) continue;
      ctx.fillStyle = t.pal[b]; ctx.globalAlpha = b === 4 ? .8 : .95; ctx.beginPath();
      for(let i = 0; i < arr.length; i += 3){ ctx.moveTo(arr[i] + arr[i + 2], arr[i + 1]); ctx.arc(arr[i], arr[i + 1], arr[i + 2], 0, 6.283); }
      ctx.fill(); }
    ctx.globalAlpha = 1;
    if(t.litT > .01){ ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t.litT * .5;
      const cy = t.y - t.h * .8 - cam, g = ctx.createRadialGradient(t.x, cy, 0, t.x, cy, t.h * .75);
      g.addColorStop(0, 'rgba(255,220,140,.55)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g;
      ctx.fillRect(t.x - t.h, cy - t.h, t.h * 2, t.h * 2); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  }
  function paintFar(){
    const c = document.createElement('canvas'); c.width = W * DPR; c.height = (GY + 40) * DPR;
    const g = c.getContext('2d'); g.scale(DPR, DPR);
    const sky = g.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#0b1d22'); sky.addColorStop(.38, '#1f4146'); sky.addColorStop(.7, '#6c7a62'); sky.addColorStop(.9, '#d9a56a'); sky.addColorStop(1, '#f1c688');
    g.fillStyle = sky; g.fillRect(0, 0, W, GY + 40);
    const sun = g.createRadialGradient(W * .7, GY - H * .06, 0, W * .7, GY - H * .06, H * .6);
    sun.addColorStop(0, 'rgba(255,226,160,.85)'); sun.addColorStop(.12, 'rgba(255,205,130,.45)'); sun.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, GY + 40);
    const r = rng(77);
    for(let i = 0; i < 160; i++){ g.fillStyle = `rgba(255,248,230,${r() * .5})`; g.fillRect(r() * W, r() * GY * .45, 1.2, 1.2); }
    [[.62, '#56695c', .5, 2.2], [.75, '#34493f', .72, 1.6], [.88, '#1b2d28', .92, 1.15]].forEach(([yy, col, al, sc], L) => {
      g.globalAlpha = al; g.fillStyle = col; g.filter = L < 2 ? `blur(${2.4 - L * 1.2}px)` : 'none';
      const base = GY * yy + GY * .25 * (1 - yy);
      g.beginPath(); g.moveTo(0, GY + 40);
      for(let x = 0; x <= W; x += 4) g.lineTo(x, base + Math.sin(x * .004 + L) * 14 + Math.sin(x * .013 + L * 3) * 6);
      g.lineTo(W, GY + 40); g.fill();
      const n = Math.round(W / (26 * sc));
      for(let i = 0; i < n; i++){ const x = (i + r() * .8) * (W / n), hh = (20 + r() * 42) * sc * (H / 900), yb = base + Math.sin(x * .004 + L) * 14 + 4;
        g.beginPath(); for(let q = 0; q < 5; q++){ const ox = (r() - .5) * hh * .7, oy = -hh * (.35 + r() * .5), rr = hh * (.22 + r() * .2); g.moveTo(x + ox + rr, yb + oy); g.arc(x + ox, yb + oy, rr, 0, 6.283); }
        g.rect(x - hh * .5, yb - hh * .4, hh, hh * .4 + 6); g.fill(); }
      g.filter = 'none'; g.globalAlpha = 1;
      const fog = g.createLinearGradient(0, base - 40, 0, base + 60);
      fog.addColorStop(0, 'rgba(220,190,150,0)'); fog.addColorStop(.6, `rgba(220,190,150,${.16 - L * .04})`); fog.addColorStop(1, 'rgba(220,190,150,0)');
      g.fillStyle = fog; g.fillRect(0, base - 40, W, 100);
    });
    const gr = g.createLinearGradient(0, GY - 26, 0, GY + 30); gr.addColorStop(0, '#16261f'); gr.addColorStop(1, '#0e1712');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, GY + 40);
    for(let x = 0; x <= W; x += 3) g.lineTo(x, GY - 6 - Math.abs(Math.sin(x * .9)) * 5 - Math.sin(x * .01) * 4);
    g.lineTo(W, GY + 40); g.fill();
    return c;
  }
  function paintUnder(){
    const UH = WH - GY, c = document.createElement('canvas'); c.width = W * DPR; c.height = UH * DPR;
    const g = c.getContext('2d'); g.scale(DPR, DPR);
    const soil = g.createLinearGradient(0, 0, 0, UH);
    soil.addColorStop(0, '#171109'); soil.addColorStop(.08, '#120d08'); soil.addColorStop(1, '#050403');
    g.fillStyle = soil; g.fillRect(0, 0, W, UH);
    const r = rng(4242);
    for(let i = 0; i < W * UH / 260; i++){ g.fillStyle = `rgba(${150 + r() * 60 | 0},${110 + r() * 40 | 0},${70 + r() * 30 | 0},${r() * .09})`; g.fillRect(r() * W, r() * UH, 1 + r() * 1.5, 1 + r() * 1.5); }
    for(let i = 0; i < 90; i++){ g.fillStyle = `rgba(90,70,50,${.12 + r() * .15})`; g.beginPath(); g.ellipse(r() * W, r() * UH, 2 + r() * 7, 1.5 + r() * 4, r() * 3, 0, 6.283); g.fill(); }
    g.lineCap = 'round';
    const seeds = trees.map(t => [t.x, 0, 1]).concat(Array.from({ length:Math.round(W / 28 * (UH / H)) }, () => [r() * W, r() * UH, 0]));
    seeds.forEach(([sx, sy, isTree]) => {
      const stack = [[sx, sy, Math.PI / 2 + (r() - .5) * (isTree ? .9 : 3), isTree ? 130 : 60, isTree ? 1.6 : .7]];
      let guard = 0;
      while(stack.length && guard++ < (isTree ? 900 : 180)){
        let [x, y, a, life, w] = stack.pop();
        g.strokeStyle = `rgba(232,190,120,${isTree ? .16 : .07})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
        for(let s = 0; s < life; s += 1){
          a += (r() - .5) * .5 + (Math.PI / 2 - a) * .02; x += Math.cos(a) * 4; y += Math.sin(a) * 4;
          g.lineTo(x, y); if(y > UH || x < -20 || x > W + 20) break;
          if(r() < .045 && w > .25) stack.push([x, y, a + (r() < .5 ? -1 : 1) * (.5 + r() * .7), life * (.35 + r() * .4), w * .7]);
        }
        g.stroke();
      }
    });
    links = [];
    const lr = rng(99);
    hubs.forEach(h => h.links.forEach(tid => {
      const t = tById(tid); if(!t) return;
      const pts = curvePts(t.x, 0, h.x, h.y - GY, lr, (h.x - t.x) * .18, W, H);
      links.push({ t:tid, h:h.id, pts:pts.map(p => [p[0], p[1] + GY]) });
      [[7, 'rgba(242,190,110,.06)'], [3.2, 'rgba(242,190,110,.22)'], [1.3, 'rgba(255,226,170,.75)']].forEach(([lw, col]) => {
        g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); });
    }));
    const sh = g.createLinearGradient(0, 0, 0, 90); sh.addColorStop(0, 'rgba(5,8,6,.9)'); sh.addColorStop(1, 'rgba(5,8,6,0)');
    g.fillStyle = sh; g.fillRect(0, 0, W, 90);
    return c;
  }
  function mkGlow(){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,244,210,1)'); rg.addColorStop(.25, 'rgba(255,214,140,.55)'); rg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return c; }

  function mkLabels(){
    const L = o.lays; L.innerHTML = '';
    trees.forEach((t, i) => { const a = document.createElement(t.url ? 'a' : 'button');
      a.className = 'fz-lab'; if(t.url){ a.href = t.url; if(!t.self){ a.target = '_blank'; a.rel = 'noopener'; } } else a.type = 'button';
      a.innerHTML = '<span class="no">' + String(i + 1).padStart(2, '0') + '</span><b>' + t.name + '</b><small>' + (t.sub || '') + '</small><i></i>';
      a.addEventListener('mouseenter', () => t.lit = 1); a.addEventListener('mouseleave', () => t.lit = 0);
      a.addEventListener('focus', () => t.lit = 1); a.addEventListener('blur', () => t.lit = 0);
      if(!t.url) a.addEventListener('click', () => o.onTree && o.onTree(t));
      L.appendChild(a); t.el = a; });
    if(full) hubs.forEach((h, i) => { const d = document.createElement('div');
      d.className = 'fz-lab hub';
      d.innerHTML = '<i></i><span class="no">ROOT ' + String.fromCharCode(65 + i) + '</span><b>' + h.name + '</b><small>' + h.sub + '</small>';
      L.appendChild(d); h.el = d; });
  }

  function build(){
    DPR = Math.min(devicePixelRatio || 1, 2); W = o.box.clientWidth; H = o.box.clientHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    WH = full ? H * 2.35 : H; GY = full ? H * .8 : H * .74;
    trees = (o.trees || []).map(mkTree);
    hubs = (o.hubs || []).map(h => Object.assign({}, h, { x:h.f * W, y:full ? GY + (WH - GY) * h.d : GY + (WH - GY) * (.55 + h.d * .35), lit:0 }));
    far = paintFar(); under = paintUnder(); spr = mkGlow(); mkLabels();
    const r = rng(5);
    motes = links.flatMap(l => Array.from({ length:3 }, (_, j) => ({ l, k:(r() + j / 3) % 1, v:(.00006 + r() * .00008) * (r() < .3 ? -1 : 1) })));
    flies = Array.from({ length:Math.round(W / 38) }, () => ({ x:r() * W, y:GY - r() * H * .45, ph:r() * 6.3, sp:.3 + r() * .6 }));
  }
  function progress(){ if(!o.track) return 0; const tr = o.track, max = tr.offsetHeight - innerHeight; return clamp((scrollY - tr.offsetTop) / max, 0, 1); }

  function frame(now){
    if(!alive) return;
    requestAnimationFrame(frame);
    if(!visible || document.hidden) return;
    const p = o.forceP != null ? o.forceP : progress();
    const target = tour ? tour.cam : ease(p) * (WH - H);
    camY = tour ? lerp(camY, target, .08) : target;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#050403'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(far, 0, -camY, W, GY + 40);
    ctx.drawImage(under, 0, GY - camY, W, WH - GY);
    ctx.globalCompositeOperation = 'lighter';
    motes.forEach(m => { if(!reduce) m.k = (m.k + m.v * 16 + 1) % 1; const P = m.l.pts[Math.floor(m.k * (m.l.pts.length - 1))];
      const s = 14 * (tour && tour.lit.has(m.l) ? 1.8 : 1); ctx.globalAlpha = .75; ctx.drawImage(spr, P[0] - s / 2, P[1] - camY - s / 2, s, s); });
    if(tour) tour.lit.forEach(l => { ctx.globalAlpha = .9; ctx.strokeStyle = 'rgba(255,230,170,.9)'; ctx.lineWidth = 2.4; ctx.beginPath();
      l.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1] - camY) : ctx.moveTo(q[0], q[1] - camY)); ctx.stroke(); });
    hubs.forEach((h, i) => { const pulse = reduce ? .7 : .55 + Math.sin(now * .0016 + i * 2) * .25, y = h.y - camY, s = (full ? 150 : 90) * (h.lit ? 1.6 : 1);
      ctx.globalAlpha = pulse; ctx.drawImage(spr, h.x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1; ctx.drawImage(spr, h.x - 18, y - 18, 36, 36); });
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    if(full) hubs.forEach(h => { ctx.strokeStyle = 'rgba(255,226,170,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(h.x, h.y - camY, 26 + (h.lit ? 6 : 0), 0, 6.283); ctx.stroke(); });
    trees.forEach(t => { t.litT = lerp(t.litT, t.lit ? 1 : 0, .12); if(t.y - camY > -50 && t.y - t.h * 1.6 - camY < H) drawTree(t, now, camY); });
    if(!reduce){ ctx.globalCompositeOperation = 'lighter';
      flies.forEach(f => { const x = f.x + Math.sin(now * .0004 * f.sp + f.ph) * 30, y = f.y + Math.cos(now * .0005 * f.sp + f.ph) * 18 - camY, a = .35 + Math.sin(now * .003 * f.sp + f.ph) * .35;
        if(y < -10 || y > H) return; ctx.globalAlpha = Math.max(0, a); ctx.drawImage(spr, x - 7, y - 7, 14, 14); });
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    if(tour && tour.spark){ const [x, y] = tour.spark; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(spr, x - 45, y - camY - 45, 90, 90); ctx.drawImage(spr, x - 14, y - camY - 14, 28, 28); ctx.globalCompositeOperation = 'source-over'; }
    const pp = tour ? camY / Math.max(1, WH - H) : p;
    /* 좁은 화면: 이름표를 두 줄 기준선에 맞춰 엇갈리게 (나무 높이가 달라도 줄이 섞이지 않게) */
    const minTop = Math.min(...trees.map(t => t.top || t.y - t.h * 1.2));
    trees.forEach((t, i) => { const y = (W < 640 ? minTop - 6 - (i % 2 ? 40 : 0) : (t.top || t.y - t.h * 1.2) - 6) - camY;
      t.el.style.transform = `translate(${clamp(t.x, 52, W - 52)}px,${y}px) translate(-50%,-100%)`;
      t.el.classList.toggle('on', y > 30 && y < H + 60 && (!full || pp > .015 || !!tour)); t.el.classList.toggle('lit', !!t.lit); });
    hubs.forEach(h => { if(!h.el) return; const y = h.y + 52 - camY; h.el.style.transform = `translate(${clamp(h.x, 90, W - 90)}px,${y}px) translate(-50%,0)`;
      h.el.classList.toggle('on', y > 0 && y < H - (full ? 250 : 40)); });
    o.onFrame && o.onFrame(pp, !!tour);
  }

  /* 캔버스에서도 나무를 누를 수 있게 */
  const treeAt = (x, y) => trees.find(t => Math.abs(x - t.x) < t.h * .5 && y + camY > (t.top || t.y - t.h) && y + camY < t.y);
  const rel = e => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  cv.addEventListener('mousemove', e => { const t = treeAt(...rel(e)); trees.forEach(x => { if(!x.el.matches(':hover')) x.lit = x === t ? 1 : 0; }); cv.style.cursor = t ? 'pointer' : ''; });
  cv.addEventListener('mouseleave', () => trees.forEach(x => x.lit = 0));
  cv.addEventListener('click', e => { const t = treeAt(...rel(e)); if(!t) return; if(t.url){ t.self ? (location.href = t.url) : window.open(t.url, '_blank', 'noopener'); } else o.onTree && o.onTree(t); });

  /* ── 한 학생의 질문 따라가기 (full) ── */
  const ptOf = id => { const t = tById(id); if(t) return [t.x, t.y - t.h * .78]; const h = hById(id); return [h.x, h.y]; };
  function route(a, b){
    const l = links.find(x => x.t === a && x.h === b) || links.find(x => x.t === b && x.h === a);
    if(l){ let pts = l.t === a ? l.pts.slice() : l.pts.slice().reverse(); if(tById(a)) pts.unshift(ptOf(a)); if(tById(b)) pts.push(ptOf(b)); return { pts, lit:[l] }; }
    const via = hubs.find(h => h.links.includes(a) && h.links.includes(b));
    if(via){ const r1 = route(a, via.id), r2 = route(via.id, b); return { pts:r1.pts.concat(r2.pts), lit:r1.lit.concat(r2.lit) }; }
    return { pts:[ptOf(a), ptOf(b)], lit:[] };
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function mark(id, on){ const t = tById(id), h = hById(id); if(t){ t.lit = on ? 1 : 0; t.el.classList.toggle('lit', on); } if(h){ h.lit = on ? 1 : 0; } }
  api.tour = async function(ui){
    if(tour || !o.tour) return; tour = { cam:camY, spark:null, lit:new Set(), stop:false }; ui.start && ui.start();
    const T = o.tour;
    for(let i = 0; i < T.length && !tour.stop; i++){
      const [id, txt] = T[i];
      if(i){ const r = route(T[i - 1][0], id); r.lit.forEach(l => tour.lit.add(l));
        const N = r.pts.length, dur = reduce ? 1 : clamp(N * 26, 1400, 3400), t0 = performance.now();
        await new Promise(res => { (function f(now){ if(tour.stop) return res();
          const k = ease(Math.min(1, (now - t0) / dur)), fi = k * (N - 1), a = r.pts[fi | 0], b = r.pts[Math.min(N - 1, (fi | 0) + 1)], q = fi % 1;
          tour.spark = [lerp(a[0], b[0], q), lerp(a[1], b[1], q)]; tour.cam = clamp(tour.spark[1] - H * .45, 0, WH - H);
          k < 1 ? requestAnimationFrame(f) : res(); })(t0); });
      } else { tour.spark = ptOf(id); tour.cam = clamp(tour.spark[1] - H * .45, 0, WH - H); }
      T.forEach(x => mark(x[0], false)); mark(id, true); ui.step && ui.step(i, txt);
      await sleep(tour.stop ? 0 : 2900);
    }
    if(!tour.stop){ ui.done && ui.done(); await sleep(2200); }
    T.forEach(x => mark(x[0], false));
    if(o.track){ const tr = o.track, max = tr.offsetHeight - innerHeight, want = camY / (WH - H); let lo = 0, hi = 1;
      for(let k = 0; k < 20; k++){ const m = (lo + hi) / 2; ease(m) < want ? lo = m : hi = m; } scrollTo({ top:tr.offsetTop + lo * max }); }
    tour = null; ui.end && ui.end();
  };
  api.stopTour = () => { if(tour) tour.stop = true; };
  api.touring = () => !!tour;
  api.destroy = () => { alive = false; };

  if('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(o.box);
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(build, 180); });
  build(); requestAnimationFrame(frame);
  return api;
};
})();
