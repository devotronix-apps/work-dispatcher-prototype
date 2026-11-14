/* Map tab: a drawn city map (no tiles) with numbered stops per route, route lines, unresolved addresses and the live truck layer.
   Also owns the truck simulation in WD.data.trucks, which other screens may read. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, nav } = WD;
const NS = 'http://www.w3.org/2000/svg', SMAX = 4, SPEED = 3.2 /* map units per second, compressed for the demo */, DWELL = 240 /* seconds on site, so a route day lasts roughly 15–20 minutes of preview */, MI = 0.03;
const DONE = WD.closed;
const STATE = { driving: { title: 'Driving', color: 'var(--blue)' }, 'on site': { title: 'On site', color: 'var(--orange)' }, parked: { title: 'Parked', color: 'var(--gray)' } };
const hash = s => { let n = 7; for (const c of String(s)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };
const depot = data.depot, stopLabel = j => { const p = q.position(j); return 'Stop ' + p.n + ' of ' + p.of; };

WD.addIcons({ 'mp.fit': '<path d="M4 9V4h5M4 4l5.500 5.500M20 15v5h-5M20 20l-5.500-5.500M15 4h5v5M20 4l-5.500 5.500M9 20H4v-5M4 20l5.500-5.500"/>' });

WD.css(`
.mp-page > .page-body { padding-top: 0 !important; }
.mp { position: relative; flex: 1; min-height: 0; overflow: hidden;
  --mp-land: #F2EFE9; --mp-zone: #E8E4DC; --mp-water: #A7D0F2; --mp-water-label: #3D7DB6; --mp-park: #CDE7BA; --mp-park-label: #4E8A3E;
  --mp-road: #FFFFFF; --mp-casing: #DAD4CA; --mp-minor: #FFFFFF; --mp-hwy: #F8D67F; --mp-hwy-casing: #DDB25A; --mp-label: #4A4A4F; --mp-hood: #8D857B; --mp-halo: rgba(255,255,255,.9); }
.screen[data-theme="dark"] .mp { --mp-land: #23252A; --mp-zone: #292B30; --mp-water: #1D3B59; --mp-water-label: #79A8D8; --mp-park: #233C2B; --mp-park-label: #82B88C;
  --mp-road: #484B52; --mp-casing: #2C2E33; --mp-minor: #393C42; --mp-hwy: #806B3D; --mp-hwy-casing: #574A2B; --mp-label: #D1D1D6; --mp-hood: #8E8E93; --mp-halo: rgba(0,0,0,.65); }
.mp-surface { position: absolute; inset: 0; touch-action: none; cursor: grab; background: var(--mp-land); }
.mp-surface.grabbing { cursor: grabbing; }
.mp-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.mp-svg .land { fill: var(--mp-land); } .mp-svg .zone { fill: var(--mp-zone); } .mp-svg .park { fill: var(--mp-park); stroke: var(--mp-park); stroke-width: 6; stroke-linejoin: round; }
.mp-svg .river { fill: none; stroke: var(--mp-water); stroke-linecap: round; stroke-linejoin: round; } .mp-svg .lake { fill: var(--mp-water); }
.mp-svg .minor { fill: none; stroke: var(--mp-minor); stroke-width: 1.5px; opacity: .55; }
.mp-svg .acase { fill: none; stroke: var(--mp-casing); stroke-width: 4.5px; } .mp-svg .art { fill: none; stroke: var(--mp-road); stroke-width: 3px; }
.mp-svg .hcase { fill: none; stroke: var(--mp-hwy-casing); stroke-width: 7px; } .mp-svg .hwy { fill: none; stroke: var(--mp-hwy); stroke-width: 5px; }
.mp.z2 .mp-svg .minor { stroke-width: 3px; opacity: 1; } .mp.z3 .mp-svg .minor { stroke-width: 6px; opacity: 1; }
.mp.z2 .mp-svg .acase { stroke-width: 8px; } .mp.z2 .mp-svg .art { stroke-width: 6px; } .mp.z3 .mp-svg .acase { stroke-width: 13px; } .mp.z3 .mp-svg .art { stroke-width: 10.5px; }
.mp.z2 .mp-svg .hcase { stroke-width: 11px; } .mp.z2 .mp-svg .hwy { stroke-width: 8.5px; } .mp.z3 .mp-svg .hcase { stroke-width: 17px; } .mp.z3 .mp-svg .hwy { stroke-width: 13.5px; }
.mp-svg .rline { fill: none; stroke-width: 2.5px; stroke-dasharray: 7 5; stroke-linecap: round; stroke-linejoin: round; opacity: .85; }
.mp-svg .trail { fill: none; stroke-width: 4px; stroke-linecap: round; stroke-linejoin: round; opacity: .28; }
.mp-ov, .mp-layer { position: absolute; inset: 0; pointer-events: none; }
.mp-o { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: transform; }
.mp-lbl > span { position: absolute; display: block; transform: translate(-50%,-50%); white-space: nowrap; font-size: 11px; font-weight: 600; letter-spacing: 0; color: var(--mp-label);
  text-shadow: 0 0 2px var(--mp-halo), 0 0 3px var(--mp-halo), 0 0 4px var(--mp-halo); }
.mp-lbl.hood > span { font-size: 10px; letter-spacing: 1.6px; color: var(--mp-hood); font-weight: 600; }
.mp-lbl.water > span { color: var(--mp-water-label); font-style: italic; font-weight: 500; }
.mp-lbl.park > span { color: var(--mp-park-label); font-weight: 600; font-size: 10.5px; }
.mp-lbl.shield > span { background: #fff; color: #1F4E9C; border: 1.5px solid #1F4E9C; border-radius: 5px; padding: 0 4px; font-size: 10px; font-weight: 800; text-shadow: none; line-height: 14px; }
.mp-lbl.street, .mp-lbl.park, .mp-lbl.water.small { display: none; }
.mp.z2 .mp-lbl.street, .mp.z3 .mp-lbl.street, .mp.z2 .mp-lbl.park, .mp.z3 .mp-lbl.park { display: block; }
.mp.z3 .mp-lbl.hood { opacity: .45; }
.mp-hit { pointer-events: auto; cursor: pointer; }
.mp-pv { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; border-radius: 50%; background: var(--c); border: 3px solid var(--ring); box-shadow: 0 1px 4px rgba(0,0,0,.35);
  color: var(--fg, #fff); font-size: 12px; font-weight: 700; letter-spacing: 0; display: grid; place-items: center; transition: transform .2s cubic-bezier(.3,.8,.3,1.3); }
.mp-pin.sel { z-index: 3; } .mp-pin.sel .mp-pv { transform: scale(1.3); box-shadow: 0 3px 10px rgba(0,0,0,.4); }
.mp-pin.done .mp-pv, .mp-pin.skip .mp-pv { opacity: .55; }
.mp-pb { position: absolute; left: 6px; top: -18px; width: 14px; height: 14px; border-radius: 50%; display: grid; place-items: center; color: #fff; border: 1.5px solid #fff; }
.mp-depot .mp-dv { position: absolute; left: -12px; top: -12px; width: 24px; height: 24px; border-radius: 7px; background: #636366; color: #fff; display: grid; place-items: center; box-shadow: 0 1px 4px rgba(0,0,0,.3); border: 1.5px solid #fff; }
.mp-depot .mp-dl { position: absolute; top: 14px; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: var(--mp-label); text-shadow: 0 0 3px var(--mp-halo); white-space: nowrap; }
.mp-place .mp-dv { background: #8E8E93; border-radius: 50%; }
.mp-truck { z-index: 4; }
.mm { position: relative; border-radius: 12px; overflow: hidden; background: var(--mp-land); --mp-land: #F2EFE9; --mp-zone: #E8E4DC; --mp-water: #A7D0F2; --mp-park: #CDE7BA; --mp-road: #FFFFFF; --mp-casing: #DAD4CA; --mp-minor: #FFFFFF; --mp-hwy: #F8D67F; --mp-hwy-casing: #DDB25A; }
.screen[data-theme="dark"] .mm { --mp-land: #23252A; --mp-zone: #292B30; --mp-water: #1D3B59; --mp-park: #233C2B; --mp-road: #484B52; --mp-casing: #2C2E33; --mp-minor: #393C42; --mp-hwy: #806B3D; --mp-hwy-casing: #574A2B; }
.mm svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.mm .mp-svg .acase { stroke-width: 2.5px; } .mm .mp-svg .art { stroke-width: 1.5px; } .mm .mp-svg .hcase { stroke-width: 4px; } .mm .mp-svg .hwy { stroke-width: 2.5px; } .mm .mp-svg .minor { display: none; }
.mm-p { position: absolute; transform: translate(-50%, -50%); width: 20px; height: 20px; border-radius: 50%; background: var(--c); border: 2.5px solid var(--ring, #fff); color: var(--fg, #fff); font-size: 10px; font-weight: 800; display: grid; place-items: center; letter-spacing: 0; box-shadow: 0 1px 3px rgba(0,0,0,.35); }
.mm-p.sq { border-radius: 5px; width: 18px; height: 18px; } .mm-p.big { width: 28px; height: 28px; font-size: 12px; } .mm-p.dim { opacity: .45; }
.mm-cap { position: absolute; left: 8px; top: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0; background: var(--material); border-radius: 7px; padding: 1px 7px; }
.mp-tv { position: absolute; left: -18px; top: -18px; width: 36px; height: 36px; }
.mp-cone { position: absolute; left: 50%; top: 50%; width: 0; height: 0; transition: transform .9s linear; }
.mp-cone::before { content: ""; position: absolute; left: -11px; top: -31px; border-left: 11px solid transparent; border-right: 11px solid transparent; border-bottom: 18px solid var(--c); opacity: .55; }
.mp-truck.still .mp-cone { opacity: .4; }
.mp-ti { position: absolute; inset: 0; border-radius: 50%; background: var(--c); border: 2.5px solid #fff; display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
.mp-ti .ic { --cell: var(--c); }
.mp-tl { position: absolute; top: 21px; transform: translateX(-50%); background: var(--material); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-radius: 8px; padding: 1px 6px; font-size: 10.5px; font-weight: 700; white-space: nowrap; letter-spacing: 0; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
.mp-me { z-index: 5; } .mp-me .mp-cone::before { border-bottom-color: var(--blue); opacity: .35; }
.mp-me .mp-halo { position: absolute; left: -26px; top: -26px; width: 52px; height: 52px; border-radius: 50%; background: color-mix(in srgb, var(--blue) 22%, transparent); animation: mp-halo 2s ease-out infinite; }
.mp-me .mp-dot { position: absolute; left: -10px; top: -10px; width: 20px; height: 20px; border-radius: 50%; background: var(--blue); border: 3px solid #fff; box-shadow: 0 1px 5px rgba(0,0,0,.35); }
@keyframes mp-halo { 0% { transform: scale(.4); opacity: 1; } 100% { transform: scale(1.3); opacity: 0; } }
.mp-glass { background: var(--material); backdrop-filter: blur(22px) saturate(180%); -webkit-backdrop-filter: blur(22px) saturate(180%); box-shadow: 0 2px 12px rgba(0,0,0,.14), 0 0 0 .5px var(--sep); }
.mp-fade { position: absolute; left: 0; right: 0; top: 0; height: 56px; background: linear-gradient(var(--mp-land) 35%, transparent); opacity: .85; pointer-events: none; }
.mp-top { position: absolute; top: 56px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
.mp-top > * { pointer-events: auto; }
.mp-day { display: flex; align-items: center; height: 40px; border-radius: 20px; padding: 0 4px; }
.mp-day button { border: 0; background: none; height: 40px; cursor: pointer; color: var(--tint); display: grid; place-items: center; }
.mp-day .mp-dbtn { width: 38px; } .mp-day .mp-dlabel { color: var(--label); font-size: 15px; font-weight: 600; letter-spacing: -.24px; padding: 0 6px; min-width: 150px; }
.mp-chips { display: flex; gap: 6px; overflow-x: auto; max-width: 100%; padding: 2px 12px 4px; scrollbar-width: none; }
.mp-chips::-webkit-scrollbar { display: none; }
.mp-chip { flex: none; border: 0; height: 30px; border-radius: 15px; padding: 0 11px 0 9px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; letter-spacing: -.08px; color: var(--label); cursor: pointer; }
.mp-chip .dot { width: 9px; height: 9px; } .mp-chip.off { color: var(--label3); } .mp-chip.off .dot { opacity: .3; }
.mp-side { position: absolute; right: 10px; top: 152px; display: flex; flex-direction: column; gap: 10px; }
.mp-grp { border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
.mp-btn { width: 44px; height: 44px; border: 0; background: none; color: var(--tint); display: grid; place-items: center; cursor: pointer; padding: 0; }
.mp-btn + .mp-btn { border-top: .5px solid var(--sep); } .mp-btn.off { color: var(--label2); } .mp-btn:active { background: var(--fill3); }
.mp-bottom { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; pointer-events: none; }
.mp-bottom > * { pointer-events: auto; }
.mp-note { border: 0; border-radius: 15px; min-height: 30px; padding: 5px 11px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; letter-spacing: -.08px; color: var(--label); text-align: left; }
button.mp-note { cursor: pointer; }
.mp-card { width: 100%; border-radius: 20px; overflow: hidden; }
.mp-sum { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; background: none; padding: 12px 14px; text-align: left; cursor: pointer; color: var(--label); }
.mp-sum .mp-sm { flex: 1; min-width: 0; }
.mp-listbtn { display: flex; align-items: center; gap: 5px; color: var(--tint); font-size: 15px; font-weight: 600; background: var(--fill3); border-radius: 15px; padding: 5px 11px; }
.mp-unres { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; border-top: .5px solid var(--sep); background: none; padding: 9px 14px 11px; text-align: left; cursor: pointer; color: var(--label); }
.mp-unres > div { flex: 1; min-width: 0; } .mp-unres .ic { color: var(--label3); }
.mp-q { width: 26px; height: 26px; flex: none; border-radius: 50%; border: 2px solid var(--red); color: var(--red); font-weight: 900; font-size: 15px; display: grid; place-items: center; letter-spacing: 0; }
.mp-stop { padding: 12px 14px 14px; }
.mp-stop .mp-sh { display: flex; gap: 10px; align-items: flex-start; }
.mp-stop .mp-sh > div { flex: 1; min-width: 0; }
.mp-stop .headline { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mp-x { border: 0; width: 28px; height: 28px; border-radius: 50%; background: var(--fill3); color: var(--label2); display: grid; place-items: center; cursor: pointer; flex: none; padding: 0; }
.mp-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 8px 0 12px; font-size: 13px; color: var(--label2); }
.mp-meta .dot { width: 8px; height: 8px; margin-right: 4px; }
.mp-acts { display: flex; gap: 8px; } .mp-acts .btn { flex: 1; }
.mp-mini { width: 26px; height: 26px; border-radius: 50%; background: var(--c); border: 2.5px solid var(--ring); color: var(--fg, #fff); font-size: 11.5px; font-weight: 700; display: grid; place-items: center; flex: none; letter-spacing: 0; }
.mp-mini.done { opacity: .5; }
.mp-thead { display: flex; align-items: center; gap: 12px; padding: 4px 4px 2px; }
.mp-thead > div:not(.avatar) { flex: 1; min-width: 0; }
.mp-tbtns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; } .mp-tbtns .btn:last-child { grid-column: 1 / -1; }
`);

/* ================= Base map: generated once, deterministically ================= */
const HROADS = [[45, 'Orchard Park Rd'], [170, 'Northgate Blvd'], [300, 'Mercer St'], [430, 'Larkspur Ln'], [525, 'Industrial Way'], [650, 'Ridgeview Dr'], [760, 'Harbor Rd'], [875, 'Mission St']];
const VROADS = [[60, 'Westfield Rd'], [185, 'Lantern St'], [310, 'Civic Ave'], [435, 'Bank St'], [560, 'Foundry Ln'], [700, 'Scholar Way'], [830, 'Greenway Dr'], [950, 'Quail Hollow Rd']];
const RIVER = [[440, -500], [400, -150], [380, 0], [345, 110], [265, 215], [140, 300], [20, 360], [-150, 420], [-500, 470]];
const I35 = [[650, -500], [645, -100], [630, 200], [612, 420], [600, 560], [625, 760], [680, 960], [720, 1200], [740, 1500]];
const R9 = [[-500, 610], [0, 600], [250, 590], [480, 585], [700, 595], [1000, 575], [1500, 560]];
const PARKS = [['Riverside Park', [[175, 245], [300, 240], [305, 300], [190, 310]]], ['Foundry Park', [[455, 445], [540, 440], [545, 500], [460, 505]]],
  ['Greenway Park', [[850, 280], [935, 275], [940, 385], [845, 380]]], ['Westfield Commons', [[60, 690], [170, 685], [175, 770], [65, 775]]], ['Bayside Park', [[505, 905], [640, 900], [645, 960], [500, 965]]]];
const HOODS = [['ORCHARD PARK', 470, 95], ['NORTHGATE', 735, 112], ['GREENWAY', 895, 205], ['DOWNTOWN', 500, 355], ['LARKSPUR', 120, 385], ['CIVIC CENTER', 250, 520],
  ['WESTFIELD', 105, 612], ['RIDGEVIEW', 455, 700], ['QUAIL HOLLOW', 905, 620], ['HARBOR DISTRICT', 760, 885], ['BAYSIDE', 390, 935]];
const wob = (t, k, a = 7) => a * Math.sin(t / 190 + k * 0.37), dwob = (t, k, a = 7) => a / 190 * Math.cos(t / 190 + k * 0.37);
const pathOf = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function smooth(pts, closed) {
  if (closed) { let d = 'M' + mid(pts[pts.length - 1], pts[0]).join(' '); pts.forEach((p, i) => { d += 'Q' + p.join(' ') + ' ' + mid(p, pts[(i + 1) % pts.length]).join(' '); }); return d + 'Z'; }
  let d = 'M' + pts[0].join(' '); for (let i = 1; i < pts.length - 1; i++) d += 'Q' + pts[i].join(' ') + ' ' + mid(pts[i], pts[i + 1]).join(' ');
  return d + 'L' + pts[pts.length - 1].join(' ');
}
function blob(cx, cy, r, seed) { const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, k = 1 + 0.16 * Math.sin(i * 2.3 + seed) + 0.09 * Math.cos(i * 4.1 + seed); pts.push([+(cx + Math.cos(a) * r * k * 1.2).toFixed(1), +(cy + Math.sin(a) * r * k * 0.85).toFixed(1)]); } return smooth(pts, true); }
let baseCache = null;
function buildBase() {
  if (baseCache) return baseCache;
  const fill = named => { const out = named.map(([v, name]) => ({ v, name })); for (let v = -455; v < 0; v += 125) out.push({ v }); for (let v = 1000; v <= 1500; v += 125) out.push({ v }); return out.sort((a, b) => a.v - b.v); };
  const line = (v, horiz, amp) => { const pts = []; for (let t = -500; t <= 1500; t += 50) pts.push(horiz ? [t, v + wob(t, v, amp)] : [v + wob(t, v, amp), t]); return pathOf(pts); };
  const hs = fill(HROADS), vs = fill(VROADS), minors = [], arts = [], labels = [];
  [[hs, true], [vs, false]].forEach(([set, horiz]) => set.forEach((r, i) => {
    arts.push(line(r.v, horiz));
    const nx = set[i + 1]; if (nx) [1 / 3, 2 / 3].forEach(f => minors.push(line(r.v + (nx.v - r.v) * f, horiz, 3)));
    if (r.name) [(130 + i * 97) % 400 + 70, (130 + i * 97) % 400 + 520].forEach(t => {
      const off = wob(t, r.v), d = dwob(t, r.v), angle = horiz ? Math.atan(d) * 180 / Math.PI : Math.atan2(1, d) * 180 / Math.PI - 180;
      labels.push(horiz ? { x: t, y: r.v + off, text: r.name, cls: 'street', angle } : { x: r.v + off, y: t, text: r.name, cls: 'street', angle });
    });
  }));
  const lake = blob(905, 705, 70, 3), parks = PARKS.map(([, pts]) => smooth(pts, true)), river = smooth(RIVER), i35 = smooth(I35), r9 = smooth(R9);
  const ns = ' vector-effect="non-scaling-stroke"', paths = (list, cls) => list.map(d => '<path class="' + cls + '"' + ns + ' d="' + d + '"/>').join('');
  const big = 'x="-600" y="-600" width="2200" height="2200"';
  const markup = '<defs><mask id="mp-mm" maskUnits="userSpaceOnUse" ' + big + '><rect ' + big + ' fill="#fff"/><path d="' + river + '" stroke="#000" stroke-width="26" fill="none"/><path d="' + lake + '" fill="#000"/>' + parks.map(d => '<path d="' + d + '" fill="#000"/>').join('') + '</mask>'
    + '<mask id="mp-ma" maskUnits="userSpaceOnUse" ' + big + '><rect ' + big + ' fill="#fff"/><path d="' + lake + '" fill="#000"/></mask></defs>'
    + '<rect class="land" ' + big + '/><rect class="zone" x="420" y="508" width="180" height="66" rx="6"/><rect class="zone" x="380" y="290" width="200" height="130" rx="8"/>'
    + parks.map(d => '<path class="park" d="' + d + '"/>').join('') + '<path class="river" stroke-width="18" d="' + river + '"/><path class="lake" d="' + lake + '"/>'
    + '<g mask="url(#mp-mm)">' + paths(minors, 'minor') + '</g>'
    + '<g mask="url(#mp-ma)">' + paths(arts, 'acase') + paths(arts, 'art') + paths([i35, r9], 'hcase') + paths([i35, r9], 'hwy') + '</g>';
  HOODS.forEach(([text, x, y]) => labels.push({ x, y, text, cls: 'hood' }));
  PARKS.forEach(([name, pts]) => labels.push({ x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length, text: name, cls: 'park' }));
  labels.push({ x: 300, y: 172, text: 'Willow Creek', cls: 'water', angle: -38 }, { x: 905, y: 705, text: 'Harbor Lake', cls: 'water' });
  [[641, 120, '35'], [612, 870, '35'], [150, 594, '9'], [860, 582, '9']].forEach(([x, y, text]) => labels.push({ x, y, text, cls: 'shield' }));
  return (baseCache = { markup, labels });
}

