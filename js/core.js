/* RouteClerk prototype — core: DOM helper, icons, iOS components, navigation, fake network, app shell.
   Everything hangs off the global `WD`. Screen modules live in js/screens/*.js and register on WD.screens. */
(function () {
'use strict';
const WD = window.WD = { screens: {}, data: {} };
/** Prototype version (Settings → About). Bump on every publish; the “what’s new” tutorial shows once per version. */
WD.version = '6.0';
/** Earlier releases kept on the published site under v/<version>/ (Settings → Older versions). Add the outgoing version on every publish. */
WD.olderVersions = ['5.4', '5.3', '5.2', '5.1', '5.0', '4.3', '4.2', '4.1'];
const $ = (s, r) => (r || document).querySelector(s);

/* ================= DOM helper ================= */
function add(el, kid) {
  if (kid == null || kid === false || kid === true) return;
  if (Array.isArray(kid)) kid.forEach(k => add(el, k));
  else if (kid instanceof Node) el.appendChild(kid);
  else el.appendChild(document.createTextNode(String(kid)));
}
/** h('div.a.b', {class, style, html, onclick, ...attrs}, ...children) → Element. Props are optional. */
function h(tag, props, ...kids) {
  const parts = tag.split('.'), el = document.createElement(parts[0] || 'div'), cls = parts.slice(1);
  if (props == null || typeof props !== 'object' || props instanceof Node || Array.isArray(props)) { kids.unshift(props); props = null; }
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') cls.push(v);
    else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else for (const [p, val] of Object.entries(v)) { if (val == null) continue; p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val); } }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  if (cls.length) el.className = cls.join(' ');
  add(el, kids);
  return el;
}
WD.h = h;
WD.css = text => document.head.appendChild(h('style', text));

/* ================= Events ================= */
const listeners = {};
WD.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return () => { listeners[evt] = listeners[evt].filter(f => f !== fn); }; };
WD.emit = (evt, data) => (listeners[evt] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
let changeQueued = false;
/** Call after mutating WD.state / WD.data. Visible pages re-render on the next frame. */
WD.changed = () => { if (changeQueued) return; changeQueued = true; requestAnimationFrame(() => { changeQueued = false; WD.emit('change'); }); };

/* ================= Time, dates, formatting ================= */
const loadedAt = Date.now(), pad = n => String(n).padStart(2, '0');
const simStart = (() => { const d = new Date(); d.setHours(10, 24, 0, 0); return d.getTime(); })();
/** The prototype's clock: today's real date, starting at 10:24 AM when the page loads and running in real time. */
WD.now = () => new Date(simStart + (Date.now() - loadedAt));
WD.nowMins = () => { const d = WD.now(); return d.getHours() * 60 + d.getMinutes(); };
WD.delay = (min = 500, max) => new Promise(r => setTimeout(r, max == null ? min : min + Math.random() * (max - min)));
const D = WD.date = {
  key: d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
  parse: k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); },
  today: () => D.key(WD.now()),
  add: (k, n) => { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  diff: (a, b) => Math.round((D.parse(a) - D.parse(b)) / 864e5),
};
const WK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], WKL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], MOL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
WD.locale = { country: 'US', tag: 'en-US', currency: 'USD', units: 'us', language: 'en' };
const F = WD.fmt = {
  /** style: 'short' "Fri, Nov 13" · 'long' "Friday, November 13" · 'weekday' "Fri" · 'md' "Nov 13" · 'rel' "Today"/"Tomorrow"/short */
  day(k, style = 'short') {
    const d = D.parse(k);
    if (style === 'weekday') return WK[d.getDay()];
    if (style === 'md') return MO[d.getMonth()] + ' ' + d.getDate();
    if (style === 'long') return WKL[d.getDay()] + ', ' + MOL[d.getMonth()] + ' ' + d.getDate();
    if (style === 'month') return MOL[d.getMonth()] + ' ' + d.getFullYear();
    if (style === 'rel') { const n = D.diff(k, D.today()); if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday'; }
    return WK[d.getDay()] + ', ' + MO[d.getMonth()] + ' ' + d.getDate();
  },
  /** minutes since midnight → "9:30 AM" (short: "9:30") */
  time(m, short) { m = Math.round(m); const hh = Math.floor(m / 60) % 24, mm = m % 60, h12 = hh % 12 || 12; return h12 + ':' + pad(mm) + (short ? '' : (hh < 12 ? ' AM' : ' PM')); },
  hhmm: m => pad(Math.floor(m / 60)) + ':' + pad(m % 60),
  fromHHMM: s => { if (!s) return null; const [a, b] = s.split(':').map(Number); return a * 60 + b; },
  range: (start, dur) => F.time(start) + ' – ' + F.time(start + dur),
  dur(m) { m = Math.round(m); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' hr' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); },
  clock: d => F.time(d.getHours() * 60 + d.getMinutes()),
  /** Date|ms → "Just now", "12 min ago", "3 hr ago", "Yesterday", "Nov 3" */
  rel(d) {
    const t = +d, s = (+WD.now() - t) / 1000;
    if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400 && D.key(new Date(t)) === D.today()) return Math.floor(s / 3600) + ' hr ago';
    const n = D.diff(D.today(), D.key(new Date(t))); if (n === 1) return 'Yesterday'; if (n < 7) return n + ' days ago';
    const x = new Date(t); return MO[x.getMonth()] + ' ' + x.getDate();
  },
  /** Currency and number format are company settings (WD.locale; Settings → Country, currency and units). */
  money: (n, cents) => { const L = WD.locale; try { return new Intl.NumberFormat(L.tag, { style: 'currency', currency: L.currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(Number(n) || 0); } catch (e) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }); } },
  /** Distances are kept in miles and weights in pounds; they show in the company's units. */
  dist: mi => WD.locale.units === 'metric' ? (k => (k < 10 ? k.toFixed(1) : Math.round(k)) + ' km')(mi * 1.609) : (mi < 10 ? (+mi).toFixed(1) : Math.round(mi)) + ' mi',
  weight: lb => WD.locale.units === 'metric' ? Math.round(lb * 0.4536).toLocaleString('en-US') + ' kg' : Math.round(lb).toLocaleString('en-US') + ' lb',
  /** "559-968-4175" (plus " ext. 12" when given). Anything that isn't exactly 10 digits is returned as typed. */
  phone(p, ext) { const d = F.phoneDigits(p); return d.length === 10 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) + (ext ? ' ext. ' + ext : '') : (p || ''); },
  /** The 10 digits of a US number: drops punctuation and a leading country code 1. */
  phoneDigits(p) { let d = String(p || '').replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d; },
  /** Format while typing: at most 10 digits, dashes added as they go. */
  phoneTyping(p) { let d = String(p || '').replace(/\D/g, ''); if (d.length > 10 && d[0] === '1') d = d.slice(1); d = d.slice(0, 10); return d.length > 6 ? d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6) : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d; },
  phoneValid: p => F.phoneDigits(p).length === 10,
  initials: n => String(n || '?').split(/\s+/).filter(w => /[A-Za-z]/.test(w[0])).slice(0, 2).map(w => w[0].toUpperCase()).join(''),
};

