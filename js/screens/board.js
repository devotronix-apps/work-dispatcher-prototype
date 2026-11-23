/* Dispatch board: routes side by side for one day, one route across days, and a month overview.
   Jobs have no times — each column is an ordered list (stop 1 is done first). Drag a job to reorder or reassign it. */
(function () {
'use strict';
const { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;
const PAD = 6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

WD.css(`
.bd-top { height: 44px; display: flex; align-items: center; padding: 0 4px; flex: none; }
/* In a workspace column the bar's buttons sit closer together (a mouse, not a finger), so the date is never squeezed out. */
.phone.desktop .tabpanes.multi .bd-top .nav-btn, .phone.desktop .tabpanes.multi .bd-date .nav-btn { min-width: 32px; } .phone.desktop .tabpanes.multi .bd-date .t { flex: none; } .phone.desktop .tabpanes.multi .bd-date .t b { font-size: 15px; letter-spacing: -.3px; }
.bd-date { flex: 1; display: flex; align-items: center; justify-content: center; min-width: 0; }
.bd-date .t { border: 0; background: none; padding: 0 2px; min-height: 44px; min-width: 0; flex: 0 1 auto; cursor: pointer; text-align: center; color: var(--label); }
.bd-date .t b { display: block; font-size: 17px; font-weight: 600; line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .bd-date .t.long b { font-size: 15px; letter-spacing: -.3px; }
.bd-date .t small { display: block; font-size: 12px; line-height: 14px; font-weight: 500; color: var(--label2); letter-spacing: 0; }
.bd-date .t small.today { color: var(--tint); font-weight: 600; }
/* Tap targets: every button in the bar is 44 × 44; the icons keep their size. */
.bd-top .nav-btn, .bd-date .nav-btn { min-width: 44px; padding: 0; flex: none; }
.bd-today { width: 24px; height: 24px; border: 1.7px solid currentColor; border-radius: 5px; font-size: 12px; font-weight: 700; display: grid; place-items: center; letter-spacing: 0; }
/* Warning lines: black or white text on a tinted bar, with the color carried by the icon and the left edge. */
.bd-strip { flex: none; position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 6px; min-height: 38px; padding: 5px 14px 5px 10px; font-size: 13px; line-height: 16px; font-weight: 500; letter-spacing: -.08px; cursor: pointer; background: color-mix(in srgb, var(--c) 14%, var(--cell)); color: var(--label); border-top: .5px solid var(--sep); border-left: 4px solid var(--c); }
.bd-strip > .ic:first-child { color: var(--c); flex: none; } .bd-strip > .ic { flex: none; }
.bd-strip::after { content: ''; position: absolute; inset: -3px 0; }
.bd-strip .spacer { flex: 1; }
.bd-strip:focus-visible, .bd-colhead:focus-visible, .bd-add:focus-visible, .bd-chip:focus-visible, .bd-rnote:focus-visible { outline: 3px solid var(--tint); outline-offset: -3px; }
.bd-strip-n { display: inline-flex; gap: 3px; margin-left: 4px; } .bd-strip-n i { width: 7px; height: 7px; border-radius: 50%; }
.bd-fold { flex: none; } .bd-fold > .sum { font-weight: 600; } .bd-fold > .sum > .ic:last-child { transition: transform .18s; } .bd-fold > .sum.open > .ic:last-child { transform: rotate(180deg); }
.bd-fold-list { max-height: 45vh; overflow-y: auto; } .bd-fold-list[hidden] { display: none; } .bd-fold-list .bd-strip { padding-left: 22px; } .bd-fold-list .bd-strip::after { inset: 0; }
.bd-mseg { padding: 8px 10px 6px; }
/* 5.0: Board ↔ Map switch in the top bar, the embedded map, the desktop split, calendar-time cards and capacity chips. */
.bd-vbtn { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 34px; margin: 0 6px; padding: 0 14px 0 11px; border: 0; border-radius: 17px; background: var(--tint); color: #fff; font: inherit; font-size: 15px; font-weight: 600; letter-spacing: -.2px; cursor: pointer; position: relative; white-space: nowrap; }
.bd-vbtn::after { content: ''; position: absolute; inset: -5px 0; } .bd-vbtn:active { filter: brightness(.9); }
/* iPhone: the same button floats over the bottom of the board or map, centered, 46 points tall. */
.bd-vbtn.float { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 7; height: 46px; margin: 0; padding: 0 22px 0 18px; border-radius: 23px; font-size: 17px; background: color-mix(in srgb, var(--tint) 86%, #000); box-shadow: 0 4px 16px rgba(0,0,0,.34), 0 0 0 1.5px rgba(255,255,255,.55); transition: bottom .22s ease; }
.bd-holder { flex: 1; min-height: 0; min-width: 0; position: relative; display: flex; flex-direction: column; } .bd-holder .bd-col { padding-bottom: 72px; }
/* 5.1: a wide column (one route on an iPhone, or a computer) gets a bigger name with the day's notes beside it instead of above the stops. */
.bd-colhead.roomy { flex-wrap: nowrap; align-items: stretch; gap: 8px; padding: 5px 8px; min-height: 48px; }
.bd-hname { display: flex; flex-wrap: wrap; align-items: center; align-content: center; gap: 1px 6px; min-width: 0; flex: 0 1 auto; max-width: 54%; } .bd-hname.alone { max-width: none; flex: 1; }
.bd-colhead.roomy span.n { font-size: 17px; line-height: 21px; font-weight: 700; letter-spacing: -.3px; white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.bd-colhead.roomy.single span.n { font-size: 21px; line-height: 25px; letter-spacing: -.4px; } .bd-colhead.roomy .dot { width: 11px; height: 11px; }
.bd-colhead.roomy span.c { margin-left: 0; white-space: nowrap; } .bd-colhead.roomy.single .bd-hnotes:not(.many) .bd-rnote { -webkit-line-clamp: 3; } .bd-colhead.roomy .bd-offrow { flex-basis: auto; order: 0; }
.bd-hnotes { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 3px; }
.bd-hnotes .bd-rnote, .bd-hnotes .bd-chip { margin: 0; } .bd-hnotes .bd-rnote { padding: 3px 6px; font-weight: 500; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.bd-hnotes.many .bd-rnote { -webkit-line-clamp: 1; } .bd-hnotes .bd-rnote b { font-weight: 800; }
.bd-mapwrap { flex: 1; min-height: 0; min-width: 0; position: relative; display: flex; flex-direction: column; border-top: .5px solid var(--sep); }
.bd-split { flex: 1; min-height: 0; display: flex; } .bd-split > .bd-wrap { flex: 0 0 60%; min-width: 0; } .bd-split > .bd-mapwrap { border-left: .5px solid var(--sep); }
.bd-time { font-size: 13px; line-height: 16px; font-weight: 800; letter-spacing: -.1px; font-variant-numeric: tabular-nums; }
.bd-tag.ov { background: #D70015; color: #fff; text-transform: none; }
.bd-notime { margin: 8px 2px 5px; font-size: 12px; line-height: 15px; font-weight: 700; color: var(--label2); text-transform: uppercase; letter-spacing: .3px; }
.bd-cap { flex: none; font-size: 12px; line-height: 15px; font-weight: 800; letter-spacing: .1px; border: 0; border-radius: 4px; padding: 1px 5px; color: #fff; background: #B25000; cursor: pointer; white-space: nowrap; } .bd-cap.over { background: #D70015; } .bd-cap.ok { background: #636366; }
.bd-date .t small.rt { display: flex; align-items: center; justify-content: center; gap: 4px; } .bd-date .t small.rt .dot { width: 7px; height: 7px; }
.bd-wrap { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
.bd-scroll { touch-action: pan-x pan-y; flex: 1; min-height: 0; overflow: auto; position: relative; background: var(--cell); border-top: .5px solid var(--sep); scrollbar-width: none; overscroll-behavior: contain; }
.bd-scroll::-webkit-scrollbar { display: none; }
/* More routes than fit: the next column peeks in, and this marker counts the ones still off screen. */
.bd-morecols { position: absolute; right: 6px; bottom: 12px; z-index: 6; border: 0; border-radius: 16px; min-height: 32px; padding: 0 12px; background: color-mix(in srgb, var(--tint) 78%, #000); color: #fff; font: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.4); }
.bd-morecols::after { content: ''; position: absolute; inset: -6px; } .bd-morecols[hidden] { display: none; }
.bd-content { position: relative; min-width: 100%; }
.bd-head { position: sticky; top: 0; z-index: 4; background: var(--cell); border-bottom: .5px solid var(--sep); }
.bd-hrow { display: flex; }
.bd-colhead { flex: none; box-sizing: border-box; min-height: 44px; padding: 6px 8px 5px; font-size: 13px; line-height: 16px; font-weight: 600; letter-spacing: -.1px; display: flex; align-items: center; gap: 5px; border-left: .5px solid var(--sep); min-width: 0; }
.bd-colhead:first-child { border-left: 0; }
.bd-colhead span.n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bd-colhead span.c { margin-left: auto; font-weight: 500; color: var(--label2); font-size: 12px; }
.bd-colhead.today span.n { color: var(--red); }
.bd-colhead .dot { width: 8px; height: 8px; }
.bd-chip { margin: 0 0 4px; border-radius: 6px; background: color-mix(in srgb, var(--c) 18%, var(--cell)); color: var(--label); border: 1px dashed color-mix(in srgb, var(--c) 60%, transparent); font-size: 12px; line-height: 15px; padding: 4px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; letter-spacing: -.05px; }
.bd-chip .ic { margin: -2px 3px 0 0; }
.bd-body { display: flex; position: relative; align-items: stretch; }
.bd-col { flex: none; position: relative; border-left: .5px solid var(--sep); padding: 6px 4px 24px; box-sizing: border-box; }
.bd-col:first-child { border-left: 0; }
.bd-col.past { background: color-mix(in srgb, var(--fill3) 45%, transparent); }
/* Job cards are calm: a neutral background (white, dark gray in dark mode), the route color only on the left edge and the stop number, one small tag
   or icon for the status, and red only for a real problem. The old fill by job type is still a choice in Settings → Display (.cs-solid, r15.js). */
.bd-job { position: relative; margin-bottom: 5px; cursor: pointer; touch-action: pan-y; border-radius: 9px; }
.bd-job:focus-visible { outline: 3px solid var(--tint); outline-offset: 2px; }
.bd-job-in { border-radius: 9px; background: var(--cell); color: var(--label); padding: 5px 5px 5px 4px; overflow: hidden; position: relative; display: flex; gap: 6px; align-items: flex-start; font-size: 13px; line-height: 16px; letter-spacing: -.1px; border: 1px solid var(--sep); border-left: 4px solid var(--ring); box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.bd-type { display: inline-block; font-size: 12px; line-height: 15px; font-weight: 600; letter-spacing: 0; border-radius: 4px; padding: 0 4px; margin-top: 2px; background: var(--fill3); color: var(--label2); }
.bd-num { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--ring); color: var(--nfg, #fff); font-size: 12px; font-weight: 800; display: grid; place-items: center; letter-spacing: 0; }
.bd-job-main { min-width: 0; flex: 1; }
/* The title is the part that gets shortened; the key facts under it wrap and are never cut off. */
.bd-job-title { font-weight: 600; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; word-break: break-word; }
.bd-job-title .ic { margin: -2px 2px 0 0; }
.bd-job .bd-job-title .wf-td { font-size: 12px; opacity: 1; }
.bd-job-key { font-size: 12px; line-height: 15px; font-weight: 700; letter-spacing: 0; margin-top: 1px; overflow-wrap: anywhere; }
.bd-job-sub { font-size: 12px; line-height: 15px; overflow-wrap: anywhere; letter-spacing: 0; margin-top: 1px; }
.bd-job-sub .ic { margin-top: -2px; }
.bd-job-note { font-size: 12px; line-height: 15px; margin-top: 2px; font-style: italic; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; letter-spacing: 0; }
.bd-done { display: inline-grid; place-items: center; width: 16px; height: 16px; border-radius: 50%; background: #1B7F3B; color: #fff; vertical-align: -3px; margin-right: 3px; box-shadow: 0 0 0 1px rgba(255,255,255,.85); } .bd-job-title .bd-done .ic { margin: 0; }
.lvl0 .bd-job-in { padding: 2px 4px; align-items: center; } .lvl0 .bd-job-title { -webkit-line-clamp: 1; } .lvl0 .bd-num { width: 19px; height: 19px; }
.lvl2 .bd-job-title { -webkit-line-clamp: 3; }
/* Every card carries all three detail levels; the board's class picks one, so pinching never rebuilds the list. */
.lvl0 .d12, .lvl0 .d1, .lvl0 .d2, .lvl1 .d0, .lvl1 .d2, .lvl2 .d0, .lvl2 .d1 { display: none; }
/* Narrow columns (four or more routes on screen): the stop number sits above the name so the name keeps the full width. */
.bd-scroll.narrow .bd-job-in { flex-direction: column; align-items: flex-start; gap: 2px; padding: 3px; } .bd-scroll.narrow.lvl0 .bd-job-title { -webkit-line-clamp: 2; }
.bd-scroll.narrow .bd-colhead { padding: 6px 4px 5px; gap: 4px; } .bd-scroll.narrow .bd-col { padding-left: 3px; padding-right: 3px; } .bd-scroll.tiny .bd-add .l { display: none; }
.bd-job.calledoff .bd-num { background: #636366; color: #fff; box-shadow: none; }
.bd-colhead { flex-wrap: wrap; row-gap: 2px; cursor: pointer; } .bd-offrow { flex-basis: 100%; order: 9; display: flex; }
.bd-off { flex: none; font-size: 12px; line-height: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: .2px; border-radius: 4px; padding: 0 4px; background: #D70015; color: #fff; }
.bd-off.purgeOnly { background: #8A6100; } .bd-off.closed { background: #636366; }
.bd-zoom { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); background: var(--material); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 12px; padding: 10px 16px; font-size: 15px; font-weight: 600; z-index: 30; pointer-events: none; box-shadow: 0 4px 18px rgba(0,0,0,.18); text-align: center; max-width: 80%; }
.bd-q { display: inline-block; background: color-mix(in srgb, var(--red) 14%, transparent); color: color-mix(in srgb, var(--red) 78%, var(--label)); font-weight: 800; border-radius: 4px; padding: 0 4px; margin-right: 3px; font-size: 12px; line-height: 15px; }
/* Finished and called-off jobs: a greyed card with full-contrast text (and a check on completed ones), never faded text. */
.bd-job.faded .bd-job-in, .bd-job.struck .bd-job-in { background: color-mix(in srgb, var(--gray) 15%, var(--cell)); color: var(--label); border-left-color: color-mix(in srgb, var(--ring) 45%, var(--gray)); box-shadow: none; }
.bd-scroll.selecting .bd-job:not(.sel) .bd-job-in { opacity: 1; }
.bd-slot { margin-bottom: 5px; border-radius: 9px; border: 2px dashed var(--tint); background: color-mix(in srgb, var(--tint) 12%, transparent); position: relative; box-sizing: border-box; transition: height .12s; }
.bd-slot .bd-job-in { opacity: .45; border-color: transparent; }
.bd-slot .bd-land { position: absolute; right: 6px; bottom: 4px; font-size: 12px; line-height: 15px; font-weight: 800; color: var(--label); background: var(--cell); border-radius: 4px; padding: 0 4px; letter-spacing: .2px; text-transform: uppercase; box-shadow: 0 0 0 1px var(--tint); }
.bd-job.struck .bd-job-title { text-decoration: line-through; text-decoration-thickness: 2px; }
.bd-tag { display: inline-block; font-size: 12px; line-height: 15px; font-weight: 800; letter-spacing: .2px; text-transform: uppercase; border-radius: 4px; padding: 0 4px; background: var(--fill2); color: var(--label); margin-top: 2px; }
/* One warning look (amber: needs doing) and one problem look (red: something is wrong). */
.bd-tag.nb, .bd-flag.warn { background: color-mix(in srgb, var(--orange) 18%, transparent); color: color-mix(in srgb, var(--orange) 55%, var(--label)); } .bd-tag.na, .bd-flag.bad { background: color-mix(in srgb, var(--red) 14%, transparent); color: color-mix(in srgb, var(--red) 78%, var(--label)); }
.bd-job.arrived .bd-job-in { outline: 2px solid var(--label); outline-offset: -2px; }
/* A change that is still syncing shows a dashed outline. */
.bd-job.pending .bd-job-in { border-style: dashed; }
.bd-job.dragging { display: none; }
.bd-job.linked .bd-job-in { box-shadow: 0 0 0 2px var(--tint); }
.bd-job.flash .bd-job-in { animation: bd-flash 1.800s ease-out; }
@keyframes bd-flash { 0%, 40% { box-shadow: 0 0 0 4px var(--yellow); transform: scale(1.04); } 100% { transform: none; } }
.bd-add { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 44px; box-sizing: border-box; border-radius: 9px; border: 1px dashed var(--sep); color: var(--label2); font-size: 12px; font-weight: 600; cursor: pointer; letter-spacing: 0; }
.bd-empty { text-align: center; color: var(--label2); font-size: 12px; padding: 14px 4px 10px; letter-spacing: 0; }
.bd-ins { position: absolute; height: 3px; border-radius: 2px; background: var(--tint); z-index: 9; pointer-events: none; }
.bd-ins::before { content: ''; position: absolute; left: -3px; top: -3px; width: 9px; height: 9px; border-radius: 50%; background: var(--tint); }
.bd-ghost { position: absolute; z-index: 10; pointer-events: none; margin: 0; box-sizing: border-box; }
.bd-ghost .bd-job-in { box-shadow: 0 10px 26px rgba(0,0,0,.35); transform: scale(1.03); opacity: .95; }
.bd-month { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--cell); border-top: .5px solid var(--sep); }
.bd-mhead { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 12px; color: var(--label2); text-align: center; padding: 4px 0; flex: none; letter-spacing: 0; }
.bd-week { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(7, 1fr); border-top: .5px solid var(--sep); }
.bd-mday { min-width: 0; padding: 2px 1px; cursor: pointer; overflow: hidden; }
.bd-mday.other { opacity: .35; }
.bd-month { touch-action: none; overflow: hidden; }
.bd-month.up > .bd-week { animation: bd-mup .26s cubic-bezier(.2,.85,.25,1); } .bd-month.down > .bd-week { animation: bd-mdown .26s cubic-bezier(.2,.85,.25,1); }
@keyframes bd-mup { from { transform: translateY(60px); opacity: 0; } } @keyframes bd-mdown { from { transform: translateY(-60px); opacity: 0; } }
.bd-mev.area { font-weight: 600; margin: 2px 1px 0; padding: 1px 3px; border-radius: 4px; border-left: 0; }
.bd-month.areas .bd-mev.area { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--ln, 1); white-space: normal; overflow-wrap: anywhere; line-height: 14px; }
.bd-mev.off { margin: 2px 1px 0; padding: 1px 3px; border-radius: 4px; border-left: 0; font-weight: 700; background: var(--label); color: var(--cell); }
.bd-mev.off.ask { background: none; color: var(--label); outline: 1.5px dashed var(--label2); outline-offset: -1.5px; }
.bd-mev.wkend { margin: 2px 1px 0; font-weight: 600; background: color-mix(in srgb, var(--ring) 18%, var(--cell)); }
.bd-mday.sel { background: var(--fill3); }
.bd-mnum { width: 22px; height: 22px; margin: 0 auto 1px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; letter-spacing: 0; }
.bd-mday.today .bd-mnum { background: #D70015; color: #fff; font-weight: 600; }
.bd-mev { font-size: 12px; line-height: 14px; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; border-radius: 3px; padding: 0 2px; margin-top: 1px; color: var(--label); background: var(--fill3); border-left: 3px solid var(--ring); }
.bd-mev.struck { text-decoration: line-through; background: color-mix(in srgb, var(--gray) 16%, var(--cell)); }
.bd-more { font-size: 12px; line-height: 14px; color: var(--label2); padding-left: 3px; letter-spacing: -.2px; white-space: nowrap; overflow: hidden; }
.menu.compact .menu-item .mi-sub { display: none; }
/* Route chips in the board menu: 32 points tall to the eye, 44 to the finger. */
.bd-rchips { display: flex; flex-wrap: wrap; gap: 12px 6px; padding: 8px 10px 12px; }
.bd-rchips button { position: relative; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--sep); background: none; border-radius: 16px; height: 32px; padding: 0 10px 0 8px; font: inherit; font-size: 13px; color: var(--label2); cursor: pointer; letter-spacing: -.1px; max-width: 100%; }
.bd-rchips button::after { content: ''; position: absolute; inset: -6px -3px; }
.bd-rchips button span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .bd-rchips button .dot { width: 9px; height: 9px; opacity: .35; }
.bd-rchips button.on { color: var(--label); border-color: color-mix(in srgb, var(--c) 55%, transparent); background: color-mix(in srgb, var(--c) 14%, transparent); font-weight: 600; } .bd-rchips button.on .dot { opacity: 1; }
.bd-rnote { margin: 0 0 5px; border-radius: 8px; background: #FFE066; color: #1C1C1E; border-left: 4px solid #E0A800; font-size: 12px; line-height: 15px; font-weight: 600; padding: 5px 6px; cursor: pointer; letter-spacing: -.05px; overflow-wrap: anywhere; }
.bd-rnote small { display: block; font-weight: 700; font-size: 12px; letter-spacing: .2px; text-transform: uppercase; opacity: .8; }
/* One warning style. A card that dispatch should stop and look at (more unpaid invoices than the company's limit, or a driver or truck not cleared
   for the job) gets a red outline, and a red label on the card says which. The route's color stays on the left edge. There are no stripes. */
.bd-job.unpaid .bd-job-in, .bd-job.blocked .bd-job-in { border-color: var(--red); border-left-color: var(--ring); box-shadow: 0 0 0 1.5px var(--red); }
.bd-flag { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; line-height: 15px; font-weight: 800; letter-spacing: .2px; text-transform: uppercase; border-radius: 4px; padding: 0 4px; margin: 2px 3px 0 0; background: var(--fill2); color: var(--label); }
/* Selecting jobs to move: a solid bar under the date, in place of the warning lines, so it is seen and covers no job. */
.bd-pick { flex: none; position: relative; z-index: 5; display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: color-mix(in srgb, var(--tint) 78%, #000); color: #fff; font-size: 15px; box-shadow: 0 2px 8px rgba(0,0,0,.28); }
.bd-pick.in { animation: bd-pick-in .3s cubic-bezier(.2,.9,.3,1.25); }
@keyframes bd-pick-in { from { transform: translateY(-14px) scaleY(.6); opacity: 0; } }
.bd-pick button { flex: none; border: 1.5px solid rgba(255,255,255,.8); background: none; color: #fff; font: inherit; font-weight: 600; min-height: 44px; min-width: 44px; padding: 0 10px; border-radius: 10px; cursor: pointer; white-space: nowrap; }
.bd-pick button:disabled { opacity: .5; cursor: default; } .bd-pick button:not(:disabled):active { background: rgba(255,255,255,.2); }
.bd-pick .n { flex: 1; min-width: 0; text-align: center; font-weight: 700; font-size: 13px; line-height: 16px; } .bd-pick .n b { display: block; font-size: 20px; line-height: 22px; }
.bd-pick .go { background: #fff; border-color: #fff; color: color-mix(in srgb, var(--tint) 78%, #000); font-weight: 700; } .bd-pick .go:not(:disabled):active { background: rgba(255,255,255,.8); }
.bd-cal { padding: 0 14px 12px; }
.bd-cal-top { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 6px; font-weight: 600; } .bd-cal-top .nav-btn { min-width: 44px; }
.bd-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 2px; text-align: center; }
.bd-cal-grid span { font-size: 12px; color: var(--label2); padding-bottom: 4px; letter-spacing: 0; }
.bd-cal-grid button { border: 0; background: none; height: 44px; font-size: 19px; color: var(--label); cursor: pointer; border-radius: 50%; width: 44px; margin: 0 auto; letter-spacing: 0; padding: 0; }
.bd-cal-grid button.today { color: var(--tint); font-weight: 600; }
.bd-cal-grid button.sel { background: color-mix(in srgb, var(--tint) 78%, #000); color: #fff; font-weight: 600; }
.bd-cal-grid button.other { color: var(--label3); }
`);

let page = null, scroller = null, saved = { top: null, left: 0 }, layout = { cols: [], colW: 100, cap: 2 }, drag = null, flashId = null, revealId = null, lastDown = 0;
/* Text on a colored fill. WD.textOn switches at one luminance and leaves white on mid-tone fills at about 3:1, so this compares the real WCAG
   contrast ratios instead: white or near-black, whichever reads better, and pure black for the few mid-tones where neither reaches 4.5:1. */
const lum = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, n >> 8 & 255, n & 255].reduce((s, v, i) => { v /= 255; return s + (v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)) * [.2126, .7152, .0722][i]; }, 0); };
const contrast = WD.contrast = (a, b) => { const x = lum(a), y = lum(b); return x == null || y == null ? 0 : (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const readableOn = WD.readableOn = hex => { if (lum(hex) == null) return '#fff'; const w = contrast(hex, '#ffffff'), d = contrast(hex, '#1C1C1E'); return w >= d && w >= 4.5 ? '#fff' : d >= 4.5 ? '#1C1C1E' : contrast(hex, '#000000') > w ? '#000' : '#fff'; };
/** Enter or Space on a focused control does what a tap does. */
const keyClick = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); e.currentTarget.click(); } };
if (S.board.cols == null) S.board.cols = 3;   // routes on screen at once: a number, or 'all'
const boardSort = q.order;
const jobsScreen = () => WD.screens.jobs || {};
/* r14-ops.js (capacity, calendar times, route review, the stop requests) loads after this file, so it is looked up when the board draws. */
const ops2 = () => WD.ops2 || {}, calendar = () => !!(WD.r14 && WD.r14.calendar && WD.r14.calendar());
if (S.board.view == null) S.board.view = 'board';   // 'board' | 'map': what Dispatch shows under the date bar
const mapOnly = () => S.board.view === 'map' && S.board.mode !== 'month', splitView = () => !!S.desktop && !!S.board.split && S.board.view !== 'map' && S.board.mode !== 'month';
const canMap = () => S.board.mode !== 'month' && !!(WD.screens.map && WD.screens.map.create);
/** The Board ↔ Map button: shows the icon and name of the other view, and a tap goes there. */
function viewBtn(floating) { const toMap = S.board.view !== 'map';
  return h('button.bd-vbtn' + (floating ? '.float' : ''), { 'aria-label': toMap ? 'Showing the board. Switch to the map' : 'Showing the map. Switch to the board', title: toMap ? 'Show the map' : 'Show the board', onclick: () => setView(toMap ? 'map' : 'board') }, icon(toMap ? 'map' : 'columns', floating ? 19 : 17), h('span', toMap ? 'Map' : 'Board')); }