/* ================= Truck simulation (WD.data.trucks) ================= */
const sim = {};   // routeId → { t, px, py, at, hd, trail, dwell, fixN }
data.trucks = [];
/** Who is driving this route's truck right now: the signed-in user while clocked in on it, otherwise the assigned driver (never yourself off shift). */
function driverOf(r) {
  if (S.shift && S.shift.routeId === r.id) return S.shift.location === 'denied' ? null : S.me.id;
  return r.driverId && r.driverId !== S.me.id ? r.driverId : null;
}
const stopJobs = routeId => q.stops(routeId, D.today()).map(s => s.job);
function spawn(r, driverId) {
  const stops = stopJobs(r.id), cur = stops.find(j => j.status === 'arrived'), nx = stops.find(j => j.status === 'enroute'), n = hash(r.id);
  const home = q.routeEnds(r.id, D.today()); let x = home.start.x, y = home.start.y, state = 'parked';
  if (cur) { x = cur.x; y = cur.y; state = 'on site'; }
  else if (nx) { const prev = stops.slice(0, stops.indexOf(nx)).reverse().find(j => j.status === 'completed') || depot; x = prev.x + (nx.x - prev.x) * 0.45; y = prev.y + (nx.y - prev.y) * 0.45; state = 'driving'; }
  const start = new Date(WD.now()); start.setHours(7, 20 + hash(r.id) % 30, 0, 0);
  const t = { routeId: r.id, vehicleId: r.vehicleId, driverId, x, y, heading: 0, speedMph: 0, state, lastFix: +WD.now() - (n % 9) * 1000, battery: 46 + n % 45, nextJobId: null, shiftStart: +start };
  return { t, px: x, py: y, at: performance.now(), hd: 0, trail: [[x, y]], dwell: cur ? 8 + n % 18 : 0, fixN: 0 };
}
function reconcile() {
  if (!S.me) return;
  const want = [];
  q.routes().forEach(r => {
    const d = driverOf(r); if (!d) { delete sim[r.id]; return; }
    const s = sim[r.id] || (sim[r.id] = spawn(r, d)), own = S.shift && S.shift.routeId === r.id;
    s.t.driverId = d; s.t.vehicleId = own ? S.shift.vehicleId : r.vehicleId; if (own && s.t.shiftStart !== S.shift.startedAt) s.t.shiftStart = S.shift.startedAt;
    want.push(s.t);
  });
  data.trucks.splice(0, data.trucks.length, ...want);
}
/** A status change made by another driver's phone (arrives through sync, so it is not a local pending operation). */
function remote(job, status, text, actor) {
  const m = WD.nowMins(); job.status = status;
  if (status === 'arrived') job.arrivedAt = m; if (status === 'completed') { job.departedAt = m; if (job.arrivedAt == null) job.arrivedAt = m - (job.dur || 20); }
  job.events.push({ at: +WD.now(), actor, text });
}
function tick() {
  if (!S.signedIn || !S.me) return;
  reconcile();
  let changed = false; const now = +WD.now();
  data.trucks.forEach(t => {
    const s = sim[t.routeId], auto = t.driverId !== S.me.id; if (auto && S.offline) return;   // other trucks freeze while this phone is offline
    const stops = stopJobs(t.routeId), name = (q.user(t.driverId) || {}).name || 'Driver';
    let active = stops.find(j => j.status === 'arrived') || stops.find(j => j.status === 'enroute');
    if (!active && auto) { const nx = stops.find(j => j.status === 'scheduled' && !j.pending); if (nx) { remote(nx, 'enroute', 'En route', name); changed = true; active = nx; } }
    const endAt = q.routeEnds(t.routeId, D.today()).end, target = active || (stops.length && stops.every(j => DONE[j.status]) ? endAt : null);
    s.px = t.x; s.py = t.y; s.at = performance.now();
    let state = 'parked';
    if (target) {
      const dx = target.x - t.x, dy = target.y - t.y, dist = Math.hypot(dx, dy);
      if (dist > 1.5) {
        const step = Math.min(dist, SPEED); t.x += dx / dist * step; t.y += dy / dist * step; state = 'driving'; s.dwell = 0;
        const hd = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360; s.hd += ((hd - s.hd % 360 + 540) % 360) - 180; t.heading = Math.round(hd);
        s.trail.push([+t.x.toFixed(1), +t.y.toFixed(1)]); if (s.trail.length > 240) s.trail.shift();
      } else if (target !== endAt) {
        state = 'on site';
        if (auto && !target.pending) {
          if (target.status === 'enroute') { remote(target, 'arrived', 'Arrived (geofence)', name); changed = true; }
          else if (++s.dwell >= DWELL) { remote(target, 'completed', 'Completed', name); changed = true; }
        }
      }
    }
    t.state = state; t.speedMph = state === 'driving' ? Math.round(24 + 14 * Math.abs(Math.sin(now / 9000 + hash(t.routeId)))) : 0;
    if (++s.fixN >= (state === 'driving' ? 5 : 60)) { s.fixN = 0; t.lastFix = now; }
    if (Math.random() < 1 / 150) t.battery = Math.max(5, t.battery - 1);
    const nx = stops.find(j => j.status === 'arrived' || j.status === 'enroute') || stops.find(j => j.status === 'scheduled'); t.nextJobId = nx ? nx.id : null;
  });
  if (changed) WD.changed();
  WD.emit('trucks');
}
setInterval(tick, 1000);
/** Smoothly interpolated display position between the last two simulation steps. */
function posOf(t) { const s = sim[t.routeId]; if (!s) return [t.x, t.y]; const k = Math.min(1, (performance.now() - s.at) / 1000); return [s.px + (t.x - s.px) * k, s.py + (t.y - s.py) * k]; }
const truckFor = routeId => data.trucks.find(t => t.routeId === routeId);
const ago = ms => { const s = Math.max(0, Math.round((+WD.now() - ms) / 1000)); return s < 60 ? s + ' s ago' : Math.floor(s / 60) + ' min ago'; };
const numberOf = job => { const s = q.stops(job.routeId, job.day).find(x => x.job === job); return s ? s.number : null; };
/* Colors: the job type fills the pin and the route (calendar) color rims it. */
const ringOf = job => q.routeColor(job.routeId), fillOf = job => q.jobType(job.type).color, pinStyle = job => ({ '--c': fillOf(job), '--ring': ringOf(job), '--fg': WD.textOn(fillOf(job)) });
const dayLabel = k => { const rel = fmt.day(k, 'rel'), base = fmt.day(k, 'weekday') + ' ' + fmt.day(k, 'md'); return /^(Today|Tomorrow|Yesterday)$/.test(rel) ? rel + ', ' + base : base; };
const openDetails = id => { if (WD.screens.jobs && WD.screens.jobs.openDetails) WD.screens.jobs.openDetails(id); else ui.toast('Job details aren’t available', 'info.circle'); };
const mini = (job, n) => h('span.mp-mini' + (DONE[job.status] ? '.done' : ''), { style: pinStyle(job) }, n);