/* ================= Icons (SF Symbols-style, 24×24, stroked) ================= */
const I = WD.icons = {
  'chevron.right': '<path d="M9 5l7 7-7 7"/>', 'chevron.left': '<path d="M15 5l-7 7 7 7"/>', 'chevron.down': '<path d="M5 9l7 7 7-7"/>', 'chevron.up': '<path d="M5 15l7-7 7 7"/>',
  'chevron.up.chevron.down': '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
  'eye.slash': '<path d="M3 12s3.3-6 9-6c1.6 0 3 .5 4.200 1.200M21 12s-3.300 6-9 6c-1.600 0-3-.5-4.200-1.200M4 4l16 16"/><circle cx="12" cy="12" r="2.6"/>', 'line.3.horizontal.decrease': '<path d="M4 7h16M7 12h10M10 17h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', xmark: '<path d="M6 6l12 12M18 6L6 18"/>', checkmark: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  'plus.circle.fill': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 7.5v9M7.5 12h9" stroke="#fff"/>',
  'checkmark.circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
  'checkmark.circle.fill': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.5l3 3L16.5 9" stroke="#fff"/>',
  'xmark.circle.fill': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff"/>',
  'minus.circle.fill': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12h9" stroke="#fff"/>',
  circle: '<circle cx="12" cy="12" r="9"/>', 'circle.fill': '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/>',
  magnifyingglass: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  map: '<path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13"/>',
  gearshape: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.3 2.6 2.8-.9.9 2.8 2.9.4-.5 2.9 2.3 1.4-2.3 1.4.5 2.9-2.9.4-.9 2.8-2.8-.9L12 21.2l-1.3-2.6-2.8.9-.9-2.8-2.9-.4.5-2.9L2.3 12l2.3-1.4-.5-2.9 2.9-.4.9-2.8 2.8.9L12 2.8z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  'person.2': '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8M15.5 5.3a3.5 3.5 0 0 1 0 6.4M18 14.6c2.1.8 3.5 2.6 3.5 5.4"/>',
  'person.crop.circle': '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M5.8 18.6c1.2-2.4 3.5-3.6 6.2-3.6s5 1.2 6.2 3.6"/>',
  'person.badge.plus': '<circle cx="10" cy="8" r="4"/><path d="M2.5 20.5c0-4 3.3-6.5 7.5-6.5 1.3 0 2.5.2 3.6.7M18.5 14v7M15 17.5h7"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3c0 1.1-.9 2-2 2C10.5 19.5 4.5 13.5 4.5 5.5c0-1.1.9-2 2-2z"/>',
  'phone.fill': '<path fill="currentColor" stroke="none" d="M6.5 3h3.2l1.7 4.6-2.1 1.6a11 11 0 0 0 5.5 5.5l1.6-2.1L21 14.3v3.2c0 1.4-1.1 2.5-2.5 2.5C10.5 20 4 13.500 4 5.5 4 4.100 5.100 3 6.500 3z"/>',
  message: '<path d="M4 6.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-5l-5 4v-4a3 3 0 0 1-3-3v-7z"/>',
  envelope: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7.500l8.500 6 8.500-6"/>',
  voicemail: '<circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M7 16h10"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
  timer: '<circle cx="12" cy="13.500" r="7.500"/><path d="M12 9.500v4M9.500 3h5M12 3v3M18.500 7l1.500-1.500"/>',
  repeat: '<path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4"/>',
  sync: '<path d="M20 12a8 8 0 0 0-14-5.300L4 9M4 4v5h5M4 12a8 8 0 0 0 14 5.300L20 15M20 20v-5h-5"/>',
  'arrow.clockwise': '<path d="M20 12a8 8 0 1 1-2.600-5.900M20 4v5h-5"/>',
  'arrow.up.right': '<path d="M7 17L17 7M9 7h8v8"/>', 'arrow.right': '<path d="M5 12h14M13 6l6 6-6 6"/>', 'arrow.down': '<path d="M12 5v14M6 13l6 6 6-6"/>', 'arrow.up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
  'arrow.left.arrow.right': '<path d="M8 4L4 8l4 4M4 8h16M16 12l4 4-4 4M20 16H4"/>',
  'arrow.triangle.turn.up.right': '<path d="M5 20v-6a4 4 0 0 1 4-4h10M15 6l4 4-4 4"/>',
  pencil: '<path d="M4 20l1-4.500L16.500 4a2.100 2.100 0 0 1 3 3L8 18.500 4 20zM14.500 6l3 3"/>',
  paintbrush: '<path d="M20.500 3.500c-3 1.500-7.500 6-9.500 9l2.500 2.500c3-2 7.500-6.500 9-9.500a1.500 1.500 0 0 0-2-2zM9.500 14A3.500 3.500 0 0 0 6 17.500c0 1.500-1 2.500-2.500 3 3.500 1 8 0 8-4a2.500 2.500 0 0 0-2-2.500z"/>',
  'square.and.pencil': '<path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.500 3.500a2.100 2.100 0 0 1 3 3L12 16l-4 1 1-4 9.500-9.500z"/>',
  trash: '<path d="M4 7h16M9.500 7V4.500h5V7M6.500 7l1 13h9l1-13M10 11v5.500M14 11v5.500"/>',
  paperclip: '<path d="M20 11.500l-8 8a5 5 0 0 1-7-7l8.500-8.500a3.400 3.400 0 0 1 4.800 4.800L10 17a1.800 1.800 0 0 1-2.500-2.500L15 7"/>',
  camera: '<path d="M3 8.500a2 2 0 0 1 2-2h2.500l1.500-2h6l1.500 2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.500z"/><circle cx="12" cy="13" r="3.500"/>',
  photo: '<rect x="3" y="4.500" width="18" height="15" rx="3"/><circle cx="8.500" cy="9.500" r="1.500"/><path d="M3.500 17l5-4.500 3.500 3 3-2.500 5.500 4.500"/>',
  doc: '<path d="M7 3h7l4.500 4.500V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h4.500"/>',
  'doc.text': '<path d="M7 3h7l4.500 4.500V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM14 3v5h4.500M8.500 12.500h7M8.500 16h7"/>',
  location: '<path d="M20 4L4 11l7 2 2 7 7-16z"/>', 'location.fill': '<path fill="currentColor" d="M20 4L4 11l7 2 2 7 7-16z"/>',
  truck: '<path d="M2.500 6h11v10.500h-11zM13.500 9.500h4l3.500 4v3h-7.500z"/><circle cx="7" cy="17.500" r="2" fill="var(--cell,#fff)"/><circle cx="17" cy="17.500" r="2" fill="var(--cell,#fff)"/>',
  mappin: '<path d="M12 21.500s6.500-6.200 6.500-11.200a6.500 6.500 0 1 0-13 0c0 5 6.500 11.200 6.500 11.200z"/><circle cx="12" cy="10" r="2.300"/>',
  bell: '<path d="M6 16.500V11a6 6 0 0 1 12 0v5.500l1.500 2h-15l1.500-2zM10 20.500a2.200 2.200 0 0 0 4 0"/>',
  lock: '<rect x="5" y="10.500" width="14" height="10" rx="2.500"/><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500"/>',
  key: '<circle cx="8" cy="15.500" r="4"/><path d="M11 12.500L20 3.500M16 7.500l3 3M13.500 10l2 2"/>',
  shield: '<path d="M12 3l7.500 2.500v6c0 4.500-3 8-7.500 9.500-4.500-1.500-7.500-5-7.500-9.500v-6L12 3z"/>',
  'hand.raised': '<path d="M8 12V5.500a1.500 1.500 0 0 1 3 0V11M11 10.500v-6a1.500 1.500 0 0 1 3 0v6M14 11V6a1.500 1.500 0 0 1 3 0v8.500c0 4-2.500 6.500-6 6.500-3 0-4.500-1.500-6-4.500l-2-4a1.500 1.500 0 0 1 2.600-1.400L8 14"/>',
  'list.bullet': '<path d="M9 6.500h11M9 12h11M9 17.500h11"/><circle cx="4.500" cy="6.500" r="1" fill="currentColor"/><circle cx="4.500" cy="12" r="1" fill="currentColor"/><circle cx="4.500" cy="17.500" r="1" fill="currentColor"/>',
  checklist: '<path d="M3.500 6.500l1.500 1.500 3-3M3.500 12.500L5 14l3-3M3.500 18.500L5 20l3-3M11.500 7h9M11.500 13h9M11.500 19h9"/>',
  columns: '<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="M9 5v14M15 5v14"/>',
  'arrow.expand': '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>', 'arrow.shrink': '<path d="M19 11h-6V5M13 11l7-7M5 13h6v6M11 13l-7 7"/>', 'sidebar.thin': '<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="M8 5v14M16 10l-3 2 3 2"/>',
  'square.grid': '<rect x="3.500" y="3.500" width="7" height="7" rx="1.500"/><rect x="13.500" y="3.500" width="7" height="7" rx="1.500"/><rect x="3.500" y="13.500" width="7" height="7" rx="1.500"/><rect x="13.500" y="13.500" width="7" height="7" rx="1.500"/>',
  ellipsis: '<circle cx="5" cy="12" r="1.600" fill="currentColor"/><circle cx="12" cy="12" r="1.600" fill="currentColor"/><circle cx="19" cy="12" r="1.600" fill="currentColor"/>',
  'ellipsis.circle': '<circle cx="12" cy="12" r="9.500"/><circle cx="7.800" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16.200" cy="12" r="1" fill="currentColor"/>',
  'info.circle': '<circle cx="12" cy="12" r="9.500"/><path d="M12 11v6"/><circle cx="12" cy="7.500" r=".600" fill="currentColor"/>',
  'questionmark.circle': '<circle cx="12" cy="12" r="9.500"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700"/><circle cx="12" cy="16.800" r=".600" fill="currentColor"/>',
  'exclamationmark.triangle': '<path d="M12 3.500l9.500 16.500h-19L12 3.500zM12 10v5"/><circle cx="12" cy="17.300" r=".600" fill="currentColor"/>',
  'exclamationmark.circle': '<circle cx="12" cy="12" r="9.500"/><path d="M12 7v6.500"/><circle cx="12" cy="16.500" r=".600" fill="currentColor"/>',
  wifi: '<path d="M2.500 9a14 14 0 0 1 19 0M5.500 12.500a9.500 9.500 0 0 1 13 0M8.500 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  'wifi.slash': '<path d="M2.500 9a14 14 0 0 1 5-3M11 4.600a14 14 0 0 1 10.500 4.400M5.500 12.500a9.500 9.500 0 0 1 4-2.300M15 10.400a9.500 9.500 0 0 1 3.500 2.100M8.500 16a5 5 0 0 1 7 0M4 3l16 18"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  bolt: '<path d="M13 2.500L5 13.500h6l-1 8 8-11h-6l1-8z"/>', 'bolt.fill': '<path fill="currentColor" d="M13 2.500L5 13.500h6l-1 8 8-11h-6l1-8z"/>',
  battery: '<rect x="2.500" y="7.500" width="17" height="9" rx="2.500"/><path d="M21.500 10.500v3"/><rect x="4.500" y="9.500" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>',
  play: '<path d="M7 4.500v15l12-7.500-12-7.500z"/>', 'play.fill': '<path fill="currentColor" d="M7 4.500v15l12-7.500-12-7.500z"/>', 'stop.fill': '<rect x="5.500" y="5.500" width="13" height="13" rx="2.500" fill="currentColor"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  creditcard: '<rect x="2.500" y="5" width="19" height="14" rx="3"/><path d="M2.500 9.500h19M6 15h4"/>',
  dollarsign: '<path d="M12 3v18M16.500 7.500c-.800-1.300-2.300-2-4.500-2-2.500 0-4.200 1.200-4.200 3.200 0 4.300 9 2 9 6.400 0 2-1.800 3.400-4.800 3.400-2.400 0-4.200-.900-5-2.500"/>',
  'dollarsign.circle': '<circle cx="12" cy="12" r="9.500"/><path d="M12 6.500v11M14.800 9.300c-.500-.800-1.400-1.200-2.800-1.200-1.600 0-2.700.800-2.700 2 0 2.700 5.700 1.300 5.700 4 0 1.300-1.200 2.100-3 2.100-1.500 0-2.600-.500-3.100-1.500"/>',
  building: '<path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M16 10h2a2 2 0 0 1 2 2v9M3 21h18M8.500 7.500h1M12.500 7.500h1M8.500 11.500h1M12.500 11.500h1M8.500 15.500h1M12.500 15.500h1"/>',
  house: '<path d="M3.500 11L12 3.500l8.500 7.500M5.500 9.500V20h13V9.500M10 20v-6h4v6"/>',
  tag: '<path d="M3.500 4.500h7.500l9.500 9.500-7 7L4 11.500l-.500-7z"/><circle cx="8" cy="9" r="1.300"/>',
  star: '<path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1.100 5.900-5.300-2.900-5.300 2.900 1.100-5.900-4.300-4.100 5.900-.800L12 3.500z"/>',
  'star.fill': '<path fill="currentColor" d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1.100 5.900-5.300-2.900-5.300 2.900 1.100-5.900-4.300-4.100 5.900-.800L12 3.500z"/>',
  flag: '<path d="M5 21V4M5 4.500h12l-2.500 4 2.500 4H5"/>', note: '<path d="M5 4h14v11l-5 5H5V4zM14 20v-5h5M8.500 8.500h7M8.500 12h4"/>',
  share: '<path d="M12 15V3.500M8 7l4-4 4 4M6 11H5a1.500 1.500 0 0 0-1.500 1.500v7A1.500 1.500 0 0 0 5 21h14a1.500 1.500 0 0 0 1.500-1.500v-7A1.500 1.500 0 0 0 19 11h-1"/>',
  link: '<path d="M10 14a4.500 4.500 0 0 0 6.400 0l3-3a4.500 4.500 0 0 0-6.400-6.400l-1 1M14 10a4.500 4.500 0 0 0-6.400 0l-3 3a4.500 4.500 0 0 0 6.400 6.400l1-1"/>',
  cloud: '<path d="M7 18.500a4.500 4.500 0 0 1-.500-9 6 6 0 0 1 11.600 1.500 3.800 3.800 0 0 1-.600 7.500H7z"/>', globe: '<circle cx="12" cy="12" r="9.500"/><path d="M2.500 12h19M12 2.500c3 3 3 16 0 19M12 2.500c-3 3-3 16 0 19"/>',
  filter: '<path d="M4 7h16M7 12h10M10 17h4"/>', 'line.3.horizontal': '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>', wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.100 2.100 0 0 1-3-3l8.500-8.500a4 4 0 0 0-5-5l2.500 2.500-1 2-2 1L8.500 6.500"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.500v2.500M12 19v2.500M2.500 12H5M19 12h2.500M5.300 5.300L7 7M17 17l1.700 1.700M5.300 18.700L7 17M17 7l1.700-1.700"/>', textformat: '<path d="M3 18.500L7.500 6l4.500 12.500M4.600 14.500h5.800M14.500 18.500l3-8 3 8M15.500 16h4"/>', calculator: '<rect x="5" y="3" width="14" height="18" rx="2.500"/><path d="M8.500 7.500h7M8.500 12h.01M12 12h.01M15.500 12h.01M8.500 16h.01M12 16h.01M15.500 16h.01"/>', fuelpump: '<path d="M5 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M3.500 20h12M7.500 8h4M14 11h1.500a1.500 1.500 0 0 1 1.500 1.500V16a1.500 1.500 0 0 0 3 0V9l-2.500-2.500"/>', sparkles: '<path d="M11 3.500l1.800 5.200L18 10.500l-5.200 1.800L11 17.500l-1.800-5.200L4 10.500l5.200-1.800L11 3.500zM18.500 15l.800 2.200 2.200.800-2.200.800-.800 2.200-.800-2.200-2.200-.800 2.200-.800.800-2.200z"/>',
  shippingbox: '<path d="M12 3l8.500 4.500v9L12 21l-8.500-4.500v-9L12 3zM3.500 7.500L12 12l8.500-4.500M12 12v9M7.700 5.300l8.600 4.500"/>',
  route: '<circle cx="6" cy="18" r="2.500"/><circle cx="18" cy="6" r="2.500"/><path d="M8.500 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.500"/>',
  'chart.bar': '<path d="M4 20V11M9.300 20V4M14.700 20v-7M20 20V8"/>', gauge: '<path d="M4.500 17a8.500 8.500 0 1 1 15 0M12 13l4-5"/><circle cx="12" cy="13.500" r="1.300" fill="currentColor"/>',
  tray: '<path d="M3.500 13.500l2.500-8h12l2.500 8v5a1.500 1.500 0 0 1-1.500 1.500H5a1.500 1.500 0 0 1-1.500-1.500v-5zM3.500 13.500h5l1 2.500h5l1-2.500h5"/>',
  briefcase: '<rect x="3" y="7.500" width="18" height="12.500" rx="2.500"/><path d="M9 7.500V5.500a1.500 1.500 0 0 1 1.500-1.500h3A1.500 1.500 0 0 1 15 5.500v2M3 13h18"/>',
  moon: '<path d="M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500z"/>', power: '<path d="M12 3v9M6.500 6.500a8 8 0 1 0 11 0"/>',
  scope: '<circle cx="12" cy="12" r="7.500"/><path d="M12 2.500v5M12 16.500v5M2.500 12h5M16.500 12h5"/>', 'square.stack': '<rect x="5" y="8" width="14" height="12" rx="2.500"/><path d="M7.500 5h9M9.500 2.500h5"/>',
  signature: '<path d="M3 17c3-6 5-10 6.500-10 2 0-1.500 10 .500 10 1.500 0 2.500-4 4-4 1.200 0 .800 3 2 3 1 0 1.500-1 3-1M3 20.500h18"/>',
  'rectangle.portrait.and.arrow.right': '<path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7M10.500 12H21M17.500 8.500L21 12l-3.500 3.500"/>',
  apple: '<path fill="currentColor" stroke="none" d="M16.700 12.800c0-2.200 1.800-3.200 1.900-3.300-1-1.500-2.600-1.700-3.200-1.700-1.400-.100-2.600.800-3.300.800-.700 0-1.700-.800-2.800-.800-1.500 0-2.800.800-3.500 2.100-1.500 2.600-.400 6.400 1.100 8.500.700 1 1.500 2.200 2.600 2.100 1.100 0 1.500-.700 2.700-.700 1.300 0 1.600.700 2.700.700 1.100 0 1.900-1 2.600-2.100.800-1.200 1.100-2.300 1.200-2.400-.100 0-2-.800-2-3.200zM14.600 6.300c.600-.700 1-1.700.900-2.700-.800 0-1.900.600-2.500 1.300-.500.600-1 1.600-.900 2.600.900.100 1.900-.500 2.500-1.200z"/>',
};
/** WD.icon('truck', 22, 'var(--blue)') → inline SVG element. */
WD.icon = (name, size = 22, color) => h('span.ic', { style: { width: size + 'px', height: size + 'px', color }, 'data-icon': name,
  html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || I.circle) + '</svg>' });