/* On the map the button sits just above the map's own bottom card (the day's summary, or the stop that is selected) and follows it as the
   card grows, shrinks or goes away, so it never covers what the card says. On the board it stays at the bottom edge. */
let pillWatch = null;
const viewPill = () => { if (pillWatch) { pillWatch.disconnect(); pillWatch = null; } if (S.desktop || !canMap() || S.board.select) return null; const pill = viewBtn(true); if (!mapOnly()) return pill;
  const place = () => { const holder = pill.parentNode, card = holder && holder.querySelector('.mp-bottom'); if (!holder) return; let up = 12;
    if (card && card.offsetHeight > 4 && getComputedStyle(card).display !== 'none') up = Math.max(12, Math.round((holder.getBoundingClientRect().bottom - card.getBoundingClientRect().top) / WD.scale()) + 10);
    pill.style.bottom = up + 'px'; };
  requestAnimationFrame(() => { const holder = pill.parentNode; if (!holder) return; place();
    pillWatch = new MutationObserver(() => requestAnimationFrame(place)); pillWatch.observe(holder, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    if (window.ResizeObserver) { const ro = new ResizeObserver(place), card = holder.querySelector('.mp-bottom'); if (card) ro.observe(card); const mo = pillWatch; pillWatch = { disconnect() { mo.disconnect(); ro.disconnect(); } }; } });
  return pill; };
function setView(v) { const b = S.board; if (b.view === v) return; b.view = v; if (v === 'map' && b.mode === 'month') b.mode = 'routes'; refresh(); }
/* The live map inside Dispatch: made once, then only told to update. It follows the board's day and routes. */
let emb = null, embWrap = null, embKey = '';
/* Each business keeps its own scroll position, open warning list and embedded map. */
const perOrg = {};
WD.on('orgSwap', e => { if (emb) { emb.destroy(); emb = null; embWrap = null; }
  perOrg[e.from] = { saved: scroller && scroller.isConnected && scroller.offsetParent && scroller.placed ? { top: scroller.scrollTop, left: scroller.scrollLeft } : saved, stripsOpen };
  const p = perOrg[e.to] || { saved: { top: null, left: 0 }, stripsOpen: false }; saved = p.saved; stripsOpen = p.stripsOpen; scroller = null; page = null; });
function mapPane() {
  const M = WD.screens.map, b = S.board; if (!M || !M.create) return h('div.bd-mapwrap', ui.empty({ icon: 'map', title: 'The map isn’t available' }));
  if (!emb) { emb = M.create(); embWrap = h('div.bd-mapwrap', emb.mount()); embKey = ''; }
  const m = emb, key = b.mode === 'days' ? 'd:' + b.routeId : 'r';
  requestAnimationFrame(() => { if (m !== emb || !m.el.isConnected) return; if (key !== embKey) { embKey = key; m.setRoutes(b.mode === 'days' ? [b.routeId] : null); } m.resume(); });
  return embWrap;
}

function columns() {
  const b = S.board;
  if (b.mode === 'days') return Array.from({ length: b.dayCount }, (_, i) => { const day = D.add(b.day, i); return { routeId: b.routeId, day, title: fmt.day(day, 'weekday') + ' ' + D.parse(day).getDate(), today: day === D.today() }; });
  return q.visibleRoutes().map(r => ({ routeId: r.id, day: b.day, title: q.routeName(r), color: q.routeColor(r), today: b.day === D.today() }));
}
function step(n) { const b = S.board; if (b.mode === 'month') { const d = D.parse(b.day); d.setDate(1); d.setMonth(d.getMonth() + n); b.day = D.key(d); } else b.day = D.add(b.day, n); keep(undefined, 0); refresh(); }
/** Choose the scroll position for the next render (undefined = stay where we are, null = back to the top). */
function keep(top, left) { const live = scroller && scroller.isConnected && !!scroller.offsetParent && !!scroller.placed; saved = { top: top === undefined ? (live ? scroller.scrollTop : saved.top) : top, left: left === undefined ? (live ? scroller.scrollLeft : saved.left) : left }; scroller = null; }
function refresh() { if (page && page.el.isConnected) page.refresh(); }

/* A driver's default board is their own route for today alone (WD.app.driverRoute, round11b.js).
   5.3 Home. The default board: today, every route side by side (Routes view), the board rather than the map, three routes across, the
   standard card detail, and the routes that were showing when the app opened. Home puts all of that back at once. */
const firstVisible = new WeakMap(), startVisible = r => { if (!firstVisible.has(r)) firstVisible.set(r, !!r.visible); return firstVisible.get(r); };
const boardHome = WD.app.home('board', {
  atHome: () => { const b = S.board, mine = WD.app.driverRoute && WD.app.driverRoute(D.today()); if (mine) return b.day === D.today() && b.mode === 'days' && b.routeId === mine.id && b.dayCount === 1 && b.view === 'board' && !b.split && !b.select && b.detail === 1;
    return b.day === D.today() && b.mode === 'routes' && b.view === 'board' && !b.split && !b.select && b.detail === 1 && (S.desktop || b.cols === 3) && b.dayCount === (S.desktop ? 7 : 3) && q.routes().every(r => !!r.visible === startVisible(r)); },
  reset: () => { const b = S.board; q.routes().forEach(r => { r.visible = startVisible(r); }); Object.assign(b, { day: D.today(), mode: 'routes', view: 'board', split: false, select: null, detail: 1, cols: 3, dayCount: S.desktop ? 7 : 3 }); { const mine = WD.app.driverRoute && WD.app.driverRoute(D.today()); if (mine) Object.assign(b, { mode: 'days', routeId: mine.id, dayCount: 1 }); } keep(null, 0); refresh(); WD.changed(); },
});
/* ---------- Header rows ---------- */
function topBar() {
  const b = S.board, today = D.today();
  let title = fmt.day(b.day), sub = fmt.day(b.day, 'rel');
  if (b.mode === 'month') { title = fmt.day(b.day, 'month'); sub = showAreas() ? '' : 'All jobs'; }
  else if (b.mode === 'days' && b.dayCount > 1 && !mapOnly()) { title = fmt.day(b.day, 'md') + ' – ' + fmt.day(D.add(b.day, b.dayCount - 1), 'md'); sub = ''; }
  else if (sub === title) sub = '';
  const route = b.mode === 'days' && (b.dayCount > 1 || mapOnly()) && q.route(b.routeId);
  const btn = (ic, label, fn, extra) => h('button.nav-btn', { 'aria-label': label, onclick: e => fn(e.currentTarget) }, extra || icon(ic, 23));
  const unit = b.mode === 'month' ? 'month' : 'day';
  /* Six 44-point buttons and the date do not fit across an iPhone, so AutoRoute is the first tool in the menu (and in each route heading's menu). */
  return h('div.bd-top',
    h('div.bd-date', btn('chevron.left', 'Previous ' + unit, () => step(-1), icon('chevron.left', 20)),
      h('button.t' + (title.length > 11 ? '.long' : ''), { 'aria-label': 'Go to date, showing ' + title, onclick: pickDate }, h('b', title), route ? h('small.rt', ui.dot(q.routeColor(route)), q.routeName(route)) : sub && h('small' + (b.day === today && b.mode !== 'month' ? '.today' : ''), sub)),
      btn('chevron.right', 'Next ' + unit, () => step(1), icon('chevron.right', 20))),
    /* Board ↔ Map (5.1): one button that names the view a tap goes to. On a computer it sits here in the bar; on an iPhone it floats over the
       bottom of the board (viewPill), where there is room for a label, and the date gets the width back. */
    !boardHome.atHome() && btn('house', 'Home: back to the default board', () => { boardHome.reset(); ui.toast('Default board', 'house', 1200); }),
    S.desktop && canMap() && viewBtn(),
    (S.desktop || b.mode === 'month') && btn('magnifyingglass', 'Search', () => jobsScreen().openSearch && jobsScreen().openSearch()),
    btn(null, 'Today', () => { b.day = today; keep(null); refresh(); }, h('span.bd-today', D.parse(today).getDate())),
    WD.can('jobs.edit') && btn('plus', 'New job', () => jobsScreen().openEditor && jobsScreen().openEditor({ day: b.day, routeId: b.mode === 'days' ? b.routeId : (q.visibleRoutes()[0] || q.routes()[0]).id })),
    btn('ellipsis.circle', 'View, routes and more · ' + ({ routes: 'Routes', days: 'Days', month: 'Month' })[b.mode] + ' view', el => boardMenu(el)));
}
/* The day's tools. The menu shows the ones used most and ends in “More…”, which opens the rest as its own menu, so nothing is hidden below a scroll. */
const mainItems = anchor => [!S.desktop && S.board.mode !== 'month' && { label: 'Search jobs…', icon: 'magnifyingglass', onTap: () => jobsScreen().openSearch && jobsScreen().openSearch() },
  ops2().activePlan && ops2().activePlan() && { label: 'Route plan in progress', subtitle: ops2().planProgress(ops2().activePlan()), icon: 'checkmark.circle', onTap: () => WD.nav.push(ops2().planSpec(ops2().activePlan())) },
  WD.can('jobs.edit') && S.board.mode !== 'month' && { label: 'AutoRoute…', subtitle: 'Work out the best stop order', icon: 'sparkles', onTap: () => jobsScreen().openAutoRoute && jobsScreen().openAutoRoute(S.board.mode === 'days' ? S.board.routeId : null, { day: S.board.day }) },
  WD.can('jobs.edit') && WD.r9 && S.board.mode !== 'month' && { label: 'Select jobs to move…', subtitle: 'Several jobs to another route, day or both', icon: 'checkmark.circle', onTap: () => { S.board.select = new Set(); refresh(); } },
  { label: 'More…', icon: 'ellipsis.circle', onTap: () => { if (anchor.isConnected) ui.menu(anchor, [{ header: 'More for this day' }, ...moreItems()]); } }];
const moreItems = () => [
  WD.can('jobs.edit') && WD.r11 && S.board.mode !== 'month' && { label: 'Add a note for the driver or office…', icon: 'note', onTap: () => WD.r11.pickNoteRoute(S.board.mode === 'days' ? [S.board.routeId] : q.visibleRoutes().map(r => r.id), S.board.day) },
  { label: 'Pending changes' + (S.pending.length ? ' (' + S.pending.length + ')' : ''), icon: 'sync', onTap: () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending() },
  { label: 'Refresh', icon: 'arrow.clockwise', onTap: async () => { if (S.offline) return ui.toast('Offline — showing saved jobs', 'wifi.slash'); ui.toast('Checking for changes…'); await WD.delay(900, 1400); ui.toast('Up to date', 'checkmark'); } },
  WD.aip && WD.aip.on() && WD.can('jobs.edit') && ops2().routeReviewSpec && { label: 'AI route review…', subtitle: 'How to schedule and run the recurring routes', icon: 'sparkles', onTap: () => WD.nav.push(ops2().routeReviewSpec()) },
  WD.biz && S.board.mode !== 'month' && { label: 'Load sheet and truck capacity', icon: 'shippingbox', onTap: () => WD.nav.push(WD.biz.loadSpec(S.board.day)) },
  WD.can('jobs.edit') && WD.ops && { label: 'Holidays and schedule changes', icon: 'calendar', onTap: () => WD.ops.openSchedule() },
  'divider',
  WD.can('jobs.edit') && WD.ops && { label: 'Move a route’s jobs…', subtitle: 'Unfinished jobs to another day, another route, or both', icon: 'arrow.left.arrow.right', onTap: () => WD.ops.moveSheet({ routeId: S.board.mode === 'days' ? S.board.routeId : q.visibleRoutes().length === 1 ? q.visibleRoutes()[0].id : (q.visibleRoutes()[0] || q.routes()[0]).id, from: S.board.day }) },
  WD.r8 && { label: 'Postponed, no date yet' + (WD.r8.postponed().length ? ' (' + WD.r8.postponed().length + ')' : ''), icon: 'clock', onTap: () => WD.r8.openPostponed() }];
/* One menu holds what used to be a second header row: the view (Routes / Days / Month), which routes show, how much each card shows, and the day's tools. */
function boardMenu(anchor) {
  const b = S.board; let m;
  const seg = (opts, val, fn) => ({ node: h('div.bd-mseg', ui.segmented(opts, val, v => { fn(v); m && m.close(); })) });
  m = ui.menu(anchor, [
    seg([{ value: 'routes', label: 'Routes' }, { value: 'days', label: 'Days' }, { value: 'month', label: 'Month' }], b.mode, v => { b.mode = v; if (v === 'month') b.view = 'board'; if (v === 'days' && !b.routeId) b.routeId = (q.visibleRoutes()[0] || q.routes()[0]).id; keep(undefined, 0); refresh(); }),
    /* Month only: what the calendar shows. Jobs, or the area plan (which areas on which days, no jobs). */
    ...(b.mode === 'month' && WD.areas ? [{ header: 'Show on the calendar' }, seg([{ value: 'areas', label: 'Plan' }, { value: 'jobs', label: 'All jobs' }], showAreas() ? 'areas' : 'jobs', v => { b.monthShow = v; refresh(); })] : []),
    ...(b.mode === 'days' ? [{ header: 'Route' }, ...q.routes().map(r => ({ label: q.routeName(r), checked: r.id === b.routeId, onTap: () => { b.routeId = r.id; refresh(); } })),
        /* A computer has room for a working week, a full week or two weeks; narrow columns scroll sideways. */
        ...(S.desktop ? [{ header: 'Days on screen' }] : []),
        seg(S.desktop ? [1, 3, 5, 7, 14].map(n => ({ value: n, label: String(n) })) : [{ value: 1, label: '1 day' }, { value: 3, label: '3 days' }], b.dayCount, v => { b.dayCount = v; keep(undefined, 0); refresh(); })]
      : [{ header: 'Routes on the board · tap to show or hide' },
        { node: h('div.bd-rchips', q.routes().map(r => { const el = h('button' + (r.visible ? '.on' : ''), { style: { '--c': q.routeColor(r) }, 'aria-pressed': String(!!r.visible), onclick: () => { r.visible = !r.visible; el.classList.toggle('on', r.visible); el.setAttribute('aria-pressed', String(r.visible)); WD.changed(); } }, ui.dot(q.routeColor(r)), h('span', q.routeName(r))); return el; })) },
        /* How many routes share the screen. A number sets the column width and the rest scroll sideways; All fits every route shown. */
        /* On a computer every route shown sits side by side, so there is nothing to choose. */
        ...(S.desktop ? [] : [{ header: 'Routes on screen · All fits every one' },
        seg([1, 2, 3, 4, 5].filter(n => n <= Math.max(3, Math.min(5, q.visibleRoutes().length))).map(n => ({ value: n, label: String(n) })).concat({ value: 'all', label: 'All' }), b.cols, v => { b.cols = v; keep(undefined, 0); refresh(); })])]),
    ...(S.desktop && b.mode !== 'month' && WD.screens.map && WD.screens.map.create ? [{ label: 'Board and map side by side', subtitle: 'The map of the same day on the right', icon: 'map', checked: !!b.split && b.view !== 'map', onTap: () => { b.split = !(b.split && b.view !== 'map'); b.view = 'board'; keep(undefined, 0); refresh(); } }] : []),
    ...(b.mode !== 'month' ? [{ header: 'Card detail · or pinch the board' }, seg(DETAIL.map((label, value) => ({ value, label: label.replace(' detail', '') })), b.detail, v => setDetail(v, true))] : []),
    'divider', ...mainItems(anchor),
  ], { compact: true });
}
/* Warning lines: one shows as it is; two or more fold into a single row ("3 issues · Review") that opens the list in place.
   Red and orange lines are issues; gray ones (who is driving, a schedule mark) are notes. */
let stripsOpen = false;
function strips(list) {
  list = list.flat(Infinity).filter(x => x instanceof Element);
  list.forEach(x => { if (x.style.cursor === 'default') return; x.setAttribute('role', 'button'); x.tabIndex = 0; x.addEventListener('keydown', keyClick); });
  if (list.length < 2) return list;
  const col = x => x.style.getPropertyValue('--c'), color = ['var(--red)', 'var(--orange)'].find(c => list.some(x => col(x) === c)) || 'var(--gray)';
  const issues = list.filter(x => col(x) !== 'var(--gray)').length, notes = list.length - issues, count = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const box = h('div.bd-fold-list', { hidden: !stripsOpen }, list), act = h('span', stripsOpen ? 'Hide' : 'Review');
  const sum = h('div.bd-strip.sum' + (stripsOpen ? '.open' : ''), { style: { '--c': color }, role: 'button', tabindex: '0', 'aria-expanded': String(stripsOpen), onkeydown: keyClick,
    onclick: () => { stripsOpen = !stripsOpen; box.hidden = !stripsOpen; sum.classList.toggle('open', stripsOpen); sum.setAttribute('aria-expanded', String(stripsOpen)); act.textContent = stripsOpen ? 'Hide' : 'Review'; } },
    icon('exclamationmark.triangle', 16), (issues ? count(issues, 'issue') : '') + (issues && notes ? ' · ' : '') + (notes ? count(notes, 'note') : ''), h('span.bd-strip-n', { 'aria-hidden': 'true' }, list.map(x => h('i', { style: { background: col(x) } }))), h('span.spacer'), act, icon('chevron.down', 13));
  return h('div.bd-fold', sum, box);
}
function statusStrip() {
  const conflicts = S.pending.filter(o => o.status === 'conflict').length, n = S.pending.length;
  if (!S.offline && !n) return null;
  const open = () => WD.screens.settings && WD.screens.settings.openPending && WD.screens.settings.openPending();
  if (conflicts) return h('div.bd-strip', { style: { '--c': 'var(--red)' }, onclick: open }, icon('exclamationmark.triangle', 16), conflicts + (conflicts === 1 ? ' change needs' : ' changes need') + ' review', h('span.spacer'), 'Review', icon('chevron.right', 13));
  if (S.offline) return h('div.bd-strip', { style: { '--c': 'var(--orange)' }, onclick: open }, icon('wifi.slash', 16), n ? 'Offline · ' + n + (n === 1 ? ' change' : ' changes') + ' saved on this iPhone' : 'Offline · showing saved jobs', h('span.spacer'), n ? icon('chevron.right', 13) : null);
  return h('div.bd-strip', { style: { '--c': 'var(--gray)' }, onclick: open }, ui.spinner(14), 'Syncing ' + n + (n === 1 ? ' change…' : ' changes…'));
}
/** Upcoming jobs saved without the address their type needs: review, fix or ignore them. */
function addressStrip() {
  const n = WD.missingAddresses().filter(inView).length; if (!n) return null;
  return h('div.bd-strip', { style: { '--c': 'var(--red)' }, onclick: () => WD.x.missingSheet({ inView, label: viewLabel() }) }, icon('mappin', 16), n + (n === 1 ? ' job here is' : ' jobs here are') + ' missing an address', h('span.spacer'), 'Review', icon('chevron.right', 13));
}
/** What the warning lines are about, for the heading of a review list: the day showing, the days showing, or the month. */
function viewLabel() { const b = S.board; if (b.mode === 'month') return fmt.day(b.day, 'month'); const days = [...new Set(columns().map(c => c.day))].sort();
  return days.length > 1 ? fmt.day(days[0], 'md') + ' – ' + fmt.day(days[days.length - 1], 'md') : fmt.day(days[0] || b.day, 'long'); }
/** Approved time off for the driver of a column's route on its day. */
const offFor = c => WD.offOn(WD.rc && WD.rc.driverOn ? (WD.rc.driverOn(c.routeId, c.day) || {}).id : (q.route(c.routeId) || {}).driverId, c.day);
/** Warning lines only speak up for what is on screen: the day(s) and route(s) showing, or the month showing. */
function inView(job) { const b = S.board; if (!job) return false;
  if (b.mode === 'month') return job.day.slice(0, 7) === b.day.slice(0, 7) && q.visibleRoutes().some(r => r.id === job.routeId);
  return columns().some(c => c.routeId === job.routeId && c.day === job.day); }
const offText = (c, t) => (q.user(t.userId) || { name: 'Driver' }).name.split(' ')[0] + ' off' + (t.fromTime ? ' ' + shortT(fmt.fromHHMM(t.fromTime)) + '–' + shortT(fmt.fromHHMM(t.untilTime || '17:00')) : '');
/** With a single column there is no header row, so time off shows as a bar instead. */
function markStrip() {
  const cols = S.board.mode === 'month' ? [] : columns(); if (cols.length !== 1 || !WD.dayMark) return null; const m = WD.dayMark(cols[0].routeId, cols[0].day); if (!m) return null;
  return h('div.bd-strip', { style: { '--c': m.kind === 'holiday' ? 'var(--red)' : m.kind === 'purgeOnly' ? 'var(--orange)' : 'var(--gray)' }, onclick: () => WD.ops && WD.ops.openSchedule() }, icon('calendar', 16), m.label + (m.kind === 'holiday' ? ' · holiday' : ''), h('span.spacer'), icon('chevron.right', 13));
}
function offStrip() {
  const cols = S.board.mode === 'month' ? [] : columns(); if (cols.length !== 1) return null; const t = offFor(cols[0]); if (!t) return null;
  return h('div.bd-strip', { style: { '--c': 'var(--red)', cursor: 'default' } }, icon('person', 16), (q.user(t.userId) || { name: 'The driver' }).name + ' has approved time off · ' + WD.timeOffLabel(t));
}

/* ---------- Ordered lists ---------- */
/* Colors: the route (calendar) color is the left edge and the stop number. --c (the job-type color) is only used by the optional filled styles. */
/* Linked columns (desktop workspace): the first click on a stop shows it in the columns beside the board (the map zooms to it, Customers opens the record)
   and marks the card; a second click on the same card opens the job. With one column, or on an iPhone, a click opens the job as before. */
let linkedId = null, linkTold = false;
function openJob(job) {
  if (linkedId !== job.id && WD.app.linkSelect && WD.app.linkSelect({ from: 'board', jobId: job.id, customerId: job.customerId, routeId: job.routeId, day: job.day })) {
    linkedId = job.id; refresh(); if (!linkTold) { linkTold = true; ui.toast('Shown in the other columns. Click it again to open the job.', 'columns', 3200); } return; }
  linkedId = null; jobsScreen().openDetails && jobsScreen().openDetails(job.id); }
const cardStyle = job => { const c = WD.cardColor(job), ring = q.routeColor(job.routeId); return { '--c': c, '--ring': ring, '--fg': readableOn(c), '--nfg': readableOn(ring) }; };
/* Card detail: pinch vertically on the board (or ⌘/ctrl-scroll, or the routes menu) — 0 shows more jobs with just the name, 2 shows fewer jobs with everything a dispatcher needs. Addresses are left off; they're one tap away. */
const DETAIL = ['Less detail', 'Standard', 'More detail'];
if (S.board.detail == null) S.board.detail = 1;
const shortT = m => { const hh = Math.floor(m / 60), mm = m % 60; return (hh % 12 || 12) + (mm ? ':' + String(mm).padStart(2, '0') : '') + (hh < 12 ? 'a' : 'p'); };
function facts(job, full) {
  const out = [], items = WD.itemsLabel(job.items, job.type === 'purge'), est = job.type === 'purge' && job.purge && WD.purgeEstimate(job.purge), m = fmt.fromHHMM;
  if (items) out.push(['shippingbox', items]); else if (job.containers) out.push(['shippingbox', job.containers]);
  if (job.exactAt) out.push(['clock', 'Exactly ' + shortT(m(job.exactAt))]);
  else if (job.custFrom || job.custUntil) out.push(['clock', (job.windowBy === 'us' ? 'Told ' : 'Asked ') + (job.custFrom ? shortT(m(job.custFrom)) : 'any') + '–' + (job.custUntil ? shortT(m(job.custUntil)) : 'any') + (job.custStrict ? ' · required' : '')]);
  else if (job.needsWindow) out.push(['clock', 'Needs window']);
  if (est && est.minutes) out.push(['timer', (est.guess ? est.low + '–' + est.high : est.minutes) + ' min on site']); else if (job.dur && full) out.push(['timer', '~' + WD.siteMinutes(job).minutes + ' min on site']);
  return out;
}
/** The heads-up facts that used to trail the title and get cut off ("Early service", "Closed Mon", "Call 15m ahead"): each gets its own line. */
const keyFacts = job => { const wf = WD.workflow; return wf && wf.titleDetails ? wf.titleDetails(job) : []; };
const hasWindow = key => key.some(k => /^(Told|Asked|Needs window)/.test(k));
function details(job, key) {
  const c = job.customerId && q.customer(job.customerId), p = c && c.contacts[0], out = [];
  out.push(h('div.bd-job-sub', q.jobType(job.type).title));
  facts(job, true).filter(x => !(x[0] === 'clock' && hasWindow(key))).forEach(([ic, t]) => out.push(h('div.bd-job-sub', icon(ic, 11), ' ', t)));
  if (job.callAhead && !key.some(k => /^Call /.test(k))) out.push(h('div.bd-job-sub', icon('phone', 11), ' Call ' + (job.callAhead === 60 ? '1 hr' : job.callAhead + ' min') + ' ahead'));
  if (p || job.phone) out.push(h('div.bd-job-sub', icon('person', 11), ' ', p ? p.name : job.contactName || fmt.phone(job.phone, job.ext)));
  if (job.po) out.push(h('div.bd-job-sub', 'PO ' + job.po));
  if (job.notes) out.push(h('div.bd-job-note', job.notes));
  return out;
}
/** Why dispatch should stop and look: the route's driver or truck is not cleared for this job (round 11's "bad" issues). */
const blockers = job => !WD.closed[job.status] && WD.r11 && WD.r11.issues ? WD.r11.issues(job).filter(i => i.level === 'bad') : [];
function cell(job, number, ci) {
  const type = q.jobType(job.type), done = job.status === 'completed', st = { enroute: 'truck', arrived: 'mappin', skipped: 'xmark', canceled: 'xmark', rescheduled: 'calendar', postponed: 'clock' }[job.status], struck = WD.struck[job.status];
  const tag = { skipped: 'Skipped', canceled: 'Canceled', rescheduled: 'Rescheduled', postponed: 'Postponed' }[job.status];
  const wf = WD.workflow, notBilled = done && !wf.billed(job) && job.type !== 'meet', noAddr = !WD.closed[job.status] && WD.addressIssue(job);
  const cls = WD.cardClass ? WD.cardClass(job) : '', unpaid = /\.unpaid\b/.test(cls), bad = blockers(job), off = WD.calledOff(job), picking = S.board.select, picked = !!picking && picking.has(job.id);
  const key = keyFacts(job), fx = facts(job).filter(x => !(x[0] === 'clock' && hasWindow(key)));
  /* What VoiceOver reads: "Stop 4, Summit Physical Therapy, scheduled", then anything that needs attention. */
  const say = [off ? 'Called off' : 'Stop ' + number, job.title, ((WD.jobStatuses[job.status] || {}).title || job.status).toLowerCase(), ...key, notBilled && 'not billed', noAddr, unpaid && 'unpaid invoices', ...bad.map(i => i.short), job.pending && 'change still syncing', q.routeName(job.routeId)].filter(Boolean).join(', ');
  return h('div.bd-job.' + job.status + cls + (bad.length ? '.blocked' : '') + (struck ? '.struck' : '') + (off ? '.calledoff' : '') + (wf.dimmed(job) ? '.faded' : '') + (job.pending ? '.pending' : '') + (drag && drag.job.id === job.id ? '.dragging' : '') + (flashId === job.id ? '.flash' : '') + (linkedId === job.id ? '.linked' : '') + (picked ? '.sel' : ''),
    { 'data-job': job.id, style: cardStyle(job), role: 'button', tabindex: '0', 'aria-label': say, 'aria-pressed': picking ? String(picked) : null },
    h('div.bd-job-in', h('span.bd-num', { 'aria-hidden': 'true' }, number),
      h('div.bd-job-main', ci && h('div.bd-time', ci.time || 'No time'), h('div.bd-job-title', !job.located && job.address && job.type !== 'meet' ? h('span.bd-q', '?') : null, done ? h('span.bd-done', icon('checkmark', 11)) : st && icon(st, 12), job.pending && icon('sync', 11), job.title, job.recurring ? h('span', { style: 'font-weight:400' }, ' ↻') : null),
        key.length ? h('div.d12', key.map(k => h('div.bd-job-key', k))) : null,
        ci && ci.overlap && !WD.closed[job.status] ? h('div.bd-tag.ov', ci.overlap) : null,
        tag ? h('div.bd-tag', tag + (job.rescheduledTo ? ' · ' + fmt.day(job.rescheduledTo, 'md') : '')) : notBilled ? h('div.bd-tag.nb', 'Not billed') : noAddr ? h('div.bd-tag.na', noAddr) : job.offWindow && !WD.closed[job.status] ? h('div.bd-tag.na', { title: job.offWindow }, 'Outside window') : null,
        WD.cardTags && !WD.closed[job.status] && (t => t.length ? h('div.d12', t) : null)(WD.cardTags(job)),
        /* 5.3: every stop shows its ETA, worked out again as the day goes on; red when it falls outside the time the customer was given. */
        !tag && !WD.closed[job.status] && WD.eta && WD.eta.cardChip(job),
        !tag && job.type !== 'regular' && h('div.d12', h('span.bd-type', type.title)),
        !tag && h('div.bd-job-sub.d1', fx.map(x => x[1]).join(' · ') || (key.length || job.type !== 'regular' ? null : type.title)),
        !tag && h('div.d2', details(job, key)))),
    picking && canSelect(job) && h('span.bd-check', icon('checkmark', 11)));
}
/* ---------- Selecting several jobs to move together ---------- */
const canSelect = job => job.status === 'scheduled' && !job.pending && !job.allDay;
function toggleSelect(job) { const sel = S.board.select; if (!canSelect(job)) return ui.toast(lockedReason(job), 'lock', 2400); if (sel.has(job.id)) sel.delete(job.id); else sel.add(job.id); refresh(); }
let pickShown = false;
function selectBar() {
  const sel = S.board.select; if (!sel) { pickShown = false; return null; }
  [...sel].forEach(id => { const j = q.job(id); if (!j || !canSelect(j)) sel.delete(id); });
  const shown = S.board.mode === 'month' ? [] : columns().flatMap(c => q.stopList(c.routeId, c.day).filter(canSelect)), all = shown.length > 0 && shown.every(j => sel.has(j.id)), first = !pickShown; pickShown = true;
  /* The slide-in plays once, when select mode starts, not on every tap. */
  return h('div.bd-pick' + (first ? '.in' : ''), { role: 'toolbar', 'aria-label': 'Select jobs to move' }, h('button', { onclick: () => { S.board.select = null; refresh(); } }, 'Cancel'),
    h('span.n', { 'aria-live': 'polite' }, sel.size ? [h('b', String(sel.size)), 'selected'] : 'Tap jobs to select'),
    h('button', { disabled: !shown.length, onclick: () => { shown.forEach(j => all ? sel.delete(j.id) : sel.add(j.id)); refresh(); } }, all ? 'Deselect all' : 'Select all'),
    h('button.go', { disabled: !sel.size, onclick: () => WD.r9.batchMove([...sel], () => { S.board.select = null; refresh(); }) }, 'Move…'));
}
/** The detail level the cards really use: what was chosen, held down when the columns are too narrow for it. */
const shownDetail = () => Math.min(S.board.detail, layout.cap == null ? 2 : layout.cap);
/** Opening a card or control without a pointer: the keyboard, or VoiceOver's double tap (which sends a click and no pointer events). */
function activate(t) {
  if (t.matches('.bd-job')) { const j = q.job(t.dataset.job); if (!j) return; if (S.board.select) toggleSelect(j); else openJob(j); }
  else if (t.matches('.bd-add')) addStop(t.closest('.bd-col')); else t.click();
}
function onKey(e) { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target; if (!t.matches || !t.matches('.bd-job, .bd-colhead, .bd-add, .bd-chip, .bd-rnote')) return; e.preventDefault(); activate(t); }
function onClick(e) { if (Date.now() - lastDown < 1200) return; const t = e.target.closest && e.target.closest('.bd-job, .bd-add'); if (t) activate(t); }
function grid() {
  const b = S.board, cols = columns(), O2 = ops2(), cal = calendar(), desk = !!S.desktop, timeGrid = cal && desk && !!O2.timeGrid, gutter = timeGrid ? 58 : 0;
  const W = Math.floor((page.body.clientWidth || 393) * (splitView() ? .6 : 1)) - gutter;
  if (cal && O2.ensureTimes) O2.ensureTimes();
  /* A computer shows the cards at full detail the first time; the menu and pinch still change it. */
  if (desk && !b.deskDetail) { b.deskDetail = true; b.detail = 2; }
  if (!cols.length) return h('div', { style: 'flex:1;background:var(--cell);border-top:.5px solid var(--sep)' }, ui.empty({ icon: 'columns', title: 'No routes selected', text: 'Choose which routes appear on the board.', action: ui.button('Choose routes', { kind: 'tinted', block: false, small: true, onTap: (e, el) => boardMenu(el) }) }));
  /* Routes view: the menu says how many routes share the screen (All = every one, no sideways scrolling). When more are selected than fit,
     the columns give up 22 points so the next one peeks in. Days view always fits its one or three days. */
  const per = b.mode === 'routes' && b.cols !== 'all' ? clamp(+b.cols || 3, 1, cols.length) : cols.length, peek = cols.length > per ? 22 : 0;
  /* On a computer every column is on screen at once, at least 170 points wide; more than fit scroll sideways. */
  /* In a narrow workspace column the board shows one or two routes at a readable width and the rest scroll sideways. */
  const colW = desk ? Math.max(W < 620 ? Math.min(W, 230) : 170, Math.floor(W / cols.length)) : Math.floor((W - peek) / per), showHead = cols.length > 1, today = D.today(), canEdit = WD.can('jobs.edit');
  /* Narrow columns hold less: under 110 points the cards stop at Standard, under 84 at names only. */
  layout = { cols, colW, cap: colW < 84 ? 0 : colW < 110 ? 1 : 2 };
  /* Calendar scheduling lists each day by start time; jobs with no time come last under “No time set”. Stop order is untouched otherwise. */
  const lists = cols.map(c => ({ notes: q.jobsFor(c.routeId, c.day).filter(j => j.allDay), stops: cal && O2.byTime ? O2.byTime(q.stopList(c.routeId, c.day)) : q.stopList(c.routeId, c.day) }));
  /* A wide column has room beside the name: the name is larger and the day's notes sit to its right, so the stops start higher. */
  const roomy = colW >= 260 && !timeGrid, single = cols.length === 1;
  const noteNodes = (c, i, inHead) => [(n => n && h('div.bd-rnote', { 'data-note': i, role: 'button', tabindex: '0', onclick: e => { e.stopPropagation(); if (WD.can('jobs.edit')) WD.r11.editNote(c.routeId, c.day); } }, inHead ? h('b', n.to === 'office' ? 'Office: ' : n.to === 'driver' ? 'Driver: ' : 'Driver and office: ') : h('small', n.to === 'office' ? 'Note for the office' : n.to === 'driver' ? 'Note for the driver' : 'Note for the driver and office'), n.text))(WD.r11 && WD.r11.noteFor(c.routeId, c.day)),
    lists[i].notes.map(j => h('div.bd-chip', { style: { '--c': q.routeColor(j.routeId) }, role: 'button', tabindex: '0', 'aria-label': 'Note for the day, ' + j.title, onclick: e => { e.stopPropagation(); jobsScreen().openDetails && jobsScreen().openDetails(j.id); } }, icon('note', 11), j.title))].flat().filter(Boolean);
  const anyNotes = roomy && cols.some((c, i) => noteNodes(c, i, true).length), headOn = showHead || timeGrid || (roomy && (b.mode === 'routes' || anyNotes));
  const headCell = (c, i) => { const n = lists[i].stops.filter(j => !WD.calledOff(j)).length, name = single && b.mode === 'days' ? q.routeName(c.routeId) : c.title, hn = roomy ? noteNodes(c, i, true) : [];
    const parts = [(c.color || (single && b.mode === 'days')) && ui.dot(c.color || q.routeColor(c.routeId)), h('span.n', name), WD.rc && WD.rc.headTag && WD.rc.headTag(c), (t => t && h('span.bd-offrow', h('span.bd-off', { title: WD.timeOffLabel(t) }, offText(c, t))))(offFor(c)), (m => m && h('span.bd-offrow', h('span.bd-off.' + m.kind, { title: m.label }, m.label)))(WD.dayMark && WD.dayMark(c.routeId, c.day)), (x => x && h('span.bd-offrow', x))(O2.capChip && O2.capChip(c.routeId, c.day)),
      h('span.c', (d => d ? 'Leave ' + shortT(d.depart) + ' · ' : '')(data.routeDays[c.routeId + '|' + c.day]) + (roomy ? n + (n === 1 ? ' stop' : ' stops') : n))];
    return h('div.bd-colhead' + (c.today && b.mode === 'days' && !single ? '.today' : '') + (roomy ? '.roomy' : '') + (roomy && single ? '.single' : ''), { style: { width: colW + 'px' }, role: 'button', tabindex: '0', 'aria-label': name + ', ' + n + ' stops. Notes, driver and AutoRoute for this ' + (b.mode === 'days' ? 'day' : 'route'), onclick: e => { if (e.currentTarget.dataset.held) { delete e.currentTarget.dataset.held; return; } colMenu(e.currentTarget, c); }, onpointerdown: e => holdHead(e, c), oncontextmenu: e => e.preventDefault() },
      roomy ? [h('div.bd-hname' + (hn.length ? '' : '.alone'), parts), hn.length > 0 && h('div.bd-hnotes' + (hn.length > 1 ? '.many' : ''), hn)] : parts); };
  const head = headOn && h('div.bd-head', h('div.bd-hrow', timeGrid && h('div', { style: { width: gutter + 'px', flex: 'none' } }), cols.map(headCell)));
  /* Calendar scheduling on a computer: a true time grid, hours down the side and each job placed by its start time and length (r14-ops.js). */
  if (timeGrid) {
    const tg = O2.timeGrid({ cols, colW, gutter, head, lists, style: cardStyle, open: id => jobsScreen().openDetails && jobsScreen().openDetails(id), add: canEdit ? (c, startAt) => jobsScreen().openEditor && jobsScreen().openEditor({ day: c.day, routeId: c.routeId, startAt }) : null });
    const sc = scroller = tg.scroller, top0 = saved.top, left0 = saved.left;
    requestAnimationFrame(() => { if (!sc.isConnected) return; sc.scrollTop = top0 == null ? tg.startTop : top0; sc.scrollLeft = left0 || 0; });
    return h('div.bd-wrap', sc);
  }
  const body = h('div.bd-body', cols.map((c, i) => {
    const { stops } = lists[i], firstUntimed = cal ? stops.find(j => !j.startAt && !WD.calledOff(j)) : null;
    return h('div.bd-col' + (c.day < today ? '.past' : ''), { 'data-i': i, style: { width: colW + 'px' } },
      !(roomy && headOn) && noteNodes(c, i, false),
      (k => stops.map(j => [j === firstUntimed && h('div.bd-notime', 'No time set'), cell(j, WD.calledOff(j) ? '–' : ++k, cal && O2.calInfo ? O2.calInfo(j, stops) : null)]))(0),
      !stops.length && h('div.bd-empty', 'No stops'),
      canEdit && h('div.bd-add', { 'data-add': i, role: 'button', tabindex: '0', 'aria-label': 'Add stop to ' + c.title }, icon('plus', 13), h('span.l', 'Add stop')));
  }));
  const el = scroller = h('div.bd-scroll.lvl' + shownDetail() + (colW < 110 ? '.narrow' : '') + (colW < 84 ? '.tiny' : '') + (S.board.select ? '.selecting' : ''), h('div.bd-content', { style: { width: colW * cols.length + 'px' } }, head, body));
  /* "1 more →": how many routes are still off the right edge. Tapping it brings the next screenful; it goes away at the end. */
  const more = cols.length > per && h('button.bd-morecols', { hidden: true, onclick: () => { const left = Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + colW * per); el.scrollTo ? el.scrollTo({ left, behavior: 'smooth' }) : (el.scrollLeft = left); } });
  const syncMore = () => { if (!more) return; const n = Math.ceil((el.scrollWidth - el.clientWidth - el.scrollLeft) / colW - .15); more.hidden = n < 1; if (n > 0) { more.textContent = n + ' more →'; more.setAttribute('aria-label', 'Show ' + n + ' more ' + (b.mode === 'days' ? 'day' : 'route') + (n === 1 ? '' : 's')); } };
  if (more) el.addEventListener('scroll', syncMore, { passive: true });
  el.addEventListener('scroll', () => { if (el === scroller && el.offsetParent && el.placed) saved = { top: el.scrollTop, left: el.scrollLeft }; }, { passive: true });
  el.addEventListener('pointerdown', onPointerDown); el.addEventListener('wheel', onWheel, { passive: false }); el.addEventListener('keydown', onKey); el.addEventListener('click', onClick);
  el.addEventListener('touchstart', touchStart, { passive: false }); el.addEventListener('touchmove', touchMove, { passive: false }); el.addEventListener('touchend', touchEnd); el.addEventListener('touchcancel', touchEnd);
  const top = saved.top, left = saved.left, reveal = revealId; revealId = null;
  requestAnimationFrame(() => {
    if (!el.isConnected) return; el.scrollTop = top == null ? 0 : top; el.scrollLeft = left; if (el.offsetParent) el.placed = true; syncMore();
    const target = reveal && el.querySelector('.bd-job[data-job="' + reveal + '"]');
    if (target) { const r = target.getBoundingClientRect(), box = el.getBoundingClientRect(); if (r.bottom > box.bottom - 10 || r.top < box.top + 30) el.scrollTop += r.top - box.top - box.height / 3; const cx = r.left - box.left; if (cx < 0 || cx + r.width > box.width) el.scrollLeft += cx - 4; }
    if (drag) { el.querySelector('.bd-body').append(drag.ghost); drag.target = null; dragMove(drag.last); }
  });
  if (flashId) setTimeout(() => { flashId = null; }, 1900);
  return h('div.bd-wrap', el, more);
}