/* ================= The map page ================= */
let inst = null;
function createMap() {
  const st = { day: S.board.day || D.today(), hidden: new Set(), extra: new Set(), showTrucks: true, sel: null, follow: null };
  let W = 393, H = 769, view = { s: 1, x0: 0, y0: 0 }, fitted = false, raf = 0, anim = 0, ro = null;
  const base = buildBase();
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'mp-svg'); svg.setAttribute('preserveAspectRatio', 'none'); svg.innerHTML = base.markup;
  const routesG = document.createElementNS(NS, 'g'), trailsG = document.createElementNS(NS, 'g'); svg.appendChild(trailsG); svg.appendChild(routesG);
  const labelLayer = h('div.mp-layer'), pinLayer = h('div.mp-layer'), truckLayer = h('div.mp-layer');
  const statics = base.labels.map(l => { const el = h('div.mp-o.mp-lbl.' + l.cls, h('span', { style: l.angle ? { transform: 'translate(-50%,-50%) rotate(' + l.angle.toFixed(1) + 'deg)' } : null }, l.text)); labelLayer.appendChild(el); return { el, x: l.x, y: l.y }; });
  const depotEl = h('div.mp-o.mp-depot', h('div.mp-dv', icon('building', 15)), h('div.mp-dl', depot.name)); labelLayer.appendChild(depotEl); statics.push({ el: depotEl, x: depot.x, y: depot.y });
  data.places.filter(p => p.id !== 'p1').forEach(p => { const e = h('div.mp-o.mp-depot.mp-place', h('div.mp-dv', icon('house', 14)), h('div.mp-dl', p.name)); labelLayer.appendChild(e); statics.push({ el: e, x: p.x, y: p.y }); });
  const meEl = h('div.mp-o.mp-me', { style: { display: 'none' } }, h('div.mp-halo'), h('div.mp-cone'), h('div.mp-dot')); truckLayer.appendChild(meEl);
  const truckEls = new Map(); let pins = [], meShown = false;
  const surface = h('div.mp-surface', svg, h('div.mp-ov', labelLayer, pinLayer, truckLayer));
  const top = h('div.mp-top'), side = h('div.mp-side'), bottom = h('div.mp-bottom');
  const el = h('div.mp', surface, h('div.mp-fade'), top, side, bottom);
  const unsub = [];

  /* ---------- View: scale + world offset, clamped to the 1000 × 1000 world ---------- */
  const clampS = s => Math.min(SMAX, Math.max(W / 1000, s));
  const clampV = v => { const s = clampS(v.s), ax = (o, span) => span >= 1000 ? 500 - span / 2 : Math.min(1000 - span, Math.max(0, o)); return { s, x0: ax(v.x0, W / s), y0: ax(v.y0, H / s) }; };
  const proj = (x, y) => [(x - view.x0) * view.s, (y - view.y0) * view.s];
  const put = (e, x, y) => { const [X, Y] = proj(x, y); e.style.transform = 'translate3d(' + X.toFixed(1) + 'px,' + Y.toFixed(1) + 'px,0)'; };
  const center = v => [v.x0 + W / 2 / v.s, v.y0 + H / 2 / v.s];
  /** View that puts world point (x, y) in the middle of the area between the top controls and the bottom card. */
  const lookAt = (x, y, s, pt = 140, pb = 200) => ({ s, x0: x - W / 2 / s, y0: y - (pt + (H - pt - pb) / 2) / s });
  function apply(v) {
    view = clampV(v);
    svg.setAttribute('viewBox', [view.x0, view.y0, W / view.s, H / view.s].map(n => n.toFixed(2)).join(' '));
    const z = view.s / (W / 1000); el.classList.toggle('z2', z >= 1.9 && z < 4); el.classList.toggle('z3', z >= 4);
    statics.forEach(it => put(it.el, it.x, it.y)); pins.forEach(it => put(it.el, it.x, it.y)); placeTrucks();
  }
  function animateTo(t) {
    t = clampV(t); cancelAnimationFrame(anim);
    const a = view, ca = center(a), cb = center(t), t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 340), e = 1 - Math.pow(1 - k, 3), s = Math.exp(Math.log(a.s) + (Math.log(t.s) - Math.log(a.s)) * e);
      apply({ s, x0: ca[0] + (cb[0] - ca[0]) * e - W / 2 / s, y0: ca[1] + (cb[1] - ca[1]) * e - H / 2 / s }); if (k < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  }
  function zoomAt(p, k, animated) { const wx = view.x0 + p.x / view.s, wy = view.y0 + p.y / view.s, s = clampS(view.s * k), v = { s, x0: wx - p.x / s, y0: wy - p.y / s }; animated ? animateTo(v) : apply(v); }
  function fit(animated) {
    const pts = [[depot.x, depot.y]];
    shownRoutes().forEach(r => q.stops(r.id, st.day).forEach(s => pts.push([s.job.x, s.job.y])));
    liveTrucks().forEach(t => pts.push(posOf(t)));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pt = 150, pb = 175;
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const s = Math.min((W - 70) / Math.max(maxx - minx, 80), (H - pt - pb) / Math.max(maxy - miny, 80));
    const v = lookAt((minx + maxx) / 2, (miny + maxy) / 2, clampS(s), pt, pb); animated ? animateTo(v) : apply(v); fitted = true;
  }
  function measure() { const w = el.clientWidth, hh = el.clientHeight; if (!w || !hh) return false; const changed = w !== W || hh !== H; W = w; H = hh; if (!fitted) fit(false); else if (changed) apply(view); return true; }

  /* ---------- Gestures: drag to pan, pinch / ctrl-wheel / wheel / double-click to zoom ---------- */
  const ptrs = new Map(); let moved = 0;
  const gest = () => { const ps = [...ptrs.values()], n = ps.length || 1; return { x: ps.reduce((a, p) => a + p.x, 0) / n, y: ps.reduce((a, p) => a + p.y, 0) / n, d: ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0 }; };
  const isHit = e => e.target && e.target.closest && e.target.closest('.mp-hit');
  surface.addEventListener('pointerdown', e => {
    if (isHit(e)) return;
    try { surface.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    ptrs.set(e.pointerId, ui.localPoint(e, el)); if (ptrs.size === 1) moved = 0; cancelAnimationFrame(anim); surface.classList.add('grabbing');
  });
  surface.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const a = gest(); ptrs.set(e.pointerId, ui.localPoint(e, el)); const b = gest();
    moved += Math.abs(b.x - a.x) + Math.abs(b.y - a.y) + Math.abs(b.d - a.d); if (moved > 6 && st.follow) stopFollow();
    const s = clampS(a.d && b.d ? view.s * b.d / a.d : view.s), wx = view.x0 + a.x / view.s, wy = view.y0 + a.y / view.s;
    apply({ s, x0: wx - b.x / s, y0: wy - b.y / s });
  });
  const end = e => { if (!ptrs.delete(e.pointerId) || ptrs.size) return; surface.classList.remove('grabbing'); if (e.type === 'pointerup' && moved < 6 && st.sel) select(null); };
  surface.addEventListener('pointerup', end); surface.addEventListener('pointercancel', end);
  surface.addEventListener('wheel', e => { e.preventDefault(); if (st.follow) stopFollow(); zoomAt(ui.localPoint(e, el), Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022))); }, { passive: false });
  surface.addEventListener('dblclick', e => { if (!isHit(e)) zoomAt(ui.localPoint(e, el), 2, true); });

  /* ---------- Routes, stops and pins ---------- */
  const chipRoutes = () => q.routes().filter(r => r.visible || st.extra.has(r.id));
  const shownRoutes = () => chipRoutes().filter(r => !st.hidden.has(r.id));
  const liveOK = () => st.day === D.today() && st.showTrucks && WD.can('tracking.view_live');
  const liveTrucks = () => { if (!liveOK()) return []; const ids = new Set(shownRoutes().map(r => r.id)), own = S.shift && S.shift.routeId; return data.trucks.filter(t => ids.has(t.routeId) && t.routeId !== own); };
  const unresolved = () => shownRoutes().flatMap(r => q.jobsFor(r.id, st.day).filter(j => !j.located && j.address));
  function pinEl(job, n) {
    const cls = job.status === 'completed' ? '.done' : job.status === 'skipped' ? '.skip' : '';
    return h('div.mp-o.mp-pin.mp-hit' + cls + (st.sel === job.id ? '.sel' : ''), { onclick: () => select(job.id) },
      h('div.mp-pv', { style: pinStyle(job) }, n,
        cls && h('span.mp-pb', { style: { background: cls === '.done' ? 'var(--green)' : 'var(--red)' } }, icon(cls === '.done' ? 'checkmark' : 'xmark', 9))));
  }
  function drawStops() {
    const routes = shownRoutes(); pins = [];
    routesG.innerHTML = routes.map(r => { const ends = q.routeEnds(r.id, st.day), pts = [ends.start, ...q.stops(r.id, st.day).map(s => s.job), ends.end]; return pts.length > 2 ? '<polyline class="rline" vector-effect="non-scaling-stroke" stroke="' + q.routeColor(r) + '" points="' + pts.map(p => p.x + ',' + p.y).join(' ') + '"/>' : ''; }).join('');
    routes.forEach(r => q.stops(r.id, st.day).forEach(({ job, number }) => pins.push({ el: pinEl(job, number), x: job.x, y: job.y })));
    pinLayer.replaceChildren(...pins.map(p => p.el)); pins.forEach(it => put(it.el, it.x, it.y));
  }
  function drawTrucks() {
    const want = new Set();
    liveTrucks().forEach(t => {
      want.add(t.routeId);
      let e = truckEls.get(t.routeId);
      if (!e) { e = h('div.mp-o.mp-truck.mp-hit', { onclick: () => openTruck(t.routeId) }, h('div.mp-tv', h('div.mp-cone'), h('div.mp-ti', icon('truck', 18, '#fff'))), h('div.mp-tl')); truckEls.set(t.routeId, e); truckLayer.appendChild(e); }
      e.style.setProperty('--c', q.routeColor(t.routeId)); e.classList.toggle('still', t.state !== 'driving');
      e.querySelector('.mp-cone').style.transform = 'rotate(' + sim[t.routeId].hd.toFixed(0) + 'deg)';
      const v = q.vehicle(t.vehicleId), lbl = e.querySelector('.mp-tl'), txt = v ? v.name : 'Truck'; if (lbl.textContent !== txt) lbl.textContent = txt;
    });
    truckEls.forEach((e, id) => { if (!want.has(id)) { e.remove(); truckEls.delete(id); } });
    const own = S.shift && st.day === D.today() && truckFor(S.shift.routeId);
    meShown = !!own; meEl.style.display = own ? '' : 'none';
    if (own) meEl.querySelector('.mp-cone').style.transform = 'rotate(' + sim[own.routeId].hd.toFixed(0) + 'deg)';
    trailsG.innerHTML = liveTrucks().map(t => '<polyline class="trail" vector-effect="non-scaling-stroke" stroke="' + q.routeColor(t.routeId) + '" points="' + sim[t.routeId].trail.join(' ') + '"/>').join('');
    if (st.follow && !truckEls.has(st.follow)) st.follow = null;
    kick();
  }
  function placeTrucks() {
    truckEls.forEach((e, id) => { const t = truckFor(id); if (t) { const [x, y] = posOf(t); put(e, x, y); } });
    if (meShown && S.shift) { const t = truckFor(S.shift.routeId); if (t) { const [x, y] = posOf(t); put(meEl, x, y); } }
  }
  const visible = () => el.isConnected && nav.activeTab() === 'map';
  function loop() {
    raf = 0; if (!visible()) return;
    const f = st.follow && truckFor(st.follow);
    if (f) { const [x, y] = posOf(f); apply(lookAt(x, y, view.s)); } else placeTrucks();
    if (truckEls.size || meShown) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf && visible() && (truckEls.size || meShown)) raf = requestAnimationFrame(loop); };

  /* ---------- Floating controls ---------- */
  function select(id) { st.sel = id; drawStops(); drawUI(); }
  function setDay(k) { st.day = k; st.sel = null; st.follow = null; update(); fit(true); }
  function stopFollow() { st.follow = null; drawUI(); }
  function follow(routeId) { const t = truckFor(routeId), v = t && q.vehicle(t.vehicleId); if (!t) return; st.follow = routeId; select(null); const [x, y] = posOf(t); animateTo(lookAt(x, y, Math.max(view.s, 1.4))); ui.toast('Following ' + (v ? v.name : 'truck'), 'location.fill'); kick(); }
  function locate() {
    const own = S.shift && truckFor(S.shift.routeId);
    if (own && st.day === D.today()) { const [x, y] = posOf(own); animateTo(lookAt(x, y, Math.max(view.s, 1.6))); return; }
    ui.toast(S.shift ? 'Location is off for this shift' : 'Your location shows during a shift', 'location'); animateTo(lookAt(depot.x, depot.y, Math.max(view.s, 1.2)));
  }
  const fill = (box, ...kids) => box.replaceChildren(...kids.filter(k => k instanceof Node));   // native replaceChildren would print null/false as text
  const btn = (ic, label, fn, off) => h('button.mp-btn' + (off ? '.off' : ''), { 'aria-label': label, onclick: fn }, icon(ic, 21));
  function drawUI() {
    const routes = chipRoutes(), canLive = WD.can('tracking.view_live'), today = st.day === D.today();
    fill(top, 
      h('div.mp-day.mp-glass', h('button.mp-dbtn', { 'aria-label': 'Previous day', onclick: () => setDay(D.add(st.day, -1)) }, icon('chevron.left', 19)),
        h('button.mp-dlabel', { onclick: () => setDay(D.today()) }, dayLabel(st.day)), h('button.mp-dbtn', { 'aria-label': 'Next day', onclick: () => setDay(D.add(st.day, 1)) }, icon('chevron.right', 19))),
      routes.length > 1 && h('div.mp-chips', routes.map(r => h('button.mp-chip.mp-glass' + (st.hidden.has(r.id) ? '.off' : ''), { onclick: () => { st.hidden.has(r.id) ? st.hidden.delete(r.id) : st.hidden.add(r.id); st.sel = null; update(); } }, ui.dot(q.routeColor(r)), q.routeName(r)))));
    fill(side, 
      h('div.mp-grp.mp-glass', btn('list.bullet', 'Stops list', openList), canLive && btn('truck', st.showTrucks ? 'Hide trucks' : 'Show trucks', () => { st.showTrucks = !st.showTrucks; ui.toast(st.showTrucks ? 'Showing live trucks' : 'Trucks hidden', 'truck', 1400); update(); }, !st.showTrucks)),
      h('div.mp-grp.mp-glass', btn(S.shift ? 'location.fill' : 'location', 'Show my location', locate), btn('mp.fit', 'Show all stops', () => { stopFollow(); fit(true); })),
      h('div.mp-grp.mp-glass', btn('plus', 'Zoom in', () => zoomAt({ x: W / 2, y: H / 2 }, 1.7, true)), btn('minus', 'Zoom out', () => zoomAt({ x: W / 2, y: H / 2 }, 1 / 1.7, true))));
    const fv = st.follow && truckFor(st.follow), fveh = fv && q.vehicle(fv.vehicleId);
    fill(bottom, 
      fv && h('button.mp-note.mp-glass', { onclick: stopFollow }, icon('location.fill', 14, 'var(--blue)'), 'Following ' + (fveh ? fveh.name : 'truck'), icon('xmark', 12, 'var(--label2)')),
      today && !canLive && h('div.mp-note.mp-glass', icon('lock', 14, 'var(--label2)'), 'Live trucks need the Live truck map permission'),
      today && canLive && st.showTrucks && S.offline && h('div.mp-note.mp-glass', icon('wifi.slash', 14, 'var(--orange)'), 'Showing last known positions'),
      st.sel && q.job(st.sel) ? stopCard(q.job(st.sel)) : summaryCard());
  }
  function summaryCard() {
    const routes = shownRoutes(), stops = routes.flatMap(r => q.stops(r.id, st.day).map(s => s.job)), done = stops.filter(j => DONE[j.status]).length, un = unresolved(), live = liveTrucks().length;
    return h('div.mp-card.mp-glass',
      h('button.mp-sum', { onclick: openList }, h('div.mp-sm', h('div.headline', stops.length ? stops.length + ' stop' + (stops.length === 1 ? '' : 's') : 'No stops'),
        h('div.footnote', [routes.length + ' route' + (routes.length === 1 ? '' : 's'), done + ' done', live && live + ' truck' + (live === 1 ? '' : 's') + ' live'].filter(Boolean).join(' · '))), h('span.mp-listbtn', icon('list.bullet', 17), 'List')),
      un.length > 0 && h('button.mp-unres', { onclick: () => un.length === 1 ? openDetails(un[0].id) : openList() }, h('span.mp-q', '?'),
        h('div', h('div.subhead', un.length === 1 ? un[0].title : un.length + ' unresolved addresses'), h('div.caption', un.length === 1 ? 'Address not found · not on the map' : 'Not on the map until the addresses are fixed')), icon('chevron.right', 14)));
  }
  function stopCard(job) {
    const stx = WD.jobStatuses[job.status], n = numberOf(job);
    return h('div.mp-card.mp-glass.mp-stop',
      h('div.mp-sh', mini(job, n), h('div', h('div.headline', job.title), h('div.footnote', job.allDay ? 'Note for the day' : stopLabel(job))), h('button.mp-x', { 'aria-label': 'Close', onclick: () => select(null) }, icon('xmark', 13))),
      h('div.mp-meta', ui.badge(stx.title, stx.color), job.pending && ui.badge('Pending sync', 'var(--orange)'), h('span', ui.dot(q.routeColor(job.routeId)), q.routeName(job.routeId)), h('span', job.address)),
      h('div.mp-acts', ui.button('Details', { kind: 'gray', small: true, icon: 'info.circle', onTap: () => openDetails(job.id) }), ui.button('Directions', { kind: 'filled', small: true, icon: 'arrow.triangle.turn.up.right', onTap: () => ui.toast('Opening Apple Maps…', 'map') })));
  }
  function update() { drawStops(); drawTrucks(); drawUI(); }

  /* ---------- Sheets ---------- */
  function openList() {
    ui.sheet({ title: 'Stops', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
      render(page) {
        const routes = shownRoutes(); if (!routes.length) return ui.empty({ icon: 'map', title: 'No routes shown', text: 'Turn on a route with the chips above the map.' });
        return ui.list(h('div.footnote', { style: { padding: '2px 16px 0' } }, dayLabel(st.day) + ' · stops in board order'),
          routes.map(r => ui.section({ header: h('span.hstack', { style: { gap: '6px' } }, ui.dot(q.routeColor(r)), q.routeName(r)) },
            q.stops(r.id, st.day).map(({ job, number }) => { const sx = WD.jobStatuses[job.status];
              return ui.row({ leading: mini(job, number), title: job.title, subtitle: (job.allDay ? 'Note for the day' : stopLabel(job)) + (job.pending ? ' · Pending sync' : ''), trailing: icon(sx.icon, 18, sx.color), onTap: () => { page.dismiss(); focusJob(job.id); } }); }),
            q.jobsFor(r.id, st.day).filter(j => !j.located && j.address).map(job => ui.row({ leading: h('span.mp-q', '?'), title: job.title, subtitle: 'Address not found · not on the map', chevron: true, onTap: () => openDetails(job.id) })),
            !q.jobsFor(r.id, st.day).length && ui.row({ title: 'No jobs', subtitle: 'Nothing scheduled on this route' }))));
      } }, { detent: 'medium' });
  }
  function openTruck(routeId) {
    const t0 = truckFor(routeId); if (!t0) return;
    const drv = q.user(t0.driverId) || { name: 'Driver', phone: '' }, veh = q.vehicle(t0.vehicleId) || { name: 'Truck' };
    let timer = 0;
    const vals = () => {
      const t = truckFor(routeId); if (!t) return null;
      const stops = stopJobs(routeId), done = stops.filter(j => DONE[j.status]).length, nx = t.nextJobId && q.job(t.nextJobId);
      let next = 'Back to the shop', eta = '—';
      if (nx) { next = '#' + numberOf(nx) + ' ' + nx.title; const dist = Math.hypot(nx.x - t.x, nx.y - t.y), mins = Math.round(dist * MI * 1.35 / 28 * 60); eta = nx.status === 'arrived' ? 'On site now' : fmt.time(WD.nowMins() + Math.max(1, mins)); }
      return { state: STATE[t.state].title, color: STATE[t.state].color, speed: t.state === 'driving' ? t.speedMph + ' mph' : 'Stopped', updated: ago(t.lastFix), battery: t.battery + '%', next, eta, progress: done + ' of ' + stops.length + ' stops', frac: stops.length ? done / stops.length : 0 };
    };
    const span = (k, v) => h('span', { 'data-k': k }, v[k]);
    ui.sheet({ title: veh.name, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
      render(page) {
        const v = vals(); if (!v) return ui.empty({ icon: 'truck', title: 'No recent location', text: 'This truck is no longer reporting.' });
        return ui.list(
          h('div.mp-thead', ui.avatar(drv.name, { size: 52 }), h('div', h('div.title3', drv.name), h('div.footnote', veh.name + ' · ' + q.routeName(routeId))), h('span.badge', { 'data-k': 'state', style: { '--c': v.color } }, v.state)),
          ui.section(null, ui.row({ title: 'Speed', detail: span('speed', v), icon: 'gauge', iconColor: 'var(--blue)' }), ui.row({ title: 'Last update', detail: span('updated', v), icon: 'clock', iconColor: 'var(--gray)' }),
            ui.row({ title: 'Phone battery', detail: span('battery', v), icon: 'battery', iconColor: 'var(--green)' }),
            ui.row({ title: 'Next stop', subtitle: span('next', v), detail: span('eta', v), icon: 'mappin', iconColor: 'var(--orange)' }),
            ui.row({ title: 'Shift started', detail: fmt.clock(new Date(t0.shiftStart)), icon: 'play.fill', iconColor: 'var(--indigo)' }),
            h('div.row', h('div.row-icon', { style: { background: q.routeColor(routeId) } }, icon('route', 19)), h('div.row-main', h('div.hstack', h('span', 'Today'), h('span.spacer'), h('span.secondary', span('progress', v))), h('div', { style: { marginTop: '7px' } }, ui.progress(v.frac))))),
          h('div.mp-tbtns', ui.button('Call driver', { kind: 'gray', icon: 'phone.fill', onTap: () => ui.toast('Calling ' + drv.name + '…', 'phone.fill') }), ui.button('Text driver', { kind: 'gray', icon: 'message', onTap: () => ui.toast('Opening Messages…', 'message') }),
            ui.button('Follow', { icon: 'location.fill', onTap: () => { page.dismiss(); follow(routeId); } })));
      },
      onAppear(page) {
        timer = setInterval(() => {
          if (!page.el.isConnected) return clearInterval(timer);
          const v = vals(); if (!v) return;
          page.body.querySelectorAll('[data-k]').forEach(e => { const k = e.dataset.k; if (e.textContent !== v[k]) e.textContent = v[k]; if (k === 'state') e.style.setProperty('--c', v.color); });
          const bar = page.body.querySelector('.progress > i'); if (bar) bar.style.width = Math.round(v.frac * 100) + '%';
        }, 1000);
      },
      onClose: () => clearInterval(timer) }, { detent: 'medium' });
  }

  /* ---------- Lifecycle ---------- */
  function focus(job) {
    st.day = job.day; st.follow = null; st.hidden.delete(job.routeId); if (!q.route(job.routeId).visible) st.extra.add(job.routeId);
    st.sel = job.id; measure(); update(); fitted = true;
    if (job.located && job.x != null) animateTo(lookAt(job.x, job.y, Math.max(view.s, 1.5))); else ui.toast('This address isn’t on the map', 'questionmark.circle');
  }
  const resume = () => { measure(); update(); };
  unsub.push(WD.on('trucks', () => { if (el.isConnected) drawTrucks(); }), WD.on('tab', id => { if (id === 'map') resume(); }));
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(() => measure()); ro.observe(el); }
  return {
    mount() { update(); return el; }, update, resume, focus,
    destroy() { unsub.forEach(f => f()); cancelAnimationFrame(raf); cancelAnimationFrame(anim); if (ro) ro.disconnect(); },
  };
}