WD.addIcons = map => Object.assign(I, map);
/** Readable text color (#fff or near-black) on a hex background, e.g. dark text on the yellow purge color. */
WD.textOn = hex => { if (WD.readableOn) return WD.readableOn(hex);   // board.js supplies the WCAG 4.5:1 version; this is the fallback until it loads
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#fff'; const n = parseInt(m[1], 16), c = [n >> 16, n >> 8 & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] > .4 ? '#1C1C1E' : '#fff'; };

/* ================= State and permissions ================= */
const ALL = ['analytics.view', 'tracking.view_live', 'team.locations', 'crm.view', 'crm.edit', 'billing.view', 'billing.field', 'billing.manage', 'jobs.edit', 'users.manage', 'hr.manage', 'settings.manage', 'contracts.manage', 'comms.view', 'leads.view', 'leads.all', 'maintenance.view'];
WD.roles = {
  owner: { title: 'Owner', perms: ALL }, admin: { title: 'Admin', perms: ALL },
  dispatcher: { title: 'Dispatcher', perms: ['jobs.edit', 'tracking.view_live', 'team.locations', 'crm.view', 'crm.edit', 'analytics.view', 'billing.field', 'comms.view', 'leads.view'] },
  office: { title: 'Office', perms: ['jobs.edit', 'team.locations', 'crm.view', 'crm.edit', 'billing.view', 'billing.field', 'billing.manage', 'contracts.manage', 'comms.view', 'leads.view', 'leads.all'] },
  driver: { title: 'Driver', perms: ['billing.field'] },
  staff: { title: 'Staff', perms: [] },
};
WD.permissionList = [
  ['jobs.edit', 'Edit jobs', 'Create, move, reassign and delete jobs'], ['tracking.view_live', 'Live truck map', 'See where trucks are right now'],
  ['team.locations', 'Team locations', 'See where clocked-in employees are and where they stopped'],
  ['crm.view', 'View customers', 'Customer records and history'], ['crm.edit', 'Edit customers', 'Change customers, notes and follow-ups'],
  ['analytics.view', 'Analytics', 'Driver, stop and route reports'], ['billing.view', 'View billing', 'Invoices and payments'],
  ['billing.field', 'Field invoicing', 'Edit job charges, collect signatures and payment on site'], ['billing.manage', 'Manage billing', 'Create invoices and charge cards'], ['users.manage', 'Manage team', 'Invite people and change roles'], ['hr.manage', 'HR authority', 'Approve time off; see everyone’s hours, overtime, federal overtime, time cards and reports for any dates; fix clock-in/out times and add missed shifts. Owners and admins have it; it can be granted to anyone'], ['settings.manage', 'Company settings', 'Integrations and the Google mirror'],
  ['contracts.manage', 'Service agreements', 'Create, send and track service agreements to signature'], ['comms.view', 'Call and message history', 'Call transcripts and summaries of past calls, texts and emails when a customer calls'],
  ['maintenance.view', 'Maintenance', 'The Maintenance section: trucks, pre-trip inspection reports, GPS readings, engine codes, repairs and service due. Owners and admins have it; it can be granted to anyone'],
  ['leads.view', 'CRM: leads and pipeline', 'The CRM tab: leads, follow-ups, quotes, referrals and customer feedback'], ['leads.all', 'CRM: all territories', 'See every lead. Off = only leads in the regions, ZIP codes or area codes assigned to this person'],
];
const S = WD.state = {
  signedIn: false, role: 'owner', me: null, org: null,
  offline: false, sim: { conflictNext: false },
  theme: (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light', textSize: 1,
  pending: [], abandoned: [], folded: {},        // folded: which collapsible sections are closed, by page title | section header
  board: { day: null, mode: 'routes', routeId: null, dayCount: 3 },
  shift: null,                                   // set by the Shift screen while clocked in
  tracking: { consent: false, consentAt: null }, // employee location-tracking consent (Settings + clock-in)
  googleMirror: { enabled: true, lastSync: Date.now() - 4 * 60000, errors: 2 },
};
/** WD.can('jobs.edit') → does the signed-in user hold this permission? Per-user overrides live on user.perms. */
WD.can = flag => { const u = S.me; if (!u) return false; return (u.perms || WD.roles[u.role].perms).includes(flag); };

/* ================= iOS components ================= */
const ui = WD.ui = {};
const screen = () => $('#screen'), overlays = () => $('#overlays');
/* Measured on the overlay layer, which carries the Display → Text size zoom, so pointer math stays right at every text size. */
WD.scale = () => { const s = overlays(); return s.getBoundingClientRect().width / s.offsetWidth || 1; };
/** Pointer event → {x, y} in `el`'s own unscaled CSS pixels (the phone is scaled to fit the window). */
ui.localPoint = (evt, el) => { const r = el.getBoundingClientRect(), k = WD.scale(); return { x: (evt.clientX - r.left) / k, y: (evt.clientY - r.top) / k }; };

ui.spinner = (size = 20, color) => {
  let lines = ''; for (let i = 0; i < 8; i++) lines += '<line x1="12" y1="3" x2="12" y2="7.500" opacity="' + (0.15 + i * 0.12).toFixed(2) + '" transform="rotate(' + i * 45 + ' 12 12)"/>';
  return h('span.spinner', { style: { width: size + 'px', height: size + 'px', color }, html: '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' + lines + '</svg>' });
};
ui.progress = fraction => h('div.progress', h('i', { style: { width: Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%' } }));
ui.badge = (text, color, solid) => h('span.badge' + (solid ? '.solid' : ''), { style: { '--c': color } }, text);
ui.dot = color => h('span.dot', { style: { background: color } });
const AVATAR = ['#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF2D55', '#30B0C7', '#5856D6', '#A2845E'];
/** Who dealt with a customer: an employee (small avatar and first name), the AI (purple, with the sparkle), an automatic message, or nobody.
    by: a name, a list of names, 'AI …' / 'RouteClerk AI', 'Automatic', or null. o.none: text to show when nobody did (default: nothing shown). */
ui.isAI = by => /^(ai\b|routeclerk ai)|\bai (phone )?agent\b|^ai premium/i.test(String(by || ''));
ui.who = (by, o = {}) => { const names = [].concat(by || []).filter(Boolean);
  if (!names.length) return o.none ? h('span.who.none', WD.icon('person', 12), o.none) : null;
  return h('span.who-set', names.map(n => ui.isAI(n) ? h('span.who.ai', { title: 'Handled by AI: ' + n }, WD.icon('sparkles', 12), 'AI' + (/approved by/i.test(n) ? ' · ' + n.replace(/^.*approved by\s*/i, 'OK’d by ').split(' ').slice(0, 3).join(' ') : ''))
    : /^(automatic|routeclerk|invoice ninja|system)$/i.test(n) ? h('span.who.auto', { title: 'Sent automatically' }, WD.icon('repeat', 12), 'Automatic')
    : h('span.who', { title: 'Handled by ' + n }, h('i', { style: { background: ui.avatarColor(n) } }, n.trim().charAt(0).toUpperCase()), o.full ? n : n.split(' ')[0]))); };
ui.avatarColor = name => { let n = 0; for (const c of String(name)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[n % AVATAR.length]; };
ui.avatar = (name, o = {}) => { const size = o.size || 40; let n = 0; for (const c of String(name)) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return h('div.avatar', { style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.4) + 'px', '--c': o.color || AVATAR[n % AVATAR.length] } }, o.icon ? WD.icon(o.icon, size * 0.55) : F.initials(name)); };
ui.empty = o => h('div.empty', o.icon && WD.icon(o.icon, 52), h('h3', o.title), o.text && h('p', o.text), o.action);
ui.note = text => h('div.note', text);
ui.list = (...kids) => h('div.list', kids);
/** ui.section('Header' | {header, footer, plainHeader}, ...rows). Rows may be nested arrays; null rows are skipped. */
ui.section = (o, ...rows) => {
  if (o == null || typeof o !== 'object' || o instanceof Node || Array.isArray(o)) { if (typeof o === 'string') o = { header: o }; else { rows.unshift(o); o = {}; } }
  const flat = rows.flat(Infinity).filter(r => r != null && r !== false);
  if (!flat.length && !o.keepEmpty) return null;
  /* Sections with a plain-text header fold: tap the header to collapse it to its name and the number of items it holds (o.fold forces it,
     o.fold === false prevents it, o.folded starts it collapsed, o.count overrides the number). Forms with text fields don't fold. */
  const text = typeof o.header === 'string' && !o.plainHeader ? o.header : null, n = o.count != null ? o.count : flat.length;
  const fold = !!text && o.fold !== false && (o.fold || flat.length >= 2) && (o.fold || !flat.some(r => r instanceof Element && (r.matches('.row') ? r : r).querySelector('input.field, textarea.field')));
  /* A long explanation under a section is tucked away: behind an ⓘ on the header (tap for a popover), or, with no header, cut to one line
     that opens on tap. Short footers, footers that are elements, and o.showFooter stay as they are. */
  const long = typeof o.footer === 'string' && o.footer.length > 64 && !o.showFooter, tuck = long && !!text;
  const info = tuck && h('button.sec-info', { 'aria-label': 'About ' + text, onclick: e => { e.stopPropagation(); ui.popover(info, o.footer); } }, WD.icon('info.circle', 15));
  const foot = o.footer && h('div.section-footer' + (tuck ? '.tucked' : long ? '.clamp' : ''), long && !tuck ? { role: 'button', onclick: e => e.currentTarget.classList.toggle('clamp') } : null, o.footer);
  const el = h('div.section', o.header && h('div.section-header' + (o.plainHeader ? '.plain' : '') + (fold ? '.fold' : '') + (info ? '.has-info' : ''), fold ? { role: 'button', 'aria-label': text + ', ' + n + (n === 1 ? ' item' : ' items') } : null, info ? h('span.sh-t', o.header) : o.header, info, fold && h('span.fold-n', String(n)), fold && WD.icon('chevron.down', 12)), flat.length ? h('div.cells', flat) : null, foot);
  if (text) el.dataset.title = text;
  if (fold) { el.dataset.fold = o.foldKey || text.split(' · ')[0]; if (o.folded && !flat.some(r => r instanceof Element && r.querySelector('.field-label.missing'))) el.dataset.folded = '1'; }   // never hide a required field that is still empty
  return el;
};
/** A list cell. {title, subtitle, detail, icon, iconColor, iconPlain, leading, trailing, chevron, onTap, tint, destructive, center, disabled, badge} */
ui.row = o => {
  const tap = o.onTap && !o.disabled;
  const el = h('div.row' + (tap ? '.tappable' : '') + (o.icon || o.leading ? '.has-icon' : '') + (o.center ? '.center' : '') + (o.disabled ? '.disabled' : '') + (o.class ? '.' + o.class : ''), { onclick: tap ? e => o.onTap(e, el) : null },
    o.leading, o.icon && h('div.row-icon' + (o.iconPlain ? '.plain' : ''), { style: o.iconPlain ? { color: o.iconColor || 'var(--tint)' } : { background: o.iconColor || 'var(--gray)' } }, WD.icon(o.icon, o.iconPlain ? 24 : 19)),
    h('div.row-main', h('div.row-title' + (o.tint ? '.tint' : '') + (o.destructive ? '.destructive' : ''), o.title), o.subtitle && h('div.row-sub', o.subtitle)),
    o.badge, o.detail != null && h('div.row-detail', o.detail), o.trailing, o.chevron && h('span.row-chevron', WD.icon('chevron.right', 16)));
  return el;
};
/** onChange(newValue, el) may return false (or a Promise of false) to revert the switch. */
ui.toggle = (value, onChange, disabled) => {
  const el = h('div.switch' + (value ? '.on' : '') + (disabled ? '.disabled' : ''), { role: 'switch', onclick: async e => { e.stopPropagation(); const next = !el.classList.contains('on'); el.classList.toggle('on', next); const r = onChange && await onChange(next, el); if (r === false) el.classList.toggle('on', !next); } });
  return el;
};
ui.toggleRow = o => ui.row({ ...o, onTap: null, trailing: ui.toggle(o.value, o.onChange, o.disabled), disabled: false });
/** {label, placeholder, value, onInput(value), type, multiline, autofocus, right} */
ui.inputRow = o => {
  const input = h(o.multiline ? 'textarea.field' : 'input.field' + (o.right ? '.right' : ''), { type: o.multiline ? null : (o.type || 'text'), placeholder: o.placeholder || '', value: o.value || '', autocomplete: 'off', autocapitalize: o.caps || 'sentences', spellcheck: 'false', inputmode: o.inputmode, id: o.id, oninput: e => o.onInput && o.onInput(e.target.value, e.target), onkeydown: o.onEnter ? e => { if (e.key === 'Enter') o.onEnter(e.target.value); } : null });
  if (o.autofocus) setTimeout(() => input.focus(), 450);
  /* required: the label is bold red until the field has a value. suggested: bold label, not red. */
  const lab = o.label && h('div.field-label' + (o.required ? '.req' + (String(o.value || '').trim() ? '' : '.missing') : o.suggested ? '.sugg' : ''), o.label);
  if (o.required && lab) input.addEventListener('input', () => lab.classList.toggle('missing', !input.value.trim()));
  return h('div.row', o.icon && h('div.row-icon.plain', { style: { color: o.iconColor || 'var(--label2)' } }, WD.icon(o.icon, 22)), lab, input, o.trailing);
};
/** Phone number field: formats as 559-968-4175 while typing, accepts exactly 10 digits, with a small extension box.
    {label, value, ext, onInput(phone, ext), required, placeholder}. The label turns red while the number is incomplete. */
ui.phoneRow = o => {
  let ext = o.ext || '';
  const extIn = h('input.field.ext', { type: 'text', inputmode: 'numeric', placeholder: 'Ext.', 'aria-label': 'Extension', value: ext, autocomplete: 'off', oninput: e => { ext = e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); o.onInput && o.onInput(input.value, ext); } });
  const row = ui.inputRow({ label: o.label === undefined ? 'Phone' : o.label, type: 'tel', inputmode: 'tel', placeholder: o.placeholder || '559-555-0100', value: F.phoneTyping(o.value), required: o.required, trailing: extIn,
    onInput: (v, el) => { const t = F.phoneTyping(v); if (t !== v) el.value = t; o.onInput && o.onInput(t, ext); } });
  const input = row.querySelector('input.field'), lab = row.querySelector('.field-label');
  const mark = () => { const d = F.phoneDigits(input.value).length; row.classList.toggle('bad', d > 0 && d < 10); if (lab && o.required) lab.classList.toggle('missing', d !== 10); };
  input.maxLength = 14; input.addEventListener('input', mark); mark();   // added last, so it has the final say on the label after inputRow's own required check
  return row;
};
/** Pop-up picker. {title, options: [{value, label, icon}] | ['a','b'], value, onChange(value), icon, iconColor} */
ui.pickerRow = o => {
  const opts = o.options.map(x => typeof x === 'object' ? x : { value: x, label: String(x) }), cur = opts.find(x => x.value === o.value);
  const val = h('div.picker-value', h('span.t', cur ? cur.label : (o.placeholder || 'Choose')), WD.icon('chevron.up.chevron.down', 15));
  return ui.row({ title: o.title, subtitle: o.subtitle, icon: o.icon, iconColor: o.iconColor, iconPlain: o.iconPlain, trailing: val, disabled: o.disabled,
    onTap: () => ui.menu(val, opts.map(x => ({ label: x.label, icon: x.icon, checked: x.value === o.value, onTap: () => o.onChange && o.onChange(x.value) }))) });
};
/** Native date / time inputs styled as iOS compact pickers. value 'YYYY-MM-DD' or 'HH:MM'. */
ui.dateRow = o => ui.row({ title: o.title, icon: o.icon, iconColor: o.iconColor, trailing: h('input.pill-input', { type: 'date', value: o.value, onchange: e => o.onChange && e.target.value && o.onChange(e.target.value) }) });
ui.timeRow = o => ui.row({ title: o.title, icon: o.icon, iconColor: o.iconColor, trailing: h('input.pill-input', { type: 'time', step: 300, value: o.value || '', onchange: e => o.onChange && o.onChange(e.target.value) }) });
/** Time in 15-minute steps: an hour menu and a minutes menu (:00 :15 :30 :45). {title, subtitle, value 'HH:MM' | '', onChange('HH:MM' | ''), optional (adds "—" for no time)} */
ui.quarterRow = o => {
  let hh = '', mm = 0; const v = WD.fmt.fromHHMM(o.value); if (v != null) { const r = Math.round(v / 15) * 15; hh = Math.floor(r / 60) % 24; mm = r % 60; }
  const emit = () => o.onChange && o.onChange(hh === '' ? '' : String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
  const hs = h('select.pill-input.qt-h', { 'aria-label': (o.title || 'Time') + ' hour', onchange: e => { hh = e.target.value === '' ? '' : +e.target.value; ms.disabled = hh === ''; emit(); } },
    o.optional !== false && h('option', { value: '' }, '—'), Array.from({ length: 24 }, (_, i) => h('option', { value: i, selected: hh === i }, (i % 12 || 12) + ' ' + (i < 12 ? 'AM' : 'PM'))));
  if (hh === '') hs.value = '';
  const ms = h('select.pill-input.qt-m', { 'aria-label': (o.title || 'Time') + ' minutes', disabled: hh === '', onchange: e => { mm = +e.target.value; emit(); } }, [0, 15, 30, 45].map(m => h('option', { value: m, selected: mm === m }, ':' + String(m).padStart(2, '0'))));
  return ui.row({ title: o.title, subtitle: o.subtitle, icon: o.icon, iconColor: o.iconColor, trailing: h('div.qt', hs, ms) });
};
/** A count that can be typed. Commits when the field loses focus or Return is pressed; out-of-range values are pulled back into range. */
ui.numField = (value, min, max, onChange, label) => h('input.numfield', { type: 'text', inputmode: 'numeric', 'aria-label': label || 'Quantity', value: String(value), onfocus: e => e.target.select(), onkeydown: e => { if (e.key === 'Enter') e.target.blur(); },
  onchange: e => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10), v = Math.min(max, Math.max(min, isNaN(n) ? min : n)); e.target.value = String(v); if (v !== value) onChange(v); } });
ui.stepper = (value, min, max, onChange) => h('div.stepper', h('button', { disabled: value <= min, onclick: () => onChange(value - 1) }, '−'), h('button', { disabled: value >= max, onclick: () => onChange(value + 1) }, '+'));
/** An option may carry `badge` (a count): it shows in a red circle after the label, like the count on a tab. */
ui.segmented = (options, value, onChange) => h('div.segmented', options.map(x => typeof x === 'object' ? x : { value: x, label: String(x) }).map(x =>
  h('button' + (x.value === value ? '.on' : ''), { onclick: e => { [...e.currentTarget.parentNode.children].forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); onChange && onChange(x.value); } }, x.label, x.badge ? h('span.seg-badge', { 'aria-label': x.badge + ' waiting' }, String(x.badge)) : null)));
/** ui.button('Save', {kind: 'filled'|'tinted'|'gray'|'plain'|'destructive'|'dark', icon, onTap(e, el), block, small, disabled}) */
ui.button = (label, o = {}) => { const el = h('button.btn.' + (o.kind || 'filled') + (o.block === false ? '' : '.block') + (o.small ? '.small' : ''), { disabled: !!o.disabled, style: o.style, onclick: e => o.onTap && o.onTap(e, el) }, o.icon && WD.icon(o.icon, o.small ? 17 : 20), label); return el; };
/** A round icon button for the trailing edge of a row (call, text, directions), so one row can carry its own actions. */
ui.iconBtn = (name, label, onTap) => h('button.row-act', { 'aria-label': label, title: label, onclick: e => { e.stopPropagation(); onTap && onTap(e, e.currentTarget); } }, WD.icon(name, 18));
/** Rows shown as a strip of chips that scrolls sideways: pass rows or whole sections, and each row becomes a chip that does what the row did.
    A count that leads the row's subtitle ("14 customers owe…") is carried onto the chip. */
ui.chipRow = (...kids) => {
  const rows = kids.flat(Infinity).filter(x => x instanceof Element).flatMap(x => x.matches('.row') ? [x] : [...x.querySelectorAll('.row')]); if (!rows.length) return null;
  return h('div.chips', rows.map(r => { const t = (r.querySelector('.row-title') || r).textContent.trim(), sub = (r.querySelector('.row-sub') || {}).textContent || '', n = /^\d/.test(t) ? null : (/^\s*(\d[\d,]*)/.exec(sub) || [])[1], ic = r.querySelector('.row-icon .ic');
    const c = (r.querySelector('.row-icon') || { style: {} }).style.background || (r.querySelector('.row-icon') || { style: {} }).style.color;
    return h('button.chip', { title: sub.trim() || null, style: { '--c': c || null }, onclick: () => r.click() }, ic && ic.cloneNode(true), n && h('b', n), t); }));
};
/** {placeholder, value, onInput(value), autofocus, cancel: fn} */
ui.searchField = o => {
  const input = h('input', { type: 'text', placeholder: o.placeholder || 'Search', value: o.value || '', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off', oninput: () => { box.classList.toggle('filled', !!input.value); o.onInput && o.onInput(input.value); } });
  const box = h('div.search-box' + (o.value ? '.filled' : ''), WD.icon('magnifyingglass', 18), input, h('button.clear', { onclick: () => { input.value = ''; box.classList.remove('filled'); o.onInput && o.onInput(''); input.focus(); } }, WD.icon('xmark.circle.fill', 17)));
  if (o.autofocus) setTimeout(() => input.focus(), 450);
  return h('div.search', box, o.cancel && h('button.cancel', { onclick: o.cancel }, 'Cancel'));
};

/* ---------- Overlays ---------- */
const openSoon = (...els) => requestAnimationFrame(() => requestAnimationFrame(() => els.forEach(e => e.classList.add('open'))));
const closeAfter = (ms, ...els) => { els.forEach(e => e.classList.remove('open')); setTimeout(() => els.forEach(e => e.remove()), ms); };
/** Bottom action sheet / confirmation dialog. Resolves to the tapped button's `value` (default: its label) or null on cancel. */
ui.actionSheet = o => new Promise(resolve => {
  const dim = h('div.dim'), el = h('div.actionsheet');
  const done = v => { closeAfter(380, dim, el); resolve(v); };
  dim.onclick = () => done(null);
  add(el, [h('div.as-group', (o.title || o.message) && h('div.as-head', o.title && h('b', o.title), o.message),
    (o.buttons || []).map(b => h('button.as-btn' + (b.role === 'destructive' ? '.destructive' : ''), { onclick: () => done(b.value === undefined ? b.label : b.value) }, b.label))),
    h('div.as-group', h('button.as-btn.cancel', { onclick: () => done(null) }, o.cancel || 'Cancel'))]);
  add(overlays(), [dim, el]); openSoon(dim, el);
});
/** Centered alert. buttons: [{label, value, role: 'cancel'|'destructive', bold}] (default one OK). input: {placeholder, value} adds a text field;
    then it resolves to {value, text}. Otherwise resolves to the button's value (default: its label). */
ui.alert = o => new Promise(resolve => {
  if (typeof o === 'string') o = { title: o };
  const btns = o.buttons || [{ label: 'OK', bold: true }], dim = h('div.dim'), input = o.input && h('input.alert-input', { type: o.input.type || 'text', placeholder: o.input.placeholder || '', value: o.input.value || '' });
  const el = h('div.alert', h('div.alert-body', h('div.alert-title', o.title), o.message && h('div.alert-msg', o.message), input),
    h('div.alert-btns' + (btns.length > 2 ? '.stack' : ''), btns.map(b => h('button' + (b.bold ? '.bold' : '') + (b.role === 'destructive' ? '.destructive' : ''), { onclick: () => { closeAfter(240, dim, el); const v = b.value === undefined ? b.label : b.value; resolve(input ? { value: v, text: input.value } : v); } }, b.label))));
  add(overlays(), [dim, el]); openSoon(dim, el); if (input) setTimeout(() => input.focus(), 300);
});
/** iOS pull-down menu anchored to an element. items: {label, subtitle, icon, checked, destructive, disabled, onTap} | 'divider' | {header: 'text'} */
ui.menu = (anchor, items, o = {}) => {
  const dim = h('div.dim.clear'), el = h('div.menu' + (o.compact ? '.compact' : '')), close = () => closeAfter(260, dim, el);
  dim.onclick = close;
  const anyCheck = items.some(i => i && i.checked !== undefined);
  items.filter(Boolean).forEach(it => {
    if (it === 'divider') return add(el, h('div.menu-divider'));
    if (it.header) return add(el, h('div.menu-head', it.header));
    if (it.node) return add(el, it.node);   // a custom block, e.g. the board's row of route chips
    add(el, h('button.menu-item' + (it.destructive ? '.destructive' : ''), { disabled: !!it.disabled, onclick: () => { close(); it.onTap && setTimeout(it.onTap, 120); } },
      anyCheck && h('span.mi-check', it.checked ? WD.icon('checkmark', 16) : null), h('span.mi-label', it.label, it.subtitle && h('span.mi-sub', it.subtitle)), it.icon && WD.icon(it.icon, 20)));
  });
  add(overlays(), [dim, el]);
  const sc = overlays(), sr = sc.getBoundingClientRect(), k = WD.scale(), a = anchor.getBoundingClientRect();
  const ax = (a.left - sr.left) / k, ay = (a.top - sr.top) / k, aw = a.width / k, ah = a.height / k, W = sc.offsetWidth, H = sc.offsetHeight, mw = 250, mh = Math.min(el.offsetHeight, 560);
  const rightSide = ax + aw / 2 > W / 2, below = ay + ah + 8 + mh < H - 30;
  el.style.left = Math.max(8, Math.min(W - mw - 8, rightSide ? ax + aw - mw : ax)) + 'px';
  el.style.top = Math.max(58, below ? ay + ah + 6 : ay - mh - 6) + 'px';
  el.style.transformOrigin = (rightSide ? '90%' : '10%') + ' ' + (below ? '0%' : '100%');
  openSoon(el);
  return { close };
};
/** A small explanation bubble anchored to an element (the ⓘ on a section header). content: text or a node. */
ui.popover = (anchor, content) => ui.menu(anchor, [{ node: h('div.pop-text', content) }]);
/** A long page of sections shown as a short hub: one row per section (its name and what's inside), a search field over every row,
    and the section itself one tap away. build(page) → the sections, called again whenever a sub-page or the search needs them fresh.
    Sections without a header show as they are; a section with a single row shows that row. o: {placeholder, icons: {header: [icon, color]}} */
ui.hub = (page, build, o = {}) => {
  const secs = () => [build(page)].flat(Infinity).filter(x => x instanceof Element), icons = o.icons || {};
  const rowsOf = s => [...s.querySelectorAll(':scope > .cells > .row')];
  const open = s => { const hd = s.querySelector(':scope > .section-header'); if (hd) hd.remove(); delete s.dataset.fold; s.classList.remove('folded'); const f = s.querySelector(':scope > .section-footer'); if (f) f.classList.remove('tucked', 'clamp'); return s; };
  const normal = h('div'), results = h('div'); let cells = null;
  const flush = () => { if (cells) normal.appendChild(h('div.section', cells)); cells = null; };
  secs().forEach(s => {
    const title = s.dataset.title, rows = rowsOf(s);
    if (!title) { flush(); return normal.appendChild(s); }
    cells = cells || h('div.cells');
    if (rows.length === 1) return cells.appendChild(rows[0]);
    const names = rows.map(r => (r.querySelector('.row-title') || r).textContent.trim()).filter(Boolean), badge = s.querySelector('.cells .badge'), ic = icons[title];
    const lead = ic ? null : (rows.map(r => r.querySelector(':scope > .row-icon')).find(Boolean) || h('span')).cloneNode(true);
    cells.appendChild(ui.row({ class: 'hub-row', icon: ic && ic[0], iconColor: ic && ic[1], leading: lead, title, subtitle: names.slice(0, 4).join(', ') + (names.length > 4 ? '…' : ''), badge: badge && badge.cloneNode(true), detail: String(rows.length), chevron: true,
      onTap: () => page.push({ title, render: () => { const s2 = secs().find(x => x.dataset.title === title); return s2 ? ui.list(open(s2)) : ui.empty({ icon: 'gearshape', title }); } }) }));
  });
  flush();
  const find = text => { page.hubQ = text; const t = text.trim().toLowerCase(); normal.style.display = t ? 'none' : ''; results.replaceChildren(); if (!t) return;
    const hits = []; secs().forEach(s => { const title = (s.dataset.title || '').toLowerCase(); rowsOf(s).forEach(r => { if (s.dataset.title && (r.textContent.toLowerCase().includes(t) || title.includes(t))) hits.push(r); }); });
    results.appendChild(hits.length ? h('div.section', h('div.cells', hits)) : ui.empty({ icon: 'magnifyingglass', title: 'No matches', text: 'Nothing here is called “' + text.trim() + '”.' })); };
  const el = h('div.list.hub', h('div.hub-search', ui.searchField({ placeholder: o.placeholder || 'Search', value: page.hubQ || '', onInput: find })), normal, results);
  if (page.hubQ) find(page.hubQ);
  return el;
};
/** Blocking progress HUD. icon: 'spinner' or any icon name. Returns {set(text, icon), close()}. */
ui.hud = (text, o = {}) => {
  const dim = h('div.dim.clear'), iconBox = h('div.hud-icon'), label = h('div'), el = h('div.hud', iconBox, label);
  const set = (t, icon = 'spinner') => { label.textContent = t; iconBox.replaceChildren(icon === 'spinner' ? ui.spinner(34) : WD.icon(icon, 40)); };
  set(text, o.icon); add(overlays(), [dim, el]); openSoon(el);
  return { set, close: () => closeAfter(220, dim, el) };
};
/** Small transient capsule at the top of the screen, e.g. ui.toast('Copied', 'checkmark'). */
ui.toast = (text, icon, ms = 2000) => { const el = h('div.toast', icon && WD.icon(icon, 17), text); add(overlays(), el); openSoon(el); setTimeout(() => closeAfter(420, el), ms); };
/** Notification banner. {title, text, icon, color, when, onTap, duration} */
ui.banner = o => {
  /* Banners never stay: they sit above the tab bar (clear of the title, the date row and a sheet's Done), close by themselves
     (duration 0 = the longest stay, 9 s), and can be swiped away or closed with the ×. A new banner replaces the one showing. */
  overlays().querySelectorAll('.banner').forEach(b => closeAfter(300, b));
  const ms = o.duration === 0 ? 9000 : Math.min(o.duration || 5000, 9000); let gone = false, timer = null, start = null, moved = 0;
  const el = h('div.banner', { role: 'status', 'aria-live': 'polite' }, h('div.b-icon', { style: { background: o.color } }, WD.icon(o.icon || 'bell', 22)), h('div.b-main', h('div.b-title', h('span', o.title), h('small', o.when || 'now')), h('div.b-text', o.text)),
    h('button.b-x', { 'aria-label': 'Dismiss', onclick: e => { e.stopPropagation(); close(); } }, WD.icon('xmark', 17)), h('div.b-bar', h('i', { style: { animationDuration: ms + 'ms' } })));
  const close = () => { if (gone) return; gone = true; clearTimeout(timer); closeAfter(460, el); };
  el.onclick = () => { if (Math.abs(moved) > 6) return; close(); o.onTap && o.onTap(); };
  el.onpointerdown = e => { if (e.target.closest('.b-x')) return; start = { x: e.clientX, y: e.clientY }; moved = 0; try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic event */ } };
  el.onpointermove = e => { if (!start) return; const dx = e.clientX - start.x, dy = e.clientY - start.y; moved = Math.abs(dx) > Math.abs(dy) ? dx : Math.max(0, dy); if (Math.abs(moved) < 6) return; el.classList.add('drag'); el.style.transform = Math.abs(dx) > Math.abs(dy) ? 'translateX(' + dx + 'px)' : 'translateY(' + Math.max(0, dy) + 'px)'; el.style.opacity = String(Math.max(.25, 1 - Math.abs(moved) / 220)); };
  el.onpointerup = el.onpointercancel = () => { if (!start) return; start = null; el.classList.remove('drag'); if (Math.abs(moved) > 60) { el.style.transform = ''; el.style.opacity = '0'; close(); } else { el.style.transform = ''; el.style.opacity = ''; } };
  add(overlays(), el); openSoon(el); timer = setTimeout(close, ms);
  return { close };
};
/** Run something that needs the network: blocking HUD → latency → fn() → optional success tick. Returns false when offline
    (after explaining), otherwise fn's result (true when fn returns nothing). o: {done, min, max, offlineOK} */
ui.run = async (label, fn, o = {}) => {
  if (S.offline && !o.offlineOK) { await ui.alert({ title: 'No Internet Connection', message: 'This needs a connection. Job changes are saved on this iPhone and sync later, but this action can’t be queued.' }); return false; }
  const hud = ui.hud(label);
  await WD.delay(o.min == null ? 700 : o.min, o.max == null ? 1500 : o.max);
  const result = fn ? await fn() : undefined;
  if (o.done) { hud.set(o.done, 'checkmark'); await WD.delay(750); }
  hud.close(); WD.changed();
  return result === undefined ? true : result;
};

/* ================= Navigation: pages, stacks, sheets, tabs ================= */
const stacks = new Set(), sheets = [];
function navButton(b, page) {
  if (!b) return null; if (b instanceof Node) return b;
  const el = h('button.nav-btn' + (b.bold ? '.bold' : '') + (b.destructive ? '.destructive' : ''), { disabled: !!b.disabled, 'aria-label': b.label || b.icon, onclick: () => b.onTap && b.onTap(page, el) },
    b.icon && WD.icon(b.icon, b.size || 23), b.label && (!b.icon || b.showLabel) ? h('span', b.label) : null, b.badge ? h('span.badge.solid', { style: { '--c': 'var(--orange)', marginLeft: '2px' } }, b.badge) : null);
  return el;
}
function makePage(spec, stack, prev) {
  const lead = h('div.nav-lead'), trail = h('div.nav-trail'), title = h('div.nav-title' + (spec.large ? '.hidden' : '')), navbar = h('div.navbar', h('div.navbar-row', lead, title, trail));
  const body = h('div.page-body' + (spec.plain ? '.plain' : '') + (spec.noScroll ? '.noscroll' : '')), el = h('div.page' + (spec.navbar === false ? '.no-navbar' : '') + (spec.class ? '.' + spec.class : ''), navbar, body);
  const page = { spec, stack, el, body, navbar, sheet: stack.sheet || null };
  if (spec.search) navbar.appendChild(h('div.nav-search', ui.searchField({ ...spec.search, onInput: v => spec.search.onInput && spec.search.onInput(v, page) })));
  const accessory = spec.accessory ? h('div.nav-accessory') : null; if (accessory) navbar.appendChild(accessory);
  const toolbar = spec.toolbar ? h('div.toolbar') : null; if (toolbar) el.appendChild(toolbar);
  const evalSpec = v => typeof v === 'function' ? v(page) : v, list = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
  page.setTitle = t => { spec.title = t; title.textContent = t || ''; const lt = body.querySelector(':scope > .large-title'); if (lt) lt.textContent = t || ''; };
  page.refresh = () => {
    const top = body.scrollTop;
    title.textContent = evalSpec(spec.title) || '';
    lead.replaceChildren(); trail.replaceChildren();
    if (prev && spec.back !== false) { const pt = evalSpec(prev.spec.title) || 'Back'; add(lead, h('button.nav-btn.back', { 'aria-label': 'Back', onclick: () => stack.pop() }, WD.icon('chevron.left', 25), h('span', spec.backLabel || (pt.length > 11 || pt.length + (title.textContent || '').length > 24 ? 'Back' : pt)))); }
    list(evalSpec(spec.leading)).forEach(b => add(lead, navButton(b, page)));
    { const hm = !prev && !stack.sheet && spec.home; if (hm && !hm.atHome()) add(trail, navButton(app.homeButton(hm, page), page)); }
    list(evalSpec(spec.trailing)).forEach(b => add(trail, navButton(b, page)));
    if (accessory) { accessory.replaceChildren(); add(accessory, evalSpec(spec.accessory)); }
    if (toolbar) { toolbar.replaceChildren(); add(toolbar, evalSpec(spec.toolbar)); }
    let content = spec.render ? spec.render(page) : null;
    if (typeof content === 'string') content = h('div', { html: content });
    body.replaceChildren(); if (spec.large) add(body, h('div.large-title', evalSpec(spec.title)));
    add(body, content);
    body.querySelectorAll('.section[data-fold]').forEach(sec => { const v = S.folded[foldKey(sec)]; if (v != null ? v : sec.dataset.folded === '1') sec.classList.add('folded'); });
    body.scrollTop = top;
  };
  const foldKey = sec => (title.textContent || evalSpec(spec.title) || '') + '|' + sec.dataset.fold;
  body.addEventListener('click', e => { const hd = e.target.closest('.section-header.fold'); if (!hd || !body.contains(hd) || e.target.closest('button, a, input')) return; const sec = hd.parentNode, on = !sec.classList.contains('folded'); sec.classList.toggle('folded', on); S.folded[foldKey(sec)] = on; });
  /** Close the enclosing sheet (or pop if this page is not in a sheet). */
  page.dismiss = result => stack.sheet ? stack.sheet.close(result) : stack.pop();
  page.pop = () => stack.pop();
  page.push = s => stack.push(s);
  body.addEventListener('scroll', () => { const y = body.scrollTop; navbar.classList.toggle('scrolled', y > 2); if (spec.large) title.classList.toggle('hidden', y < 38); });
  return page;
}
function makeStack(o = {}) {
  const el = h('div.navstack'), stack = { el, pages: [], sheet: o.sheet || null };
  const top = () => stack.pages[stack.pages.length - 1];
  stack.top = top;
  stack.push = (spec, animated = true) => {
    const prev = top(), page = makePage(spec, stack, prev);
    stack.pages.push(page);
    if (prev && animated) { page.el.classList.add('enter'); el.appendChild(page.el); page.refresh(); void page.el.offsetWidth; page.el.classList.remove('enter'); prev.el.classList.add('behind'); }
    else { el.appendChild(page.el); page.refresh(); if (prev) prev.el.classList.add('behind'); }
    if (document.activeElement && document.activeElement.blur && prev) document.activeElement.blur();
    spec.onAppear && spec.onAppear(page);
    return page;
  };
  stack.pop = () => {
    if (stack.pages.length < 2) return;
    const page = stack.pages.pop(), prev = top();
    page.el.classList.add('enter'); prev.el.classList.remove('behind');
    if (prev.spec.live !== false) prev.refresh(); prev.spec.onReappear && prev.spec.onReappear(prev);
    setTimeout(() => page.el.remove(), 420); page.spec.onClose && page.spec.onClose(page);
  };
  stack.popToRoot = () => { while (stack.pages.length > 2) { const p = stack.pages.splice(stack.pages.length - 2, 1)[0]; p.el.remove(); p.spec.onClose && p.spec.onClose(p); } stack.pop(); };
  stacks.add(stack);
  return stack;
}
WD.on('change', () => stacks.forEach(st => {
  if (!st.el.isConnected || st.el.closest('.parked')) return; const p = st.top(); if (!p || p.spec.live === false) { p && p.spec.onChange && p.spec.onChange(p); return; }
  const a = document.activeElement; if (a && p.body.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  p.refresh();
}));
/** Present a modal sheet with its own navigation stack. o: {detent: 'large'|'medium'|'small', dismissable}.
    Returns {close(result), push(spec), closed: Promise<result>, stack}. */
ui.sheet = (spec, o = {}) => {
  const detent = o.detent || 'large', backdrop = h('div.sheet-backdrop'), el = h('div.sheet.' + detent, h('div.grabber'));
  let resolve, open = true; const sheet = { el, backdrop, detent, closed: new Promise(r => resolve = r) };
  const stack = makeStack({ sheet }); sheet.stack = stack; el.appendChild(stack.el);
  sheet.push = s => stack.push(s);
  sheet.close = result => {
    if (!open) return; open = false;
    sheets.splice(sheets.indexOf(sheet), 1); closeAfter(460, backdrop, el); stacks.delete(stack); syncPushedBack();
    stack.pages.slice().reverse().forEach(p => p.spec.onClose && p.spec.onClose(p));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    resolve(result); WD.changed();
  };
  backdrop.onclick = () => { if (o.dismissable !== false) sheet.close(); };
  sheets.push(sheet); add(overlays(), [backdrop, el]); stack.push(spec, false); openSoon(backdrop, el); syncPushedBack();
  return sheet;
};
function syncPushedBack() { $('#root').classList.toggle('pushed-back', sheets.some(s => s.detent === 'large')); }
ui.closeAllSheets = () => sheets.slice().reverse().forEach(s => s.close());

const app = WD.app = { tabs: [
  { id: 'board', title: 'Dispatch', icon: 'calendar' }, { id: 'map', title: 'Map', icon: 'map' }, { id: 'dialer', title: 'Inbox', icon: 'phone', can: 'crm.view', badge: () => WD.calls && WD.calls.actCount ? WD.calls.actCount() : 0 },
  /* Customers, CRM and Invoices are one Admin tab with a selector (CRM first). The three keep their own entries, hidden, so their badges and screens still register. */
  { id: 'office', get title() { const s = app.officeSegs(); return s.length === 1 ? OFFICE[s[0]][0] : 'Admin'; }, get icon() { const s = app.officeSegs(); return s.length === 1 ? OFFICE[s[0]][1] : 'briefcase'; }, can: () => app.officeSegs().length > 0, badge: () => app.officeSegs().reduce((n, id) => { const t = app.tabs.find(x => x.id === id); return n + (t && t.badge ? t.badge() : 0); }, 0) },
  { id: 'customers', title: 'Customers', icon: 'person.2', can: 'crm.view', hidden: true }, { id: 'crm', title: 'CRM', icon: 'funnel', can: 'leads.view', hidden: true }, { id: 'invoices', title: 'Invoices', icon: 'doc.text', can: () => WD.can('billing.view') || WD.can('billing.field'), hidden: true }, { id: 'shift', title: 'Shift', icon: 'truck' }, { id: 'settings', title: 'Settings', icon: 'gearshape', hidden: true },
  /* The last tab is a menu (three lines), not a screen: it lists the sections in app.menu and opens the chosen one in its own stack. */
  { id: 'more', title: 'Menu', icon: 'line.3.horizontal', menu: true, badge: () => app.menuItems().reduce((n, m) => n + app.menuBadge(m), 0) },
] };
/** Sections in the menu, top to bottom. Each opens WD.screens[id].root(). A person can hide any of them except Settings (Settings → Display → Menu sections). */
app.menu = [
  { id: 'services', title: 'Services and Fees', icon: 'repeat', can: () => WD.can('billing.view') || WD.can('jobs.edit') || WD.can('settings.manage') },
  { id: 'products', title: 'Products', icon: 'shippingbox', can: () => WD.can('billing.view') || WD.can('jobs.edit') || WD.can('settings.manage') },
  { id: 'customers', title: 'Customers', icon: 'person.2', can: () => WD.can('crm.view') },
  { id: 'invoices', title: 'Invoices', icon: 'doc.text', can: () => WD.can('billing.view') || WD.can('billing.field') },
  { id: 'contracts', title: 'Contracts', icon: 'signature', can: () => WD.can('contracts.manage') || WD.can('crm.view') },
  { id: 'reports', title: 'Reports', icon: 'chart.bar', can: () => WD.can('analytics.view') || WD.can('billing.view') },
  { id: 'calc', title: 'Price Calc', icon: 'calculator', can: () => WD.can('jobs.edit') || WD.can('billing.manage') || WD.can('crm.edit') },
  { id: 'maintenance', title: 'Maintenance', icon: 'wrench', can: () => WD.can('maintenance.view') },
  /* 5.1: an add-on module, off until a company turns it on (bids.js). The entry stays in the menu so it can be found and turned on. */
  { id: 'bids', title: 'Bids and Prospects', icon: 'flag', can: () => WD.can('crm.view') || WD.can('settings.manage'), badge: () => WD.bids && WD.bids.badge ? WD.bids.badge() : 0 },
  { id: 'settings', title: 'Settings', icon: 'gearshape', fixed: true },
];
/* Each person arranges the app for their own job (Settings → Display → Tabs and menu): any section can take one of the four places in the
   bottom bar, and everything else is in the Menu, in the order they choose. S.prefs.bar = ids in the bar; S.prefs.order = menu order;
   S.prefs.hidden = sections taken out of the menu. A destination is a screen tab (board, map, office = CRM, shift) or a menu section. */
/* 5.0: the bar starts with four places and a person can add shortcuts up to six (BAR_MAX). The map left the default bar: it is in the Menu and inside Dispatch.
   On the desktop website (S.desktop) every section gets its own place in the sidebar and the Menu only holds Settings. */
app.BAR_MAX = 6; app.BAR_DEFAULT = 4; app.defaultBar = ['board', 'office', 'dialer', 'shift'];
const allowed = d => !d.can || (typeof d.can === 'function' ? d.can() : WD.can(d.can));
app.dests = () => app.tabs.filter(t => !t.hidden && !t.menu).concat(app.menu).filter(allowed);
app.dest = id => app.dests().find(d => d.id === id);
app.barIds = () => { if (S.desktop) return app.dests().filter(d => !d.fixed).map(d => d.id); const p = S.prefs || {}, ids = (p.bar || app.defaultBar).filter((id, i, a) => a.indexOf(id) === i && app.dest(id)).slice(0, app.BAR_MAX); return ids.length ? ids : app.dests().slice(0, 1).map(d => d.id); };
app.menuItems = () => { const p = S.prefs || {}, bar = app.barIds(), order = p.order || [], at = d => { const i = order.indexOf(d.id); return i < 0 ? 1000 + app.dests().indexOf(d) : i; };
  return app.dests().filter(d => !bar.includes(d.id) && (d.fixed || !(p.hidden || {})[d.id])).sort((a, b) => at(a) - at(b)); };
app.menuBadge = m => { if (app.tabs.includes(m)) return m.badge ? m.badge() : 0; const t = m.id !== 'customers' && app.tabs.find(x => x.id === m.id && x.hidden); return (m.badge ? m.badge() : 0) + (t && t.badge ? t.badge() : 0); };
/** Change the bar or the menu (prefs → the tab interface is rebuilt in place, keeping the open screens that still have a place). */
app.setLayout = change => { S.prefs = S.prefs || {}; change(S.prefs); store.set('wd.layout5', JSON.stringify({ bar: S.prefs.bar || null, order: S.prefs.order || null, hidden: S.prefs.hidden || {} })); if (tabState) tabState.syncBar(); WD.changed(); };
const OFFICE = { crm: ['CRM', 'funnel'], customers: ['Customers', 'person.2'], invoices: ['Invoices', 'doc.text'] };
/** The Admin tab's views this person may see, in order: CRM, Customers, Invoices. */
app.officeSegs = () => [WD.can('leads.view') && 'crm'].filter(Boolean);   // Customers and Invoices moved to the menu in 4.0
app.officeSeg = null; app.officeNames = OFFICE;
let tabState = null, rootStack = null;
/* Businesses (5.0). A person who works for several companies keeps a separate, untouched copy of the app for each one: its open screens,
   scroll positions, half-filled forms and open sheets are parked (hidden, not rebuilt) while another business is in front.
   app.switchOrg(id) parks the current business and brings the other back exactly as it was left; 'orgSwap' lets data.js-level code swap the
   company's data before the other business's screens are shown. */
const parked = {};
const BOARD0 = () => ({ day: D.today(), mode: 'routes', routeId: null, dayCount: S.desktop ? 7 : 3 });
const setBoard = b => { Object.keys(S.board).forEach(k => delete S.board[k]); Object.assign(S.board, b); };
app.parkedOrgs = () => Object.keys(parked);
/* 5.1: view state. A screen keeps its choices (which side of the CRM, the Dialer's tab, invoice filters, a typed number or address, sort
   orders) in an object of its own. Each such object is registered here; switching business saves a copy for the business being left and
   puts back the copy of the one being opened, or the starting values the first time a business is opened. Without this the hidden screens
   of a business would redraw with the other business's choices. Plain values, arrays and plain objects are copied; anything else
   (a page, a map) is kept by reference, because the parked screens it belongs to come back unchanged. */
const uiReg = [];
const snap = v => Array.isArray(v) ? v.map(snap) : v instanceof Set ? new Set(v) : v instanceof Map ? new Map(v) : v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.keys(v).map(k => [k, snap(v[k])])) : v;
const putState = (obj, from) => { Object.keys(obj).forEach(k => { delete obj[k]; }); Object.assign(obj, snap(from)); };
app.uiState = (name, obj) => { if (obj && !uiReg.some(r => r.obj === obj)) uiReg.push({ name, obj, init: snap(obj) }); return obj; };
/* 5.3 Home. A tab that can change its view (a selector, a filter, a sort order, another day) says what its default view is:
   app.home(id, { atHome: () => true while nothing differs from the default, reset: () => put the default back }).
   The root page of that tab then gets a Home button, first in the trailing group of its navigation bar, only while the view differs from the
   default; a tap restores the default and the button goes away. Screens that draw their own top bar (Dispatch, Map) call app.homes[id] themselves.
   app.viewHome(names, { skip }) builds one from view-state objects registered with app.uiState: the default is what the object held at start. */
app.homes = {};
app.home = (id, def) => { app.homes[id] = def; return def; };
const plain = v => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
const same = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => same(x, b[i])) : plain(a) && plain(b) ? Object.keys({ ...a, ...b }).every(k => same(a[k], b[k])) : false);
app.viewHome = (names, o = {}) => { const regs = () => uiReg.filter(r => names.includes(r.name)), keys = r => Object.keys(r.init).filter(k => !(o.skip || []).includes(k));
  return { atHome: () => regs().every(r => keys(r).every(k => same(r.obj[k], r.init[k]))) && (!o.atHome || o.atHome()), reset: () => { regs().forEach(r => keys(r).forEach(k => { r.obj[k] = snap(r.init[k]); })); if (o.reset) o.reset(); } }; };
app.homeButton = (hm, page) => ({ icon: 'house', label: 'Home: back to the default view', onTap: () => { hm.reset(); if (page) { page.body.scrollTop = 0; page.refresh(); } WD.changed(); } });
const saveUi = () => ({ states: uiReg.map(r => [r.obj, snap(r.obj)]), officeSeg: app.officeSeg });
const loadUi = saved => { const m = new Map(saved ? saved.states : []); uiReg.forEach(r => putState(r.obj, m.has(r.obj) ? m.get(r.obj) : r.init)); app.officeSeg = saved ? saved.officeSeg : null; };
/** 5.1: called just before switching from the Business page in Settings. That page is where every switch starts, so parking it would make each
    business come back on the same Settings page. Instead the business is left on the screen the person was using before they opened Settings. */
app.leaveSwitcher = () => { if (!tabState) return; const st = tabState.stacks[tabState.active]; if (tabState.active === 'more' && st) { if (st.pages.length > 1) st.popToRoot(); if (tabState.prev && tabState.prev !== 'more') tabState.select(tabState.prev); } };
/** Choose a business: with two there is only one place to go; with more, a list. → true when it switched. */
app.pickOrg = async () => { const all = WD.data.orgs || [], cur = (S.org || {}).id, others = all.filter(o => o.id !== cur); if (!others.length) return false;
  const id = others.length === 1 ? others[0].id : await ui.actionSheet({ title: 'Switch business', message: 'You are in ' + (S.org || {}).name + '. Each business comes back on the screen you left it on.', buttons: others.map(o => ({ label: o.name, value: o.id })) });
  if (!id || app.switchOrg(id) === false) return false; ui.toast('Now in ' + all.find(o => o.id === id).name, 'building'); return true; };
app.switchOrg = id => {
  const to = (WD.data.orgs || []).find(o => o.id === id), from = S.org && S.org.id; if (!to || !tabState || from === id) return false;
  /* The view in front is the one that is not parked. (Taking the first .tabview parked the wrong one as soon as a second business had been opened, which left two businesses' screens on top of each other.) */
  const view = $('#root > .tabview:not(.parked)'), mine = sheets.splice(0);
  parked[from] = { view, tabState, sheets: mine, board: { ...S.board }, ui: saveUi(), shift: S.shift, pending: S.pending, abandoned: S.abandoned, folded: S.folded };
  view.classList.add('parked'); mine.forEach(sh => { sh.el.classList.add('parked'); sh.backdrop.classList.add('parked'); });
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  WD.emit('orgSwap', { from, to: id }); S.org = to; S.me = (WD.data.users || []).find(u => u.id === (S.me || {}).id) || S.me;
  const p = parked[id]; loadUi(p ? p.ui : null);
  if (p) { delete parked[id]; tabState = p.tabState; p.view.classList.remove('parked'); p.sheets.forEach(sh => { sh.el.classList.remove('parked'); sh.backdrop.classList.remove('parked'); sheets.push(sh); });
    setBoard(p.board); S.shift = p.shift; S.pending = p.pending; S.abandoned = p.abandoned; S.folded = p.folded; }
  else { setBoard(BOARD0()); S.shift = null; S.pending = []; S.abandoned = []; S.folded = {}; tabState = null; app.showMain(null, true); }
  syncPushedBack(); syncPanel(); WD.emit('org', id); WD.changed(); return true;
};
/* 5.1 drafts: sheets (a half-filled job, lead or invoice) can be set aside whole when a call comes in, and brought back or thrown away later.
   A set-aside sheet is hidden exactly like a parked business's, so nothing typed into it is lost. */
app.stashSheets = keep => { const out = sheets.filter(sh => !keep || !keep(sh)); out.forEach(sh => { sheets.splice(sheets.indexOf(sh), 1); sh.el.classList.add('parked'); sh.backdrop.classList.add('parked'); }); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); syncPushedBack(); return out; };
app.restoreSheets = list => { list.forEach(sh => { sh.el.classList.remove('parked'); sh.backdrop.classList.remove('parked'); overlays().append(sh.backdrop, sh.el); sheets.push(sh); }); syncPushedBack(); WD.changed(); };
app.openSheets = () => sheets.slice();
const nav = WD.nav = {
  /** The stack a push should go to: the top sheet if one is open, else the active tab (or the sign-in flow). */
  current: () => sheets.length ? sheets[sheets.length - 1].stack : tabState ? tabState.stacks[tabState.active] : rootStack,
  push: spec => nav.current().push(spec),
  pop: () => nav.current().pop(),
  /** A menu section's id ('customers', 'invoices', 'settings', 'reports'…) opens that section; 'crm' opens the CRM tab. */
  switchTab: id => { if (!tabState) return; if (id === 'crm') { app.officeSeg = id; id = 'office'; WD.emit('officeSeg'); } tabState.go(id); },
  activeTab: () => tabState && tabState.active,
};
function clearRoot() { Object.keys(parked).forEach(k => { parked[k].sheets.forEach(sh => { sh.el.remove(); sh.backdrop.remove(); stacks.delete(sh.stack); }); delete parked[k]; }); stacks.forEach(st => { if (!st.sheet) stacks.delete(st); }); tabState = null; rootStack = null; $('#root').replaceChildren(); }
/** Replace the whole app with one navigation stack (used by the sign-in flow). Returns the root page. */
app.showRoot = spec => { ui.closeAllSheets(); clearRoot(); rootStack = makeStack(); $('#root').appendChild(rootStack.el); return rootStack.push(spec, false); };
/** Show the signed-in tab interface. */
app.showMain = (tabId, keep) => {
  if (!keep) { ui.closeAllSheets(); clearRoot(); }
  const more = app.tabs.find(t => t.menu), panes = h('div.tabpanes'), bar = h('div.tabbar'), state = tabState = { stacks: {}, active: null, buttons: {} };
  let tabs = [];
  state.cur = 'settings'; state.open = [];   // desktop workspace: the modules on screen, left to right (up to PANES)
  state.sizes = {}; state.thin = {}; state.max = null;   // each column's share of the width, the columns folded to a strip, and the one shown full width
  /** (Re)build the bar from the person's layout. Open screens keep their place; a screen that left the bar is closed. */
  state.syncBar = () => {
    tabs = app.barIds().map(app.dest).concat(more); if (S.desktop) tabs = tabs.map((t, i) => [t, i]).sort((a, b) => app.sideGroup(a[0].id) - app.sideGroup(b[0].id) || a[1] - b[1]).map(x => x[0]); state.buttons = {}; bar.replaceChildren(); bar.className = 'tabbar n' + tabs.length; const many = (WD.data.orgs || []).length > 1; bar.style.setProperty('--org', many && S.org && S.org.color || 'transparent');
    if (S.desktop) bar.appendChild(h('button.side-org', { 'aria-label': 'Business: ' + (S.org || {}).name, onclick: e => state.orgMenu(e.currentTarget) }, h('i'), h('span', (S.org || {}).name, h('small', many ? 'Switch business' : 'RouteClerk'))));
    let grp = -1;
    tabs.forEach(t => { if (S.desktop && app.sideGroup(t.id) !== grp) { grp = app.sideGroup(t.id); bar.appendChild(h('div.side-head', app.SIDE_GROUPS[grp][0])); } const b = state.buttons[t.id] = h('button.tab' + (state.active === t.id ? '.active' : ''), { 'aria-label': t.title, onclick: () => t.menu ? (S.desktop ? state.go('settings') : state.openMenu(b)) : state.tap(t.id) }, WD.icon(t.menu && S.desktop ? 'gearshape' : t.icon, 27), h('span', t.menu && S.desktop ? 'Settings' : t.title), S.desktop && h('i.tab-split', { role: 'button', title: 'Open ' + (t.menu ? 'Settings' : t.title) + ' beside what is on screen', 'aria-label': 'Open ' + (t.menu ? 'Settings' : t.title) + ' beside what is on screen', onclick: e => { e.stopPropagation(); state.openBeside(t.id); } }, WD.icon('columns', 15))); bar.appendChild(b); });
    if (S.desktop) bar.appendChild(h('button.side-work', { 'aria-label': 'Workspace: modules on screen', onclick: e => state.workMenu(e.currentTarget) }, WD.icon('columns', 18), h('span', 'Workspace', h('small', state.open.length > 1 ? state.open.length + ' columns · layouts' : 'One column · layouts'))));
    Object.keys(state.stacks).forEach(id => { if (tabs.some(t => t.id === id) || id === state.active) return; const st = state.stacks[id]; state.open = state.open.filter(k => k !== id); st.el.remove(); stacks.delete(st); delete state.stacks[id]; });
    if (state.cur !== 'settings' && tabs.some(t => t.id === state.cur) && state.active !== 'more') { const old = state.stacks.more; if (old) { old.el.remove(); stacks.delete(old); delete state.stacks.more; } state.cur = 'settings'; }
    state.badges();
  };
  /* Two businesses: “Switch to <the other one>”. Three or more: “Switch business…”, which lists them. */
  const orgItems = () => { const others = (WD.data.orgs || []).filter(o => o.id !== (S.org || {}).id); return !others.length ? [] : others.length === 1 ? [{ label: 'Switch to ' + others[0].name, icon: 'building', onTap: () => app.pickOrg() }] : [{ label: 'Switch business…', subtitle: 'Now in ' + (S.org || {}).name, icon: 'building', onTap: () => app.pickOrg() }]; };
  state.orgMenu = anchor => ui.menu(anchor, [{ header: 'Switch business' }].concat((WD.data.orgs || []).map(o => ({ label: o.name, checked: o.id === (S.org || {}).id, onTap: () => { if (o.id !== (S.org || {}).id && app.switchOrg(o.id) !== false) ui.toast('Now in ' + o.name, 'building'); } }))));
  state.openMenu = anchor => ui.menu(anchor, app.menuItems().map(m => { const n = app.menuBadge(m); return { label: m.title + (n ? '  (' + n + ')' : ''), icon: m.icon, onTap: () => state.tap(m.id) }; }).concat('divider', { label: 'Arrange tabs and menu…', icon: 'square.grid', onTap: () => { state.go('settings'); if (WD.rc && WD.rc.sectionsSpec) nav.push(WD.rc.sectionsSpec()); } }, ...(orgItems().length ? ['divider'].concat(orgItems()) : [])));
  /** Open a section wherever it lives: its own tab when it is in the bar, otherwise the Menu tab's stack (a different section replaces that stack). */
  state.go = id => { if (tabs.some(t => t.id === id && !t.menu)) return state.select(id);
    const m = app.dest(id) || app.menu.find(x => x.id === 'settings'), old = state.stacks.more;
    if (old && state.cur !== m.id) { old.el.remove(); stacks.delete(old); delete state.stacks.more; if (state.active === 'more') state.active = null; }
    state.cur = m.id; state.select('more'); };
  /** A person pressed a tab or a menu section (not code switching tabs): the screen's onTabTap runs first. */
  state.tap = id => { const m = WD.screens[id], hook = m && m.onTabTap; if (hook) hook(); state.go(id); if (hook) WD.changed(); };
  state.select = id => {
    const t = tabs.find(x => x.id === id) || tabs[0]; id = t.id;
    /* Desktop workspace: a module that is already on screen is brought into focus; otherwise it takes the place of the focused one. */
    if (S.desktop && state.open.length > 1 && state.open.includes(id) && state.active !== id) return state.focus(id);
    if (state.active === id) { state.stacks[id].popToRoot(); return; }
    if (state.active) state.prev = state.active;
    ensure(t);
    if (S.desktop && state.open.length > 1) { const i = state.open.indexOf(state.active), old = state.open[i < 0 ? 0 : i]; state.open[i < 0 ? 0 : i] = id; state.sizes[id] = state.sizes[old]; if (state.max === old) state.max = id; delete state.thin[id]; } else state.open = [id];
    state.active = id; show(); saveWork();
    const p = state.stacks[id].top(); if (p.spec.live !== false) p.refresh(); p.spec.onReappear && p.spec.onReappear(p);
    WD.emit('tab', id);
  };
  const PANES = 3, title = id => { const t = tabs.find(x => x.id === id); return !t ? id : t.menu ? (app.dest(state.cur) || { title: 'Settings' }).title : t.title; };
  /* The workspace is kept per role: which modules are side by side, how wide each is, and which are folded to a strip. */
  const readWork = key => { try { return JSON.parse(store.get(key) || '{}') || {}; } catch (e) { return {}; } };
  const layoutNow = () => ({ open: state.open.slice(), sizes: Object.assign({}, state.sizes), thin: state.open.filter(k => state.thin[k]) });
  const saveWork = () => { if (!S.desktop) return; const all = readWork('wd.work3'); all[S.role] = layoutNow(); store.set('wd.work3', JSON.stringify(all)); };
  const refreshOpen = () => requestAnimationFrame(() => state.open.forEach(k => { const p = state.stacks[k] && state.stacks[k].top(); if (p) p.refresh(); }));
  const relayout = () => { show(); saveWork(); refreshOpen(); };
  /** Put a whole layout on screen: {open: [ids], sizes: {id: share}, thin: [ids]}. Used by the role presets, a saved layout and the layout left last time. */
  state.applyLayout = (L, focus) => { const ids = ((L && L.open) || []).filter((id, i, a) => a.indexOf(id) === i && tabs.some(t => t.id === id)).slice(0, PANES); if (!ids.length) return false;
    ids.forEach(id => ensure(tabs.find(t => t.id === id))); state.open = ids; state.sizes = Object.assign({}, L.sizes); state.thin = {}; (L.thin || []).forEach(k => { if (ids.includes(k)) state.thin[k] = true; }); state.max = null;
    state.active = focus && ids.includes(focus) ? focus : ids.includes(state.active) ? state.active : ids[0]; delete state.thin[state.active]; relayout(); WD.emit('tab', state.active); return true; };
  /** Fold a column to a thin strip (its name, turned sideways); pressing the strip opens it again. One column always stays open. */
  state.collapse = id => { if (state.open.filter(k => !state.thin[k]).length < 2) return ui.toast('One column has to stay open.', 'columns', 2200); state.thin[id] = true; if (state.max === id) state.max = null; if (state.active === id) state.active = state.open.find(k => !state.thin[k]); relayout(); WD.emit('tab', state.active); };
  state.expand = id => { delete state.thin[id]; state.active = id; relayout(); WD.emit('tab', id); };
  /** One column across the whole width, and back to side by side with the same button. */
  state.toggleMax = id => { state.max = state.max === id ? null : id; if (state.max) { delete state.thin[id]; state.active = id; } relayout(); WD.emit('tab', state.active); };
  /* Drag the edge between two columns to resize them. The screen is drawn scaled, so the pointer distance is divided by the scale. */
  const gripDown = (e, id) => { const i = state.open.indexOf(id), left = state.open[i - 1]; if (i < 1 || state.thin[id] || state.thin[left] || state.max) return; e.preventDefault(); e.stopPropagation();
    const a = state.stacks[left].el, b = state.stacks[id].el, scale = a.getBoundingClientRect().width / (a.offsetWidth || 1) || 1, wa = a.offsetWidth, wb = b.offsetWidth, sum = (state.sizes[left] || 1) + (state.sizes[id] || 1), x0 = e.clientX, grip = e.currentTarget; grip.classList.add('on');
    const move = ev => { const na = Math.max(170, Math.min(wa + wb - 170, wa + (ev.clientX - x0) / scale)); state.sizes[left] = sum * na / (wa + wb); state.sizes[id] = sum - state.sizes[left]; a.style.setProperty('--w', state.sizes[left]); b.style.setProperty('--w', state.sizes[id]); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); grip.classList.remove('on'); relayout(); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); };
  function ensure(t) { const id = t.id; if (state.stacks[id]) return;
    const mod = WD.screens[t.menu ? state.cur : id], st = state.stacks[id] = makeStack(); st.el.dataset.tab = id; panes.appendChild(st.el);
    /* In a workspace each module has a strip with its name and a close button; pressing anywhere in a module makes it the one new screens open in. */
    const pb = (ic, label, fn, cls) => h('button' + (cls || ''), { 'aria-label': label, title: label, onclick: e => { e.stopPropagation(); fn(); } }, WD.icon(ic, 13));
    st.el.appendChild(h('div.pane-bar', h('span'), pb('sidebar.thin', 'Fold this column to a thin strip', () => state.collapse(id)), pb('arrow.expand', 'Full width, or back to side by side', () => state.toggleMax(id), '.pane-max'), pb('xmark', 'Close this column', () => state.closePane(id))));
    st.el.appendChild(h('div.pane-grip', { title: 'Drag to resize', onpointerdown: e => gripDown(e, id) }));
    st.el.appendChild(h('button.pane-thin', { 'aria-label': 'Open this column', title: 'Open this column', onclick: e => { e.stopPropagation(); state.expand(id); } }, WD.icon('chevron.right', 14), h('span.t')));
    st.el.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('.pane-grip, .pane-thin')) return; if (state.open.length > 1 && state.active !== id && state.open.includes(id)) state.focus(id); }, true);
    const spec = mod && mod.root ? mod.root() : null, hm = app.homes[t.menu ? state.cur : id]; if (spec && hm && !spec.home) spec.home = hm;
    st.push(spec || { title: t.title, large: true, render: () => ui.empty({ icon: t.icon, title: t.title, text: 'This screen is not part of the prototype yet.' }) }, false); }
  function show() { const many = state.open.length > 1; if (!many || !state.open.includes(state.max)) state.max = null; delete state.thin[state.active]; panes.classList.toggle('multi', many); panes.classList.toggle('maxed', many && !!state.max);
    Object.entries(state.stacks).forEach(([k, st]) => { const on = state.open.includes(k); st.el.classList.toggle('active', on); st.el.classList.toggle('focus', many && k === state.active); st.el.style.order = on ? state.open.indexOf(k) : '';
      st.el.classList.toggle('thin', many && on && !!state.thin[k] && !state.max); st.el.classList.toggle('max', many && state.max === k); st.el.classList.toggle('first', state.open[0] === k); st.el.style.setProperty('--w', state.sizes[k] || 1);
      const mx = st.el.querySelector(':scope > .pane-bar > .pane-max'); if (mx) mx.replaceChildren(WD.icon(state.max === k ? 'arrow.shrink' : 'arrow.expand', 13));
      st.el.querySelectorAll(':scope > .pane-bar > span, :scope > .pane-thin > .t').forEach(lab => { lab.textContent = title(k); }); });
    Object.entries(state.buttons).forEach(([k, b]) => { b.classList.toggle('active', k === state.active); b.classList.toggle('open', many && state.open.includes(k)); });
    const w = bar.querySelector('.side-work small'); if (w) w.textContent = many ? state.open.length + ' columns · layouts' : 'One column · layouts'; }
  state.focus = id => { if (!state.open.includes(id)) return; const was = state.thin[id]; state.active = id; show(); if (was) { saveWork(); refreshOpen(); } WD.emit('tab', id); };
  /** Desktop: put another module on screen beside the ones already there (up to three). */
  state.openBeside = id => { const t = tabs.find(x => x.id === id); if (!t || !S.desktop) return; if (state.open.includes(id)) return state.focus(id);
    if (state.open.length >= PANES) return ui.toast('Three modules fit side by side. Close one first.', 'columns', 2600);
    ensure(t); state.open.push(id); state.active = id; state.max = null; relayout(); WD.emit('tab', id); };
  state.closePane = id => { if (state.open.length < 2) return; state.open = state.open.filter(k => k !== id); delete state.thin[id]; delete state.sizes[id]; if (state.active === id) state.active = state.open.find(k => !state.thin[k]) || state.open[0]; relayout(); WD.emit('tab', state.active); };
  state.workMenu = anchor => { const rest = tabs.filter(t => !state.open.includes(t.id)), names = L => L.open.filter(id => tabs.some(t => t.id === id)).map(title).join(' | '), usable = L => L && L.open.filter(id => tabs.some(t => t.id === id)).length > 1;
    const mine = readWork('wd.workMine')[S.role], presets = Object.values(app.workPresets).filter(usable);
    ui.menu(anchor, [{ header: 'Layouts' }, ...presets.map(p => ({ label: p.name, subtitle: names(p), icon: 'columns', onTap: () => state.applyLayout(p) })),
      usable(mine) && { label: 'My layout', subtitle: names(mine), icon: 'star.fill', onTap: () => state.applyLayout(mine) },
      state.open.length > 1 && { label: 'Save this as my layout', icon: 'plus', onTap: () => { const all = readWork('wd.workMine'); all[S.role] = layoutNow(); store.set('wd.workMine', JSON.stringify(all)); ui.toast('Saved as your layout', 'checkmark'); } },
      'divider', { header: 'On screen now' }, ...state.open.map(k => ({ label: title(k), checked: true, disabled: state.open.length < 2, onTap: () => state.closePane(k) })),
      ...(state.open.length < PANES ? [{ header: 'Open beside' + (state.open.length > 1 ? ' them' : ' it') }, ...rest.map(t => ({ label: t.menu ? 'Settings' : t.title, checked: false, onTap: () => state.openBeside(t.id) }))] : [{ header: 'Three columns fit. Untick one to change it.' }]),
      ...(state.open.length > 1 ? ['divider', { label: 'Back to one column', icon: 'xmark', onTap: () => { state.open = [state.active]; state.thin = {}; state.max = null; relayout(); } }] : [])].filter(Boolean)); };
  state.badges = () => tabs.forEach(t => { const b = state.buttons[t.id], n = t.menu ? (t.badge ? t.badge() : 0) : app.menuBadge(t); const old = b.querySelector('.tab-badge'); if (old) old.remove(); if (n) b.appendChild(h('span.tab-badge', n)); });
  state.syncBar();
  $('#root').appendChild(h('div.tabview', panes, bar));
  const left = S.desktop && !keep ? readWork('wd.work3')[S.role] : null;   // read before the first screen is selected, which saves the layout
  const first = tabId || (S.role === 'driver' && WD.screens.shift ? 'shift' : 'board'); if (tabs.some(t => t.id === first)) state.select(first); else if (app.dest(first)) state.go(first); else state.select(tabs[0].id); state.badges();
  /* Desktop: bring back the workspace this person left (which modules were side by side). */
  /* The first time, each role starts on its preset (app.workPresets), so nobody builds a workspace from a blank screen. */
  if (S.desktop && !keep) { const L = left || app.workPresets[app.presetFor(S.role)]; if (L && (L.open || []).length > 1 && (!tabId || L.open.includes(tabId))) state.applyLayout(L, tabId || state.active); }
};
WD.on('change', () => tabState && tabState.badges());
/* The desktop sidebar lists the sections under four headings. A section that is not named here goes under Setup. */
app.SIDE_GROUPS = [['Operations', ['board', 'map', 'dialer']], ['Customers & Money', ['office', 'crm', 'customers', 'invoices', 'contracts', 'calc', 'reports', 'bids']], ['Fleet & Team', ['shift', 'maintenance']], ['Setup', ['services', 'products', 'files', 'settings', 'more']]];
app.sideGroup = id => { const i = app.SIDE_GROUPS.findIndex(g => g[1].includes(id)); return i < 0 ? app.SIDE_GROUPS.length - 1 : i; };
/* Desktop workspace presets, one per role: what a person sees the first time, before they swap a column or save their own. `sizes` are shares of the width (1 when not given). */
app.workPresets = { dispatcher: { name: 'Dispatcher', open: ['board', 'map', 'dialer'], sizes: { board: 1.3 } }, office: { name: 'Office', open: ['dialer', 'customers', 'invoices'] }, owner: { name: 'Owner', open: ['board', 'office', 'shift'], sizes: { board: 1.3 } } };
app.presetFor = role => role === 'admin' ? 'owner' : role;
/** Linked columns. A screen calls this when something is selected in it: {from, customerId, jobId, routeId, vehicleId, day}. Every other column on
    screen whose screen has `onLinked(sel)` is told, and shows what it has about it (the customer's record, the stop on the map, the truck's route).
    While a screen's onLinked runs, new pages open in that screen's own column. Returns true when another column took it; false on an iPhone or with one column. */
