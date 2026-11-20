/* Longhao Wang — Bright White 16-Bit Cartoon Pixel World Engine (zero dependencies).
   Features: Living Daytime Pixel Water-Cycle & Bayer-8 Earth Diorama with clouds/rain/trees/researcher/satellites,
   Bright 5x7 LED Dot-Matrix Journal Marquee, PixelCard hover shimmer, Daytime Pixel SST Radar,
   and Interactive Walking Pixel Researcher Buddy. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function parseHex(c) {
    c = (c || '#000000').trim();
    if (c[0] === '#') c = c.slice(1);
    if (c.length === 3) c = c.replace(/./g, '$&$&');
    var n = parseInt(c.slice(0, 6), 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function cssVar(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  // ============================================================
  // 1. LANGUAGE TOGGLE + MOBILE NAV + SCROLL SPY
  // ============================================================
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

  var navBtn = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (navBtn && mobileNav) {
    navBtn.addEventListener('click', function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      navBtn.setAttribute('aria-expanded', String(open));
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileNav.hidden = true;
        navBtn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var progFill = document.getElementById('scroll-prog');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.mast > .wrap > nav a[href^="#"]'));
  var trackedSections = navLinks.map(function (a) {
    return { link: a, el: document.querySelector(a.getAttribute('href')) };
  }).filter(function (x) { return !!x.el; });

  function onScroll() {
    if (progFill) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0;
      progFill.style.width = p.toFixed(1) + '%';
    }
    var y = window.scrollY + 150;
    var active = null;
    for (var i = 0; i < trackedSections.length; i++) {
      if (trackedSections[i].el.offsetTop <= y) active = trackedSections[i];
    }
    navLinks.forEach(function (a) { a.classList.toggle('active', !!(active && active.link === a)); });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ============================================================
  // 2. COPY EMAIL, PUBLICATION FILTERS & HERO CHARACTER INTERACTION
  // ============================================================
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

  // Hero cute pixel researcher speech-bubble cycler on click!
  var heroCharBtn = document.getElementById('hero-char-btn');
  var heroSpeech = document.getElementById('hero-speech');
  if (heroCharBtn && heroSpeech) {
    var quotes = [
      { en: 'Hi! I teach AI to forecast oceans, rain & drought!', zh: '你好！我教 AI 预测海洋、降水与干旱！' },
      { en: 'Drag the pixel Earth to inspect El Niño & GRACE-FO!', zh: '拖拽右侧像素地球，看看厄尔尼诺与 GRACE-FO 卫星！' },
      { en: '18 weather models live inside WeatherAI PyTorch zoo!', zh: 'WeatherAI 里已经复现了 18 个开源天气大模型！' },
      { en: 'CAS-Canglong forecasts global ocean SST 16 months ahead!', zh: '中科苍龙可提前 16 个月预测全球海表温度与 ENSO！' }
    ];
    var qIdx = 0;
    heroCharBtn.addEventListener('click', function () {
      qIdx = (qIdx + 1) % quotes.length;
      var q = quotes[qIdx];
      heroSpeech.innerHTML = '<span class="t-en">' + q.en + '</span><span class="t-zh" lang="zh-CN">' + q.zh + '</span>';
    });
  }

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

  // Shared land mask loader
  var maskListeners = [];
  var maskImage = null;
  function onLandMask(fn) {
    if (maskImage) { fn(maskImage); return; }
    maskListeners.push(fn);
  }
  var loaderImg = new Image();
  loaderImg.onload = function () {
    maskImage = loaderImg;
    maskListeners.forEach(function (fn) { try { fn(loaderImg); } catch (e) {} });
    maskListeners = [];
  };
  loaderImg.src = 'assets/img/land-mask.jpg';

  function watchVisibility(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    var io = new IntersectionObserver(function (entries) {
      cb(entries[0] && entries[0].isIntersecting);
    }, { rootMargin: '140px' });
    io.observe(el);
  }

  // ============================================================
  // 3. HERO BRIGHT DAYTIME 16-BIT WATER-CYCLE & BAYER EARTH DIORAMA
  //    Sunny pixel sky + smiling clouds + falling rain + Bayer-8 spinning Earth
  //    + GRACE-FO twin satellites + pixel hillside, trees (ET), ocean waves & pixel researcher!
  // ============================================================
  var globeStage = document.getElementById('hero-globe');
  if (globeStage) {
    (function initPixelDiorama() {
      var BAYER8 = [
        0,32,8,40,2,34,10,42, 48,16,56,24,50,18,58,26,
        12,44,4,36,14,46,6,38, 60,28,52,20,62,30,54,22,
        3,35,11,43,1,33,9,41, 51,19,59,27,49,17,57,25,
        15,47,7,39,13,45,5,37, 63,31,55,23,61,29,53,21
      ];

      var canvas = document.createElement('canvas');
      canvas.className = 'px-canvas';
      globeStage.insertBefore(canvas, globeStage.firstChild);
      var ctx = canvas.getContext('2d');
      var buf = document.createElement('canvas');
      var bctx = buf.getContext('2d');

      var bw = 136, bh = 138;
      buf.width = bw; buf.height = bh;
      var img = bctx.createImageData(bw, bh);

      var MW = 360, MH = 180;
      var maskBits = null, coastBits = null;
      onLandMask(function (im) {
        var oc = document.createElement('canvas');
        oc.width = MW; oc.height = MH;
        var ox = oc.getContext('2d');
        ox.drawImage(im, 0, 0, MW, MH);
        var md = ox.getImageData(0, 0, MW, MH).data;
        maskBits = new Uint8Array(MW * MH);
        for (var i = 0; i < MW * MH; i++) maskBits[i] = md[i * 4] < 128 ? 1 : 0;
        coastBits = new Uint8Array(MW * MH);
        for (var y = 1; y < MH - 1; y++) {
          for (var x = 0; x < MW; x++) {
            var idx = y * MW + x;
            if (!maskBits[idx]) continue;
            var xl = (x - 1 + MW) % MW, xr = (x + 1) % MW;
            if (!maskBits[y * MW + xl] || !maskBits[y * MW + xr] || !maskBits[(y - 1) * MW + x] || !maskBits[(y + 1) * MW + x]) {
              coastBits[idx] = 1;
            }
          }
        }
      });

      function hash2(x, y) { var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
      function noise2(x, y) {
        var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        var a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
        return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
      }
      function fbm(x, y) { return 0.5 * noise2(x, y) + 0.3 * noise2(x * 2.03, y * 2.01) + 0.2 * noise2(x * 4.07, y * 4.03); }

      var lonReadout = document.getElementById('globe-lon');
      var toggleBtn = document.getElementById('globe-toggle');
      var paused = reduceMotion;
      var dragging = false, lastX = 0, lastY = 0;
      var spin = 2.75, tilt = 0.14;
      var time = 0, lastT = 0, visible = true, raf = 0;

      if (toggleBtn) {
        toggleBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          paused = !paused;
          toggleBtn.textContent = paused ? '▶ SPIN' : '❚❚ PAUSE';
        });
      }

      globeStage.addEventListener('pointerdown', function (e) {
        if (e.target && e.target.closest('button')) return;
        dragging = true; lastX = e.clientX; lastY = e.clientY;
        if (globeStage.setPointerCapture) try { globeStage.setPointerCapture(e.pointerId); } catch (err) {}
      });
      globeStage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        spin -= (e.clientX - lastX) * 0.011;
        tilt = Math.max(-0.5, Math.min(0.5, tilt + (e.clientY - lastY) * 0.006));
        lastX = e.clientX; lastY = e.clientY;
      });
      function stopDrag() { dragging = false; }
      globeStage.addEventListener('pointerup', stopDrag);
      globeStage.addEventListener('pointercancel', stopDrag);

      function resize() {
        var r = globeStage.getBoundingClientRect();
        canvas.width = Math.max(240, Math.round(r.width));
        canvas.height = Math.max(240, Math.round(r.height));
      }
      resize();
      window.addEventListener('resize', resize);

      // Low-res pixel painters
      function px(data, x, y, rgb) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= bw || y >= bh) return;
        var i = (y * bw + x) * 4;
        data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
      }
      function rect(data, x, y, w, h, rgb) {
        for (var dy = 0; dy < h; dy++) for (var dx = 0; dx < w; dx++) px(data, x + dx, y + dy, rgb);
      }

      var INK = [26, 34, 51];
      var WHITE = [255, 255, 255];
      var SKY_TOP = [125, 211, 252];
      var SKY_MID = [186, 230, 253];
      var SKY_BOT = [232, 247, 255];
      var SUN_Y = [250, 204, 21];
      var SUN_CORE = [254, 249, 195];
      var SEA_DEEP = [14, 116, 178];
      var SEA_MID = [56, 189, 248];
      var SEA_FOAM = [224, 242, 254];
      var LAND_DARK = [21, 128, 61];
      var LAND_MID = [34, 197, 94];
      var LAND_HI = [134, 239, 172];
      var WARM_HOT = [239, 68, 68];
      var WARM_MID = [251, 146, 60];
      var WARM_HI = [253, 224, 71];
      var TRUNK = [146, 64, 14];
      var SKIN = [254, 215, 170];
      var BLUSH = [251, 113, 133];
      var JACKET = [14, 165, 233];

      function drawCloud(data, x0, y0, happy) {
        // Fluffy cartoon pixel cloud with ink outline
        var shape = [
          '....OOOOO.....',
          '...OWWWWWO....',
          '.OOWWWWWWWOO..',
          'OWWWWWWWWWWWO.',
          'OWWWOWWWOWWWWO',
          'OWWWWWWWWWWWWO',
          'OCCCCCCCCCCCCO',
          '.OOOOOOOOOOOO.'
        ];
        var CLOUD_SH = [219, 234, 254];
        for (var r = 0; r < shape.length; r++) {
          for (var c = 0; c < shape[r].length; c++) {
            var ch = shape[r][c];
            if (ch === '.') continue;
            if (ch === 'O') px(data, x0 + c, y0 + r, (r === 4 && !happy && (c === 4 || c === 8)) ? WHITE : INK);
            else if (ch === 'W') px(data, x0 + c, y0 + r, WHITE);
            else if (ch === 'C') px(data, x0 + c, y0 + r, CLOUD_SH);
          }
        }
      }

      function drawTree(data, x0, y0) {
        rect(data, x0 + 3, y0 + 7, 3, 5, TRUNK);
        rect(data, x0 + 2, y0 + 7, 1, 5, INK);
        rect(data, x0 + 6, y0 + 7, 1, 5, INK);
        rect(data, x0 + 1, y0 + 2, 7, 5, LAND_MID);
        rect(data, x0 + 2, y0 + 1, 5, 2, LAND_HI);
        rect(data, x0 + 1, y0 + 5, 7, 2, LAND_DARK);
        // outline
        rect(data, x0 + 2, y0, 5, 1, INK);
        rect(data, x0, y0 + 2, 1, 5, INK);
        rect(data, x0 + 8, y0 + 2, 1, 5, INK);
        px(data, x0 + 1, y0 + 1, INK); px(data, x0 + 7, y0 + 1, INK);
        rect(data, x0 + 1, y0 + 7, 7, 1, INK);
      }

      function drawMiniScientist(data, x0, y0, wave) {
        // Cute 10x14 pixel researcher standing on the hill!
        var sp = [
          '..OOOOOO..',
          '.OHHHHHHO.',
          '.OHSSSSHO.',
          '.OSGSGSGO.',
          '.OSBSSSBO.',
          '..OOOOOO..',
          '.OWJJJJWO.',
          'OWWJJJJWWO',
          'O.OJJJJO.O',
          '..OJJJJO..',
          '..OOBBOO..',
          '..OO..OO..',
          '.OOO..OOO.'
        ];
        var HAIR = [30, 41, 59];
        var PANTS = [51, 65, 85];
        for (var r = 0; r < sp.length; r++) {
          for (var c = 0; c < sp[r].length; c++) {
            var ch = sp[r][c];
            if (ch === '.') continue;
            var dy = (wave && r === 7 && c >= 8) ? -2 : 0;
            if (ch === 'O') px(data, x0 + c, y0 + r + dy, INK);
            else if (ch === 'H') px(data, x0 + c, y0 + r + dy, HAIR);
            else if (ch === 'S') px(data, x0 + c, y0 + r + dy, SKIN);
            else if (ch === 'G') px(data, x0 + c, y0 + r + dy, [14, 165, 233]);
            else if (ch === 'B') px(data, x0 + c, y0 + r + dy, r === 4 ? BLUSH : PANTS);
            else if (ch === 'W') px(data, x0 + c, y0 + r + dy, WHITE);
            else if (ch === 'J') px(data, x0 + c, y0 + r + dy, JACKET);
          }
        }
      }

      function drawSatellite(data, cx, cy) {
        rect(data, cx - 3, cy - 1, 2, 3, [56, 189, 248]);
        rect(data, cx + 2, cy - 1, 2, 3, [56, 189, 248]);
        rect(data, cx - 1, cy - 1, 3, 3, WHITE);
        px(data, cx, cy, [239, 68, 68]);
        px(data, cx - 4, cy, INK); px(data, cx + 4, cy, INK);
        px(data, cx, cy - 2, INK); px(data, cx, cy + 2, INK);
      }

      function drawSailboat(data, x0, y0) {
        // Cute tiny 11x9 pixel research sailboat on the right ocean!
        rect(data, x0 + 5, y0, 1, 6, INK);
        rect(data, x0 + 6, y0 + 1, 3, 2, WHITE);
        rect(data, x0 + 6, y0 + 3, 4, 2, [254, 240, 138]);
        rect(data, x0 + 2, y0 + 2, 3, 3, [251, 113, 133]);
        rect(data, x0 + 1, y0 + 6, 9, 2, [239, 68, 68]);
        rect(data, x0 + 2, y0 + 8, 7, 1, INK);
        rect(data, x0, y0 + 6, 1, 2, INK);
        rect(data, x0 + 10, y0 + 6, 1, 2, INK);
      }

      var frameCount = 0;
      function step(now) {
        if (!visible) { raf = 0; return; }
        raf = requestAnimationFrame(step);
        var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
        lastT = now;
        if (!paused) {
          time += dt;
          if (!dragging) spin += dt * 0.25;
        }
        frameCount++;
        if (frameCount % 2 === 1 && !dragging && !paused) return;

        var data = img.data;
        var cx = 73, cy = 58;
        var R = 31;
        var cosT = Math.cos(tilt), sinT = Math.sin(tilt);
        var lx = -0.48, ly = -0.4, lz = 0.78;
        var ditherShift = paused ? 0 : Math.floor(time * 4);

        // 1. Bright Bayer-dithered daytime pixel sky background
        for (var y = 0; y < bh; y++) {
          var fy = y / bh;
          for (var x = 0; x < bw; x++) {
            var b = BAYER8[(y & 7) * 8 + (x & 7)] / 64;
            var col;
            if (fy < 0.45) col = (fy / 0.45) > b ? SKY_MID : SKY_TOP;
            else col = ((fy - 0.45) / 0.55) > b ? SKY_BOT : SKY_MID;
            var i = (y * bw + x) * 4;
            data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
          }
        }

        // 2. Cute Smiling Pixel Sun (clear upper-right sky between HUD pills and Chinese seal)
        var sunX = 95, sunY = 17;
        for (var sy = -6; sy <= 6; sy++) {
          for (var sx = -6; sx <= 6; sx++) {
            var d = Math.hypot(sx, sy);
            if (d < 4.0) px(data, sunX + sx, sunY + sy, SUN_CORE);
            else if (d < 5.6) px(data, sunX + sx, sunY + sy, SUN_Y);
            else if (d < 6.6) px(data, sunX + sx, sunY + sy, INK);
          }
        }
        // cute smiling sun face
        px(data, sunX - 2, sunY - 1, INK); px(data, sunX + 2, sunY - 1, INK);
        px(data, sunX - 1, sunY + 1, INK); px(data, sunX, sunY + 2, INK); px(data, sunX + 1, sunY + 1, INK);
        // twinkling pixel rays
        var rayTick = Math.floor(time * 2) % 2;
        [[0,-8],[0,8],[-8,0],[8,0],[-6,-6],[6,-6],[-6,6],[6,6]].forEach(function (rv, ri) {
          if ((ri + rayTick) % 2 === 0) px(data, sunX + rv[0], sunY + rv[1], SUN_Y);
        });

        // 3. Drifting smiling pixel clouds (top center + left rain cloud feeding the trees!)
        var c1x = 57 + Math.round(Math.sin(time * 0.6) * 3);
        var c2x = 12 + Math.round(Math.cos(time * 0.5) * 3);
        drawCloud(data, c1x, 10, true);
        drawCloud(data, c2x, 40, true);

        // Animated pixel raindrops falling from left cloud onto the green hill & trees
        for (var rd = 0; rd < 5; rd++) {
          var rx = c2x + 2 + rd * 2;
          var ry = 50 + Math.floor((time * 18 + rd * 7) % 34);
          px(data, rx, ry, SEA_DEEP);
          px(data, rx, ry + 1, SEA_MID);
        }

        // 4. Orbiting GRACE-FO twin satellites positions
        var orbA1 = time * 0.95, orbA2 = orbA1 - 0.30;
        var orbR = R + 12, inc = 0.42;
        function orbPos(ang) {
          var ox = Math.cos(ang) * orbR, oz = Math.sin(ang) * orbR;
          var oy = -ox * Math.sin(inc) + Math.sin(ang) * 4;
          return { x: cx + ox * Math.cos(inc), y: cy + oy, z: oz };
        }
        var sat1 = orbPos(orbA1), sat2 = orbPos(orbA2);

        // Back orbital dashes
        for (var a0 = 0; a0 < Math.PI * 2; a0 += 0.14) {
          var op0 = orbPos(a0);
          if (op0.z < 0 && Math.floor(a0 * 10) % 2 === 0) px(data, op0.x, op0.y, [14, 116, 178]);
        }

        // 5. Crisp Cartoon-Outlined Bayer-8 Dithered Daytime Earth Globe!
        for (var gy = Math.floor(cy - R - 2); gy <= Math.ceil(cy + R + 2); gy++) {
          for (var gx = Math.floor(cx - R - 2); gx <= Math.ceil(cx + R + 2); gx++) {
            var dx = gx - cx, dy = gy - cy;
            var rr = Math.hypot(dx, dy);
            if (rr > R + 1.4) continue;
            if (rr >= R - 0.3) {
              // Chunky comic-ink outline around the planet!
              px(data, gx, gy, INK);
              continue;
            }
            var nx = dx / R, ny = dy / R;
            var nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
            var ty = ny * cosT - nz * sinT;
            var tz = ny * sinT + nz * cosT;
            var lam = Math.max(0.18, nx * lx + ny * ly + nz * lz);

            var lonRad = Math.atan2(nx, tz) + spin;
            var latRad = Math.asin(Math.max(-1, Math.min(1, ty)));
            var lonDeg = ((lonRad * 180 / Math.PI) % 360 + 540) % 360 - 180;
            var latDeg = -latRad * 180 / Math.PI;

            var isLand = 0, isCoast = 0;
            if (maskBits) {
              var mx = Math.floor(((lonDeg + 180) / 360) * MW) % MW;
              if (mx < 0) mx += MW;
              var my = Math.max(0, Math.min(MH - 1, Math.floor(((90 - latDeg) / 180) * MH)));
              isLand = maskBits[my * MW + mx];
              isCoast = coastBits[my * MW + mx];
            } else {
              var nv = fbm(lonRad * 1.6 + 10, latRad * 2.2 + 5);
              isLand = nv > 0.51 ? 1 : 0;
              isCoast = Math.abs(nv - 0.51) < 0.03 ? 1 : 0;
            }

            var bayer = BAYER8[((gy + ditherShift) & 7) * 8 + ((gx + ditherShift) & 7)] / 64 - 0.5;
            var dLonW = (lonDeg - (-112)) / 36, dLatW = (latDeg - (-1)) / 9;
            var enso = (!isLand) ? Math.exp(-(dLonW * dLonW + dLatW * dLatW)) * (0.86 + 0.14 * Math.sin(time * 2.4)) : 0;

            var col2;
            if (enso > 0.25) {
              var q = Math.round(enso * 2.6 + bayer);
              col2 = q >= 3 ? WARM_HI : (q >= 2 ? WARM_HOT : WARM_MID);
            } else if (isCoast) {
              col2 = lam > 0.45 ? LAND_HI : LAND_DARK;
            } else if (isLand) {
              var q2 = Math.round(lam * 2.6 + bayer);
              col2 = q2 >= 3 ? LAND_HI : (q2 >= 2 ? LAND_MID : LAND_DARK);
            } else {
              var q3 = Math.round(lam * 2.4 + bayer);
              col2 = q3 >= 3 ? SEA_FOAM : (q3 >= 2 ? SEA_MID : SEA_DEEP);
            }
            px(data, gx, gy, col2);
          }
        }

        // Front orbital dashes + GRACE-FO twin satellites + laser beam
        for (var a1 = 0; a1 < Math.PI * 2; a1 += 0.14) {
          var op1 = orbPos(a1);
          if (op1.z >= 0 && Math.floor(a1 * 10) % 2 === 0) px(data, op1.x, op1.y, INK);
        }
        if (sat1.z > -12 && sat2.z > -12) {
          for (var s = 0; s <= 10; s++) {
            var lx2 = sat1.x + (sat2.x - sat1.x) * (s / 10);
            var ly2 = sat1.y + (sat2.y - sat1.y) * (s / 10);
            if (s % 2 === 0) px(data, lx2, ly2, WARM_HOT);
          }
        }
        if (sat1.z >= 0 || Math.hypot(sat1.x - cx, sat1.y - cy) > R + 1) drawSatellite(data, sat1.x, sat1.y);
        if (sat2.z >= 0 || Math.hypot(sat2.x - cx, sat2.y - cy) > R + 1) drawSatellite(data, sat2.x, sat2.y);

        // 6. Foreground Pixel Ocean Waves + Tiny Sailboat (right) + Green Pixel Meadow Hill (left)
        var seaTop = 109;
        for (var wy = seaTop; wy < bh; wy++) {
          for (var wx = 0; wx < bw; wx++) {
            var waveY = seaTop + Math.round(Math.sin(wx * 0.22 + time * 3) * 1.4);
            if (wy < waveY) continue;
            if (wy === waveY) px(data, wx, wy, INK);
            else if (wy === waveY + 1) px(data, wx, wy, SEA_FOAM);
            else px(data, wx, wy, ((wx + Math.floor(time * 8)) % 9 === 0 && wy % 4 === 0) ? SEA_FOAM : (wy > seaTop + 14 ? SEA_DEEP : SEA_MID));
          }
        }
        drawSailboat(data, 108, 101 + Math.round(Math.sin(time * 3) * 1));
        // Left green pixel hill
        for (var hx = 0; hx < 72; hx++) {
          var hTop = 103 + Math.floor(Math.max(0, (hx - 39) * 0.36));
          px(data, hx, hTop, INK);
          for (var hy = hTop + 1; hy < bh; hy++) {
            px(data, hx, hy, hy < hTop + 4 ? LAND_HI : (hy < hTop + 11 ? LAND_MID : LAND_DARK));
          }
        }
        // Cute pixel trees + rising ET vapor pixels + cute waving pixel researcher on the hill!
        drawTree(data, 5, 92);
        drawTree(data, 17, 93);
        for (var ev = 0; ev < 4; ev++) {
          var vx = 8 + ev * 5;
          var vy = 89 - Math.floor((time * 10 + ev * 5) % 13);
          px(data, vx, vy, SEA_MID);
          px(data, vx + 1, vy - 1, WHITE);
        }
        var isWave = Math.floor(time * 2.5) % 2 === 0;
        drawMiniScientist(data, 31, 91, isWave);

        bctx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, canvas.width, canvas.height);

        if (lonReadout) {
          var centerLon = ((spin * 180 / Math.PI) % 360 + 540) % 360 - 180;
          lonReadout.textContent = 'LON ' + Math.abs(centerLon).toFixed(0) + '°' + (centerLon >= 0 ? 'E' : 'W');
        }
      }

      watchVisibility(globeStage, function (v) {
        visible = v;
        if (v && !raf) { lastT = 0; raf = requestAnimationFrame(step); }
      });
    })();
  }

  // ============================================================
  // 4. BRIGHT LED DOT-MATRIX JOURNAL MARQUEE (G:/ui pixel-led-display.tsx)
  // ============================================================
  var ledCanvas = document.getElementById('led-press');
  if (ledCanvas && ledCanvas.getContext) {
    (function initLedTicker() {
      var FONT5X7 = {
        ' ':[0,0,0,0,0], '.':[0,0x60,0x60,0,0], '-':[0x08,0x08,0x08,0x08,0x08],
        '●':[0x1c,0x3e,0x3e,0x3e,0x1c], '&':[0x36,0x49,0x55,0x22,0x50],
        'A':[0x7e,0x11,0x11,0x11,0x7e], 'B':[0x7f,0x49,0x49,0x49,0x36],
        'C':[0x3e,0x41,0x41,0x41,0x22], 'D':[0x7f,0x41,0x41,0x22,0x1c],
        'E':[0x7f,0x49,0x49,0x49,0x41], 'F':[0x7f,0x09,0x09,0x01,0x01],
        'G':[0x3e,0x41,0x41,0x51,0x32], 'H':[0x7f,0x08,0x08,0x08,0x7f],
        'I':[0x00,0x41,0x7f,0x41,0x00], 'J':[0x20,0x40,0x41,0x3f,0x01],
        'K':[0x7f,0x08,0x14,0x22,0x41], 'L':[0x7f,0x40,0x40,0x40,0x40],
        'M':[0x7f,0x02,0x04,0x02,0x7f], 'N':[0x7f,0x04,0x08,0x10,0x7f],
        'O':[0x3e,0x41,0x41,0x41,0x3e], 'P':[0x7f,0x09,0x09,0x09,0x06],
        'Q':[0x3e,0x41,0x51,0x21,0x5e], 'R':[0x7f,0x09,0x19,0x29,0x46],
        'S':[0x46,0x49,0x49,0x49,0x31], 'T':[0x01,0x01,0x7f,0x01,0x01],
        'U':[0x3f,0x40,0x40,0x40,0x3f], 'V':[0x1f,0x20,0x40,0x20,0x1f],
        'W':[0x7f,0x20,0x18,0x20,0x7f], 'X':[0x63,0x14,0x08,0x14,0x63],
        'Y':[0x03,0x04,0x78,0x04,0x03], 'Z':[0x61,0x51,0x49,0x45,0x43]
      };
      var items = [
        'NATURE GEOSCIENCE',
        'NATIONAL SCIENCE REVIEW',
        'ADVANCED SCIENCE',
        'REMOTE SENSING OF ENVIRONMENT',
        'HYDROLOGY AND EARTH SYSTEM SCIENCES',
        'JOURNAL OF HYDROLOGY',
        'AGRICULTURAL AND FOREST METEOROLOGY'
      ];
      var cols = [], colColors = [];
      var palette = ['#0284C7', '#0D9488', '#E11D48', '#16A34A', '#7C3AED', '#D97706', '#0284C7'];
      function pushSpace(n) { for (var i = 0; i < n; i++) { cols.push(0); colColors.push('#0D9488'); } }
      function writeWord(str, color) {
        for (var i = 0; i < str.length; i++) {
          var ch = str[i].toUpperCase();
          if (ch === ' ') { pushSpace(3); continue; }
          var g = FONT5X7[ch] || FONT5X7[' '];
          for (var c = 0; c < 5; c++) { cols.push(g[c]); colColors.push(color); }
          cols.push(0); colColors.push(color);
        }
      }
      items.forEach(function (it, idx) {
        writeWord(it, palette[idx % palette.length]);
        pushSpace(4); writeWord('●', '#EAB308'); pushSpace(4);
      });

      var ctx = ledCanvas.getContext('2d');
      var offset = 0, last = 0, visible = true, hovered = false, raf = 0;
      ledCanvas.addEventListener('pointerenter', function () { hovered = true; });
      ledCanvas.addEventListener('pointerleave', function () { hovered = false; });

      function measure() {
        var r = ledCanvas.getBoundingClientRect();
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        ledCanvas.width = Math.max(200, Math.round(r.width * dpr));
        ledCanvas.height = Math.max(36, Math.round(r.height * dpr));
      }
      measure();
      window.addEventListener('resize', measure);

      function draw(now) {
        if (!visible) { raf = 0; return; }
        raf = requestAnimationFrame(draw);
        var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        if (!reduceMotion && !hovered) offset = (offset + 15 * dt) % cols.length;

        var w = ledCanvas.width, h = ledCanvas.height;
        ctx.clearRect(0, 0, w, h);
        var cell = Math.max(3, Math.floor((h - 10) / 7));
        var dot = Math.max(2, cell - Math.max(1, Math.floor(cell * 0.25)));
        var yPad = Math.floor((h - 7 * cell) / 2);
        var visCols = Math.ceil(w / cell) + 2;
        var whole = Math.floor(offset);
        var shift = (offset - whole) * cell;

        // Soft light pegboard background dots
        ctx.fillStyle = '#E2EDF7';
        for (var cx = 0; cx < visCols; cx++) {
          var px2 = Math.round(cx * cell - shift);
          for (var row = 0; row < 7; row++) ctx.fillRect(px2, yPad + row * cell, dot, dot);
        }
        // Colorful crisp pixel letters
        for (var cx2 = 0; cx2 < visCols; cx2++) {
          var idx = ((cx2 + whole) % cols.length + cols.length) % cols.length;
          var bits = cols[idx];
          if (!bits) continue;
          ctx.fillStyle = colColors[idx];
          var px3 = Math.round(cx2 * cell - shift);
          for (var r2 = 0; r2 < 7; r2++) {
            if ((bits >> r2) & 1) ctx.fillRect(px3, yPad + r2 * cell, dot, dot);
          }
        }
      }
      watchVisibility(ledCanvas, function (v) {
        visible = v;
        if (v && !raf) { last = 0; raf = requestAnimationFrame(draw); }
      });
    })();
  }

  // ============================================================
  // 5. PIXELCARD HOVER SHIMMER (G:/ui pixelcard.tsx — bright confetti pastel pixels)
  // ============================================================
  if (!reduceMotion) {
    document.querySelectorAll('[data-pixel-card]').forEach(function (card) {
      var canvas = null, ctx = null, pixels = [], raf = 0, mode = 'idle';
      var paletteAttr = card.getAttribute('data-pixel-colors');
      var cols = paletteAttr ? paletteAttr.split(',') : ['#38BDF8', '#14B8A6', '#FACC15', '#FB7185'];

      function ensureCanvas() {
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'px-shimmer-canvas';
          canvas.setAttribute('aria-hidden', 'true');
          card.insertBefore(canvas, card.firstChild);
          ctx = canvas.getContext('2d');
        }
        var w = Math.max(60, Math.floor(card.clientWidth));
        var h = Math.max(60, Math.floor(card.clientHeight));
        if (canvas.width !== w || canvas.height !== h || pixels.length === 0) {
          canvas.width = w; canvas.height = h;
          pixels = [];
          var step = 12, idx = 0, cx = w * 0.5, cy = h * 0.5;
          for (var x = 0; x < w; x += step) {
            for (var y = 0; y < h; y += step) {
              pixels.push({
                x: x, y: y, color: cols[idx++ % cols.length],
                size: 0, max: 3 + Math.random() * 2.5,
                delay: Math.hypot(x - cx, y - cy) * 0.45, counter: 0,
                speed: 0.1 + Math.random() * 0.14, rev: false
              });
            }
          }
        }
      }

      function tick() {
        if (!ctx || !canvas) { raf = 0; return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var anyActive = false;
        for (var i = 0; i < pixels.length; i++) {
          var p = pixels[i];
          if (mode === 'appear') {
            anyActive = true;
            if (p.counter < p.delay) { p.counter += 15; continue; }
            if (p.size < p.max && !p.rev) {
              p.size = Math.min(p.max, p.size + p.speed * 2.4);
              if (p.size >= p.max) p.rev = true;
            } else {
              p.size += p.rev ? -p.speed : p.speed;
              if (p.size <= 1) p.rev = false;
              else if (p.size >= p.max) p.rev = true;
            }
          } else {
            p.counter = 0;
            p.size = Math.max(0, p.size - 0.4);
            if (p.size > 0.05) anyActive = true;
          }
          if (p.size > 0.1) {
            var s = Math.max(2, Math.round(p.size));
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, s, s);
          }
        }
        if (anyActive) raf = requestAnimationFrame(tick);
        else raf = 0;
      }

      card.addEventListener('pointerenter', function () {
        ensureCanvas(); mode = 'appear';
        if (!raf) raf = requestAnimationFrame(tick);
      });
      card.addEventListener('pointerleave', function () {
        mode = 'disappear';
        if (canvas && !raf) raf = requestAnimationFrame(tick);
      });
    });
  }

  // ============================================================
  // 6. FIG. 1 — BRIGHT DAYTIME PIXEL BAYER-4 SST ANOMALY MAP (#sst)
  // ============================================================
  var cv = document.getElementById('sst');
  var cvCur = document.getElementById('sst-cursor');
  var cb = document.getElementById('sst-bar');
  var out = document.getElementById('sst-readout');
  if (cv && cv.getContext) {
    (function initPixelSST() {
      var W = 220, H = 110, STEP = 0.25, VMAX = 2.5;
      var field = new Float32Array(W * H);
      var land = new Uint8Array(W * H);
      var BAYER4 = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];

      var g = function (x, m, s) { var d = (x - m) / s; return Math.exp(-d * d); };
      var rad = Math.PI / 180;
      function anomaly(lon, lat) {
        var v = 0;
        v += 2.4 * g(lat, -1, 9) * g(lon, 242, 36);
        v += 0.9 * g(lat, 0, 6) * g(lon, 200, 28);
        v += 0.8 * g(lat, -8, 10) * g(lon, 278, 9);
        v -= 0.95 * g(lat, 24, 10) * g(lon, 160, 34);
        v -= 0.9 * g(lat, -24, 10) * g(lon, 168, 34);
        v += 1.15 * g(lat, 42, 8) * g(lon, 212, 22);
        v += 0.6 * g(lat, -6, 15) * g(lon, 75, 24);
        v += 0.85 * g(lat, 26, 10) * g(lon, 318, 24);
        v -= 0.75 * g(lat, 55, 6) * g(lon, 326, 14);
        v += 0.4 * Math.sin(lon * rad * 6) * g(lat, -52, 8);
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

      function tokens() {
        var t = {};
        ['cm-n2', 'cm-n1', 'cm-0', 'cm-p1', 'cm-p2', 'land', 'land-edge'].forEach(function (k) {
          t[k] = parseHex(cssVar('--' + k, '#D7E6D0'));
        });
        t.grid = cssVar('--grid', 'rgba(26,34,51,0.18)');
        return t;
      }

      function colour(v, t, bx, by) {
        var bOff = ((BAYER4[(by & 3) * 4 + (bx & 3)] / 16) - 0.5) * 0.24;
        var qv = Math.max(-VMAX, Math.min(VMAX, (Math.floor((v + bOff) / STEP) + 0.5) * STEP));
        var stops = [[-VMAX, t['cm-n2']], [-1, t['cm-n1']], [0, t['cm-0']], [1, t['cm-p1']], [VMAX, t['cm-p2']]];
        for (var i = 1; i < stops.length; i++) if (qv <= stops[i][0]) break;
        var a = stops[i - 1], b = stops[Math.min(i, 4)], f = (qv - a[0]) / ((b[0] - a[0]) || 1);
        return [
          Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
          Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
          Math.round(a[1][2] + (b[1][2] - a[1][2]) * f)
        ];
      }

      function draw() {
        var t = tokens(), ctx = cv.getContext('2d');
        cv.width = W; cv.height = H;
        var img = ctx.createImageData(W, H), d = img.data;
        for (var yy = 0; yy < H; yy++) {
          for (var xx = 0; xx < W; xx++) {
            var idx = yy * W + xx;
            var c;
            if (land[idx]) {
              var coast = (xx > 0 && !land[idx - 1]) || (xx < W - 1 && !land[idx + 1]) || (yy > 0 && !land[idx - W]) || (yy < H - 1 && !land[idx + W]);
              c = coast ? t['land-edge'] : t.land;
            } else {
              c = colour(field[idx], t, xx, yy);
            }
            d[idx * 4] = c[0]; d[idx * 4 + 1] = c[1]; d[idx * 4 + 2] = c[2]; d[idx * 4 + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);

        ctx.fillStyle = t.grid;
        for (var lon = 60; lon <= 360; lon += 60) {
          var gx = Math.round((lon - 30) / 360 * W);
          for (var gy2 = 0; gy2 < H; gy2 += 2) ctx.fillRect(gx, gy2, 1, 1);
        }
        [60, 30, -30, -60].forEach(function (la) {
          var gy = Math.round((90 - la) / 180 * H);
          for (var gx2 = 0; gx2 < W; gx2 += 2) ctx.fillRect(gx2, gy, 1, 1);
        });
        for (var ex = 0; ex < W; ex += 4) ctx.fillRect(ex, H >> 1, 2, 1);

        if (cb) {
          var bx = cb.getContext('2d'), steps = 20;
          cb.width = steps; cb.height = 1;
          var bi = bx.createImageData(steps, 1);
          for (var j = 0; j < steps; j++) {
            var c2 = colour(-VMAX + (j + 0.5) / steps * 2 * VMAX, t, 0, 0);
            bi.data.set([c2[0], c2[1], c2[2], 255], j * 4);
          }
          bx.putImageData(bi, 0, 0);
        }
      }

      draw();
      onLandMask(function (im) {
        var oc = document.createElement('canvas'); oc.width = W; oc.height = H;
        var ox = oc.getContext('2d'); ox.drawImage(im, 0, 0, W, H);
        var md = ox.getImageData(0, 0, W, H).data;
        for (var yy = 0; yy < H; yy++) for (var xx = 0; xx < W; xx++) {
          var lon = 30 + (xx + 0.5) * 360 / W; if (lon >= 180) lon -= 360; if (lon >= 180) lon -= 360;
          var mx = Math.min(W - 1, Math.floor((lon + 180) / 360 * W));
          land[yy * W + xx] = md[(yy * W + mx) * 4] < 128 ? 1 : 0;
        }
        draw();
      });

      function fmt(lon, lat) {
        var e = lon > 180 ? lon - 360 : lon;
        var lo = Math.abs(e) < 0.25 || Math.abs(Math.abs(e) - 180) < 0.25 ? Math.abs(e).toFixed(1) + '°' : Math.abs(e).toFixed(1) + (e > 0 ? '°E' : '°W');
        var la = Math.abs(lat) < 0.25 ? '0.0°' : Math.abs(lat).toFixed(1) + (lat > 0 ? '°N' : '°S');
        return la + '  ' + lo;
      }

      function drawCrosshair(px2, py2) {
        if (!cvCur || !cvCur.getContext) return;
        cvCur.width = W; cvCur.height = H;
        var cctx = cvCur.getContext('2d');
        cctx.clearRect(0, 0, W, H);
        if (px2 < 0) return;
        cctx.fillStyle = 'rgba(26,34,51,0.75)';
        for (var x = 0; x < W; x += 3) cctx.fillRect(x, py2, 2, 1);
        for (var y = 0; y < H; y += 3) cctx.fillRect(px2, y, 1, 2);
        cctx.fillStyle = '#FDE047';
        cctx.fillRect(px2 - 2, py2 - 2, 5, 1);
        cctx.fillRect(px2 - 2, py2 + 2, 5, 1);
        cctx.fillRect(px2 - 2, py2 - 2, 1, 5);
        cctx.fillRect(px2 + 2, py2 - 2, 1, 5);
      }

      function read(ev) {
        var r = cv.getBoundingClientRect();
        var x = Math.floor((ev.clientX - r.left) / r.width * W);
        var yv = Math.floor((ev.clientY - r.top) / r.height * H);
        if (x < 0 || yv < 0 || x >= W || yv >= H) return;
        var i = yv * W + x;
        var lon = (30 + (x + 0.5) * 360 / W) % 360;
        var lat = 90 - (yv + 0.5) * 180 / H;
        var zh = root.getAttribute('data-lang') === 'zh', v = field[i];
        out.textContent = fmt(lon, lat) + '  ' + (land[i] ? (zh ? '陆地' : 'LAND') : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + ' °C');
        out.hidden = false;
        drawCrosshair(x, yv);
      }
      cv.addEventListener('pointermove', read);
      cv.addEventListener('pointerdown', read);
      cv.addEventListener('pointerleave', function () {
        out.hidden = true;
        drawCrosshair(-1, -1);
      });
    })();
  }

  // ============================================================
  // 7. FOOTER ROAMING PIXEL RESEARCHER BUDDY (interactive!)
  // ============================================================
  var walker = document.getElementById('pixel-walker');
  if (walker) {
    var emotes = ['★ S2S!', '💧 ET!', '🛰️ GRACE!', '☀ AI!', '🌊 ENSO!'];
    var emIdx = 0;
    var emEl = walker.querySelector('.walker-emote');
    var pos = 12, dir = 1, wVisible = false, timer = 0;

    walker.addEventListener('click', function () {
      walker.classList.add('is-jump', 'show-emote');
      if (emEl) emEl.textContent = emotes[emIdx++ % emotes.length];
      setTimeout(function () { walker.classList.remove('is-jump'); }, 260);
      setTimeout(function () { walker.classList.remove('show-emote'); }, 1500);
    });

    if (!reduceMotion) {
      watchVisibility(walker.parentElement, function (v) {
        wVisible = v;
        if (v && !timer) {
          timer = setInterval(function () {
            if (!wVisible) return;
            pos += dir * 0.85;
            if (pos > 86) { pos = 86; dir = -1; walker.classList.add('is-flip'); }
            else if (pos < 8) { pos = 8; dir = 1; walker.classList.remove('is-flip'); }
            walker.style.left = pos.toFixed(2) + '%';
          }, 120);
        } else if (!v && timer) {
          clearInterval(timer); timer = 0;
        }
      });
    }
  }

  // ============================================================
  // 8. LIVE GITHUB COUNTS (deployed site only; static fallback kept)
  // ============================================================
  if (/(^|\.)giswlh\.github\.io$/i.test(location.hostname) && window.fetch) {
    var getJSON = function (url, key, cb2, map) {
      try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 6 * 3600e3) { cb2(c.d); return; } } catch (e) {}
      fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { d = map(d); try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} cb2(d); })
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