/* ---------- Pinch: changes how much each card shows ----------
   The level follows the size of the pinch from where it started (each 35% wider or narrower is one step), so the same motion always
   gives the same result and it can be reversed without lifting. It reads the live touch list, so a finger that lifted is never counted,
   and the board is not rebuilt while two fingers are down. */
let pinch = null, pinchAt = 0, staleWhilePinching = false, wheelAcc = 0, wheelAt = 0;
const PINCH_STEP = Math.log(1.35);
const spread = e => Math.max(40, Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY));
function setDetail(n, hud) {
  n = clamp(n, 0, DETAIL.length - 1); if (n === S.board.detail) return; S.board.detail = n;
  const el = scroller && scroller.isConnected ? scroller : null;
  if (el) { const at = el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0; el.classList.remove('lvl0', 'lvl1', 'lvl2'); el.classList.add('lvl' + shownDetail()); el.scrollTop = at * Math.max(0, el.scrollHeight - el.clientHeight); } else refresh();
  if (page) page.body.querySelectorAll('.bd-zoombtns button').forEach((b, i) => { b.disabled = i ? n >= DETAIL.length - 1 : n <= 0; });
  if (hud && page) { const old = page.body.querySelector('.bd-zoom'); if (old) old.remove(); const z = h('div.bd-zoom', DETAIL[n] + (shownDetail() < n ? ' · shows once fewer routes share the screen' : '')); page.body.style.position = 'relative'; page.body.appendChild(z); setTimeout(() => z.remove(), 700); }
}
function endPinch() { if (!pinch) return; pinch = null; pinchAt = Date.now(); if (staleWhilePinching) { staleWhilePinching = false; refresh(); } }
function touchStart(e) { if (e.touches.length === 2 && !drag) { pinch = { d0: spread(e), level: S.board.detail }; pinchAt = Date.now(); if (e.cancelable) e.preventDefault(); } else endPinch(); }
function touchMove(e) {
  if (drag) { if (e.cancelable) e.preventDefault(); return; } if (!pinch) return; if (e.touches.length !== 2) return endPinch();
  if (e.cancelable) e.preventDefault(); pinchAt = Date.now(); const steps = Math.log(spread(e) / pinch.d0) / PINCH_STEP;
  setDetail(pinch.level + (steps >= 0 ? Math.floor(steps) : Math.ceil(steps)), true);
}
function touchEnd(e) { if (e.touches.length < 2) endPinch(); }
/** Trackpad pinch (ctrl-wheel) does the same on a Mac. */
function onWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const t = Date.now(); if (t - wheelAt > 400) wheelAcc = 0; wheelAt = t; wheelAcc += e.deltaY;
  if (wheelAcc < -35) { wheelAcc = 0; setDetail(S.board.detail + 1, true); } else if (wheelAcc > 35) { wheelAcc = 0; setDetail(S.board.detail - 1, true); }
}