app.linkSelect = sel => { const s = tabState; if (!s || !S.desktop || !sel || s.open.length < 2 || s.linking || sheets.length) return false; const from = s.active; let hit = false; s.linking = true;
  try { s.open.forEach(id => { if (id === from || s.thin[id] || (s.max && s.max !== id)) return; const mod = WD.screens[id === 'more' ? s.cur : id], fn = mod && mod.onLinked; if (!fn) return;
    s.active = id; try { if (fn(sel)) hit = true; } catch (e) { console.warn('onLinked', id, e); } s.active = from; }); } finally { s.active = from; s.linking = false; }
  return hit; };
/** The navigation stack of a column that is on screen (by section id), or null. */
app.paneStack = id => { const s = tabState; if (!s) return null; const k = s.stacks[id] ? id : id === s.cur ? 'more' : null; return k && s.open.includes(k) ? s.stacks[k] : null; };
/** How wide the column holding `el` is, in points. Screens use it to choose a narrow (list) or a wide (list and details) layout; pages are refreshed when a column is resized. */
app.paneW = el => { const st = el && el.closest && el.closest('.navstack'), w = st && st.isConnected ? st.clientWidth : 0; if (w) return w; const sc = screen();
  if (!S.desktop || !tabState) return sc ? sc.clientWidth : 393; const p = sc.querySelector('.tabpanes'), all = p ? p.clientWidth : 1044, o = tabState.open.filter(k => !tabState.thin[k]); if (tabState.max || o.length < 2) return all;
  const sum = o.reduce((n, k) => n + (tabState.sizes[k] || 1), 0); return Math.round(all * (tabState.sizes[tabState.active] || 1) / sum); };
