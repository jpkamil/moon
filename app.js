/* app.js — views, navigation, rendering. Depends on moon.js (global Moon). */
(function () {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const DAY = 86400000;

  // ---------- state ----------
  const state = {
    view: 'today',
    date: startOfDay(new Date()),      // selected local calendar day
    hemi: 'N',
  };
  try { state.hemi = localStorage.getItem('moon.hemi') === 'S' ? 'S' : 'N'; } catch (e) { /* storage unavailable */ }

  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.min(d.getDate(), last)); return x; }
  function noonOf(d) { const x = startOfDay(d); x.setHours(12); return x; }
  function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function fromISODate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }

  // ---------- formatting ----------
  const locale = undefined; // browser default
  const fmt = {
    long: new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    time: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    timeTz: new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    short: new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
    shortY: new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    monthY: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    month: new Intl.DateTimeFormat(locale, { month: 'long' }),
    dow: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    dowNarrow: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
    md: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }),
    num: new Intl.NumberFormat(locale),
  };
  function fmtDateSmart(d, ref = new Date()) { return (d.getFullYear() === ref.getFullYear() ? fmt.short : fmt.shortY).format(d); }
  function relative(d, now) {
    let ms = d - now; const past = ms < 0; ms = Math.abs(ms);
    const days = Math.floor(ms / DAY), hrs = Math.floor((ms % DAY) / 3600000), mins = Math.floor((ms % 3600000) / 60000);
    let s;
    if (days >= 1) s = `${days}d ${hrs}h`;
    else if (hrs >= 1) s = `${hrs}h ${mins}m`;
    else s = `${mins}m`;
    return past ? `${s} ago` : `in ${s}`;
  }
  const SHORT = ['New', '1st Qtr', 'Full', '3rd Qtr'];

  // ---------- moon drawing ----------
  let uid = 0;
  const MARIA = [
    ['ellipse', -45, -5, 28, 42, -10], ['ellipse', -22, -40, 26, 22, 0], ['ellipse', 18, -38, 17, 16, 0],
    ['ellipse', 38, -10, 20, 17, 30], ['ellipse', 68, -25, 12, 10, 0], ['ellipse', 55, 18, 13, 18, 0],
    ['ellipse', 35, 22, 10, 10, 0], ['ellipse', -25, 28, 18, 14, 0], ['ellipse', -48, 35, 11, 10, 0],
    ['ellipse', -10, -68, 45, 6, 0],
  ];
  /**
   * SVG string of the Moon's disk.
   * fraction: illuminated 0..1; waxing: boolean; detailed: maria + glow.
   */
  function moonSVG(fraction, waxing, { detailed = false, cls = '' } = {}) {
    const r = 96;
    const f = Math.min(1, Math.max(0, fraction));
    const litRight = state.hemi === 'N' ? waxing : !waxing;
    const rx = r * Math.abs(2 * f - 1);
    const sweep = f >= 0.5 ? 1 : 0;
    const lit = `M0,${-r} A${r},${r} 0 0 1 0,${r} A${rx.toFixed(3)},${r} 0 0 ${sweep} 0,${-r} Z`;
    const flip = litRight ? '' : ' transform="scale(-1,1)"';
    const litPath = `<path d="${lit}"${flip}/>`;
    const id = `m${++uid}`;
    const texRot = state.hemi === 'S' ? ' transform="rotate(180)"' : '';
    if (!detailed) {
      return `<svg class="moon ${cls}" viewBox="-100 -100 200 200" role="img" aria-label="${Math.round(f * 100)}% illuminated">` +
        `<circle r="${r}" fill="var(--moon-dark)"/><circle r="${r - 0.5}" fill="none" stroke="rgba(255,255,255,.10)"/>` +
        `<path d="${lit}"${flip} fill="var(--moon-lit)"/></svg>`;
    }
    const maria = (op) => MARIA.map(([, cx, cy, mx, my, rot]) =>
      `<ellipse cx="${cx}" cy="${cy}" rx="${mx}" ry="${my}" transform="rotate(${rot} ${cx} ${cy})" fill="rgba(70,80,105,${op})"/>`).join('');
    return `<svg class="moon ${cls}" viewBox="-104 -104 208 208" role="img" aria-label="${Math.round(f * 100)}% illuminated">` +
      `<defs><clipPath id="${id}">${litPath}</clipPath>` +
      `<filter id="${id}b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>` +
      `<radialGradient id="${id}g" cx="35%" cy="32%" r="80%"><stop offset="0" stop-color="#fbf8ee"/><stop offset=".7" stop-color="#eee8d6"/><stop offset="1" stop-color="#d9d2bb"/></radialGradient></defs>` +
      // dark side with earthshine
      `<circle r="${r}" fill="#171c33"/><g${texRot} filter="url(#${id}b)">${maria(0.35)}</g>` +
      `<circle r="${r - 0.5}" fill="none" stroke="rgba(255,255,255,.12)"/>` +
      // lit side
      `<g clip-path="url(#${id})"><circle r="${r}" fill="url(#${id}g)"/><g${texRot} filter="url(#${id}b)">${maria(0.13)}` +
      `<circle cx="-12" cy="62" r="4" fill="rgba(255,255,255,.55)"/><circle cx="-30" cy="-12" r="3" fill="rgba(255,255,255,.45)"/></g></g>` +
      `</svg>`;
  }

  // ---------- data helpers ----------
  function principalOnDay(day) {
    const list = Moon.phasesBetween(startOfDay(day), addDays(startOfDay(day), 1));
    return list.length ? list[0] : null;
  }
  function dayInfo(day) {
    const t = noonOf(day);
    const ill = Moon.illumination(t);
    const p = principalOnDay(day);
    return { t, ill, p };
  }

  // ---------- views ----------
  function renderToday() {
    const el = $('#view-today');
    const now = new Date();
    const viewingToday = isSameDay(state.date, now);
    const t = viewingToday ? now : noonOf(state.date);
    const ill = Moon.illumination(t);
    const name = Moon.phaseName(t);
    const age = Moon.age(t);
    const { prev, next, list } = Moon.surroundingPhases(t);
    const upcoming = list.filter((p) => p.date > t).slice(0, 4);
    const ageDays = Math.floor(age.days), ageHrs = Math.round((age.days - ageDays) * 24);

    el.innerHTML = `
      <div class="card hero">
        <div class="hero-moon">${moonSVG(ill.fraction, ill.waxing, { detailed: true })}</div>
        <div class="hero-text">
          <h2>${name}</h2>
          <p class="when">${fmt.long.format(t)}${viewingToday ? ' · ' + fmt.timeTz.format(t) : ' · at noon'}</p>
          <dl class="stats">
            <div><dt>Illuminated</dt><dd class="num">${(ill.fraction * 100).toFixed(1)}<small>%</small></dd></div>
            <div><dt>Moon age</dt><dd class="num">${ageDays}<small>d</small> ${ageHrs}<small>h</small></dd></div>
            <div><dt>${next ? 'Next: ' + next.name : 'Next phase'}</dt><dd class="num">${next ? relative(next.date, t) : '—'}</dd></div>
            <div><dt>Distance</dt><dd class="num">${fmt.num.format(Math.round(ill.distanceKm))}<small>km</small></dd></div>
          </dl>
        </div>
      </div>
      ${prev ? `<p class="muted prevline">Previous phase: <strong>${prev.name}</strong> · ${fmtDateSmart(prev.date, t)}, ${fmt.time.format(prev.date)} · ${relative(prev.date, t)}</p>` : ''}
      <h3 class="section-title">Coming up</h3>
      <div class="phase-list">
        ${upcoming.map((p) => `
          <div class="card phase-item">
            ${moonSVG([0, 0.5, 1, 0.5][p.phase], p.phase <= 1)}
            <div>
              <div class="name">${p.name}</div>
              <div class="time">${fmtDateSmart(p.date, t)} · ${fmt.time.format(p.date)}</div>
              <div class="rel">${relative(p.date, t)}</div>
            </div>
          </div>`).join('')}
      </div>`;
  }

  function renderDays() {
    const el = $('#view-days');
    const now = new Date();
    const start = state.date;
    const cards = [];
    for (let i = 0; i < 14; i++) {
      const d = addDays(start, i);
      const { ill, p } = dayInfo(d);
      const today = isSameDay(d, now);
      const label = p ? `${p.name} · ${fmt.time.format(p.date)}` : Moon.phaseName(noonOf(d), 0).replace('Waxing ', 'Waxing ').replace('Waning ', 'Waning ');
      cards.push(`
        <div class="card day-card ${today ? 'is-today' : ''} ${p ? 'is-principal' : ''}" data-date="${toISODate(d)}" role="button" tabindex="0">
          <div class="dow">${today ? 'Today' : fmt.dow.format(d)}</div>
          <div class="dnum">${fmt.md.format(d)}</div>
          ${moonSVG(ill.fraction, ill.waxing)}
          <div class="pct num">${(ill.fraction * 100).toFixed(0)}%</div>
          <div class="lbl">${label}</div>
        </div>`);
    }
    el.innerHTML = `
      <div class="month-head"><h2>14 days from ${fmtDateSmart(start, now)}</h2><span class="muted">${start.getFullYear() !== now.getFullYear() ? start.getFullYear() : ''}</span></div>
      <div class="days">${cards.join('')}</div>`;
  }

  function renderMonth() {
    const el = $('#view-month');
    const now = new Date();
    const y = state.date.getFullYear(), m = state.date.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const lead = first.getDay(); // Sunday-first
    const dows = [];
    for (let i = 0; i < 7; i++) dows.push(`<div class="dow">${fmt.dow.format(new Date(2023, 0, 1 + i))}</div>`);
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="cell blank"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(y, m, d);
      const { ill, p } = dayInfo(day);
      const today = isSameDay(day, now);
      cells.push(`
        <div class="cell ${today ? 'is-today' : ''} ${p ? 'is-principal' : ''}" data-date="${toISODate(day)}" role="button" tabindex="0"
             title="${p ? p.name + ' ' + fmt.time.format(p.date) : Math.round(ill.fraction * 100) + '% illuminated'}">
          <span class="n">${d}</span>
          ${moonSVG(ill.fraction, ill.waxing)}
          <span class="p num">${p ? SHORT[p.phase] : Math.round(ill.fraction * 100) + '%'}</span>
        </div>`);
    }
    const phases = Moon.phasesBetween(first, new Date(y, m + 1, 1));
    el.innerHTML = `
      <div class="month-head"><h2>${fmt.monthY.format(first)}</h2>
        <span class="muted">${phases.map((p) => `${SHORT[p.phase]} ${p.date.getDate()}`).join(' · ')}</span></div>
      <div class="cal">${dows.join('')}${cells.join('')}</div>`;
  }

  function renderYear() {
    const el = $('#view-year');
    const now = new Date();
    const y = state.date.getFullYear();
    const months = [];
    for (let m = 0; m < 12; m++) {
      const first = new Date(y, m, 1);
      const n = new Date(y, m + 1, 0).getDate();
      const lead = first.getDay();
      const g = [];
      for (let i = 0; i < 7; i++) g.push(`<span class="dh">${fmt.dowNarrow.format(new Date(2023, 0, 1 + i))}</span>`);
      for (let i = 0; i < lead; i++) g.push('<span></span>');
      for (let d = 1; d <= n; d++) {
        const day = new Date(y, m, d);
        const { ill, p } = dayInfo(day);
        g.push(`<span class="${p ? 'pp' : ''}" title="${fmt.md.format(day)}: ${p ? p.name : Math.round(ill.fraction * 100) + '%'}">${moonSVG(ill.fraction, ill.waxing)}</span>`);
      }
      months.push(`<div class="card mini" data-month="${m}" role="button" tabindex="0"><h3>${fmt.month.format(first)}</h3><div class="g">${g.join('')}</div></div>`);
    }
    // table of principal phases
    const phases = Moon.phasesBetween(new Date(y, 0, 1), new Date(y + 1, 0, 1));
    const fullCountByMonth = {};
    phases.forEach((p) => { if (p.phase === 2) { const k = p.date.getMonth(); fullCountByMonth[k] = (fullCountByMonth[k] || 0) + 1; } });
    const seenFull = {};
    const rows = phases.map((p) => {
      let tags = '';
      let nm = '';
      if (p.phase === 2) {
        const mo = p.date.getMonth();
        seenFull[mo] = (seenFull[mo] || 0) + 1;
        nm = Moon.FULL_MOON_NAMES[mo];
        if (fullCountByMonth[mo] > 1 && seenFull[mo] === 2) { tags += '<span class="tag">Blue Moon</span>'; nm = ''; }
        const dist = Moon.illumination(p.date).distanceKm;
        if (dist < 360000) tags += '<span class="tag">Supermoon</span>';
        else if (dist > 405000) tags += '<span class="tag">Micromoon</span>';
      }
      return `<tr class="${p.date < now ? 'past' : ''}">
        <td>${moonSVG([0, 0.5, 1, 0.5][p.phase], p.phase <= 1)}${p.name}${tags}</td>
        <td>${fmt.short.format(p.date)}</td>
        <td class="num">${fmt.time.format(p.date)}</td>
        <td class="nm">${nm}</td></tr>`;
    });
    el.innerHTML = `
      <div class="year-head"><h2>${y}</h2><span class="muted">${phases.filter((p) => p.phase === 2).length} full moons</span></div>
      <div class="year-grid">${months.join('')}</div>
      <h3 class="section-title">All phases in ${y}</h3>
      <div class="card ptable-wrap"><table class="ptable">
        <thead><tr><th>Phase</th><th>Date</th><th>Time</th><th>Name</th></tr></thead>
        <tbody>${rows.join('')}</tbody></table>
        <p class="faint" style="font-size:12px;margin:10px 8px 2px">Times are local. Full-moon names follow the common North American almanac tradition. “Supermoon” marks a full moon closer than 360,000 km; “Micromoon” farther than 405,000 km.</p>
      </div>`;
  }

  const renderers = { today: renderToday, days: renderDays, month: renderMonth, year: renderYear };

  function render() {
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === state.view)));
    $$('.view').forEach((v) => { v.hidden = v.dataset.view !== state.view; });
    renderers[state.view]();
    $('#dateInput').value = toISODate(state.date);
    $('#hemiBtn').textContent = state.hemi;
    $('#hemiBtn').setAttribute('aria-label', state.hemi === 'N' ? 'Northern hemisphere view. Switch to Southern.' : 'Southern hemisphere view. Switch to Northern.');
    const brand = $('#brandGlyph');
    const ill = Moon.illumination(new Date());
    brand.innerHTML = moonSVG(ill.fraction, ill.waxing);
    document.title = state.view === 'today' && isSameDay(state.date, new Date())
      ? `${Moon.phaseName(new Date())} · Moon Phases` : 'Moon Phases';
    const q = new URLSearchParams({ view: state.view, d: toISODate(state.date) });
    history.replaceState(null, '', '#' + q.toString());
  }

  // ---------- navigation ----------
  function setView(v) { state.view = v; render(); }
  function setDate(d) { if (d && !isNaN(d)) { state.date = startOfDay(d); render(); } }
  function step(dir) {
    const d = state.date;
    if (state.view === 'today') setDate(addDays(d, dir));
    else if (state.view === 'days') setDate(addDays(d, 14 * dir));
    else if (state.view === 'month') setDate(addMonths(d, dir));
    else setDate(new Date(d.getFullYear() + dir, d.getMonth(), Math.min(d.getDate(), 28)));
  }

  $$('.tab').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#prevBtn').addEventListener('click', () => step(-1));
  $('#nextBtn').addEventListener('click', () => step(1));
  $('#todayBtn').addEventListener('click', () => setDate(new Date()));
  $('#dateInput').addEventListener('change', (e) => setDate(fromISODate(e.target.value)));
  $('#hemiBtn').addEventListener('click', () => {
    state.hemi = state.hemi === 'N' ? 'S' : 'N';
    try { localStorage.setItem('moon.hemi', state.hemi); } catch (e) { /* ignore */ }
    render();
  });
  // click a day/month to drill in
  $('#main').addEventListener('click', (e) => {
    const cell = e.target.closest('[data-date]');
    if (cell) { state.date = fromISODate(cell.dataset.date); setView('today'); return; }
    const mini = e.target.closest('[data-month]');
    if (mini) { state.date = new Date(state.date.getFullYear(), +mini.dataset.month, 1); setView('month'); }
  });
  $('#main').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const t = e.target.closest('[data-date],[data-month]');
      if (t) { e.preventDefault(); t.click(); }
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input')) return;
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 't' || e.key === 'T') setDate(new Date());
  });

  // restore from URL hash
  (function restore() {
    const q = new URLSearchParams(location.hash.slice(1));
    const v = q.get('view'); const d = fromISODate(q.get('d'));
    if (v && renderers[v]) state.view = v;
    if (d && !isNaN(d)) state.date = startOfDay(d);
  }());

  // timezone note
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const abbr = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    $('#tzNote').textContent = `Times in ${tz}${abbr ? ' (' + abbr.value + ')' : ''}`;
  } catch (e) { $('#tzNote').textContent = 'Times are local'; }

  // live refresh while viewing today
  setInterval(() => { if (state.view === 'today' && isSameDay(state.date, new Date())) render(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  // PWA: service worker + install hint
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installHint').hidden = false; });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!standalone && isIOS) $('#installHint').hidden = false;
  $('#installHint').addEventListener('click', async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; $('#installHint').hidden = true; return; }
    alert('In Safari: tap the Share button, then “Add to Home Screen”. The app then opens full-screen and works offline.');
  });

  render();
}());