/* ---------- Tap, swipe and drag ---------- */
function onPointerDown(e) {
  lastDown = Date.now();
  if (e.button > 0 || e.target.closest('.bd-chip, .bd-rnote') || drag || pinch) return;
  if (S.board.select) { const c0 = e.target.closest('.bd-job'), j0 = c0 && q.job(c0.dataset.job), x0 = e.clientX, y0 = e.clientY; if (!j0) return;
    const up0 = ev => { lastDown = Date.now(); document.removeEventListener('pointerup', up0); if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 9 && S.board.select) toggleSelect(j0); }; document.addEventListener('pointerup', up0); return; }
  const cellEl = e.target.closest('.bd-job'), colEl = e.target.closest('.bd-col'), addEl = e.target.closest('.bd-add'), sx = e.clientX, sy = e.clientY, touch = e.pointerType === 'touch', el = scroller;
  const job = cellEl && q.job(cellEl.dataset.job), canDrag = job && WD.can('jobs.edit') && !job.pending && (job.status === 'scheduled' || job.status === 'enroute');
  /* A stop that can't move says why when you try to drag it (hold on touch, drag with a mouse), instead of doing nothing. */
  const locked = job && WD.can('jobs.edit') && !canDrag && lockedReason(job);
  let moved = false, active = false, held = false, timer = null;
  const begin = ev => { active = true; startDrag(job, cellEl, ev); };
  if (touch && (canDrag || locked)) timer = setTimeout(() => { if (pinch || Date.now() - pinchAt < 400) return; if (canDrag) begin(e); else { held = true; ui.toast(locked, 'lock', 2400); } }, 380);
  const move = ev => {
    if (!active && !moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 6) { moved = true; if (touch) clearTimeout(timer); else if (canDrag) begin(ev); else if (locked) ui.toast(locked, 'lock', 2400); }
    if (active) { ev.preventDefault(); dragMove(ev); }
  };
  const cleanup = () => { clearTimeout(timer); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel); };
  const up = ev => {
    lastDown = Date.now(); cleanup(); if (active) return dragEnd(); if (pinch || Date.now() - pinchAt < 500) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (held) return;
    if (!moved) { if (job) openJob(job); else if (colEl && WD.can('jobs.edit') && (addEl || !e.target.closest('.bd-empty'))) addStop(colEl); }
    else if (!job && Math.abs(dx) > 70 && Math.abs(dy) < 45 && (dx < 0 ? el.scrollLeft >= el.scrollWidth - el.clientWidth - 2 : el.scrollLeft <= 2)) step(dx < 0 ? 1 : -1);
  };
  const cancel = () => { lastDown = Date.now(); cleanup(); if (active) { drag.ghost.remove(); drag.ins.remove(); drag.slot.remove(); drag = null; refresh(); } };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel);
}
/** Tapping a column's header: a note for that route's day, AutoRoute, or show just that route. */
/** Press and hold a route's heading to assign its driver and truck for that day. */
function holdHead(e, c) { if (!WD.can('jobs.edit') || !WD.rc || !WD.rc.assignSheet) return; const el = e.currentTarget, sx = e.clientX, sy = e.clientY; delete el.dataset.held;
  const off = () => { clearTimeout(t); el.removeEventListener('pointerup', off); el.removeEventListener('pointerleave', off); el.removeEventListener('pointercancel', off); el.removeEventListener('pointermove', mv); }, mv = ev => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 8) off(); };
  const t = setTimeout(() => { off(); el.dataset.held = '1'; WD.rc.assignSheet(c.routeId, c.day); }, 480);
  el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off); el.addEventListener('pointermove', mv); }