/** Finish signing in and show the tabs. */
/* Sign-in policy: an admin chooses per company how often people must sign in again (Settings → Sign-in and security).
   The prototype remembers the last sign-in and the policy in this browser so reloading doesn't always show the sign-in screens. */
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
WD.signInPolicies = [{ value: 'launch', label: 'Every time the app opens', ms: 0 }, { value: '1d', label: 'Every day', ms: 864e5 }, { value: '7d', label: 'Every week', ms: 7 * 864e5 }, { value: '30d', label: 'Every 30 days', ms: 30 * 864e5 }, { value: 'never', label: 'Only after signing out', ms: Infinity }];
S.signInPolicy = store.get('wd.signInPolicy') || '30d'; S.faceId = store.get('wd.faceId') === '1';
WD.setSignInPolicy = (v, faceId) => { if (v) { S.signInPolicy = v; store.set('wd.signInPolicy', v); } if (faceId != null) { S.faceId = faceId; store.set('wd.faceId', faceId ? '1' : '0'); } };
const stillSignedIn = () => { const last = +store.get('wd.lastSignIn'), pol = WD.signInPolicies.find(p => p.value === S.signInPolicy) || WD.signInPolicies[3]; return !!last && store.get('wd.signedOut') !== '1' && Date.now() - last < pol.ms; };
app.signIn = () => { S.signedIn = true; store.set('wd.lastSignIn', String(Date.now())); store.set('wd.signedOut', '0'); app.showMain(); syncPanel(); setTimeout(() => app.autoUpdateCheck(), 2500); };
app.signOut = () => { store.set('wd.signedOut', '1'); S.signedIn = false; S.shift = null; ui.closeAllSheets(); if (WD.screens.auth && WD.screens.auth.show) WD.screens.auth.show(); else app.showMain(); syncPanel(); };
app.setRole = role => { S.role = role; S.me = (WD.data.users || []).find(u => u.role === role && u.status !== 'invited') || S.me; if (S.signedIn) app.showMain(); syncPanel(); WD.emit('role', role); };
app.setTheme = t => { S.theme = t; screen().dataset.theme = t; store.set('wd.theme', t); applyColors(); syncPanel(); WD.changed(); };
/** Display → Theme colors. Each person picks an accent color (buttons, links, the selected tab), the background of segmented controls, the
    color and weight of secondary text (the gray text of headings, second lines and footnotes), and the background behind the lists.
    null = the standard color. The choice is kept on this device, like the appearance and the text size. Secondary text and background colors
    apply in light appearance only, so a color chosen for a light screen never lands on a dark one. These are here while the scheme is being
    worked out; once it is settled the extra controls can go. */
