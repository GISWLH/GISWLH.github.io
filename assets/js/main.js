/* Longhao Wang homepage — interactions (no dependencies). */
(function () {
  'use strict';
  var root = document.documentElement;

  // Language toggle (EN default, 中文 optional; remembered in localStorage)
  var langBtn = document.getElementById('lang-toggle');
  function setLang(l) {
    root.setAttribute('data-lang', l);
    root.lang = l === 'zh' ? 'zh-CN' : 'en';
    if (langBtn) langBtn.setAttribute('aria-pressed', String(l === 'zh'));
    try { localStorage.setItem('lang', l); } catch (e) {}
  }
  try { if (localStorage.getItem('lang') === 'zh') setLang('zh'); } catch (e) {}
  if (langBtn) langBtn.addEventListener('click', function () {
    setLang(root.getAttribute('data-lang') === 'zh' ? 'en' : 'zh');
  });

  // Copy-to-clipboard buttons, falling back to selecting the address
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      function done() {
        btn.classList.add('ok');
        setTimeout(function () { btn.classList.remove('ok'); }, 2200);
      }
      function select() {
        var el = document.getElementById(btn.getAttribute('data-select'));
        if (!el) return;
        var r = document.createRange(); r.selectNodeContents(el);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, select);
      } else { select(); }
    });
  });

  // Publication filters
  var fbtns = document.querySelectorAll('.filters button');
  var count = document.getElementById('pub-count');
  fbtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter'), n = 0;
      fbtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      document.querySelectorAll('.pub').forEach(function (p) {
        var first = p.getAttribute('data-first') === '1', kind = p.getAttribute('data-kind');
        var show = f === 'all' || (f === 'first' && first) || (f === 'co' && !first && kind === 'jour') || (f === 'pre' && kind === 'pre');
        p.hidden = !show; if (show) n++;
      });
      document.querySelectorAll('.yr').forEach(function (y) { y.hidden = !y.querySelector('.pub:not([hidden])'); });
      if (count) count.textContent = n;
    });
  });

  // Fig. 1 — synthetic SST anomaly field, Pacific-centred (30°E → 30°E), drawn over the coastline mask
  var cv = document.getElementById('sst'), cb = document.getElementById('sst-bar'), out = document.getElementById('sst-readout');
  if (cv && cv.getContext) {
    var W = 720, H = 360, field = new Float32Array(W * H), land = new Uint8Array(W * H), STEP = 0.25, VMAX = 2.5;
    var g = function (x, m, s) { var d = (x - m) / s; return Math.exp(-d * d); };
    var rad = Math.PI / 180;
    function anomaly(lon, lat) {   // lon in °E [0, 360)
      var v = 0;
      v += 2.4 * g(lat, -1, 9) * g(lon, 242, 36);          // El Niño-like warm tongue
      v += 0.9 * g(lat, 0, 6) * g(lon, 200, 28);
      v += 0.8 * g(lat, -8, 10) * g(lon, 278, 9);          // coastal Peru
      v -= 0.95 * g(lat, 24, 10) * g(lon, 160, 34);        // western Pacific horseshoe
      v -= 0.9 * g(lat, -24, 10) * g(lon, 168, 34);
      v += 1.15 * g(lat, 42, 8) * g(lon, 212, 22);         // North Pacific marine heatwave
      v += 0.6 * g(lat, -6, 15) * g(lon, 75, 24);          // Indian Ocean basin warming
      v += 0.85 * g(lat, 26, 10) * g(lon, 318, 24);        // subtropical North Atlantic
      v -= 0.75 * g(lat, 55, 6) * g(lon, 326, 14);         // subpolar cold patch
      v += 0.4 * Math.sin(lon * rad * 6) * g(lat, -52, 8); // Southern Ocean wave train
      v += 0.32 * Math.sin(lon * rad * 3 + lat * rad * 7) * Math.cos(lat * rad * 5 - lon * rad * 2)
         + 0.2 * Math.sin(lon * rad * 9 - lat * rad * 4) * Math.cos(lon * rad * 4 + lat * rad * 11)
         + 0.12 * Math.sin(lon * rad * 17 + lat * rad * 13);
      var a = Math.abs(lat);
      return v * (a > 62 ? Math.max(0, 1 - (a - 62) / 14) : 1);
    }
    for (var y = 0; y < H; y++) {
      var lat = 90 - (y + 0.5) * 180 / H;
      for (var x = 0; x < W; x++) field[y * W + x] = anomaly((30 + (x + 0.5) * 360 / W) % 360, lat);
    }
    function hex(c) { c = c.trim(); if (c[0] === '#') c = c.slice(1); if (c.length === 3) c = c.replace(/./g, '$&$&'); var n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    function tokens() {
      var cs = getComputedStyle(root), t = {};
      ['cm-n2', 'cm-n1', 'cm-0', 'cm-p1', 'cm-p2', 'land', 'paper-2'].forEach(function (k) { t[k] = hex(cs.getPropertyValue('--' + k)); });
      t.grid = cs.getPropertyValue('--grid').trim();
      return t;
    }
    function colour(v, t) {   // contour-filled: quantise to 0.25 °C bins, then interpolate the diverging ramp
      v = Math.max(-VMAX, Math.min(VMAX, (Math.floor(v / STEP) + 0.5) * STEP));
      var stops = [[-VMAX, t['cm-n2']], [-1, t['cm-n1']], [0, t['cm-0']], [1, t['cm-p1']], [VMAX, t['cm-p2']]];
      for (var i = 1; i < stops.length; i++) if (v <= stops[i][0]) break;
      var a = stops[i - 1], b = stops[Math.min(i, 4)], f = (v - a[0]) / ((b[0] - a[0]) || 1);
      return [0, 1, 2].map(function (k) { return Math.round(a[1][k] + (b[1][k] - a[1][k]) * f); });
    }
    function draw() {
      var t = tokens(), ctx = cv.getContext('2d');
      cv.width = W; cv.height = H;
      var img = ctx.createImageData(W, H), d = img.data;
      for (var i = 0; i < W * H; i++) {
        var c = land[i] ? t.land : colour(field[i], t);
        d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      ctx.strokeStyle = t.grid; ctx.lineWidth = 1;
      for (var lon = 60; lon <= 360; lon += 60) { var gx = Math.round((lon - 30) / 360 * W) + 0.5; ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      [60, 30, -30, -60].forEach(function (la) { var gy = Math.round((90 - la) / 180 * H) + 0.5; ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); });
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, H / 2 + 0.5); ctx.lineTo(W, H / 2 + 0.5); ctx.stroke(); ctx.setLineDash([]);
      if (cb) {
        var bx = cb.getContext('2d'), bw = 300; cb.width = bw; cb.height = 1;
        var bi = bx.createImageData(bw, 1);
        for (var j = 0; j < bw; j++) { var c2 = colour(-VMAX + (j + 0.5) / bw * 2 * VMAX, t); bi.data.set([c2[0], c2[1], c2[2], 255], j * 4); }
        bx.putImageData(bi, 0, 0);
      }
    }
    draw();
    var mask = new Image();
    mask.onload = function () {
      try {
        var oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        var ox = oc.getContext('2d'); ox.drawImage(mask, 0, 0, W, H);
        var md = ox.getImageData(0, 0, W, H).data;
        for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
          var lon = 30 + (xx + 0.5) * 360 / W; if (lon >= 180) lon -= 360; if (lon >= 180) lon -= 360;
          var mx = Math.min(W - 1, Math.floor((lon + 180) / 360 * W));
          land[yy * W + xx] = md[(yy * W + mx) * 4] < 128 ? 1 : 0;
        }
        draw();
      } catch (e) { /* keep the unmasked field */ }
    };
    mask.src = 'assets/img/land-mask.jpg';
    var redraw = function () { requestAnimationFrame(draw); };
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', redraw); else if (mq.addListener) mq.addListener(redraw);
    }
    if (window.MutationObserver) new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    function fmt(lon, lat) {
      var e = lon > 180 ? lon - 360 : lon;
      var lo = Math.abs(e) < 0.25 || Math.abs(Math.abs(e) - 180) < 0.25 ? Math.abs(e).toFixed(1) + '°' : Math.abs(e).toFixed(1) + (e > 0 ? '°E' : '°W');
      var la = Math.abs(lat) < 0.25 ? '0.0°' : Math.abs(lat).toFixed(1) + (lat > 0 ? '°N' : '°S');
      return la + '  ' + lo;
    }
    function read(ev) {
      var r = cv.getBoundingClientRect();
      var x = Math.floor((ev.clientX - r.left) / r.width * W), yv = Math.floor((ev.clientY - r.top) / r.height * H);
      if (x < 0 || yv < 0 || x >= W || yv >= H) return;
      var i = yv * W + x, lon = (30 + (x + 0.5) * 360 / W) % 360, lat = 90 - (yv + 0.5) * 180 / H;
      var zh = root.getAttribute('data-lang') === 'zh', v = field[i];
      out.textContent = fmt(lon, lat) + '  ' + (land[i] ? (zh ? '陆地' : 'land') : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + ' °C');
      out.hidden = false;
    }
    cv.addEventListener('pointermove', read);
    cv.addEventListener('pointerdown', read);
    cv.addEventListener('pointerleave', function () { out.hidden = true; });
  }

  // Live GitHub counts on the deployed site only (static numbers stay as fallback; cached 6 h for rate limits)
  if (/(^|\.)giswlh\.github\.io$/i.test(location.hostname) && window.fetch) {
    var getJSON = function (url, key, cb, map) {
      try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 6 * 3600e3) { cb(c.d); return; } } catch (e) {}
      fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { d = map(d); try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} cb(d); })
        .catch(function () {});
    };
    getJSON('https://api.github.com/users/GISWLH/repos?per_page=100&type=owner', 'gh_repos_v2', function (list) {
      var by = {}, total = 0;
      list.forEach(function (r) { by[r.n] = r; total += r.s; });
      document.querySelectorAll('[data-repo]').forEach(function (el) { var r = by[el.getAttribute('data-repo')]; if (r) el.textContent = r.s; });
      document.querySelectorAll('[data-repo-f]').forEach(function (el) { var r = by[el.getAttribute('data-repo-f')]; if (r) el.textContent = r.f; });
      var t = document.querySelector('[data-total-stars]'); if (t && total > 0) t.textContent = total;
    }, function (d) { return Array.isArray(d) ? d.map(function (r) { return { n: r.name, s: r.stargazers_count, f: r.forks_count }; }) : []; });
    getJSON('https://api.github.com/users/GISWLH', 'gh_user_v2', function (d) {
      var el = document.querySelector('[data-followers]'); if (el && typeof d.f === 'number') el.textContent = d.f;
    }, function (d) { return { f: d && d.followers }; });
  }
})();
