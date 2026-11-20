/* RouteClerk prototype — version 5.1 (round 15).
   `WD.r15`: the job-card style on Dispatch (Settings → Display), who is on the phone right now (callBegin / callEnd / onCall) and what the
   rest of the app does with it (the call brief, filling a job, lead or price from the caller, drafts set aside when another call comes in),
   CRM Assignments (what every person has on their plate), and the AI Premium review of overdue invoices and of customers our emails do not reach. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, R = WD.r15 = {};
const K = () => (WD.screens.customers || {}).crm || {}, C2 = () => WD.crm2 || {}, X11 = () => WD.r11 || {}, aip = () => !!(WD.aip && WD.aip.on());
const plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's'), first = n => /desk|office|payable|reception|billing/i.test(String(n || '')) ? 'the ' + String(n).toLowerCase() : String(n || '').replace(/^(Dr|Lt|Sgt|Capt|Mr|Mrs|Ms)\.\s*/, '').split(' ')[0], me = () => (S.me && S.me.name) || 'You';
const today = () => D.today(), now = () => +WD.now(), money = n => fmt.money(Math.round(n));
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
const hash = s => { let n = 7; for (const ch of String(s)) n = (n * 31 + ch.charCodeAt(0)) >>> 0; return n; };
const isLead = c => (K().PIPE || []).includes(c.lifecycle);
const openRecord = c => { if (isLead(c) && WD.can('leads.view') && WD.screens.crm && WD.screens.crm.openLead) WD.screens.crm.openLead(c.id); else if (WD.screens.customers && WD.screens.customers.openDetail) WD.screens.customers.openDetail(c.id); };

WD.css(`
/* Job cards on Dispatch: clear (border only) or a faint fill, chosen in Settings → Display. The border carries the job-type color; the stop number keeps the route color. */
.bd-holder.cs-clear .bd-job .bd-job-in, .bd-holder.cs-faint .bd-job .bd-job-in { background: var(--cell); color: var(--label); border-color: var(--c); }
.bd-holder.cs-faint .bd-job .bd-job-in { background: color-mix(in srgb, var(--ct, var(--c)) 20%, var(--cell)); }
.bd-holder.cs-clear .bd-job.faded .bd-job-in, .bd-holder.cs-clear .bd-job.struck .bd-job-in, .bd-holder.cs-faint .bd-job.faded .bd-job-in, .bd-holder.cs-faint .bd-job.struck .bd-job-in { background: color-mix(in srgb, var(--gray) 16%, var(--cell)); border-color: color-mix(in srgb, var(--c) 45%, var(--gray)); }
.bd-holder.cs-clear .bd-tag.na, .bd-holder.cs-clear .bd-tag.nb, .bd-holder.cs-faint .bd-tag.na, .bd-holder.cs-faint .bd-tag.nb { box-shadow: 0 0 0 1px currentColor; }
.r5-sw { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px 16px 14px; background: var(--cell); }
.r5-sw button { position: relative; width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--sep); cursor: pointer; padding: 0; display: grid; place-items: center; color: var(--label); background: color-mix(in srgb, var(--k) 24%, var(--cell)); }
.r5-sw button.on { border-color: var(--tint); box-shadow: 0 0 0 2px var(--tint); } .r5-sw button.type { background: conic-gradient(#FFD60A33, #5856D633, #007AFF33, #FF3B3033, #FF2D5533, #FFD60A33); }
.r5-sw label { width: 44px; height: 44px; border-radius: 50%; border: 2px dashed var(--label3); display: grid; place-items: center; cursor: pointer; overflow: hidden; position: relative; color: var(--label2); } .r5-sw label input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.r5-prev { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px 16px; background: var(--cell); }
.r5-prev .bd-job { margin: 0; cursor: default; } .r5-prev .bd-job-in { min-height: 46px; }
/* What matters about the person on the phone. */
.r5-brief { text-align: left; width: 100%; box-sizing: border-box; margin: 12px 0 4px; border-radius: 14px; background: var(--cell); border: .5px solid var(--sep); overflow: hidden; }
.cl-call .r5-brief { background: var(--fill3); border: 0; max-width: 420px; }
.r5-brief .hd { display: flex; align-items: center; gap: 6px; padding: 9px 12px 2px; font-size: 12px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; color: var(--label2); }
.r5-line { display: flex; align-items: flex-start; gap: 8px; padding: 6px 12px; font-size: 14px; line-height: 18px; letter-spacing: -.1px; }
.r5-line > .ic { flex: none; margin-top: 1px; } .r5-line b { font-weight: 600; } .r5-line small { display: block; font-size: 12px; line-height: 15px; color: var(--label2); }
.r5-line.bad { background: color-mix(in srgb, var(--red) 12%, transparent); } .r5-line.ok { color: var(--label2); } .r5-line.tap { cursor: pointer; }
.r5-brief .rc-ai { margin: 6px 8px 8px; } .r5-brief .rc-ai ul { margin: 4px 0 0; padding-left: 18px; } .r5-brief .rc-ai li { margin: 3px 0; }
.r5-more { border: 0; background: none; color: var(--tint); font: inherit; font-size: 13px; font-weight: 600; padding: 4px 12px 10px; cursor: pointer; }
/* Assignments */
.r5-kan { display: flex; gap: 12px; align-items: flex-start; padding: 4px 16px 20px; overflow-x: auto; }
.r5-colm { flex: 1 0 230px; min-width: 230px; max-width: 340px; background: var(--fill3); border-radius: 14px; padding: 8px; box-sizing: border-box; } .r5-colm.over { outline: 2px dashed var(--tint); outline-offset: -2px; }
.r5-ch { display: flex; align-items: center; gap: 8px; padding: 4px 4px 8px; } .r5-ch .n { font-weight: 700; font-size: 15px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .r5-ch small { display: block; font-weight: 500; font-size: 12px; color: var(--label2); }
.r5-ch button { margin-left: auto; flex: none; border: 0; background: var(--fill2); color: var(--label); border-radius: 8px; height: 28px; padding: 0 9px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.r5-card { background: var(--cell); border-radius: 10px; padding: 8px 9px; margin-bottom: 6px; border-left: 4px solid var(--k); cursor: grab; font-size: 13px; line-height: 17px; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.r5-card .t { font-weight: 600; cursor: pointer; } .r5-card .s { color: var(--label2); font-size: 12px; line-height: 15px; } .r5-card .f { display: flex; align-items: center; gap: 6px; margin-top: 5px; }
.r5-card select { margin-left: auto; font: inherit; font-size: 12px; max-width: 120px; border: .5px solid var(--sep); border-radius: 6px; background: var(--cell); color: var(--label); height: 24px; }
.r5-card .late { color: var(--red); font-weight: 700; font-size: 12px; } .r5-card .due { color: var(--label2); font-size: 12px; } .r5-card.drag { opacity: .4; }
.r5-kind { display: inline-block; font-size: 11px; font-weight: 800; letter-spacing: .3px; text-transform: uppercase; color: #fff; background: var(--k); border-radius: 4px; padding: 0 5px; line-height: 16px; }
.r5-empty { text-align: center; color: var(--label2); font-size: 12px; padding: 14px 4px; }
/* Price Calc: an area's three numbers */
.pc-area { background: var(--cell); padding: 8px 16px 10px; border-bottom: .5px solid var(--sep); }
.pc-area-top { display: flex; align-items: center; gap: 6px; } .pc-name { flex: 1; min-width: 0; border: 0; background: none; font: inherit; font-size: 16px; font-weight: 600; color: var(--label); padding: 6px 0; letter-spacing: -.2px; }
.pc-area-top button { border: 0; background: none; color: var(--label2); width: 44px; height: 36px; cursor: pointer; display: grid; place-items: center; }
.pc-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } .pc-f span:first-child { display: block; font-size: 12px; line-height: 15px; color: var(--label2); margin-bottom: 3px; min-height: 30px; display: flex; align-items: flex-end; }
.pc-in { display: flex; align-items: center; gap: 2px; border: 1px solid var(--sep); border-radius: 9px; padding: 0 8px; height: 40px; background: var(--bg); } .pc-in i { font-style: normal; color: var(--label2); }
.pc-in input { width: 100%; min-width: 0; border: 0; background: none; font: inherit; font-size: 16px; font-weight: 600; color: var(--label); text-align: right; outline: none; font-variant-numeric: tabular-nums; }
.pc-in:focus-within { border-color: var(--tint); box-shadow: 0 0 0 2px color-mix(in srgb, var(--tint) 30%, transparent); }
/* AI invoice review */
.r5-inv { background: var(--cell); border-radius: 14px; margin: 0 0 12px; overflow: hidden; border: .5px solid var(--sep); }
.r5-inv .top { display: flex; align-items: center; gap: 10px; padding: 10px 12px 6px; cursor: pointer; } .r5-inv .top .m { flex: 1; min-width: 0; } .r5-inv .top .n { font-weight: 700; font-size: 16px; letter-spacing: -.2px; } .r5-inv .top .a { font-weight: 700; font-size: 17px; color: var(--red); font-variant-numeric: tabular-nums; }
.r5-inv .why { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 12px 6px; } .r5-inv .rec { padding: 4px 12px 8px; font-size: 14px; line-height: 19px; }
.r5-inv .acts { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 12px 12px; } .r5-inv .done { padding: 4px 12px 10px; font-size: 13px; color: var(--green); font-weight: 600; display: flex; gap: 6px; align-items: center; }
`);