function root() {
  if (inst) inst.destroy();
  const m = inst = createMap();
  return { title: 'Map', navbar: false, noScroll: true, live: false, class: 'mp-page', render: () => m.mount(), onChange: () => m.update(), onAppear: () => m.resume(), onReappear: () => m.resume() };
}
/** Switch to the Map tab on the job's day and center and select its stop. */
function focusJob(jobId) {
  const job = q.job(jobId); if (!job) return;
  ui.closeAllSheets(); nav.switchTab('map'); nav.switchTab('map');   // the second call pops the map stack to its root
  if (inst) inst.focus(job);
}
/** A small static map. o: {points: [{x, y, n, style, cls}], lines: [{pts: [{x, y}], color, dash}], aspect (w/h), caption, pad}. */
function miniMap(o) {
  const pts = o.points.concat(...(o.lines || []).map(l => l.pts)), xs = pts.map(p => p.x), ys = pts.map(p => p.y), pad = o.pad || 40, aspect = o.aspect || 1.6;
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad, w = Math.max(x1 - x0, 120), hh = Math.max(y1 - y0, 120);
  if (w / hh > aspect) { const nh = w / aspect; y0 -= (nh - hh) / 2; hh = nh; } else { const nw = hh * aspect; x0 -= (nw - w) / 2; w = nw; }
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'mp-svg'); svg.setAttribute('viewBox', [x0, y0, w, hh].map(n => n.toFixed(1)).join(' ')); svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = buildBase().markup + (o.lines || []).map(l => '<polyline fill="none" stroke="' + l.color + '" stroke-width="' + (l.width || 2.5) + '" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"' + (l.dash ? ' stroke-dasharray="6 4"' : '') + ' opacity="' + (l.opacity || .9) + '" points="' + l.pts.map(p => p.x + ',' + p.y).join(' ') + '"/>').join('');
  return h('div.mm', { style: { aspectRatio: String(aspect) } }, svg, o.points.map(p => h('div.mm-p' + (p.cls ? '.' + p.cls : ''), { style: { left: ((p.x - x0) / w * 100).toFixed(2) + '%', top: ((p.y - y0) / hh * 100).toFixed(2) + '%', ...(p.style || {}) }, title: p.title || null }, p.n != null ? p.n : p.icon ? icon(p.icon, 11) : null)), o.caption && h('div.mm-cap', o.caption));
}
WD.miniMap = miniMap; WD.pinStyle = pinStyle;
WD.screens.map = { root, focusJob, trucks: () => { reconcile(); return data.trucks; } };
})();
