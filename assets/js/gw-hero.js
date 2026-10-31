// Homepage hero: a supermassive black-hole binary and the gravitational waves it radiates.
//
// Physics (leading quadrupole order, quasi-circular orbit; time compressed for display):
//   separation      a(t) = a0 (1 - t/tau)^(1/4)
//   orbital freq.   w(t) = w0 (1 - t/tau)^(-3/8)            (Kepler: w ∝ a^(-3/2))
//   orbital phase   P(t) = (8/5) w0 tau [1 - (1 - t/tau)^(5/8)]
//   GW amplitude    A(t) ∝ w(t)^(2/3) ∝ 1/a(t)
// Viewed face-on, the dominant (l = m = 2) radiation in the orbital plane is
//   h+(r, phi, t) ∝ A(t_r) cos(2 P(t_r) - 2 phi) / r,   with retarded time t_r = t - r/c:
// a two-armed trailing spiral that tightens and brightens as the binary chirps. Extending the
// same law to t < 0 means the far field correctly shows the earlier, wider orbit. When the
// horizons touch, the remnant (larger, as the area theorem requires) rings down at a fixed
// quasi-normal-mode frequency, e-folding in about one cycle, and the final burst propagates
// outward. The scene then fades and a new binary forms — black holes never split.
// The grid is pulled toward each mass (a 1/r "well", for intuition only); its brightness traces h+.
// A small readout plots the same h+ against retarded time u = t - r/c, so it runs in step with
// the binary: it is what any distant detector records, shifted by its light-travel time r/c.
(() => {
  const canvas = document.querySelector('[data-gw-hero]');
  const hero = canvas && canvas.closest('.hero');
  if (!canvas || !hero || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Three stacked layers: a static starfield, the soft field (low resolution, upscaled by the
  // compositor via CSS) and the grid + black holes (full resolution, redrawn every frame).
  const layer = () => {
    const el = document.createElement('canvas');
    el.className = 'hero-layer';
    el.setAttribute('aria-hidden', 'true');
    canvas.before(el);
    return el;
  };
  const starsEl = layer();
  const fieldEl = layer();
  const fieldCtx = fieldEl.getContext('2d');
  const readout = hero.querySelector('[data-gw-readout]');
  const rctx = readout && readout.getContext('2d');

  // ── Orbit and radiation (times in seconds) ────────────────────────────
  const P0 = 7.5;                    // orbital period at t = 0
  const W0 = (2 * Math.PI) / P0;
  const TAU = 48;                    // coalescence time measured from t = 0
  const Q = 0.7;                     // mass ratio m2/m1 (radii ∝ mass)
  const FIRST_START = 0.66 * TAU;    // first view reaches merger in ~16 s
  const LATER_START = 0.3 * TAU;
  const FADE_IN = 2.5, FADE_OUT = 2.5;

  // ── Rendering ─────────────────────────────────────────────────────────
  const STEP = 8;                    // px between samples along a grid line
  const LEVELS = 16;                 // brightness buckets (one stroke per bucket)
  const GAIN = 2.2;                  // strain → brightness (tanh-compressed)
  const FIELD_SCALE = 4;             // the soft field layer is rendered at 1/4 resolution
  const FIELD_ALPHA = 0.18;
  const WELL = 0.55;                 // depth of the 1/r grid wells, in units of a0^2
  const CURSOR_WELL = 0.16;
  const TRACE_SPAN = 12;             // seconds of strain history in the readout
  const TRACE_N = 360;               // samples across it

  let W = 1, H = 1, dpr = 1, cx = 0, cy = 0, a0 = 60, R1 = 8, c = 70, grid = 60;
  let gx0 = 0, gy0 = 0, rMax = 1, rRef = 250, rIn = 60, soft = 40, dMax = 30;
  let ampT = new Float32Array(2), psiT = new Float32Array(2), heatT = new Float32Array(2);
  let uM = 1, tMerge = TAU, wM = W0, phiM = 0, aM = 1, omegaQnm = 1, tRd = 1, tEnd = TAU;
  let fieldImg = null;
  let rw = 0, rh = 0, traceStroke = null;

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  function derive() {
    const contact = clamp((R1 * (1 + Q)) / a0, 0.08, 0.4);   // a = R1 + R2 when horizons touch
    uM = contact ** 4;
    tMerge = TAU * (1 - uM);
    wM = W0 * uM ** -0.375;
    phiM = 1.6 * W0 * TAU * (1 - uM ** 0.625);
    aM = 1 / contact;
    omegaQnm = 1.3 * 2 * wM;          // ringdown GW frequency, a little above the final chirp
    tRd = (2 * Math.PI) / omegaQnm;   // e-folding time ≈ one cycle
    tEnd = tMerge + Math.min(rMax / c, 12) + 1;
  }

  // GW amplitude (∝ 1/a), phase (= 2 × orbital phase) and angular frequency emitted at time t.
  function source(t, out) {
    if (t < tMerge) {
      const u8 = Math.pow(1 - t / TAU, 0.125);
      out[0] = 1 / (u8 * u8);
      out[1] = 3.2 * W0 * TAU * (1 - u8 ** 5);
      out[2] = (2 * W0) / (u8 * u8 * u8);           // 2 w0 (1 - t/tau)^(-3/8)
    } else {
      const d = t - tMerge;
      out[0] = aM * Math.exp(-d / tRd);
      out[1] = 2 * phiM + omegaQnm * d;
      out[2] = omegaQnm;
    }
    return out;
  }

  // ── Layout ────────────────────────────────────────────────────────────
  // Layout boxes from offsets, which ignore CSS transforms: the entrance and scroll
  // animations must not move the binary.
  function box(el) {
    let x = 0, y = 0;
    for (let n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function layout() {
    const rect = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const s = Math.min(W, H);
    const hb = box(hero);
    const copy = hero.querySelector('.hero-copy');
    const cb = copy ? box(copy) : null;
    if (W >= 960 && cb) {
      const right = cb.x + cb.w - hb.x;
      cx = Math.max(right + (W - right) * 0.5, W * 0.64);
      cy = clamp(cb.y - hb.y + cb.h * 0.5, H * 0.35, H * 0.55);
      a0 = clamp(s * 0.075, 44, 74);
    } else {
      const top = cb ? cb.y - hb.y : H * 0.5;
      cx = W * 0.5;
      cy = Math.max(120, (64 + top) * 0.5);       // centered in the free band above the text
      a0 = clamp(s * 0.12, 34, 58);
    }
    hero.style.setProperty('--bx', `${((cx / W) * 100).toFixed(1)}%`);
    hero.style.setProperty('--by', `${((cy / H) * 100).toFixed(1)}%`);

    R1 = a0 * 0.13;
    grid = clamp(s / 14, 40, 64);
    const lambda0 = clamp(s * 0.3, 150, 280);     // initial GW wavelength
    c = (2 * lambda0) / P0;                       // λ = c × (P_orb / 2)
    rRef = s * 0.28;
    rIn = a0 * 1.1;
    soft = a0 * 0.7;
    dMax = a0 * 0.55;
    gx0 = ((cx + grid / 2) % grid) - grid;        // binary sits at the center of a cell
    gy0 = ((cy + grid / 2) % grid) - grid;
    rMax = Math.ceil(Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy))) + 2;
    ampT = new Float32Array(rMax + 1);
    psiT = new Float32Array(rMax + 1);
    heatT = new Float32Array(rMax + 1);
    fieldEl.width = Math.max(2, Math.round(W / FIELD_SCALE));
    fieldEl.height = Math.max(2, Math.round(H / FIELD_SCALE));
    fieldImg = fieldCtx.createImageData(fieldEl.width, fieldEl.height);

    rw = rh = 0;
    if (rctx && readout.offsetWidth) {          // hidden on small screens
      rw = readout.offsetWidth; rh = readout.offsetHeight;
      readout.width = Math.round(rw * dpr);
      readout.height = Math.round(rh * dpr);
      traceStroke = rctx.createLinearGradient(0, 0, rw, 0);
      traceStroke.addColorStop(0, 'rgba(143, 179, 255, 0)');
      traceStroke.addColorStop(0.45, 'rgba(165, 192, 255, 0.5)');
      traceStroke.addColorStop(1, 'rgba(243, 217, 164, 0.95)');
    }
    derive();
    drawStars();
  }

  function drawStars() {   // static: drawn once per layout
    let seed = 1234567;
    const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    starsEl.width = canvas.width;
    starsEl.height = canvas.height;
    const g = starsEl.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 6500);
    for (let i = 0; i < n; i++) {
      const x = rand() * W, y = rand() * H, r = 0.35 + rand() ** 3 * 1.1, a = 0.15 + rand() * 0.55;
      const warm = rand() < 0.12;
      g.fillStyle = warm ? `rgba(255, 220, 170, ${a})` : `rgba(215, 228, 255, ${a})`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }

  // ── Field and grid ────────────────────────────────────────────────────
  const styles = [];
  for (let k = 0; k < LEVELS; k++) {
    const m = -1 + (2 * k) / (LEVELS - 1);
    const alpha = m >= 0 ? 0.08 * (1 + 3.4 * m) : 0.08 * (1 + 0.7 * m);
    const s = Math.max(0, m);                              // crests: paler and brighter
    const r = 128 + 68 * s, g = 156 + 58 * s, b = 218 + 37 * s;
    styles.push(`rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(3)})`);
  }

  const src = [0, 0, 0];
  let theta0 = Math.random() * Math.PI * 2;
  function fillTables(t, fieldAlpha) {
    for (let r = 0; r <= rMax; r++) {
      source(t - r / c, src);
      const win = smooth((r - rIn) / (1.6 * rIn));          // suppress the near zone
      const kd = (src[2] / c) * FIELD_SCALE * 0.5;          // local wavenumber × sample spacing / 2
      const aa = Math.exp(-kd * kd);                        // Gaussian prefilter against aliasing
      ampT[r] = src[0] * (rRef / (rRef + r)) * win * aa * fieldAlpha * GAIN;
      psiT[r] = src[1] + 2 * theta0;
      heatT[r] = clamp((src[0] - 1.8) / 2.2, 0, 1);         // late chirp and merger burst glow gold
    }
  }
  function level(x, y) {
    const dx = x - cx, dy = y - cy;
    const r = Math.min(rMax, Math.sqrt(dx * dx + dy * dy) | 0);
    const h = ampT[r] * Math.cos(psiT[r] - 2 * Math.atan2(dy, dx));
    return Math.round(((Math.tanh(h) + 1) / 2) * (LEVELS - 1));
  }

  // The same field, rendered softly at low resolution and upscaled: makes the two arms legible
  // between the grid lines. Only crests (h+ > 0) glow.
  function drawField() {
    const fw = fieldEl.width, fh = fieldEl.height, data = fieldImg.data;
    const sx = W / fw, sy = H / fh;
    let p = 0;
    for (let j = 0; j < fh; j++) {
      const y = (j + 0.5) * sy - cy;
      for (let i = 0; i < fw; i++, p += 4) {
        const x = (i + 0.5) * sx - cx;
        const r = Math.min(rMax, Math.sqrt(x * x + y * y) | 0);
        const v = Math.tanh(ampT[r] * Math.cos(psiT[r] - 2 * Math.atan2(y, x)));
        if (v <= 0) { data[p + 3] = 0; continue; }
        const hot = heatT[r];
        data[p] = 112 + 121 * hot;
        data[p + 1] = 150 + 40 * hot;
        data[p + 2] = 250 - 140 * hot;
        data[p + 3] = 255 * FIELD_ALPHA * (1 + 0.6 * hot) * v * v;
      }
    }
    fieldCtx.putImageData(fieldImg, 0, 0);
  }

  const D = new Float64Array(2);
  function displace(x, y, masses) {
    let dx = 0, dy = 0;
    for (let i = 0; i < masses.length; i++) {
      const m = masses[i];
      const rx = x - m[0], ry = y - m[1];
      const r = Math.sqrt(rx * rx + ry * ry) + 1e-6;
      const f = m[2] / Math.max(r, soft) / r;
      dx -= f * rx; dy -= f * ry;
    }
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > dMax) { dx *= dMax / mag; dy *= dMax / mag; }
    D[0] = x + dx; D[1] = y + dy;
  }

  function drawGrid(masses) {
    const paths = [];
    for (let k = 0; k < LEVELS; k++) paths.push(new Path2D());
    const line = (x0, y0, ux, uy, n) => {
      let px = 0, py = 0, pl = -1, seg = -1;
      for (let i = 0; i <= n; i++) {
        const x = x0 + ux * i * STEP, y = y0 + uy * i * STEP;
        displace(x, y, masses);
        const l = level(x, y);
        if (i > 0) {
          const k = (l + pl) >> 1;
          if (k !== seg) { paths[k].moveTo(px, py); seg = k; }
          paths[k].lineTo(D[0], D[1]);
        }
        px = D[0]; py = D[1]; pl = l;
      }
    };
    const nx = Math.ceil((W + 2 * STEP) / STEP), ny = Math.ceil((H + 2 * STEP) / STEP);
    for (let y = gy0; y <= H + grid; y += grid) line(-STEP, y, 1, 0, nx);
    for (let x = gx0; x <= W + grid; x += grid) line(x, -STEP, 0, 1, ny);
    ctx.lineWidth = 1;
    for (let k = 0; k < LEVELS; k++) { ctx.strokeStyle = styles[k]; ctx.stroke(paths[k]); }
  }

  function drawHole(x, y, R, alpha) {
    const halo = ctx.createRadialGradient(x, y, R * 0.9, x, y, R * 4.2);
    halo.addColorStop(0, `rgba(240, 192, 124, ${0.2 * alpha})`);
    halo.addColorStop(1, 'rgba(240, 192, 124, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, R * 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, R * 1.1, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(250, 216, 164, ${0.85 * alpha})`;
    ctx.lineWidth = Math.max(1, R * 0.16);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(1, 2, 5, ${alpha})`;
    ctx.fill();
  }

  // ── Readout ───────────────────────────────────────────────────────────
  // The waveform at retarded time u (the 1/r factor is absorbed in the plot scaling), with the
  // fade the scene had when the source emitted it. Its peak coincides with the visible merger.
  const src2 = [0, 0, 0];
  function strainAt(u) {
    let a = cycle === 0 ? 1 : smooth((u - tStart) / FADE_IN);
    if (u > tEnd) a *= 1 - smooth((u - tEnd) / FADE_OUT);
    if (a <= 0) return 0;
    source(u, src2);
    return a * src2[0] * Math.cos(src2[1] + 2 * theta0);
  }

  function drawReadout(t) {
    if (!rw) return;
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, rw, rh);
    const mid = rh / 2, k = (0.44 * rh) / aM, span = rw - 4;   // the merger peak, aM, nearly fills it
    rctx.fillStyle = 'rgba(160, 176, 212, 0.16)';
    rctx.fillRect(0, Math.round(mid), rw, 1);
    rctx.beginPath();
    let y = mid;
    for (let i = 0; i <= TRACE_N; i++) {
      y = mid - k * strainAt(t - TRACE_SPAN * (1 - i / TRACE_N));
      if (i) rctx.lineTo((i / TRACE_N) * span, y); else rctx.moveTo(0, y);
    }
    rctx.strokeStyle = traceStroke;
    rctx.lineWidth = 1.3;
    rctx.lineJoin = 'round';
    rctx.stroke();
    rctx.fillStyle = 'rgba(250, 216, 164, 0.95)';
    rctx.beginPath(); rctx.arc(span, y, 2, 0, Math.PI * 2); rctx.fill();
  }

  // ── Scene ─────────────────────────────────────────────────────────────
  const cursor = { x: 0, y: 0, tx: 0, ty: 0, alpha: 0, target: 0 };
  let tStart = FIRST_START, sceneTime = 0, cycle = 0;

  function render() {
    const t = tStart + sceneTime;
    const fadeIn = cycle === 0 ? 1 : smooth(sceneTime / FADE_IN);
    const fadeOut = t > tEnd ? 1 - smooth((t - tEnd) / FADE_OUT) : 1;
    const alpha = fadeIn * fadeOut;

    let bodies;
    if (t < tMerge) {
      const u = 1 - t / TAU;
      const a = a0 * Math.pow(u, 0.25);
      const ang = 1.6 * W0 * TAU * (1 - Math.pow(u, 0.625)) + theta0;
      const r1 = (a * Q) / (1 + Q), r2 = a / (1 + Q);
      const co = Math.cos(ang), si = Math.sin(ang);
      bodies = [
        [cx + r1 * co, cy + r1 * si, R1, 1 / (1 + Q)],
        [cx - r2 * co, cy - r2 * si, R1 * Q, Q / (1 + Q)],
      ];
    } else {
      bodies = [[cx, cy, R1 * 1.5, 0.95]];   // remnant: area grows, ~5% of the mass radiated
    }
    const masses = bodies.map((b) => [b[0], b[1], WELL * a0 * a0 * b[3] * alpha]);
    if (cursor.alpha > 0.01) masses.push([cursor.x, cursor.y, CURSOR_WELL * a0 * a0 * cursor.alpha]);

    fillTables(t, alpha);
    drawField();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawGrid(masses);
    for (const b of bodies) drawHole(b[0], b[1], b[2], alpha);
    drawReadout(t);
  }

  function advance(dt) {
    sceneTime += dt;
    if (tStart + sceneTime > tEnd + FADE_OUT) {
      cycle += 1;
      tStart = LATER_START;
      sceneTime = 0;
      theta0 = Math.random() * Math.PI * 2;
    }
    cursor.x += (cursor.tx - cursor.x) * 0.1;
    cursor.y += (cursor.ty - cursor.y) * 0.1;
    cursor.alpha += (cursor.target - cursor.alpha) * 0.06;
  }

  let raf = 0, last = 0, inView = true;
  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    advance(dt);
    render();
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && !reduceMotion) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  layout();
  if (reduceMotion) {
    sceneTime = 4;   // a single still frame, mid-inspiral
    render();
  } else {
    render();
    if (window.matchMedia('(pointer: fine)').matches) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        cursor.tx = e.clientX - r.left;
        cursor.ty = e.clientY - r.top;
        if (cursor.alpha < 0.01) { cursor.x = cursor.tx; cursor.y = cursor.ty; }
        cursor.target = 1;
      });
      hero.addEventListener('pointerleave', () => { cursor.target = 0; });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        if (inView && !document.hidden) start(); else stop();
      }).observe(hero);
    } else start();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && inView) start(); else stop();
    });
  }
  requestAnimationFrame(() => hero.classList.add('is-live'));

  let resizeTimer = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { layout(); if (!raf) render(); }, 120);
  };
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(hero);
  else window.addEventListener('resize', onResize);
})();