WD.accentColors = [{ value: null, label: 'Blue', hex: '#007AFF' }, { value: '#5856D6', label: 'Indigo' }, { value: '#AF52DE', label: 'Purple' }, { value: '#0E8F9E', label: 'Teal' }, { value: '#248A3D', label: 'Green' }, { value: '#C2570C', label: 'Orange' }, { value: '#D6336C', label: 'Pink' }, { value: '#D70015', label: 'Red' }];
WD.segColors = [{ value: null, label: 'Gray', hex: '#E3E3E8' }, { value: '#CFE6FF', label: 'Light blue' }, { value: '#CDEFD8', label: 'Mint' }, { value: '#FFE0C2', label: 'Peach' }, { value: '#E3D9FB', label: 'Lavender' }, { value: '#FFF1B8', label: 'Yellow' }, { value: '#FFD6E0', label: 'Pink' }];
WD.textColors = [{ value: null, label: 'Gray', hex: '#6F6F74' }, { value: '#3A3A3C', label: 'Dark gray' }, { value: '#000000', label: 'Black' }, { value: '#3D4B5C', label: 'Slate' }, { value: '#1F3A5F', label: 'Navy' }, { value: '#0A58CA', label: 'Blue' }, { value: '#5C4630', label: 'Brown' }];
WD.bgColors = [{ value: null, label: 'Light gray', hex: '#F2F2F7' }, { value: '#FFFFFF', label: 'White' }, { value: '#EAF3FF', label: 'Ice blue' }, { value: '#EEF2F6', label: 'Mist' }, { value: '#FBF7EE', label: 'Cream' }, { value: '#ECF7F0', label: 'Mint' }, { value: '#F3F0FB', label: 'Lavender' }, { value: '#EDEBE7', label: 'Warm gray' }];
/* The standard scheme: blue accent with light blue segmented controls. */
app.colorDefaults = { accent: null, seg: '#CFE6FF', text: null, textBold: false, bg: null };
S.colors = { ...app.colorDefaults };
const hexOK = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v.toUpperCase() : null;
const cleanColors = c => ({ accent: hexOK(c.accent), seg: hexOK(c.seg), text: hexOK(c.text), textBold: !!c.textBold, bg: hexOK(c.bg) });
/* Bold secondary text: every rule that colors its text with --label2 (in the stylesheet or added by a screen) is collected, so the weight
   follows the color wherever it is used, along with anything colored that way inline. */