function colMenu(el, c) {
  const edit = WD.can('jobs.edit'), has = WD.r11 && WD.r11.noteFor(c.routeId, c.day);
  ui.menu(el, [{ header: q.routeName(c.routeId) + ' · ' + fmt.day(c.day) }, edit && WD.r11 && { label: has ? 'Edit the note' : 'Add a note for the driver or office', icon: 'note', onTap: () => WD.r11.editNote(c.routeId, c.day) },
    edit && WD.rc && WD.rc.assignSheet && { label: 'Assign driver and truck', subtitle: 'Or press and hold the heading', icon: 'person', onTap: () => WD.rc.assignSheet(c.routeId, c.day) },
    edit && { label: 'AutoRoute this route', icon: 'sparkles', onTap: () => jobsScreen().openAutoRoute && jobsScreen().openAutoRoute(c.routeId, { day: c.day }) },
    S.board.mode === 'routes' && { label: 'Show only this route', icon: 'columns', onTap: () => { S.board.mode = 'days'; S.board.routeId = c.routeId; S.board.dayCount = 1; keep(undefined, 0); refresh(); } }], { compact: true });
}
function lockedReason(job) {
  if (job.pending) return 'This stop is still syncing. Try again in a moment.';
  if (job.status === 'rescheduled' && job.rescheduledTo) return 'Rescheduled to ' + fmt.day(job.rescheduledTo) + '. Move the new visit on that day instead.';
  return { completed: 'Completed stops can’t be moved', arrived: 'The driver is at this stop, so it can’t be moved', skipped: 'Skipped stops can’t be moved', canceled: 'Canceled stops can’t be moved', rescheduled: 'Rescheduled stops can’t be moved', postponed: 'Postponed stops can’t be moved' }[job.status] || 'This stop can’t be moved';
}
/** Tapping a column's empty space (or its Add stop button) adds a job at the end of that list. */
function addStop(colEl) { const c = layout.cols[+colEl.dataset.i]; jobsScreen().openEditor && jobsScreen().openEditor({ day: c.day, routeId: c.routeId }); }
function startDrag(job, cellEl, ev) {
  const r = cellEl.getBoundingClientRect(), ghost = cellEl.cloneNode(true); ghost.classList.remove('dragging', 'flash'); ghost.classList.add('bd-ghost');
  const slot = h('div.bd-slot', { style: { height: r.height + 'px', ...cardStyle(job) } }, cellEl.firstChild.cloneNode(true), h('span.bd-land', 'Lands here'));
  drag = { job, ghost, slot, ins: h('div.bd-ins'), grabY: ev.clientY - r.top, height: r.height, last: ev, target: null, edge: 0, edgeAt: 0 };
  cellEl.parentNode.insertBefore(slot, cellEl); cellEl.classList.add('dragging'); scroller.querySelector('.bd-body').append(ghost); dragMove(ev); autoScroll();
}
/** The list slot under the pointer: column i and 0-based index among that list's other jobs. Finished and in-progress stops stay ahead of it. */
function dragMove(ev) {
  if (!drag || !scroller) return; drag.last = ev;
  const body = scroller.querySelector('.bd-body'), { cols, colW } = layout, job = drag.job, p = ui.localPoint(ev, body);
  const i = clamp(Math.floor(p.x / colW), 0, cols.length - 1), colEl = body.children[i]; if (!colEl) return;
  const cards = [...colEl.querySelectorAll('.bd-job:not(.bd-ghost)')].filter(c => c.dataset.job !== job.id), list = cards.map(c => q.job(c.dataset.job)), slot = drag.slot;
  /* Compare with the cards where they are on screen; while the finger is over the landing slot it stays put, so it never jitters. */
  const inCol = slot.parentNode === colEl, onSlot = inCol && p.y >= slot.offsetTop - 2 && p.y <= slot.offsetTop + slot.offsetHeight + 2;
  let index = onSlot && drag.target && drag.target.routeId === cols[i].routeId && drag.target.day === cols[i].day ? drag.target.index : cards.findIndex(c => p.y < c.offsetTop + c.offsetHeight / 2); if (index < 0) index = cards.length;
  /* Called-off visits sit at the bottom: nothing lands below them, and they don't hold later stops in place. */
  const live = list.filter(j => j && !WD.calledOff(j)).length, locked = list.reduce((n, j, k) => j && !WD.calledOff(j) && !['scheduled', 'enroute'].includes(j.status) ? k + 1 : n, 0); index = clamp(index, locked, live);
  const prev = drag.target; drag.target = { routeId: cols[i].routeId, day: cols[i].day, index };
  if (!prev || prev.index !== index || prev.routeId !== drag.target.routeId || prev.day !== drag.target.day || slot.parentNode !== colEl) {
    /* The ghost of where the job will land: the list makes room and every stop shows its new number. */
    colEl.insertBefore(slot, cards[index] || colEl.querySelector('.bd-empty') || colEl.querySelector('.bd-add'));
    slot.style.setProperty('--ring', q.routeColor(cols[i].routeId)); slot.style.setProperty('--nfg', readableOn(q.routeColor(cols[i].routeId)));
    [...body.children].forEach(col => { let n = 0; [...col.children].forEach(el => { if (el.classList.contains('bd-slot') || (el.classList.contains('bd-job') && !el.classList.contains('dragging') && !el.classList.contains('bd-ghost') && !el.classList.contains('calledoff'))) { const num = el.querySelector('.bd-num'); if (num) num.textContent = ++n; } }); });
  }
  Object.assign(drag.ghost.style, { left: i * colW + 4 + 'px', width: colW - 8 + 'px', top: p.y - drag.grabY + 'px' });
  drag.ghost.style.setProperty('--ring', q.routeColor(cols[i].routeId)); drag.ghost.style.setProperty('--nfg', readableOn(q.routeColor(cols[i].routeId)));
  const num = drag.ghost.querySelector('.bd-num'); if (num) num.textContent = index + 1;
}
function autoScroll() {
  if (!drag) return;
  const el = scroller, ev = drag.last;
  if (el && ev) {
    const p = ui.localPoint(ev, el), headEl = el.querySelector('.bd-head'), headH = headEl ? headEl.offsetHeight : 0, t = Date.now();
    if (p.y > el.clientHeight - 44) el.scrollTop += 9; else if (p.y < headH + 36) el.scrollTop -= 9;
    const side = p.x > el.clientWidth - 24 ? 1 : p.x < 18 ? -1 : 0, canScroll = side > 0 ? el.scrollLeft < el.scrollWidth - el.clientWidth - 1 : side < 0 ? el.scrollLeft > 0 : false;
    if (side && canScroll) { el.scrollLeft += side * 9; drag.edge = 0; }
    else if (side) { if (drag.edge !== side) { drag.edge = side; drag.edgeAt = t; } else if (t - drag.edgeAt > 850) { drag.edgeAt = t; S.board.day = D.add(S.board.day, side); saved = { top: el.scrollTop, left: el.scrollLeft }; scroller = null; refresh(); } }
    else drag.edge = 0;
    if (scroller) dragMove(ev);
  }
  requestAnimationFrame(autoScroll);
}
function dragEnd() { const { job, target, ghost, ins, slot } = drag; ghost.remove(); ins.remove(); slot.remove(); drag = null; refresh(); if (target) dropped(job, target); }