/* ================= Job cards on Dispatch ================= */
/* S.prefs.card = { style: 'solid' | 'clear' | 'faint', tint: 'type' | '#rrggbb' }. solid = the job-type color fills the card (the default). */
const CARD0 = { style: 'solid', tint: 'type' }, TINTS = [['#8E8E93', 'Gray'], ['#007AFF', 'Blue'], ['#34C759', 'Green'], ['#FFCC00', 'Yellow'], ['#FF9500', 'Orange'], ['#FF2D55', 'Pink'], ['#AF52DE', 'Purple'], ['#30B0C7', 'Teal']];
const card = () => { S.prefs = S.prefs || {}; if (!S.prefs.card) { let v = null; try { v = JSON.parse(store.get('wd.card') || 'null'); } catch (e) { v = null; } S.prefs.card = Object.assign({}, CARD0, v || {}); } return S.prefs.card; };
const setCard = o => { Object.assign(card(), o); store.set('wd.card', JSON.stringify(card())); WD.changed(); };
R.cardClass = () => { const c = card(); return c.style === 'clear' ? '.cs-clear' : c.style === 'faint' ? '.cs-faint' : ''; };
R.cardVars = () => { const c = card(); return c.style === 'faint' && c.tint !== 'type' ? { '--ct': c.tint } : null; };
const cardLabel = () => { const c = card(); return c.style === 'clear' ? 'Clear, border only' : c.style === 'faint' ? 'Faint ' + (c.tint === 'type' ? 'job-type color' : ((TINTS.find(t => t[0].toLowerCase() === String(c.tint).toLowerCase()) || [0, 'custom color'])[1]).toLowerCase()) : 'Job-type color'; };
R.cardStyleSpec = () => ({ title: 'Job cards on Dispatch', render: page => { const c = card(), re = () => page.refresh();
  const sample = (title, key, col, ring, cls) => h('div.bd-job' + (cls || ''), h('div.bd-job-in', { style: { '--c': col, '--ring': ring, '--fg': WD.readableOn ? WD.readableOn(col) : '#fff' } }, h('span.bd-num', '1'), h('div.bd-job-main', h('div.bd-job-title', title), h('div.bd-job-key', key))));
  return ui.list(
    ui.section({ header: 'Preview', fold: false }, h('div.r5-prev.bd-holder' + R.cardClass(), { style: R.cardVars() }, sample('Harlow & Finch Law', '4 consoles', '#3A3A3C', '#007AFF'), sample('Purge · 22 boxes', 'Window 9–11', '#FFD60A', '#34C759'), sample('County Records', 'PO required', '#5856D6', '#FF9500'))),
    ui.section({ header: 'Background', fold: false, showFooter: true, footer: c.style === 'solid' ? 'The job-type color fills each card and the route’s color rims it.' : 'The job-type color becomes the card’s border, the stop number keeps the route’s color, and the text is the normal text color. Warning stripes and labels are unchanged.' },
      [['solid', 'Job-type color', 'The card is filled with the color of its job type'], ['clear', 'Clear, border only', 'No fill on any job: a colored border on the board’s background'], ['faint', 'Faint color', 'A light tint of the color you choose below']].map(([v, t, sub]) => ui.row({ title: t, subtitle: sub, trailing: icon(c.style === v ? 'checkmark.circle.fill' : 'circle', 22, c.style === v ? 'var(--tint)' : 'var(--label3)'), onTap: () => { setCard({ style: v }); re(); } }))),
    c.style === 'faint' && ui.section({ header: 'Faint color', fold: false, showFooter: true, footer: 'The first choice tints each card with its own job-type color. The last opens the full color picker.' },
      h('div.r5-sw', h('button.type' + (c.tint === 'type' ? '.on' : ''), { 'aria-label': 'Each job’s own type color, faint', title: 'Job-type color', onclick: () => { setCard({ tint: 'type' }); re(); } }, c.tint === 'type' ? icon('checkmark', 18) : null),
        TINTS.map(([hex, name]) => h('button' + (String(c.tint).toLowerCase() === hex.toLowerCase() ? '.on' : ''), { style: { '--k': hex }, 'aria-label': name, title: name, onclick: () => { setCard({ tint: hex }); re(); } }, String(c.tint).toLowerCase() === hex.toLowerCase() ? icon('checkmark', 18) : null)),
        h('label', { title: 'Any color', 'aria-label': 'Choose any color' }, icon('plus', 18), h('input', { type: 'color', value: /^#/.test(c.tint) ? c.tint : '#8E8E93', onchange: e => { setCard({ tint: e.target.value }); re(); } })))),
    h('div', { style: 'padding:4px 4px 0' }, ui.note('This is your own choice and stays on this device. Other people keep theirs.'))); } });
R.cardStyleRow = push => ui.row({ icon: 'columns', iconColor: 'var(--orange)', title: 'Job cards on Dispatch', subtitle: 'Filled, clear with a border only, or a faint color', detail: cardLabel(), chevron: true, onTap: () => push(R.cardStyleSpec()) });
WD.panel.addJump('Job card style', () => { WD.nav.switchTab('settings'); WD.nav.push(R.cardStyleSpec()); });

/* ================= Who is on the phone ================= */
/* The dialer (r14-calls.js) and the caller cards (customers.js) say when a call starts and ends. cur: {dir, number, line: {label, number}, customerId, contact}. */
const CALL = { cur: null, asked: {} };
R.callBegin = info => { CALL.cur = Object.assign({ at: Date.now(), org: (S.org || {}).id }, info); CALL.asked = {}; WD.changed(); };
R.callEnd = () => { if (!CALL.cur) return; CALL.cur = null; CALL.asked = {}; WD.changed(); setTimeout(() => R.promptDrafts(true), 1100); };
R.onCall = () => CALL.cur;
const caller = () => { const c = CALL.cur; if (!c) return null; const cu = c.customerId ? q.customer(c.customerId) : null, loc = cu && (cu.locations || [])[0];
  return { call: c, cu, who: cu ? cu.name : c.contact || fmt.phone(c.number), name: cu ? cu.name : c.contact || '', contact: c.contact || '', phone: c.number, address: loc && loc.address && !/to come/i.test(loc.address) ? loc.address : '', loc: loc && loc.x != null ? loc : null,
    lineNote: 'Called in on ' + fmt.phone(c.number) + (c.line && c.line.label ? ' (our ' + c.line.label + ' line)' : '') + '.' }; };

/* ---------- Filling a job, a lead, a customer or a price from the caller ---------- */
/* A job started during a call always keeps the number the person called on, in its notes, even when they give a different number to call back. */
function wrapForms() {
  const J = WD.screens.jobs, CU = WD.screens.customers, CR = WD.screens.crm;
  if (J && J.openEditor && !J.openEditor.r15) { const open0 = J.openEditor; J.openEditor = async (o = {}) => { const k = caller(); if (!k || o.jobId) return open0(o);
      const note = k.call.dir === 'in' ? k.lineNote : 'Started during a call to ' + fmt.phone(k.phone) + '.', withNote = x => ({ ...x, notes: [x.notes, note].filter(Boolean).join(' ') });
      if (o.customerId && k.cu && o.customerId === k.cu.id) return open0(withNote(o));
      const v = await ui.actionSheet({ title: 'You’re on a call with ' + k.who, message: (k.cu ? 'Fill in this job with what we know about them: the customer record, address, contact and containers.' : 'Fill in this job with their number' + (k.contact ? ' and name' : '') + '.') + ' The number they ' + (k.call.dir === 'in' ? 'called on' : 'were called on') + ' is kept on the job either way.',
        buttons: [{ label: k.cu ? 'Fill in from ' + k.cu.name : 'Fill in from this call', value: 'fill' }, { label: 'Start blank', value: 'blank' }] });
      if (v == null) return;
      const o2 = withNote(o); if (v === 'fill') { if (k.cu && !o.customerId) o2.customerId = k.cu.id; else if (!k.cu) { if (!o.phone) o2.phone = k.phone; if (!o.contactName && k.contact) o2.contactName = k.contact; } }
      return open0(o2); }; J.openEditor.r15 = true; }
  const ask = async what => { const k = caller(); if (!k || k.cu) return null; return (await ui.actionSheet({ title: 'You’re on a call with ' + k.who, message: 'Fill in this ' + what + ' with the number they called on?', buttons: [{ label: 'Use ' + fmt.phone(k.phone), value: true }, { label: 'Start blank', value: false }] })) ? k : false; };
  if (CU && CU.openNew && !CU.openNew.r15) { const new0 = CU.openNew; CU.openNew = async (pre = {}) => { if (pre.phone || !caller() || caller().cu) return new0(pre); const k = await ask('customer'); if (k === null && caller() && !caller().cu) return; return new0(k ? { ...pre, phone: fmt.phone(k.phone), name: pre.name || k.contact } : pre); }; CU.openNew.r15 = true; }
  if (CR && CR.newLead && !CR.newLead.r15) { const lead0 = CR.newLead; CR.newLead = async (pre = {}) => { if (pre.phone || !caller() || caller().cu) return lead0(pre); const k = await ask('lead'); if (k === null && caller() && !caller().cu) return; return lead0(k ? { ...pre, phone: k.phone, contact: pre.contact || k.contact, notes: [pre.notes, k.lineNote].filter(Boolean).join(' ') } : pre); }; CR.newLead.r15 = true; }
}
/** A row for a screen with an address field (Price Calc): on a call, offers to fill in the caller. apply({name, phone, address, loc}). */
R.callFill = (key, apply) => { const k = caller(); if (!k || CALL.asked[key]) return null;
  return ui.section({ header: 'On a call with ' + k.who, fold: false, showFooter: true, footer: k.address ? 'Fills in their name, number and service address. You can change any of it.' : 'Fills in their ' + (k.name ? 'name and ' : '') + 'number. We have no address for them yet.' },
    h('div', { style: 'display:flex;gap:8px;padding:10px 16px;background:var(--cell)' }, ui.button('Fill in what we know', { small: true, icon: 'person', onTap: () => { CALL.asked[key] = true; apply({ name: k.name, phone: fmt.phone(k.phone), address: k.address, loc: k.loc }); ui.toast('Filled in from ' + k.who, 'checkmark'); } }), ui.button('No thanks', { kind: 'gray', small: true, onTap: () => { CALL.asked[key] = true; WD.changed(); } }))); };

/* ---------- Drafts: work set aside when another call comes in ---------- */
/* The open sheets (a half-filled job, lead, invoice…) are hidden whole, not rebuilt, so every field keeps what was typed. */
const DRAFTS = []; let lastPrompt = 0, dSeq = 0;
const isCallSheet = sh => { try { return /^(Quo call|Incoming call)$/.test(String(sh.stack.pages[0].spec.title)); } catch (e) { return false; } };
R.drafts = () => DRAFTS.slice();
R.stashForCall = () => { const A = WD.app; if (!A.stashSheets) return; const list = A.stashSheets(isCallSheet); if (!list.length) return;
  const top = list[list.length - 1], title = String(top.stack.pages[0].spec.title || 'Unfinished work'), inp = [...top.el.querySelectorAll('input[type=text], input:not([type]), textarea')].find(x => x.value && x.value.trim()), form = !!top.el.querySelector('input, textarea, select');
  DRAFTS.push({ id: 'd' + (++dSeq), org: (S.org || {}).id, title, hint: inp ? inp.value.trim().slice(0, 40) : '', at: now(), form, sheets: list });
  ui.toast('“' + title + '” saved as a draft for after this call', 'tray', 3400); WD.changed(); };
const draftName = d => d.title + (d.hint ? ' · ' + d.hint : '');
const finishDraft = d => { const i = DRAFTS.indexOf(d); if (i < 0) return; if (d.org && d.org !== (S.org || {}).id && WD.app.switchOrg(d.org) === false) return ui.toast('Couldn’t open that business', 'exclamationmark.circle'); DRAFTS.splice(i, 1); WD.app.restoreSheets(d.sheets); ui.toast('Back to “' + d.title + '”', 'checkmark'); };
const deleteDraft = d => { const i = DRAFTS.indexOf(d); if (i < 0) return; DRAFTS.splice(i, 1); d.sheets.forEach(sh => { sh.el.style.display = 'none'; sh.backdrop.style.display = 'none'; }); WD.app.restoreSheets(d.sheets); d.sheets.slice().reverse().forEach(sh => sh.close()); WD.changed(); };
R.openDrafts = () => { const sheet = ui.sheet({ title: 'Drafts', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: page => !DRAFTS.length ? ui.empty({ icon: 'checkmark.circle', title: 'No drafts', text: 'Work you had open when a call came in is kept here until you finish or delete it.' })
  : ui.list(h('div', { style: 'padding:0 4px 8px' }, ui.note('These were open when a call came in. Each is exactly as you left it.')), DRAFTS.map(d => { const org = (data.orgs || []).find(o => o.id === d.org);
      return ui.section({ header: draftName(d), fold: false, footer: 'Set aside ' + fmt.rel(d.at) + (org && (data.orgs || []).length > 1 ? ' · ' + org.name : '') },
        h('div', { style: 'display:flex;gap:8px;padding:10px 16px;background:var(--cell)' }, ui.button('Finish', { small: true, icon: 'pencil', onTap: () => { sheet.close(); setTimeout(() => finishDraft(d), 350); } }),
          ui.button('Delete', { kind: 'gray', small: true, icon: 'trash', onTap: async () => { if (await ui.actionSheet({ title: 'Delete this draft?', message: 'What you entered in “' + draftName(d) + '” is thrown away.', buttons: [{ label: 'Delete draft', value: true, role: 'destructive' }] })) { deleteDraft(d); page.refresh(); } } }))); })) }, { detent: 'medium' }); };
/** Asks about waiting drafts whenever the person is not on a call (after a call ends, and when they move between sections). */
R.promptDrafts = force => { if (CALL.cur || !DRAFTS.length || !S.signedIn) return; if (!force && Date.now() - lastPrompt < 45000) return; lastPrompt = Date.now();
  const d = DRAFTS[DRAFTS.length - 1];
  ui.banner({ title: DRAFTS.length === 1 ? 'Finish your draft?' : plural(DRAFTS.length, 'draft') + ' waiting', text: (DRAFTS.length === 1 ? '“' + draftName(d) + '” was set aside when the call came in.' : 'Set aside when calls came in.') + ' Tap to finish or delete.', icon: 'tray', color: 'var(--orange)', duration: 0, onTap: () => DRAFTS.length === 1 ? draftChoice(d) : R.openDrafts() }); };
async function draftChoice(d) { const v = await ui.actionSheet({ title: draftName(d), message: 'Set aside ' + fmt.rel(d.at) + ' when a call came in. It is exactly as you left it.', buttons: [{ label: 'Finish it now', value: 'f' }, { label: 'Delete draft', value: 'x', role: 'destructive' }], cancel: 'Later' }); if (v === 'f') finishDraft(d); else if (v === 'x') deleteDraft(d); }
WD.on('tab', () => setTimeout(() => R.promptDrafts(false), 600));
WD.panel.addJump('Drafts', () => R.openDrafts());
WD.panel.addAction('Second call while a job is half entered', () => { const J = WD.screens.jobs; if (!J || !J.openEditor) return; J.openEditor({ title: 'Delgado Tax — purge', address: '418 Alder St', notes: 'Wants it done before the 30th.' }); setTimeout(() => WD.screens.customers && WD.screens.customers.simulateCall('c4'), 1600); });

/* ================= Call brief: what matters about the person on the phone ================= */
const owedOf = c => X11().owed ? X11().owed(c) : (c.stats || {}).balance || 0, unpaidOf = c => X11().unpaidInv ? X11().unpaidInv(c) : [], lateOf = c => X11().overdue ? X11().overdue(c) : [];
const monthsAgo = day => Math.round(D.diff(today(), day) / 30.4), agoText = day => { const n = D.diff(today(), day), m = monthsAgo(day); return n <= 0 ? 'today' : n < 14 ? plural(n, 'day') + ' ago' : n < 60 ? plural(Math.round(n / 7), 'week') + ' ago' : plural(m, 'month') + ' ago'; };
/** The few facts worth knowing before talking (AI Premium). Real records are used where the prototype has them; a one-time customer with no
    history in the demo data gets a made-up earlier purge so the summary shows what it is for. */
function aiFacts(c) {
  const out = [], jobs = q.jobsForCustomer(c.id), done = jobs.filter(j => j.status === 'completed' && !j.allDay).sort((a, b) => b.day.localeCompare(a.day)), n = hash(c.id), recurring = c.freq && c.freq !== 'One time';
  const withBoth = done.find(j => j.estTotal != null && j.invoice && j.invoice.amount != null);
  if (withBoth) { const d = withBoth.invoice.amount - withBoth.estTotal; out.push(h('span', h('b', 'Service ' + agoText(withBoth.day) + '. '), 'Quoted ' + money(withBoth.estTotal) + ', invoiced ' + money(withBoth.invoice.amount) + (Math.abs(d) < 1 ? ': right on the estimate.' : ': ' + money(Math.abs(d)) + (d > 0 ? ' over' : ' under') + ' the estimate.'))); }
  else if (!recurring) { const mo = 9 + n % 7, boxes = 10 + n % 12, more = 3 + n % 8, quoted = 150 + Math.max(0, boxes - 14) * 8, actual = 150 + Math.max(0, boxes + more - 14) * 8;
    out.push(h('span', h('b', 'Last service ' + mo + ' months ago: '), 'a purge quoted at ' + money(quoted) + ' for ' + boxes + ' boxes.'));
    out.push(h('span', h('b', 'The job came to ' + money(actual) + '. '), 'There were ' + (boxes + more) + ' boxes, ' + more + ' more than estimated. Ask for a careful count this time.')); }
  else if (done[0]) { const inv = done.find(j => j.invoice && j.invoice.amount != null); out.push(h('span', h('b', 'Last service ' + agoText(done[0].day) + '. '), (c.freq || 'Recurring') + ' customer' + (inv ? ', usually about ' + money(inv.invoice.amount) + ' a visit.' : '.'))); }
  const qt = (data.quotes || []).filter(x => x.customerId === c.id).sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  if (qt && !withBoth) { const tot = (qt.items || []).reduce((s, x) => s + x.qty * x.rate, 0); out.push(h('span', h('b', (qt.kind === 'bid' ? 'Bid ' : 'Quote ') + qt.number + ': ' + money(tot) + ', ' + qt.status + '. '), qt.sentAt ? 'Sent ' + fmt.rel(qt.sentAt) + '.' : 'Not sent yet.')); }
  const owed = owedOf(c), late = lateOf(c);
  if (owed > 0 && WD.can('billing.view')) out.push(h('span', h('b', 'Owes ' + money(owed) + ' on ' + plural(unpaidOf(c).length, 'invoice') + '. '), late.length ? (late.length === 1 ? '1 is' : late.length + ' are') + ' overdue; bring it up on this call.' : 'None overdue yet.'));
  else if (recurring) out.push(h('span', h('b', 'Pays on time. '), 'Usually about ' + (12 + n % 20) + ' days after the invoice.'));
  const et = R.emailTrouble(c); if (et) out.push(h('span', h('b', 'Our emails are not reaching them. '), et.short + ' Confirm the address while you have them.'));
  const callI = (data.interactions || []).filter(i => i.customerId === c.id && (i.type === 'call' || i.type === 'voicemail') && i.summary && !/processing/i.test(i.summary)).sort((a, b) => b.at - a.at)[0];
  if (callI) out.push(h('span', h('b', 'Last call ' + fmt.rel(callI.at) + ': '), callI.summary));
  const need = C2().inquiries ? C2().inquiries().find(i => i.customerId === c.id && i.status !== 'done') : null;
  if (need) { const t = (data.inquiryTypes || []).find(x => x.id === need.type); out.push(h('span', h('b', 'Open request: ' + (t ? t.name : 'customer request') + '. '), 'Due ' + fmt.day(need.due, 'rel') + ', with ' + first(K().staff ? K().staff(need.owner) : 'the office') + '.')); }
  const next = jobs.find(j => j.day >= today() && !WD.closed[j.status] && !j.allDay); if (next) out.push(h('span', h('b', 'Next visit ' + fmt.day(next.day, 'rel') + '. '), q.routeName(next.routeId) + '.'));
  return out.slice(0, 6);
}
/** The card shown as soon as a call is placed or accepted. Everyone gets the money line and the latest contact; AI Premium adds the summary. */
R.callBrief = (c, o = {}) => { if (!c) return null;
  const owed = owedOf(c), unpaid = unpaidOf(c), late = lateOf(c), bill = WD.can('billing.view'), oldest = unpaid.map(i => i.day).sort()[0], et = R.emailTrouble(c);
  const tl = K().timeline ? K().timeline(c.id).filter(i => ['call', 'voicemail', 'text', 'email', 'note', 'job'].includes(i.type)).slice(0, o.incoming ? 0 : 3) : [];
  const lines = [
    bill && (owed > 0 ? h('div.r5-line.bad.tap', { role: 'button', onclick: () => WD.rc && WD.rc.openStatement && WD.rc.openStatement(c) }, icon('exclamationmark.circle', 18, 'var(--red)'), h('span', h('b', 'Outstanding: ' + money(owed) + ' on ' + plural(unpaid.length, 'invoice')), h('small', (late.length ? late.length + ' overdue · ' : '') + 'oldest from ' + fmt.day(oldest, 'md') + ' (' + plural(D.diff(today(), oldest), 'day') + ') · tap for the statement')))
      : h('div.r5-line.ok', icon('checkmark.circle', 18, 'var(--green)'), h('span', 'No outstanding bills'))),
    et && h('div.r5-line.bad', icon('envelope', 18, 'var(--orange)'), h('span', h('b', 'Emails are not reaching them'), h('small', et.short))),
    tl.map(i => { const d = K().describe ? K().describe(i) : { title: i.type, snippet: '' }; return h('div.r5-line', icon(i.type === 'job' ? 'truck' : i.type === 'note' ? 'note' : i.type === 'email' ? 'envelope' : 'phone', 17, 'var(--label2)'), h('span', h('b', d.title || i.title || i.type), ' · ' + fmt.rel(i.at), (d.snippet || i.snippet || i.summary) && h('small', String(d.snippet || i.snippet || i.summary).slice(0, 110)))); })];
  const ai = aip() ? WD.aip.card({ title: 'AI summary · what matters for this call', lines: aiFacts(c) }) : null;
  return h('div.r5-brief', h('div.hd', icon('info.circle', 14), o.incoming ? 'Before you answer' : 'Most recent with ' + c.name), lines, ai); };

/* ================= CRM: Assignments ================= */
/* Everything in the CRM that has an owner, grouped by person: leads (customer.owner), follow-ups (task.owner) and customer requests (inquiry.owner). */
const AS = { who: 'all', kind: 'all', overdueOnly: false };
const KIND = { lead: ['Lead', '#007AFF', 'Leads'], task: ['Follow-up', '#FF9500', 'Follow-ups'], need: ['Request', '#AF52DE', 'Requests'] };
const canEdit = () => WD.can('crm.edit'), staff = id => K().staff ? K().staff(id) : 'Office', owners = () => K().owners ? K().owners() : [];
function assignItems() { const out = [], X = (WD.screens.crm || {}).x || {};
  if (WD.can('leads.view') && X.pipe) X.pipe().forEach(c => out.push({ key: 'l' + c.id, kind: 'lead', owner: c.owner, title: c.name, sub: [(X.stageOf && X.STAGES ? ((X.STAGES.find(s => s.id === X.stageOf(c)) || {}).label || '') : ''), c.nextAction ? 'next step ' + fmt.day(c.nextAction, 'rel') : 'no next step'].filter(Boolean).join(' · '), due: c.nextAction || null, open: () => openRecord(c), set: u => { c.owner = u; } }));
  (data.tasks || []).filter(t => !t.done).forEach(t => { const c = q.customer(t.customerId); out.push({ key: 't' + t.id, kind: 'task', owner: t.owner, title: t.title, sub: c ? c.name : '', due: t.due, open: () => c && openRecord(c), set: u => { t.owner = u; } }); });
  if (C2().inquiries) C2().inquiries().filter(i => i.status !== 'done').forEach(i => { const t = (data.inquiryTypes || []).find(x => x.id === i.type), c = q.customer(i.customerId); out.push({ key: 'n' + i.id, kind: 'need', owner: i.owner, title: t ? t.name : 'Customer request', sub: c ? c.name : '', due: i.due, open: () => WD.nav.push(C2().inquirySpec(i.id)), set: u => { i.owner = u; (i.notes = i.notes || []).push({ at: now(), by: me(), text: 'Reassigned to ' + staff(u) + '.' }); } }); });
  return out.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')); }
const lateItem = it => !!it.due && it.due < today();
const people = items => { const list = owners().slice(), ids = new Set(list.map(u => u.id)); items.forEach(it => { if (!ids.has(it.owner)) { ids.add(it.owner); list.push(q.user(it.owner) || { id: it.owner, name: 'Unassigned' }); } }); return list; };
const countText = list => ['lead', 'task', 'need'].map(k => { const n = list.filter(i => i.kind === k).length; return n ? n + ' ' + KIND[k][n === 1 ? 0 : 2].toLowerCase() : null; }).filter(Boolean).join(' · ') || 'Nothing assigned';
function reassign(it, userId, quiet) { if (!canEdit()) return ui.toast('You can’t reassign with this role', 'lock'); if (it.owner === userId) return; const from = it.owner; it.set(userId); it.owner = userId; WD.changed();
  if (!quiet) ui.banner({ title: 'Assigned to ' + first(staff(userId)), text: it.title + (it.sub ? ' · ' + it.sub : '') + '. Tap to undo.', icon: 'person', color: 'var(--blue)', duration: 5000, onTap: () => { it.set(from); WD.changed(); } }); }
async function moveAll(person, list, page) { const others = owners().filter(u => u.id !== person.id); if (!list.length || !others.length) return;
  const to = await ui.actionSheet({ title: 'Hand ' + first(person.name) + '’s work to…', message: countText(list) + '. Use this when someone is out or leaves.', buttons: others.map(u => ({ label: u.name, value: u.id })) }); if (!to) return;
  if (await ui.run('Reassigning…', () => list.forEach(it => { it.set(to); }), { done: plural(list.length, 'item') + ' moved to ' + first(staff(to)) })) { WD.changed(); page.refresh(); } }
const dueNode = it => it.due ? h('span.' + (lateItem(it) ? 'late' : 'due'), lateItem(it) ? plural(D.diff(today(), it.due), 'day') + ' late' : fmt.day(it.due, 'rel')) : h('span.due', 'No date');
R.assignView = page => { const all = assignItems(), ppl = people(all), mine = (S.me || {}).id, seesAll = !WD.co || !WD.co.seesAll || WD.co.seesAll();
  const filt = all.filter(it => (AS.kind === 'all' || it.kind === AS.kind) && (!AS.overdueOnly || lateItem(it)));
  const kindSeg = h('div', { style: S.desktop ? 'width:430px' : 'padding:0 0 8px' }, ui.segmented([{ value: 'all', label: 'All' }, { value: 'lead', label: 'Leads' }, { value: 'task', label: 'Follow-ups' }, { value: 'need', label: 'Requests' }], AS.kind, v => { AS.kind = v; page.refresh(); }));
  const note = !seesAll && h('div', { style: 'padding:0 4px 8px' }, ui.note('Follow-ups and customer requests are shown for everyone. Leads are limited to your territory.'));
  if (S.desktop) { let dragged = null;
    /* A column for each person. Drag a card to another column, or use the menu on the card, to hand it over. */
    return h('div.wide', h('div.c2-tool', { style: 'display:flex;align-items:center;gap:14px;padding:4px 16px 12px;flex-wrap:wrap' }, kindSeg,
        h('label', { style: 'display:flex;align-items:center;gap:6px;font-size:14px;cursor:pointer' }, h('input', { type: 'checkbox', checked: AS.overdueOnly, onchange: e => { AS.overdueOnly = e.target.checked; page.refresh(); } }), 'Overdue only'),
        h('span.secondary.footnote', { style: 'margin-left:auto' }, plural(filt.length, 'open item') + ' · ' + filt.filter(lateItem).length + ' overdue · drag a card to another person to reassign it')), note,
      h('div.r5-kan', ppl.map(u => { const list = filt.filter(it => it.owner === u.id), late = list.filter(lateItem).length;
        const col = h('div.r5-colm', { ondragover: e => { if (dragged && dragged.owner !== u.id) { e.preventDefault(); col.classList.add('over'); } }, ondragleave: () => col.classList.remove('over'), ondrop: e => { e.preventDefault(); col.classList.remove('over'); if (dragged) { reassign(dragged, u.id); dragged = null; } } },
          h('div.r5-ch', ui.avatar(u.name, { size: 32 }), h('div', { style: 'min-width:0' }, h('div.n', u.name + (u.id === mine ? ' (you)' : '')), h('small', countText(list) + (late ? ' · ' + late + ' overdue' : ''))), canEdit() && list.length > 0 && h('button', { onclick: () => moveAll(u, list, page) }, 'Hand off…')),
          list.length ? list.map(it => { const el = h('div.r5-card', { draggable: canEdit() ? 'true' : 'false', style: { '--k': KIND[it.kind][1] }, ondragstart: e => { dragged = it; el.classList.add('drag'); try { e.dataTransfer.setData('text/plain', it.key); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* older browsers */ } }, ondragend: () => { el.classList.remove('drag'); } },
              h('div.t', { onclick: it.open }, it.title), it.sub && h('div.s', it.sub),
              h('div.f', h('span.r5-kind', { style: { '--k': KIND[it.kind][1] } }, KIND[it.kind][0]), dueNode(it), canEdit() && h('select', { 'aria-label': 'Assigned to', onchange: e => reassign(it, e.target.value) }, ppl.map(p => h('option', { value: p.id, selected: p.id === it.owner }, first(p.name)))))); return el; })
            : h('div.r5-empty', 'Nothing ' + (AS.overdueOnly ? 'overdue' : 'assigned') + '. Drop a card here.')); return col; }))); }
  /* iPhone: a row for each person with what they hold; tap one to see only theirs. */
  const shown = filt.filter(it => AS.who === 'all' || it.owner === AS.who);
  return ui.list(note, ui.section({ header: 'By person', fold: false, footer: 'Tap a person to see only their work. Tap again for everyone.' },
      ppl.map(u => { const list = all.filter(it => it.owner === u.id), late = list.filter(lateItem).length, on = AS.who === u.id; return ui.row({ leading: ui.avatar(u.name, { size: 34 }), title: u.name + (u.id === mine ? ' (you)' : ''), subtitle: countText(list), badge: late ? ui.badge(late + ' overdue', 'var(--red)') : null, trailing: on ? icon('checkmark.circle.fill', 22, 'var(--tint)') : null, onTap: () => { AS.who = on ? 'all' : u.id; page.refresh(); } }); })),
    kindSeg,
    ui.section({ header: (AS.who === 'all' ? 'Everyone' : staff(AS.who)) + ' · ' + plural(shown.length, 'open item'), fold: false, footer: canEdit() ? 'The person button on a row hands it to someone else.' : null },
      shown.length ? shown.slice(0, 60).map(it => ui.row({ leading: h('span.r5-kind', { style: { '--k': KIND[it.kind][1] } }, KIND[it.kind][0]), title: it.title, subtitle: [it.sub, first(staff(it.owner))].filter(Boolean).join(' · '), detail: dueNode(it),
        trailing: canEdit() ? ui.iconBtn('person', 'Reassign ' + it.title, e => ui.menu((e && e.currentTarget) || document.activeElement, [{ header: 'Assign to' }].concat(ppl.map(p => ({ label: p.name, checked: p.id === it.owner, onTap: () => { reassign(it, p.id); page.refresh(); } })))) ) : null, onTap: it.open }))
        : ui.row({ title: 'Nothing here', subtitle: 'No open ' + (AS.kind === 'all' ? 'work' : KIND[AS.kind][2].toLowerCase()) + ' for ' + (AS.who === 'all' ? 'anyone' : first(staff(AS.who))) })),
    AS.who !== 'all' && canEdit() && shown.length > 0 && h('div', { style: 'padding:0 0 16px' }, ui.button('Hand all of this to someone else…', { kind: 'gray', icon: 'arrow.left.arrow.right', onTap: () => moveAll(q.user(AS.who) || { id: AS.who, name: staff(AS.who) }, all.filter(it => it.owner === AS.who), page) }))); };
WD.panel.addJump('CRM assignments', () => { const X = (WD.screens.crm || {}).x; if (X && X.R) X.R.side = 'assign'; WD.nav.switchTab('crm'); WD.changed(); });

/* ================= AI Premium: overdue invoices and emails that do not arrive ================= */
/* data.emailHealth[customerId] = {kind: 'bounce' | 'typo' | 'spam', to, fix, since, short, detail}. In the product this comes from the mail
   service's delivery, bounce and open events; the prototype marks a few customers who owe money so the review has something to show. */
const HIGH = () => (data.collect || (data.collect = { high: 250, log: [] })).high;
const emailOf = c => c.billingEmail || ((c.contacts || []).find(p => p.email) || {}).email || '';
const debtors = () => (data.customers || []).filter((c, i, all) => all.findIndex(x => x.id === c.id) === i).map(c => ({ c, inv: unpaidOf(c) })).filter(x => x.inv.length).map(x => ({ ...x, owed: x.inv.reduce((t, i) => t + i.amount, 0) })).sort((a, b) => b.owed - a.owed);
function seedHealth() { if (data.emailHealth) return data.emailHealth; const EH = data.emailHealth = {}; if (!X11().unpaidInv) return EH;
  const ds = debtors().filter(d => emailOf(d.c)).sort((a, b) => b.owed - a.owed);
  [['typo', 1], ['bounce', 3], ['spam', 4]].forEach(([kind, at]) => { const d = ds[at] || ds[ds.length - 1]; if (!d || EH[d.c.id]) return; const good = emailOf(d.c), i = good.lastIndexOf('.'), dom = good.slice(good.indexOf('@') + 1, i < 0 ? undefined : i);
    const bad = dom.length > 3 ? good.replace(dom, dom.slice(0, -2) + dom.slice(-1) + dom.slice(-2, -1)) : good, since = D.add(today(), -(20 + hash(d.c.id) % 40));
    EH[d.c.id] = kind === 'typo' ? { kind, to: bad, fix: good, since, short: 'The address on file, ' + bad + ', looks mistyped.', detail: 'Every invoice since ' + fmt.day(since, 'md') + ' went to ' + bad + ' and bounced. The domain is one swap away from ' + good.slice(good.indexOf('@') + 1) + ', which their other contacts use.' }
      : kind === 'bounce' ? { kind, to: good, since, short: good + ' bounces: the mailbox no longer exists.', detail: 'The mail server has rejected ' + good + ' since ' + fmt.day(since, 'md') + ' (“user unknown”). The person may have left.' }
      : { kind, to: good, since, short: 'Delivered to ' + good + ' but never opened: probably a spam filter.', detail: 'Their server accepts our invoices, but none has been opened since ' + fmt.day(since, 'md') + '. Earlier ones were opened within a day. That pattern usually means a spam or quarantine filter.' }; });
  return EH; }
R.emailTrouble = c => { const e = seedHealth()[c.id]; return e && !e.fixed ? e : null; };
/** Customers worth acting on: something overdue, and either a lot of money or several unpaid invoices; plus anyone our emails do not reach. */
function collectItems() { if (!X11().unpaidInv) return []; const hi = HIGH();
  return debtors().map(d => { const late = lateOf(d.c), inv = unpaidOf(d.c), et = R.emailTrouble(d.c), lateSum = late.reduce((s, i) => s + i.amount, 0), oldest = inv.map(i => i.day).sort()[0];
    const why = [late.length && lateSum >= hi && ['High amount overdue', 'var(--red)'], late.length && inv.length >= 2 && [inv.length + ' unpaid invoices', 'var(--orange)'], et && ['Not receiving our emails', 'var(--purple)']].filter(Boolean);
    return { c: d.c, inv, late, owed: inv.reduce((t, i) => t + i.amount, 0), lateSum, oldest, et, why, show: (late.length && (lateSum >= hi || inv.length >= 2)) || (!!et && inv.length > 0) }; }).filter(x => x.show).sort((a, b) => (b.et ? 1 : 0) - (a.et ? 1 : 0) || b.lateSum - a.lateSum); }
const contactOf = c => (c.contacts || []).find(p => p.phone) || (c.contacts || [])[0] || {};
const logDone = (it, text) => { (data.collect.log = data.collect.log || []).unshift({ at: now(), customerId: it.c.id, text, by: 'AI Premium · approved by ' + me() }); (it.c.collectDone = it.c.collectDone || []).push(text); if (K().addI) K().addI({ customerId: it.c.id, type: 'note', at: now(), text: 'Collections: ' + text, by: 'AI Premium · approved by ' + me() }); };
/** What AI Premium recommends for one customer, and the steps it can take itself. */
function plan(it) { const c = it.c, p = contactOf(c), nm = first(p.name || 'the contact'), et = it.et, n = it.inv.length, acts = [], oldDays = D.diff(today(), it.oldest);
  let rec;
  if (et && et.kind === 'typo') { rec = 'They have probably never seen these invoices. ' + et.detail + ' Correct the address and send all ' + n + ' again before treating this as a collections problem.';
    acts.push({ id: 'fix', label: 'Fix the address and resend ' + plural(n, 'invoice'), auto: true, run: () => { c.billingEmail = et.fix; et.fixed = true; logDone(it, 'Billing email corrected to ' + et.fix + ' and ' + plural(n, 'invoice') + ' resent.'); } }); }
  else if (et && et.kind === 'bounce') { rec = 'These invoices are not arriving. ' + et.detail + ' Get the invoices to them another way now, and ask ' + nm + ' who handles payables.';
    if (p.phone) acts.push({ id: 'text', label: 'Text ' + nm + ' the payment link', auto: true, run: () => logDone(it, 'Texted the customer-portal payment link to ' + (p.name || 'the contact') + ' at ' + fmt.phone(p.phone) + '.') });
    acts.push({ id: 'mail', label: 'Print and mail a statement', auto: true, run: () => logDone(it, 'Statement of ' + plural(n, 'unpaid invoice') + ' queued for print and mail to the billing address.') });
    acts.push({ id: 'task', label: 'Task: get the right billing email', auto: true, run: () => { if (K().addTask) K().addTask(c.id, 'Call for the correct billing email (ours bounces)', 0, { owner: c.owner || (S.me || {}).id }); logDone(it, 'Follow-up added: get the correct billing email.'); } }); }
  else if (et) { rec = 'They may not know they owe this. ' + et.detail + ' Reach them outside email, and ask them to mark our billing address as safe.';
    if (p.phone) acts.push({ id: 'text', label: 'Text ' + nm + ' the payment link', auto: true, run: () => logDone(it, 'Texted the customer-portal payment link to ' + (p.name || 'the contact') + ' at ' + fmt.phone(p.phone) + ', with a note to check the spam folder.') });
    const other = (c.contacts || []).find(x => x.email && x.email !== et.to); if (other) acts.push({ id: 'cc', label: 'Resend to ' + first(other.name) + ' as well', auto: true, run: () => logDone(it, 'Invoices resent with ' + other.email + ' copied.') });
    acts.push({ id: 'mail', label: 'Print and mail a statement', auto: true, run: () => logDone(it, 'Statement queued for print and mail to the billing address.') }); }
  else { rec = (it.lateSum >= HIGH() ? money(it.lateSum) + ' is overdue, the oldest invoice by ' + plural(oldDays, 'day') + '. ' : '') + (n >= 2 ? plural(n, 'invoice') + ' are unpaid, so the newer ones are following the older one. ' : '') + 'The invoices were delivered and opened, so this is a decision on their side. A phone call works better than another reminder' + (n >= 3 ? ', and it is reasonable to hold further service until the oldest is paid.' : '.');
    acts.push({ id: 'stmt', label: 'Send one statement of all ' + n, auto: true, run: () => logDone(it, 'Statement of ' + plural(n, 'unpaid invoice') + ' (' + money(it.owed) + ') emailed to ' + (emailOf(c) || 'the billing contact') + '.') });
    acts.push({ id: 'task', label: 'Task for ' + first(staff(c.owner)) + ': call ' + nm, auto: true, run: () => { if (K().addTask) K().addTask(c.id, 'Call ' + (p.name || 'the customer') + ' about ' + money(it.owed) + ' overdue', 0, { owner: c.owner || (S.me || {}).id }); logDone(it, 'Follow-up added for ' + staff(c.owner) + ': call about the overdue balance.'); } });
    if (p.phone && WD.calls && WD.calls.place) acts.push({ id: 'call', label: 'Call ' + nm + ' now', auto: false, run: () => WD.calls.place({ number: p.phone, customerId: c.id, contact: p.name }) }); }
  return { rec, acts }; }
R.collectSpec = () => ({ title: 'Overdue invoice review', render: page => {
  if (!aip()) return ui.empty({ icon: 'sparkles', title: 'AI Premium is off', text: 'This review is part of AI Premium.' });
  const its = collectItems(), total = its.reduce((s, x) => s + x.owed, 0), trouble = Object.keys(seedHealth()).map(id => q.customer(id)).filter(c => c && R.emailTrouble(c)), edit = WD.can('billing.manage') || WD.can('billing.view');
  const todo = its.flatMap(it => plan(it).acts.filter(a => a.auto && !(it.c.collectDone || []).length).slice(0, 1).map(a => ({ it, a })));
  const doAct = async (it, a) => { if (!a.auto) return a.run(); if (await ui.run(a.label + '…', () => a.run(), { done: 'Done' })) { WD.changed(); page.refresh(); } };
  return ui.list(
    WD.aip.card({ title: 'AI Premium · overdue invoices', text: its.length ? plural(its.length, 'customer') + ' need attention: ' + money(total) + ' unpaid. I looked for overdue invoices that are either large (' + money(HIGH()) + ' or more) or one of several unpaid for the same customer, and checked whether our emails are reaching each of them.' : 'Nothing needs attention: no customer has a large overdue balance or several unpaid invoices.',
      lines: [trouble.length ? h('span', h('b', plural(trouble.length, 'customer') + ' may never have seen their invoices. '), 'Their email bounces, is mistyped or goes unopened. Those are first in the list.') : null, todo.length ? h('span', h('b', 'I can take the first step on ' + todo.length + ' of these' + ' for you. '), 'Each one is listed below; nothing is sent until you say so.') : null].filter(Boolean),
      action: edit && todo.length > 1 ? h('div', { style: 'margin-top:10px' }, ui.button('Do the first step for all ' + todo.length, { small: true, block: false, icon: 'sparkles', onTap: async () => { if (!await ui.alert({ title: 'Take ' + plural(todo.length, 'step') + '?', message: todo.map(x => x.it.c.name + ': ' + x.a.label).join('\n'), buttons: [{ label: 'Not now', value: false }, { label: 'Do them', value: true, bold: true }] })) return; if (await ui.run('Working through ' + todo.length + '…', () => todo.forEach(x => x.a.run()), { done: plural(todo.length, 'step') + ' done' })) { WD.changed(); page.refresh(); } } })) : null }),
    its.map(it => { const P = plan(it), done = it.c.collectDone || [];
      return h('div.r5-inv', h('div.top', { onclick: () => openRecord(it.c) }, ui.avatar(it.c.name, { size: 36 }), h('div.m', h('div.n', it.c.name), h('div.footnote.secondary', plural(it.inv.length, 'unpaid invoice') + ' · ' + it.late.length + ' overdue · oldest ' + fmt.day(it.oldest, 'md'))), h('div.a', money(it.owed))),
        h('div.why', it.why.map(([t, col]) => ui.badge(t, col))), h('div.rec', P.rec),
        done.map(t => h('div.done', icon('checkmark.circle.fill', 16, 'var(--green)'), t)),
        edit && h('div.acts', h('div.footnote.secondary', { style: 'flex-basis:100%' }, done.length ? 'More I can do:' : 'I can do this for you:'), P.acts.map((a, i) => ui.button(a.label, { kind: i === 0 && !done.length ? 'filled' : 'gray', small: true, block: false, icon: a.auto ? 'sparkles' : 'phone.fill', onTap: () => doAct(it, a) })),
          WD.rc && WD.rc.openStatement && ui.button('See the invoices', { kind: 'plain', small: true, block: false, onTap: () => WD.rc.openStatement(it.c) }))); }),
    trouble.length > 0 && ui.section({ header: 'Customers not receiving our emails', fold: false, showFooter: true, footer: 'Flagged from bounces, addresses that look mistyped, and invoices that are delivered but never opened. The flag also shows when one of them calls. Other ways to get an invoice to them: a text with the portal link, a paper copy by mail, a copy to another contact, or the driver handing it over at the next stop.' },
      trouble.map(c => { const e = R.emailTrouble(c); return ui.row({ icon: 'envelope', iconColor: e.kind === 'spam' ? 'var(--orange)' : 'var(--red)', title: c.name, subtitle: e.short, badge: ui.badge(e.kind === 'typo' ? 'Mistyped' : e.kind === 'bounce' ? 'Bounces' : 'Unopened', e.kind === 'spam' ? 'var(--orange)' : 'var(--red)'), chevron: true, onTap: () => openRecord(c) }); })),
    ui.section({ header: 'What counts as a high amount', fold: false, footer: 'An overdue balance at or above this is listed even when it is a single invoice.' }, ui.row({ title: 'High amount', trailing: h('div.hstack', { style: 'gap:4px' }, h('span.secondary', '$'), ui.numField ? ui.numField(HIGH(), 50, 100000, v => { data.collect.high = v; WD.changed(); page.refresh(); }, 'High amount') : String(HIGH())) })),
    (data.collect.log || []).length > 0 && ui.section({ header: 'Done so far', fold: true, folded: true }, data.collect.log.slice(0, 20).map(l => ui.row({ title: (q.customer(l.customerId) || {}).name || 'Customer', subtitle: l.text, detail: fmt.rel(l.at) })))); } });
/** The card at the top of Invoices (AI Premium only). */
R.collectCard = push => { if (!aip() || !(WD.can('billing.view') || WD.can('billing.manage'))) return null; let its; try { its = collectItems(); } catch (e) { return null; } if (!its.length) return null;
  const tr = its.filter(x => x.et).length;
  return h('div', { style: 'padding:0 16px 10px' }, WD.aip.card({ title: 'AI Premium · overdue invoices', text: plural(its.length, 'customer') + ' with a large or repeated overdue balance, ' + money(its.reduce((s, x) => s + x.owed, 0)) + ' in all.' + (tr ? ' ' + tr + ' of them may not be getting our emails.' : ''),
    action: h('div', { style: 'margin-top:8px' }, ui.button('Review and act', { small: true, block: false, icon: 'sparkles', onTap: () => push(R.collectSpec()) })) })); };
function wrapInvoices() { const IS = WD.screens.invoices; if (!IS || !IS.root || IS.root.r15) return; const root0 = IS.root;
  IS.root = o => { const spec = root0(o), render0 = spec.render; spec.render = page => { const out = render0(page), cardEl = R.collectCard(s => page.push(s)); return cardEl ? [cardEl].concat(out) : out; }; return spec; }; IS.root.r15 = true; }
WD.panel.addJump('AI overdue invoice review', () => { if (!aip()) return ui.toast('Turn AI Premium on in the panel first', 'sparkles'); WD.nav.switchTab('invoices'); WD.nav.push(R.collectSpec()); });

if (WD.aip && WD.aip.feature) {
  WD.aip.feature('Call summary', 'the call screen', 'When a call starts, the few facts that matter: the last service, what was quoted against what the job came to, unpaid invoices and open requests.');
  WD.aip.feature('Overdue invoice review', 'Invoices', 'Finds large or repeated overdue balances, flags customers whose email bounces, is mistyped or goes unopened, recommends what to do and offers to do it.');
}
wrapForms(); wrapInvoices();
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('assign', AS); }
})();