let boldStyle = null;
const boldRule = () => { const sels = ['[style*="--label2"]'];
  for (const sheet of document.styleSheets) { let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const r of rules) if (r.selectorText && r.style && /--label2/.test(r.style.color) && !/::|:before|:after/.test(r.selectorText)) sels.push(r.selectorText); }
  if (!boldStyle) boldStyle = document.head.appendChild(h('style')); boldStyle.textContent = '.screen.bold2 :is(' + sels.join(', ') + ') { font-weight: 600; }'; };
const applyColors = () => { const st = screen().style, c = S.colors, light = S.theme !== 'dark', set = (k, v) => v ? st.setProperty(k, v) : st.removeProperty(k);
  set('--tint', c.accent); set('--seg-bg', c.seg); set('--seg-border', c.seg && 'color-mix(in srgb, ' + c.seg + ' 62%, #000)'); set('--seg-label', c.seg && (WD.readableOn ? WD.readableOn(c.seg) : '#1C1C1E'));
  set('--label2', light && c.text); set('--bg', light && c.bg); screen().classList.toggle('bold2', c.textBold); if (c.textBold) boldRule(); };
app.setColors = change => { S.colors = cleanColors({ ...S.colors, ...change }); applyColors(); store.set('wd.colors', JSON.stringify(S.colors)); WD.changed(); };
/** Display → Text size. The whole interface is scaled, the way Dynamic Type enlarges an iPhone app. */
WD.textSizes = [{ value: 0.9, label: 'Small' }, { value: 1, label: 'Default' }, { value: 1.12, label: 'Large' }, { value: 1.25, label: 'Extra large' }, { value: 1.4, label: 'Largest' }];
app.setTextSize = z => { S.textSize = z = +z || 1; [$('#root'), overlays()].forEach(el => { el.style.zoom = z === 1 ? '' : z; }); store.set('wd.textSize', String(z)); WD.changed(); };
/** The website on a computer: a wide screen with the sections in a sidebar. Screens read S.desktop to use the extra room. */
app.setDesktop = on => { S.desktop = !!on; $('#phone').classList.toggle('desktop', S.desktop); store.set('wd.desktop', on ? '1' : '0'); S.board.dayCount = on ? 7 : 3; fit(); if (S.signedIn && tabState) { const at = tabState.active === 'more' ? tabState.cur : tabState.active; app.showMain(at); } syncPanel(); WD.emit('desktop', S.desktop); WD.changed(); };
app.setOffline = off => { S.offline = off; $('.statusbar').classList.toggle('offline', off); S.pending.forEach(op => { if (op.status === 'queued') op.message = off ? 'Waiting for a connection' : 'Waiting to sync'; }); syncPanel(); WD.changed(); if (!off) WD.api.flush(); WD.emit('network', !off); };