const SCOPES = ['This job', 'This and following jobs', 'All jobs'];
/** Other occurrences of a recurring job covered by a scope (excluding the job itself). */
function seriesJobs(job, scope) {
  if (!job.recurring || scope === 'This job' || !scope) return [];
  return data.jobs.filter(j => j !== job && j.recurring && j.recurring.seriesId === job.recurring.seriesId && j.status === 'scheduled' && (scope === 'All jobs' || j.day > job.day));
}
WD.boardHelpers = { SCOPES, seriesJobs };
async function dropped(job, t) {
  const routeChanged = t.routeId !== job.routeId, dayChanged = t.day !== job.day, pos = q.position(job);
  if (!routeChanged && !dayChanged && t.index === pos.n - 1) return;
  /* Skills, licenses, clearances and truck capability: block the move or flag it, as the company chose in Settings. */
  /* Calendar scheduling: a day is in time order, so dropping a job somewhere else in its own list asks for its new start time. */
  const cal = calendar();
  if (cal && !routeChanged && !dayChanged) { if (ops2().askTime) ops2().askTime(job, () => { flashId = job.id; }); else ui.toast('Jobs are listed by start time', 'clock'); return; }
  if (routeChanged && WD.r11 && !(await WD.r11.checkAssign([job], t.routeId, t.day))) return;
  /* AI Premium: the route is near or over capacity on that day. */
  if ((routeChanged || dayChanged) && ops2().capacityGate && (await ops2().capacityGate({ routeId: t.routeId, day: t.day, title: job.title, addMin: WD.siteMinutes ? WD.siteMinutes(job).minutes : job.dur, job, moving: true })) !== true) return;
  const where = 'Stop ' + (t.index + 1) + ' on ' + (routeChanged ? q.routeName(t.routeId) : 'the list') + (dayChanged ? ' · ' + fmt.day(t.day) : ''), me = S.me.name;
  let scope = 'This job', kind = 'edit';
  if (routeChanged) { kind = 'reassign';
    scope = await ui.actionSheet({ title: 'Reassign ' + job.title + ' to ' + q.routeName(t.routeId) + '?', message: where + '.' + (job.recurring ? ' Other visits in the series go to the end of that route’s list.' : ''), buttons: job.recurring ? SCOPES.map(s => ({ label: s })) : [{ label: 'Reassign job', value: 'This job' }] });
    if (!scope) return;
  } else if (dayChanged) {
    scope = await ui.actionSheet({ title: 'Move ' + job.title + ' to ' + fmt.day(t.day) + '?', message: where + '. Only this visit changes.', buttons: [{ label: 'Move job', value: 'This job' }] });
    if (!scope) return;
  }
  const series = routeChanged ? seriesJobs(job, scope) : [];
  api.op({ kind, title: job.title, scope: routeChanged || dayChanged ? scope : 'Reordered · stop ' + pos.n + ' → ' + (t.index + 1), jobIds: [job.id, ...series.map(j => j.id)], apply() {
    WD.placeJob(job, t.routeId, t.day, t.index);
    job.events.push({ at: +WD.now(), actor: me, text: routeChanged ? 'Reassigned to ' + q.routeName(t.routeId) + ' · stop ' + job.seq : dayChanged ? 'Moved to ' + fmt.day(t.day) + ' · stop ' + job.seq : 'Moved to stop ' + job.seq });
    series.forEach(j => WD.placeJob(j, t.routeId, j.day, Infinity));
    if (cal && ops2().sortByTime) { ops2().sortByTime(t.routeId, t.day); series.forEach(j => ops2().sortByTime(t.routeId, j.day)); }
  } });
  if (cal && job.startAt) ui.toast('Kept at ' + fmt.time(fmt.fromHHMM(job.startAt)) + ' · jobs are listed by start time', 'clock', 2600);
  flashId = job.id;
}

