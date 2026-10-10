/* Longhao Wang homepage — interactions (no dependencies). */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Language toggle (EN default, 中文 optional; remembered in localStorage)
  var toggle = document.querySelector('.lang-toggle');
  function setLang(l) {
    root.dataset.lang = l;
    root.lang = l === 'zh' ? 'zh-CN' : 'en';
    toggle && toggle.setAttribute('aria-pressed', String(l === 'zh'));
    try { localStorage.setItem('lang', l); } catch (e) {}
  }
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(root.dataset.lang === 'zh'));
    toggle.addEventListener('click', function () { setLang(root.dataset.lang === 'zh' ? 'en' : 'zh'); });
  }

  // Nav state + active section
  var nav = document.querySelector('.nav');
  function onScroll() { nav && nav.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  if ('IntersectionObserver' in window) {
    var secObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { secObs.observe(s); });
  }

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = Math.min((i % 6) * 60, 300) + 'ms';
      obs.observe(el);
    });
  }

  // Subtle 3D tilt on cards (fine pointers only, never with reduced motion)
  if (finePointer && !reduce) {
    document.querySelectorAll('.tilt').forEach(function (el) {
      var max = el.classList.contains('feature-card') || el.classList.contains('weatherai') ? 3 : 6;
      el.addEventListener('pointermove', function (ev) {
        var r = el.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        el.classList.add('tilting');
        el.style.setProperty('--ry', ((x - 0.5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((0.5 - y) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () {
        el.classList.remove('tilting');
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
      });
    });
  }

  // Publication filters
  var filters = document.querySelectorAll('.filter');
  var pubs = document.querySelectorAll('.pub');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.dataset.filter;
      filters.forEach(function (b) { var on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
      pubs.forEach(function (p) {
        var show = f === 'all' || (f === 'first' && p.dataset.first === '1') ||
          (f === 'co' && p.dataset.first === '0' && p.dataset.kind === 'jour') || (f === 'pre' && p.dataset.kind === 'pre');
        p.classList.toggle('hide', !show);
        if (show) p.classList.add('in');
      });
    });
  });

  // Live GitHub stars (static numbers stay as fallback; cached 6 h to respect rate limits)
  function applyRepos(list) {
    var by = {}; list.forEach(function (r) { by[r.name] = r; });
    var total = 0, counted = {};
    document.querySelectorAll('[data-repo]').forEach(function (el) {
      var r = by[el.dataset.repo]; if (!r) return;
      el.querySelector('.n').textContent = r.stargazers_count;
    });
    document.querySelectorAll('[data-repo-f]').forEach(function (el) {
      var r = by[el.dataset.repoF]; if (r) el.textContent = r.forks_count;
    });
    ['DataScience-master','plot-function','IPCC','Transformer_GRACE','CAS-Canglong','IPCC_figure','WeatherAI','BetterPPTSkills','skills-dashboard','cheap-paper-banana','Download-Journal-cover'].forEach(function (n) {
      if (by[n] && !counted[n]) { total += by[n].stargazers_count; counted[n] = 1; }
    });
    var t = document.querySelector('[data-total-stars]');
    if (t && total > 0) t.textContent = total;
  }
  function fetchJSON(url, key, cb, map) {
    try {
      var c = JSON.parse(localStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < 6 * 3600e3) { cb(c.d); return; }
    } catch (e) {}
    if (!window.fetch) return;
    fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (map) d = map(d); try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} cb(d); })
      .catch(function () { /* keep static fallback */ });
  }
  fetchJSON('https://api.github.com/users/GISWLH/repos?per_page=100&type=owner', 'gh_repos_v1', function (d) {
    if (Array.isArray(d)) applyRepos(d);
  }, function (d) {
    return Array.isArray(d) ? d.map(function (r) { return { name: r.name, stargazers_count: r.stargazers_count, forks_count: r.forks_count }; }) : d;
  });
  fetchJSON('https://api.github.com/users/GISWLH', 'gh_user_v1', function (d) {
    var el = document.querySelector('[data-followers]');
    if (el && d && typeof d.followers === 'number') el.textContent = d.followers;
  }, function (d) { return { followers: d && d.followers }; });

  // If the 3D module cannot load at all (blocked CDN, no modules), show the static gradient globe instead
  setTimeout(function () { if (!window.__globe) root.classList.add('no-webgl'); }, 8000);

  var yr = document.getElementById('yr'); if (yr) yr.textContent = new Date().getFullYear();
})();