/* ---------- Updates ----------
   The prototype keeps a saved copy of itself for offline use, and browsers reuse files for a while after a publish, so a phone can keep
   showing an old version. The newest version number is read straight from the published core.js, skipping every saved copy. */
const UP = { latest: null, at: 0, told: null };
/** → the published version string, or null when it can't be reached (offline, or opened as a file). */
app.latestVersion = async () => { try { const r = await fetch('js/core.js?check=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return null; const m = /WD\.version = '([^']+)'/.exec(await r.text()); UP.at = Date.now(); return (UP.latest = m ? m[1] : null); } catch (e) { return null; } };
/** Throw away every saved copy (offline cache, service worker, the browser's own cache of each file) and load the published version. */
app.update = async () => { const hud = ui.hud('Updating…');
  try { if (navigator.serviceWorker) await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister()));
    if (window.caches) await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    const urls = [location.href.split('#')[0], 'sw.js'].concat([...document.querySelectorAll('script[src]')].map(s => s.src), [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href));
    await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => null)));
  } catch (e) { console.error(e); }
  hud.set('Restarting…', 'checkmark'); setTimeout(() => location.reload(), 500); };
/** Quiet check when the app opens or comes back to the front: a banner offers the update. Asked at most every 5 minutes, and once per version. */
app.autoUpdateCheck = async () => { if (!S.signedIn || Date.now() - UP.at < 5 * 60000) return; const v = await app.latestVersion(); if (!v || v === WD.version || UP.told === v) return; UP.told = v;
  ui.banner({ title: 'Version ' + v + ' is available', text: 'You have ' + WD.version + '. Tap here to update now.', icon: 'arrow.clockwise', color: 'var(--blue)', duration: 0, onTap: () => app.update() }); };
/** Settings → About → Check for updates. */
app.checkForUpdates = async () => { const hud = ui.hud('Checking…'), v = await app.latestVersion(); await WD.delay(400); hud.close();
  if (!v) return ui.alert({ title: 'Couldn’t check', message: 'The published version can’t be reached right now. Check your connection and try again.' });
  if (v !== WD.version) { if (await ui.alert({ title: 'Version ' + v + ' is available', message: 'You have ' + WD.version + '. Updating reloads the prototype; anything you changed in it is reset.', buttons: [{ label: 'Later', value: false }, { label: 'Update', value: true, bold: true }] })) app.update(); return; }
  if (await ui.alert({ title: 'You have the newest version', message: 'Version ' + WD.version + ' is the latest published.', buttons: [{ label: 'Reload anyway', value: true }, { label: 'OK', value: false, bold: true }] })) app.update(); };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') app.autoUpdateCheck(); });

/* ================= Fake backend: the offline queue (PendingOperation) ================= */
let opSeq = 0;
const clone = j => ({ ...j, attachments: (j.attachments || []).slice(), events: (j.events || []).slice() });
const api = WD.api = {
  /** Queue a job change exactly like the real app: apply it on screen now, sync in the background (or when back online).
      {kind: 'create'|'edit'|'delete'|'reassign'|'status'|'batch', title, scope, jobIds, apply()} → the pending operation. */
  op(o) {
    const jobs = WD.data.jobs, ids = o.jobIds || [], before = ids.map(id => jobs.find(j => j.id === id)).filter(Boolean).map(clone), existed = new Set(before.map(j => j.id));
    const all = new Set(jobs.map(j => j.id));
    if (o.apply) o.apply();
    const created = WD.data.jobs.filter(j => !all.has(j.id)).map(j => j.id);
    const op = { id: 'op' + (++opSeq), kind: o.kind, title: o.title, scope: o.scope || 'This job', jobIds: ids.concat(created), status: 'queued', message: S.offline ? 'Waiting for a connection' : 'Waiting to sync', at: +WD.now(), before,
      revert() { WD.data.jobs = WD.data.jobs.filter(j => !created.includes(j.id) && !existed.has(j.id)).concat(before.map(clone)); } };
    op.jobIds.forEach(id => { const j = WD.q.job(id); if (j) j.pending = true; });
    S.pending.push(op); WD.changed(); api.flush();
    return op;
  },
  /** Driver status change (en route / arrived / completed / skipped), queued offline the same way. */
  setStatus(jobId, status, note) {
    const j = WD.q.job(jobId), label = { enroute: 'En route', arrived: 'Arrived', completed: 'Completed', skipped: 'Skipped', canceled: 'Customer canceled', rescheduled: 'Rescheduled', postponed: 'Postponed', scheduled: 'Reopened' }[status];
    return api.op({ kind: 'status', title: j.title, scope: label, jobIds: [jobId], apply() {
      j.status = status; const t = WD.nowMins();
      if (status === 'arrived') j.arrivedAt = t; if (status === 'completed') { j.departedAt = t; if (j.arrivedAt == null) j.arrivedAt = t - (j.dur || 20); }
      j.events.push({ at: +WD.now(), actor: S.me.name, text: label + (note ? ' — ' + note : '') });
    } });
  },
  /** What the server holds for a conflicting change (mock): the jobs as they were before your change, plus what the other person did meanwhile. */
  serverVersion(op) {
    const mine = op.jobIds.map(id => WD.q.job(id)).filter(Boolean);
    const jobs = (op.before.length ? op.before : mine).map(clone), by = 'Priya Raman', first = jobs[0];
    if (first) { first.notes = (first.notes ? first.notes + ' ' : '') + 'Customer called: use the side entrance today.'; if (!op.before.length) first.seq = (first.seq || 1) + 1; }
    if (jobs.length > 1) { const a = jobs[0].seq; jobs[0].seq = jobs[1].seq; jobs[1].seq = a; }
    return { by, at: +WD.now() - 4 * 60000, jobs, deleted: [] };
  },
  finish(op) { S.pending = S.pending.filter(x => x !== op); op.jobIds.forEach(id => { const j = WD.q.job(id); if (j && !S.pending.some(x => x.jobIds.includes(id))) { j.pending = false; j.version = (j.version || 1) + 1; } }); },
  async flush() {
    if (api.busy || S.offline) return; api.busy = true;
    try {
      for (;;) {
        const op = S.pending.find(x => x.status === 'queued'); if (!op || S.offline) break;
        op.status = 'syncing'; op.message = 'Sending…'; WD.changed();
        await WD.delay(600, 1500);
        if (!S.pending.includes(op)) continue;
        if (S.offline) { op.status = 'queued'; op.message = 'Waiting for a connection'; break; }
        if (S.sim.conflictNext) { S.sim.conflictNext = false; syncPanel(); op.status = 'conflict'; op.message = 'Priya Raman changed this job on another device after you opened it.'; op.server = api.serverVersion(op);
          ui.banner({ title: 'Change needs review', text: op.title + ' was changed by someone else. Choose which version to keep.', icon: 'exclamationmark.triangle', color: 'var(--orange)', onTap: () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending() }); continue; }
        api.finish(op); WD.changed();
      }
    } finally { api.busy = false; WD.changed(); }
  },
  /** Resolve a conflict: keep 'server' (discard my change) or 'mine' (reapply). */
  async resolve(opId, keep) { const op = S.pending.find(x => x.id === opId); if (!op) return; op.status = 'syncing'; op.message = keep === 'server' ? 'Loading the server version…' : 'Reapplying your change…'; WD.changed(); await WD.delay(700, 1300); if (keep === 'server') op.revert(); api.finish(op); WD.changed(); },
  retry(opId) { const op = S.pending.find(x => x.id === opId); if (op) { op.status = 'queued'; op.message = 'Waiting to sync'; WD.changed(); api.flush(); } },
  retryAll() { S.pending.forEach(op => { if (op.status === 'failed') op.status = 'queued'; }); WD.changed(); api.flush(); },
  /** Cancel a pending change: stop retrying and keep it in the abandoned-operation journal. */
  cancel(opId) { const op = S.pending.find(x => x.id === opId); if (!op) return; S.pending = S.pending.filter(x => x !== op); op.jobIds.forEach(id => { const j = WD.q.job(id); if (j && !S.pending.some(x => x.jobIds.includes(id))) j.pending = false; }); S.abandoned.unshift({ ...op, status: 'abandoned', cancelledAt: +WD.now() }); WD.changed(); },
};

/* ================= Prototype control panel (outside the phone) ================= */
const panel = WD.panel = { actions: [], jumps: [], segs: [],
  /** Add a labelled selector to the panel: options() → [[value, label]], get() → current value, set(value). */
  addSeg(title, options, get, set) { panel.segs.push({ title, options, get, set }); syncPanel(); },
  /** Add a button under “Simulate”. */
  addAction(label, fn) { panel.actions.push({ label, fn }); syncPanel(); },
  /** Add a “Jump to” shortcut. fn runs with the tab interface showing and no sheets open. */
  addJump(label, fn) { panel.jumps.push({ label, fn }); syncPanel(); },
};
function syncPanel() {
  const el = $('#panel'); if (!el) return;
  const seg = (opts, cur, fn) => h('div.pseg', opts.map(([v, l]) => h('button' + (v === cur ? '.on' : ''), { onclick: () => fn(v) }, l)));
  const ready = fn => () => { if (!S.signedIn) { S.signedIn = true; } ui.closeAllSheets(); if (!tabState) app.showMain(); syncPanel(); setTimeout(fn, 60); };
  el.replaceChildren(); add(el, [
    h('h1', 'RouteClerk'), h('p.sub', 'Clickable iPhone prototype of the route business app. Nothing is saved; reload to reset.'),
    h('h2', 'Preview as'), seg([['owner', 'Owner'], ['dispatcher', 'Dispatch'], ['office', 'Office'], ['driver', 'Driver']], S.role, r => app.setRole(r)),
    h('p.sub', { style: 'margin:6px 0 0' }, S.me ? S.me.name + ' · ' + WD.roles[S.role].title : ''),
    h('h2', 'Device'), seg([[false, 'iPhone app'], [true, 'Desktop website']], !!S.desktop, v => app.setDesktop(v)),
    (WD.data.orgs || []).length > 1 && S.signedIn ? [h('h2', 'Business'), seg(WD.data.orgs.map(o => [o.id, o.short || o.name]), (S.org || {}).id, v => app.switchOrg(v))] : null,
    h('h2', 'Appearance'), seg([['light', 'Light'], ['dark', 'Dark']], S.theme, t => app.setTheme(t)),
    h('h2', 'Network'), seg([[false, 'Online'], [true, 'Offline']], S.offline, v => app.setOffline(v)),
    panel.segs.map(x => [h('h2', x.title), seg(x.options(), x.get(), v => { x.set(v); syncPanel(); })]),
    h('label.pcheck', h('input', { type: 'checkbox', checked: S.sim.conflictNext, onchange: e => { S.sim.conflictNext = e.target.checked; } }), 'Next job change hits a conflict'),
    h('h2', 'Simulate'), panel.actions.map(a => h('button.pbtn', { onclick: ready(a.fn) }, a.label)),
    h('h2', 'Jump to'), h('div.jumps', h('button', { onclick: () => app.signOut() }, 'Sign-in'), panel.jumps.map(j => h('button', { onclick: ready(j.fn) }, j.label))),
    h('p.foot', 'Tip: drag a job on the board to reorder or reassign it. Sign-in is remembered in this browser for the company’s sign-in policy (Settings → Sign-in and security).')]);
}

/* ================= Boot ================= */
function fit() {
  const wrap = $('#phoneScale'), phone = $('#phone'), area = $('.device-area'); if (!wrap || innerWidth <= 480) { if (phone) phone.style.transform = ''; return; }
  const pw = phone.offsetWidth, ph = phone.offsetHeight, k = Math.min(1.15, (area.clientHeight - 28) / ph, (area.clientWidth - 28) / pw);
  phone.style.transform = 'scale(' + k + ')'; wrap.style.width = pw * k + 'px'; wrap.style.height = ph * k + 'px';
}
function tick() { const t = $('.sb-time'); if (t) t.textContent = F.time(WD.nowMins(), true); }
app.start = () => {
  if (store.get('wd.theme')) S.theme = store.get('wd.theme'); screen().dataset.theme = S.theme; if (+store.get('wd.textSize')) app.setTextSize(+store.get('wd.textSize'));
  try { const c = JSON.parse(store.get('wd.colors') || 'null'); if (c) S.colors = cleanColors(c); } catch (e) { /* no saved colors */ }
  applyColors();
  S.me = (WD.data.users || []).find(u => u.role === S.role) || { id: 'u0', name: 'You', role: 'owner' };
  S.org = (WD.data.orgs || [])[0] || { id: 'o1', name: 'Company' };
  S.board.day = D.today();
  try { const L = JSON.parse(store.get('wd.layout5') || 'null'); if (L) { S.prefs = S.prefs || {}; if (L.bar) S.prefs.bar = L.bar; if (L.order) S.prefs.order = L.order; S.prefs.hidden = L.hidden || {}; } } catch (e) { /* unreadable layout: defaults */ }
  if (store.get('wd.desktop') === '1' && innerWidth > 900) { S.desktop = true; S.board.dayCount = 7; $('#phone').classList.add('desktop'); }
  fit(); addEventListener('resize', fit); tick(); setInterval(tick, 5000);
  const toggle = $('#panelToggle'); if (toggle) toggle.onclick = () => document.body.classList.toggle('panel-open');
  $('.device-area').addEventListener('click', () => document.body.classList.remove('panel-open'));
  setInterval(() => WD.emit('minute'), 30000);
  WD.on('change', () => $('.statusbar').classList.toggle('tracking', !!S.shift));
  if (WD.screens.auth && WD.screens.auth.show && !/[?&]skip/.test(location.search) && !stillSignedIn()) WD.screens.auth.show();
  else if (S.faceId && !/[?&]skip/.test(location.search)) { app.signIn(); const hud = ui.hud('Face ID', { icon: 'lock' }); setTimeout(() => { hud.set('Unlocked', 'checkmark'); setTimeout(hud.close, 500); }, 900); }
  else app.signIn();
  syncPanel();
};
})();