/* ---------- Month ---------- */
function monthWeeks(dayKey) {
  const first = D.parse(dayKey); first.setDate(1); const month = first.getMonth(); let k = D.add(D.key(first), -first.getDay()); const weeks = [];
  for (let w = 0; w < 6; w++) { const days = []; for (let d = 0; d < 7; d++) { days.push(k); k = D.add(k, 1); } if (w < 4 || D.parse(days[0]).getMonth() === month) weeks.push(days); }
  return { weeks, month };
}
/* Month shows the plan (WD.areas, r18.js): time off, weekend jobs such as shred events, and the areas each route is in that day, worked
   out from its stops and editable. Every job, as before, is a choice in the ellipsis menu (Show on the calendar: Plan | All jobs).
   Swiping up goes to the next month and down to the previous one, as in Google Calendar; a mouse wheel or trackpad does the same. */
let monthAnim = null, monthSwiped = 0, wheelLock = 0;
const showAreas = () => S.board.monthShow !== 'jobs' && !!WD.areas;
function monthSwipe(el) {
  let s = null, acc = 0; const go = n => { monthAnim = n > 0 ? 'up' : 'down'; monthSwiped = Date.now(); step(n); };
  el.addEventListener('pointerdown', e => { s = { x: e.clientX, y: e.clientY }; });
  el.addEventListener('pointerup', e => { if (!s) return; const dx = e.clientX - s.x, dy = e.clientY - s.y; s = null; if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.5) go(dy < 0 ? 1 : -1); });
  el.addEventListener('pointercancel', () => { s = null; });
  el.addEventListener('wheel', e => { e.preventDefault(); if (Date.now() < wheelLock) return; acc += e.deltaY; if (Math.abs(acc) > 60) { wheelLock = Date.now() + 500; go(acc > 0 ? 1 : -1); } }, { passive: false });
}
function monthView() {
  const b = S.board, { weeks, month } = monthWeeks(b.day), routes = q.visibleRoutes().map(r => r.id), today = D.today(), areas = showAreas();
  /* An area's towns break after each slash. How many lines one may take depends on how many routes share the day's cell. */
  const el = h('div.bd-month' + (areas ? '.areas' : '') + (monthAnim ? '.' + monthAnim : ''), { style: areas ? { '--ln': String(Math.max(1, Math.floor(4 / Math.max(1, routes.length)))) } : null }, h('div.bd-mhead', ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(x => h('span', x))), weeks.map(days => h('div.bd-week', days.map(day => {
    const cls = 'div.bd-mday' + (D.parse(day).getMonth() !== month ? '.other' : '') + (day === today ? '.today' : ''), num = h('div.bd-mnum', D.parse(day).getDate()), swiped = () => Date.now() - monthSwiped < 400;
    if (areas) { const AR = WD.areas, lines = [
        ...AR.off(day).map(o => h('div.bd-mev.off' + (o.pending ? '.ask' : ''), { title: o.name + (o.pending ? ' asked for time off' : ' has time off') }, o.name + ' off' + (o.pending ? '?' : ''))),
        ...AR.specials(day, routes).map(j => h('div.bd-mev.wkend', { style: { '--ring': q.routeColor(j.routeId) }, title: j.title }, j.title)),
        ...AR.on(day, routes).map(a => h('div.bd-mev.area' + (a.auto ? '' : '.set'), { style: { background: a.color, color: readableOn(a.color) }, title: a.name + ' · ' + q.routeName(a.routeId) }, a.name.replace(/\s*\/\s*/g, '/\u200b')))];
      return h(cls, { onclick: () => { if (!swiped()) AR.openDay(day, refresh); } }, num, lines.slice(0, 5), lines.length > 5 && h('div.bd-more', '+' + (lines.length - 5) + ' more')); }
    const jobs = q.jobsOn(day).filter(j => routes.includes(j.routeId)).sort(boardSort);
    return h(cls, { onclick: () => { if (swiped()) return; b.day = day; b.mode = 'routes'; keep(null, 0); refresh(); } },
      num, WD.r11 && routes.some(r => WD.r11.noteFor(r, day)) && h('div.bd-mev', { style: { '--c': '#FFD60A', '--ring': '#E0A800', background: '#FFE066', color: '#1C1C1E' }, title: 'Route note' }, 'Note'), jobs.slice(0, 4).map(j => h('div.bd-mev' + (WD.struck[j.status] ? '.struck' : ''), { style: { '--c': j.allDay ? q.routeColor(j.routeId) : WD.cardColor(j), '--ring': q.routeColor(j.routeId) } }, j.title)), jobs.length > 4 && h('div.bd-more', '+' + (jobs.length - 4) + ' more'));
  }))));
  monthAnim = null; monthSwipe(el); return el;
}
function pickDate() {
  let cursor = S.board.day;
  const sheet = ui.sheet({ title: 'Go to date', live: false,
    leading: [{ label: 'Today', onTap: () => { S.board.day = D.today(); keep(null); sheet.close(); } }], trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render(p) {
      const { weeks, month } = monthWeeks(cursor), today = D.today(), shift = n => { const d = D.parse(cursor); d.setDate(1); d.setMonth(d.getMonth() + n); cursor = D.key(d); p.refresh(); };
      return h('div.bd-cal', h('div.bd-cal-top', h('span', fmt.day(cursor, 'month')), h('span', h('button.nav-btn', { onclick: () => shift(-1) }, icon('chevron.left', 22)), h('button.nav-btn', { onclick: () => shift(1) }, icon('chevron.right', 22)))),
        h('div.bd-cal-grid', ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(x => h('span', x)), weeks.flat().map(day => h('button' + (day === S.board.day ? '.sel' : day === today ? '.today' : '') + (D.parse(day).getMonth() !== month ? '.other' : ''), { onclick: () => { S.board.day = day; keep(null); sheet.close(); } }, D.parse(day).getDate()))));
    } }, { detent: 'medium' });
}

/* ---------- Page ---------- */
function render(p) {
  page = p; const b = S.board;
  /* A board that is hidden (another tab is in front) reports a scroll position of 0, so only a visible one is read; the scroll listener in grid() keeps `saved` current. */
  /* `placed` is set once a board has been scrolled to its remembered position while on screen; one drawn while hidden never was, and reads 0. */
  if (scroller && scroller.isConnected && scroller.offsetParent && scroller.placed) saved = { top: scroller.scrollTop, left: scroller.scrollLeft };
  if (!q.route(b.routeId)) { const mine = data.routes.find(r => r.driverId === S.me.id); b.routeId = (mine || q.visibleRoutes()[0] || q.routes()[0]).id; }
  /* While jobs are being selected the bar takes the place of the warning lines, right under the date. */
  /* Under the bar: the month, the live map of the same day and routes, or the board (on a computer optionally with the map beside it). */
  return [topBar(), selectBar() || strips([statusStrip(), addressStrip(), WD.r11 && WD.r11.boardStrips(inView, { label: viewLabel() }), WD.rc && WD.rc.assignStrip && WD.rc.assignStrip(b.mode === 'month' ? [] : columns()), offStrip(), markStrip(), WD.eta && b.mode !== 'month' && WD.eta.boardStrip(columns()), ops2().boardStrips && ops2().boardStrips(b.mode === 'month' ? [] : columns())]),
    b.mode === 'month' ? monthView() : h('div.bd-holder' + (WD.r15 && WD.r15.cardClass ? WD.r15.cardClass() : ''), { style: WD.r15 && WD.r15.cardVars ? WD.r15.cardVars() : null }, mapOnly() ? mapPane() : splitView() ? h('div.bd-split', grid(), mapPane()) : grid(), viewPill())];
}
WD.screens.board = {
  root: () => ({ title: 'Dispatch', navbar: false, noScroll: true, live: false, render, onChange: p => { if (pinch) staleWhilePinching = true; else if (!drag) p.refresh(); }, onReappear: p => p.refresh() }),
  /** From another workspace column: a job → its day, with the card marked and flashed; a route (a truck picked in Maintenance) → that route alone for the day. */
  onLinked(sel) { const b = S.board, j = sel.jobId && q.job(sel.jobId), r = !j && sel.routeId && q.route(sel.routeId);
    if (j) { b.day = j.day; if (b.mode === 'month') b.mode = 'routes'; if (b.mode === 'days' && b.routeId !== j.routeId) b.routeId = j.routeId; b.view = 'board'; linkedId = flashId = revealId = j.id; refresh(); return true; }
    if (r) { Object.assign(b, { mode: 'days', routeId: r.id, dayCount: 1, day: sel.day || D.today(), view: 'board' }); keep(null, 0); refresh(); return true; }
    return false; },
  /** Show a day (and optionally one job, highlighted) on the board. */
  show(day, jobId) { S.board.day = day; if (S.board.mode === 'month') S.board.mode = 'routes'; keep(null); flashId = jobId || null; const j = jobId && q.job(jobId); if (j) { const r = q.route(j.routeId); if (r && !r.visible) r.visible = true; revealId = j.id; } WD.nav.switchTab('board'); refresh(); },
};

WD.panel.addAction('Live update: dispatcher moves a job', () => {
  const j = data.jobs.filter(x => x.day === D.today() && x.status === 'scheduled' && !x.allDay && !x.pending && q.route(x.routeId).visible).sort(q.order).find(x => q.position(x).n < q.position(x).of); if (!j) return;
  WD.placeJob(j, j.routeId, j.day, q.position(j).n + 1); j.version++; j.events.push({ at: +WD.now(), actor: 'Priya Raman', text: 'Moved to stop ' + j.seq }); flashId = j.id; WD.changed();
  ui.banner({ title: 'Priya Raman', text: 'Moved ' + j.title + ' to stop ' + j.seq + ' on ' + q.routeName(j.routeId), icon: 'calendar', color: q.routeColor(j.routeId), onTap: () => jobsScreen().openDetails && jobsScreen().openDetails(j.id) });
});
const go = mode => () => { S.board.mode = mode; S.board.day = D.today(); keep(null, 0); WD.nav.switchTab('board'); refresh(); };
WD.panel.addJump('Board: routes', go('routes')); WD.panel.addJump('Board: one route', go('days')); WD.panel.addJump('Month', go('month'));
})();
