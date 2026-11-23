/* RouteClerk prototype 5.2 — the office team on the phones.
   WD.texts: the text inbox (threads, who replied, flagged when nobody answers in time, resolve).
   WD.staff: who is on a call now, the agent filter shared by calls and texts, who created and last changed a job,
             office staff reports for owners and admins (activity, time in the app, load by hour, AI staffing advice),
             and call quality: the files the AI reads (protocol, feedback, staffing targets), what it flags for the person
             in charge of training, and her feedback, which is written back to those files.
   Everything is a mock: the history is generated, the AI findings are picked by rule, and nothing leaves the browser. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, T = WD.staff = {}, X = WD.texts = {};
const plural = RC.plural || ((n, w) => n + ' ' + w + (n === 1 ? '' : 's')), now = () => +WD.now(), first = n => String(n || '').split(' ')[0], me = () => (S.me && S.me.name) || 'You';
const admin = () => ['owner', 'admin'].includes((S.me || {}).role), canEdit = () => WD.can('crm.edit');
const office = () => (data.users || []).filter(u => ['owner', 'admin', 'dispatcher', 'office'].includes(u.role) && u.status !== 'invited');
const aiCard = o => RC.aiCard ? RC.aiCard(o) : h('div', o.text), aiOn = () => !WD.aip || WD.aip.on();
const ask = (title, ph, value, msg) => RC.ask ? RC.ask(title, ph, value, msg) : Promise.resolve(null);
const hs = s => { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 0) % 100000) / 100000; };
const span = m => m < 60 ? Math.round(m) + ' min' : m < 1440 ? Math.round(m / 6) / 10 + ' h' : Math.round(m / 1440) + ' d';
const cst = () => { const s = data.callSettings || (data.callSettings = { threshold: 20, outShort: false, autoResolve: true, ring: {} }); if (s.textWait == null) s.textWait = 30; return s; };
const org = () => S.org || (data.orgs || [])[0] || { id: 'o', name: 'RouteClerk' };

WD.css(`
.tm-inhead { display: flex; align-items: center; gap: 10px; margin: 12px 2px 2px; } .tm-inhead > div { flex: 1; min-width: 0; } .tm-inhead b { display: block; font-size: 20px; line-height: 24px; letter-spacing: -.4px; } .tm-inhead small { display: block; font-size: 13px; color: var(--label2); }
.tm-bar { display: flex; gap: 8px; align-items: center; margin: 10px 0 2px; }
.tm-bar .segmented { flex: 1; }
.tm-ag { appearance: none; border: 0; background: var(--fill3); color: var(--label); border-radius: 10px; min-height: 44px; padding: 0 12px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap; max-width: 46%; overflow: hidden; text-overflow: ellipsis; }
.tm-ag.on { background: color-mix(in srgb, var(--tint) 16%, var(--cell)); color: var(--tint); font-weight: 600; }
.tm-live { display: flex; gap: 8px; overflow-x: auto; padding: 8px 0 2px; scrollbar-width: none; }
.tm-pill { flex: none; display: flex; align-items: center; gap: 8px; background: var(--cell); border-radius: 14px; padding: 6px 12px 6px 6px; font-size: 13px; line-height: 16px; }
.tm-pill b { display: block; font-size: 14px; font-weight: 600; } .tm-pill .s { color: var(--label2); }
.tm-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--gray); flex: none; } .tm-dot.call { background: var(--red); box-shadow: 0 0 0 3px color-mix(in srgb, var(--red) 25%, transparent); } .tm-dot.free { background: var(--green); }
.tx-snip { color: var(--label2); font-size: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tx-meta { text-align: right; font-size: 12px; color: var(--label2); white-space: nowrap; }
.tx-th { display: flex; flex-direction: column; gap: 4px; padding: 6px 4px 12px; }
.tx-b { max-width: 78%; padding: 8px 12px; border-radius: 18px; font-size: 16px; line-height: 21px; background: var(--fill3); color: var(--label); align-self: flex-start; white-space: pre-wrap; }
.tx-b.out { align-self: flex-end; background: var(--green); color: #fff; }
.tx-by { font-size: 12px; color: var(--label2); align-self: flex-start; margin: 0 6px 6px; } .tx-by.out { align-self: flex-end; }
.tx-new { padding: 8px 12px; } .tx-new textarea { width: 100%; min-height: 104px; border: 0; padding: 4px 0; font: inherit; font-size: 17px; background: none; color: var(--label); resize: none; outline: none; }
.tx-newbar { padding: 0 0 10px; }
.tx-dir { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--fill3); color: var(--green); flex: none; } .tx-dir.out { color: var(--tint); }
.tx-send { display: flex; gap: 8px; align-items: flex-end; padding: 8px 0; }
.tx-send textarea { flex: 1; min-height: 44px; border: 1px solid var(--sep); border-radius: 20px; padding: 10px 14px; font: inherit; font-size: 16px; background: var(--cell); color: var(--label); resize: none; }
.tm-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(104px, 1fr)); gap: 8px; margin: 10px 0; }
.tm-tile { background: var(--cell); border-radius: 12px; padding: 10px 12px; } .tm-tile b { display: block; font-size: 22px; line-height: 26px; font-weight: 700; } .tm-tile span { font-size: 12px; color: var(--label2); } .tm-tile i { font-style: normal; font-size: 12px; font-weight: 600; }
.tm-tbl { background: var(--cell); border-radius: 12px; overflow-x: auto; margin-bottom: 6px; }
.tm-tbl table { border-collapse: collapse; width: 100%; font-size: 14px; white-space: nowrap; }
.tm-tbl th { font-size: 12px; font-weight: 600; color: var(--label2); text-align: right; padding: 10px 10px 6px; } .tm-tbl th:first-child, .tm-tbl td:first-child { text-align: left; position: sticky; left: 0; background: var(--cell); }
.tm-tbl td { text-align: right; padding: 10px; border-top: 1px solid var(--sep); font-variant-numeric: tabular-nums; } .tm-tbl tr.on td { background: color-mix(in srgb, var(--tint) 10%, var(--cell)); } .tm-tbl tbody tr { cursor: pointer; }
.tm-chart { background: var(--cell); border-radius: 12px; padding: 12px; margin-bottom: 6px; }
.tm-bars { display: flex; align-items: flex-end; gap: 2px; height: 96px; } .tm-bars i { flex: 1; background: var(--tint); border-radius: 2px 2px 0 0; min-height: 1px; opacity: .85; } .tm-bars i.m { background: var(--red); }
.tm-ax { display: flex; justify-content: space-between; font-size: 12px; color: var(--label2); margin-top: 4px; }
.tm-heat { display: grid; grid-template-columns: 34px repeat(12, 1fr); gap: 2px; font-size: 12px; color: var(--label2); align-items: center; }
.tm-heat .c { height: 26px; border-radius: 4px; background: color-mix(in srgb, var(--k, var(--tint)) calc(var(--v) * 1%), var(--fill3)); display: grid; place-items: center; color: var(--label); font-size: 12px; }
.tm-heat .c.hot { outline: 2px solid var(--red); outline-offset: -2px; } .tm-heat .c.cold { outline: 2px dashed var(--green); outline-offset: -2px; } .tm-heat .hd { text-align: center; }
.tm-file { background: var(--cell); border-radius: 12px; padding: 12px 14px; font: 13px/19px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; color: var(--label); }
.tm-q { background: var(--fill3); border-radius: 10px; padding: 8px 10px; font-size: 14px; line-height: 19px; margin-top: 6px; } .tm-q b { font-weight: 600; }
.jb-audit { font-size: 13px; color: var(--label2); margin-top: 6px; display: flex; flex-wrap: wrap; gap: 2px 12px; } .jb-audit b { font-weight: 600; color: var(--label); }
.jb-hist { appearance: none; border: 0; background: color-mix(in srgb, var(--tint) 14%, transparent); color: var(--tint); font: inherit; font-size: 13px; font-weight: 600; border-radius: 14px; min-height: 30px; padding: 0 12px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; flex-basis: auto; margin-top: 4px; }
`);

/* ================= Texts ================= */
const TT = [   // [customer index or null, minutes since the last message, [[dir, text, staff index]], resolved how]
  [0, 14, [['in', 'Hi, can we add a second bin starting with the next visit?']]],
  [1, 190, [['in', 'Your truck did not come today. Is someone still coming?']]],
  [2, 55, [['out', 'Hi {c}, this is {st} at {biz}. The quote for your purge is in the email we just sent.', 0], ['in', 'Got it, thanks. Can you do Thursday?']]],
  [3, 300, [['in', 'What do I owe on the last invoice?'], ['out', 'Hi {c}, I can see one open invoice. I just emailed a copy with the pay link.', 1], ['in', 'Found it, paying now'], ['out', 'Thank you! It shows as paid.', 1]]],
  [4, 1500, [['out', 'Reminder: we service tomorrow between 9 and 11.', 2], ['in', 'Thanks. The gate code is 4410 now']], 'Gate code saved on the customer'],
  [5, 2900, [['in', 'Please call me about the contract renewal'], ['out', 'Will do. {st} will call you this afternoon.', 0]]],
  [null, 75, [['in', 'Do you shred hard drives? How much for 20?']]],
];
function seedTexts() { const cs = (data.customers || []).filter(c => !c.archived && (c.contacts || []).some(p => p.phone)), names = office().map(u => u.name), o = org(), line = ((o.lines || [])[0] || { label: 'Main' }).label;
  data.textsOrg = o.id;
  return TT.map(([ci, ago, ms, done], k) => { const c = ci == null ? null : cs[(ci * 3 + 1) % Math.max(1, cs.length)], p = c ? c.contacts.find(x => x.phone) : null, last = now() - ago * 60000;
    const put = (s, by) => s.replace('{c}', first(p ? p.name.replace(/^(Dr|Mr|Mrs|Ms)\.? /, '') : 'there')).replace('{st}', first(by || names[0] || 'Sam')).replace('{biz}', o.name);
    const msgs = ms.map(([dir, text, si], i) => { const by = dir === 'out' ? names[(si || 0) % Math.max(1, names.length)] || 'Office' : null; return { dir, text: put(text, by), at: last - (ms.length - 1 - i) * 9 * 60000, by }; });
    return { id: o.id + 't' + (k + 1), number: p ? p.phone : '+15125550142', customerId: c ? c.id : null, contact: p ? p.name : null, line, messages: msgs, resolved: !!done, resolvedHow: done || null, resolvedBy: done ? names[1 % Math.max(1, names.length)] : null, resolvedAt: done ? last + 6e5 : null, flag: false, flagBy: null }; }); }
const threads = () => { if (!data.textThreads || data.textsOrg !== org().id) data.textThreads = seedTexts(); return data.textThreads; };
const lastOf = t => t.messages[t.messages.length - 1], nameOfT = t => { const c = t.customerId && q.customer(t.customerId); return c ? c.name : t.contact || fmt.phone(t.number); };
X.list = () => threads().slice().sort((a, b) => lastOf(b).at - lastOf(a).at); X.nameOf = t => nameOfT(t);
X.agents = t => [...new Set(t.messages.filter(m => m.by).map(m => m.by))];
/** Why a thread needs a second look: flagged by hand, or the customer has waited longer than the setting. */
X.why = t => { const l = lastOf(t); if (t.flag) return 'Flagged by ' + first(t.flagBy || 'staff'); if (l && l.dir === 'in') { const m = (now() - l.at) / 60000; if (m >= cst().textWait) return 'No reply for ' + span(m); } return null; };
X.waiting = t => !t.resolved && (t.flag || lastOf(t).dir === 'in');
X.isOpen = t => !t.resolved && !!X.why(t);
X.inboxCount = () => { try { return S.signedIn && WD.can('crm.view') ? threads().filter(X.waiting).length : 0; } catch (e) { return 0; } };
X.reviewCount = () => { try { return S.signedIn && WD.can('crm.view') ? threads().filter(X.isOpen).length : 0; } catch (e) { return 0; } };
X.resolve = (ts, how) => { ts = [].concat(ts).filter(t => !t.resolved); if (!ts.length) return; if (!canEdit()) return ui.toast('You can’t change texts with this role', 'lock');
  ts.forEach(t => Object.assign(t, { resolved: true, resolvedAt: now(), resolvedBy: me(), resolvedHow: how || 'Handled', flag: false })); WD.changed();
  ui.banner({ title: ts.length === 1 ? 'Resolved · ' + nameOfT(ts[0]) : plural(ts.length, 'conversation') + ' resolved', text: 'Tap to undo.', icon: 'checkmark.circle', color: 'var(--green)', duration: 6000, onTap: () => { ts.forEach(t => Object.assign(t, { resolved: false, resolvedAt: null, resolvedBy: null, resolvedHow: null })); WD.changed(); } }); };
X.send = (t, text) => { t.messages.push({ dir: 'out', text, at: now(), by: me() }); t.flag = false; WD.changed(); };
X.receive = (t, text) => { t.messages.push({ dir: 'in', text, at: now(), by: null }); t.resolved = false; WD.changed(); };
const textRow = (t, page, inbox) => { const l = lastOf(t), y = X.why(t), ag = X.agents(t), C = WD.calls;
  return ui.row({ class: inbox && C && C.isSel && C.isSel('text', t.id) ? 'sel' : '', leading: ui.avatar(nameOfT(t), { size: 40 }), title: nameOfT(t),
    subtitle: [h('div.tx-snip', (l.dir === 'out' ? first(l.by) + ': ' : '') + l.text), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-top:4px' }, y && !t.resolved ? ui.badge(y, 'var(--red)') : X.waiting(t) ? ui.badge('Waiting for a reply', 'var(--orange)') : null, t.resolved && ui.badge('Resolved', 'var(--gray)'), ag.length ? ui.badge(ag.map(first).join(', '), 'var(--blue)') : ui.badge('Nobody yet', 'var(--gray)'))],
    trailing: h('div.tx-meta', h('div', fmt.rel(l.at)), h('div', t.line + ' line')), onTap: () => inbox && C && C.pick ? C.pick('text', t.id, page) : page.push(X.threadSpec(t.id)) }); };
X.threadSpec = id => { let draft = ''; return { title: 'Text', render: page => { const t = threads().find(x => x.id === id); if (!t) return ui.empty({ icon: 'message', title: 'Conversation not found' });
  const PHN = WD.phone, out = !!PHN && PHN.optedOut(t.number); t.seen = true;   // 6.2: opt-outs, ready-made texts, photos (r20-phone.js)
  const y = X.why(t), edit = canEdit(), c = t.customerId && q.customer(t.customerId), ta = h('textarea', { rows: 1, placeholder: 'Text message', oninput: e => { draft = e.target.value; } }); ta.value = draft;
  return ui.list(h('div', { style: 'text-align:center;padding:4px 0 10px' }, h('div.headline', nameOfT(t)), h('div.footnote.secondary', [t.contact, fmt.phone(t.number), t.line + ' line'].filter(Boolean).join(' · '))),
    y && !t.resolved && h('div.tm-q', { style: 'margin:0 0 10px' }, h('b', 'Needs review: ' + y + '. '), 'It stays in the inbox until someone replies or resolves it.'),
    h('div.tx-th', t.messages.map(m => [h('div.tx-b' + (m.dir === 'out' ? '.out' : ''), m.text), h('div.tx-by' + (m.dir === 'out' ? '.out' : ''), (m.dir === 'out' ? 'Sent by ' + (m.by || 'the office') : t.contact || 'Customer') + ' · ' + fmt.rel(m.at))])),
    PHN && PHN.threadTop(t, v => { draft = v; ta.value = v; ta.focus(); }),
    edit && !out && h('div.tx-send', ta, ui.button('Send', { block: false, small: true, onTap: () => { const v = draft.trim(); if (!v) return ui.toast('Write a message first', 'message'); if (X.send(t, v) === false) return; draft = ''; page.refresh(); ui.toast('Sent · logged as ' + first(me()), 'checkmark'); } })),
    PHN && PHN.threadExtras(t),
    ui.section({ header: 'Who handled it', fold: false, footer: 'Every message we send keeps the name of the person who sent it.' },
      X.agents(t).length ? X.agents(t).map(a => ui.row({ leading: ui.avatar(a, { size: 30 }), title: a, detail: plural(t.messages.filter(m => m.by === a).length, 'message') })) : ui.row({ title: 'Nobody has replied yet' }),
      t.resolved && ui.row({ title: 'Resolved', subtitle: [t.resolvedHow, t.resolvedBy, t.resolvedAt && fmt.rel(t.resolvedAt)].filter(Boolean).join(' · ') })),
    ui.section(null, c && ui.row({ icon: 'person', title: 'Open ' + c.name, chevron: true, onTap: () => WD.screens.customers && WD.screens.customers.openDetail && WD.screens.customers.openDetail(c.id) }),
      ui.row({ icon: 'phone', title: 'Call ' + fmt.phone(t.number), onTap: () => WD.calls && WD.calls.place && WD.calls.place({ number: t.number }) }),
      edit && (t.resolved ? ui.row({ icon: 'arrow.uturn.left', title: 'Reopen', onTap: () => { t.resolved = false; WD.changed(); page.refresh(); } }) : ui.row({ icon: 'checkmark.circle', title: 'Resolve', subtitle: 'Takes it out of the inbox', tint: true, onTap: () => { X.resolve(t); page.pop(); } })),
      edit && WD.files && ui.row({ icon: 'doc', title: 'Send a company file', subtitle: 'W-9, COI, license, references…', chevron: true, onTap: () => WD.files.send({ customerId: t.customerId, to: t.customerId ? undefined : t.number }) }),
      edit && !t.resolved && ui.row({ icon: 'flag', title: t.flag ? 'Remove the review flag' : 'Flag for review', onTap: () => { t.flag = !t.flag; t.flagBy = t.flag ? me() : null; WD.changed(); page.refresh(); } }))); } }; };

/* ================= 5.3: write a new text, and the log of every message ================= */
const dg = v => String(v || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
/** People with a phone number whose name, company or number matches what was typed. */
const findPeople = text => { const t = String(text || '').trim().toLowerCase(), n = dg(text), out = []; if (t.length < 2) return out;
  for (const c of data.customers || []) { if (c.archived) continue;
    for (const p of c.contacts || []) { if (!p.phone) continue; if ((n.length >= 2 && dg(p.phone).includes(n)) || (!/^[\d\s()+.-]+$/.test(t) && (c.name + ' ' + p.name).toLowerCase().includes(t))) { out.push({ c, p }); break; } }
    if (out.length >= 5) break; }
  return out; };
/** Send a text to a number: it joins the conversation with that number, or starts one. → the conversation. */
X.sendTo = (number, text, o = {}) => { let t = threads().find(x => dg(x.number) === dg(number));
  if (!t) { const hit = (data.customers || []).map(c => ({ c, p: (c.contacts || []).find(p => dg(p.phone) === dg(number)) })).find(x => x.p && !x.c.archived);
    t = { id: org().id + 't' + (threads().length + 1) + '-' + now().toString(36), number: hit ? hit.p.phone : number, customerId: hit ? hit.c.id : null, contact: hit ? hit.p.name : null, line: o.line || ((org().lines || [])[0] || { label: 'Main' }).label, messages: [], resolved: false, resolvedHow: null, resolvedBy: null, resolvedAt: null, flag: false, flagBy: null };
    threads().push(t); }
  if (o.line) t.line = o.line; t.resolved = false; X.send(t, text); return t; };
/** The New text sheet. preset: {number, text}. Sending opens the conversation on the Dialer. */
X.compose = (preset = {}) => { if (!canEdit()) return ui.toast('You can’t send texts with this role', 'lock');
  const lines = org().lines || [], d = { to: preset.number ? fmt.phoneTyping(dg(preset.number)) : '', pick: null, text: preset.text || '', line: (lines[0] || { label: 'Main' }).label };
  { const m = d.to && findPeople(d.to).find(x => dg(x.p.phone) === dg(d.to)); if (m) d.pick = m; }
  const number = () => d.pick ? d.pick.p.phone : d.to;
  const send = page => { const n = dg(number()), v = d.text.trim(); if (WD.phone && WD.phone.optedOut(n) && n.length >= 7) return void WD.phone.optOutSpec && ui.alert({ title: 'This number opted out of texts', message: 'It replied STOP, so no text can be sent to it. Call or email instead.' }); if (n.length < 7) return ui.toast(/\d/.test(d.to) ? 'That number is too short' : 'Choose a person or enter a number', 'message'); if (!v) return ui.toast('Write a message first', 'message');
    const t = X.sendTo(number(), v, { line: d.line }); page.dismiss(); if (preset.onSent) { preset.onSent(t); return ui.toast('Text sent · logged as ' + first(me()), 'checkmark'); } WD.nav.switchTab('dialer'); WD.nav.push(X.threadSpec(t.id)); ui.toast('Sent · logged as ' + first(me()), 'checkmark'); };
  return ui.sheet({ title: 'New text', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: page => [{ label: 'Send', bold: true, onTap: () => send(page) }], render: page => {
    const hits = h('div'), ta = h('textarea', { rows: 4, placeholder: 'Text message', 'aria-label': 'Message', oninput: e => { d.text = e.target.value; } }); ta.value = d.text;
    const showHits = () => { const found = d.pick ? [] : findPeople(d.to); hits.replaceChildren(...found.map(x => ui.row({ leading: ui.avatar(x.c.name, { size: 34 }), title: x.p.name, subtitle: x.c.name + ' · ' + fmt.phone(x.p.phone), onTap: () => { d.pick = x; page.refresh(); setTimeout(() => ta.focus(), 60); } }))); };
    const had = d.pick && threads().find(x => dg(x.number) === dg(d.pick.p.phone)); showHits();
    return ui.list(
      ui.section({ header: 'To', fold: false, footer: d.pick ? (had ? 'You already have a conversation with this number. The message is added to it.' : 'This starts a new conversation.') : 'Type a name, a company or a phone number. Any number works, a customer or not.' },
        d.pick ? ui.row({ leading: ui.avatar(d.pick.c.name, { size: 40 }), title: d.pick.p.name, subtitle: d.pick.c.name + ' · ' + fmt.phone(d.pick.p.phone), trailing: h('button.nav-btn', { 'aria-label': 'Choose someone else', onclick: () => { d.pick = null; d.to = ''; page.refresh(); } }, icon('xmark', 18)) })
          : ui.inputRow({ icon: 'person', placeholder: 'Name or number', value: d.to, autofocus: !d.to, caps: 'words', onInput: v => { d.to = v; showHits(); } }), hits),
      lines.length > 1 && ui.section({ header: 'From', fold: false }, lines.map(l => ui.row({ title: l.label, detail: fmt.phone(l.number), trailing: d.line === l.label ? icon('checkmark', 18, 'var(--tint)') : null, onTap: () => { d.line = l.label; page.refresh(); } }))),
      ui.section({ header: 'Message', fold: false, footer: 'Your name is kept with every message you send.' }, h('div.tx-new', ta)),
      h('div', { style: 'margin-top:14px' }, ui.button('Send', { icon: 'message', onTap: () => send(page) }))); } }, { detent: 'large' }); };
/** Every text sent and received, newest first, one row per message. */
X.logSpec = () => { const f = { dir: 'all', text: '', n: 60, view: 'msgs' }; return { title: 'Text log', search: { placeholder: 'Search texts', onInput: (v, page) => { f.text = v; f.n = 60; page.refresh(); } },
  trailing: () => canEdit() ? [{ icon: 'square.and.pencil', label: 'New text', onTap: () => X.compose() }] : [], render: page => {
    const t0 = f.text.trim().toLowerCase(), all = threads().flatMap(t => t.messages.map(m => ({ t, m }))).sort((a, b) => b.m.at - a.m.at);
    const rows = all.filter(({ t, m }) => (f.dir === 'all' || m.dir === f.dir) && (!t0 || (nameOfT(t) + ' ' + (t.contact || '') + ' ' + m.text + ' ' + (m.by || '') + ' ' + t.number).toLowerCase().includes(t0) || (dg(t0).length > 2 && dg(t.number).includes(dg(t0)))));
    const count = dir => all.filter(x => x.m.dir === dir).length;
    const pickView = h('div', { style: 'padding-bottom:8px' }, ui.segmented([{ value: 'msgs', label: 'Every message' }, { value: 'threads', label: 'By conversation' }], f.view, v => { f.view = v; page.refresh(); }));
    if (f.view === 'threads') { const ts = X.list().filter(t => !t0 || (nameOfT(t) + ' ' + (t.contact || '') + ' ' + t.number + ' ' + t.messages.map(m => m.text).join(' ')).toLowerCase().includes(t0));
      return ui.list(pickView, ts.length ? ui.section({ footer: plural(ts.length, 'conversation') + ', answered and resolved ones included.' }, ts.map(t => textRow(t, page))) : ui.empty({ icon: 'message', title: 'No texts match', text: 'Try another word.' })); }
    return ui.list(pickView, h('div', { style: 'padding-bottom:8px' }, ui.segmented([{ value: 'all', label: 'All · ' + all.length }, { value: 'in', label: 'Received · ' + count('in') }, { value: 'out', label: 'Sent · ' + count('out') }], f.dir, v => { f.dir = v; f.n = 60; page.refresh(); })),
      rows.length ? ui.section({ footer: plural(rows.length, 'message') + (rows.length < all.length ? ' of ' + all.length : '') + '. Tap one to open its conversation.' },
        rows.slice(0, f.n).map(({ t, m }) => ui.row({ leading: h('div.tx-dir' + (m.dir === 'out' ? '.out' : ''), icon(m.dir === 'out' ? 'arrow.up.right' : 'arrow.down', 16)), title: nameOfT(t),
          subtitle: [h('div.tx-snip', m.text), h('div.footnote.secondary', { style: 'margin-top:3px' }, (m.dir === 'out' ? 'Sent by ' + (m.by || 'the office') : 'Received' + (t.contact ? ' from ' + t.contact : '')) + ' · ' + t.line + ' line')],
          trailing: h('div.tx-meta', h('div', fmt.rel(m.at))), onTap: () => page.push(X.threadSpec(t.id)) })),
        rows.length > f.n && ui.row({ title: 'Show more', tint: true, center: true, onTap: () => { f.n += 60; page.refresh(); } }))
      : ui.empty({ icon: 'message', title: all.length ? 'No texts match' : 'No texts yet', text: all.length ? 'Try another word, or choose All.' : 'Texts on your numbers show here.' })); } }; };

/* ================= Agent filter, inbox bar, who is on a call ================= */
const UI3 = T.ui = { callBox: 'inbox', textBox: 'inbox', agent: '', win: '30', from: null, to: null, heat: 'calls', rAgent: '' };
T.agentOK = by => !UI3.agent || (UI3.agent === '-' ? !by : [].concat(by || []).includes(UI3.agent));
/** Inbox / All switch with the agent filter beside it. key: 'callBox' | 'textBox'. */
T.boxBar = (key, inboxN, page, names) => { const cur = UI3[key], lab = !UI3.agent ? 'All agents' : UI3.agent === '-' ? 'Nobody' : first(UI3.agent);
  const btn = h('button.tm-ag' + (UI3.agent ? '.on' : ''), { 'aria-label': 'Filter by agent', onclick: e => ui.menu(e.currentTarget, [{ header: 'Show ' + (key === 'callBox' ? 'calls' : 'texts') + ' handled by' }, { label: 'All agents', checked: !UI3.agent, onTap: () => { UI3.agent = ''; page.refresh(); } }].concat(names.map(n => ({ label: n, checked: UI3.agent === n, onTap: () => { UI3.agent = n; page.refresh(); } })), [{ label: 'Nobody (missed, unanswered)', checked: UI3.agent === '-', onTap: () => { UI3.agent = '-'; page.refresh(); } }])) }, icon('person', 16), lab, icon('chevron.up.chevron.down', 12));
  return h('div.tm-bar', ui.segmented([{ value: 'inbox', label: 'Inbox', badge: inboxN }, { value: 'all', label: 'All' }], cur, v => { UI3[key] = v; page.refresh(); }), btn); };
T.box = key => UI3[key];
/** The heading of an inbox on the Dialer: its name, what is in it, and the agent filter. kind: 'calls' | 'texts'. */
T.inboxHead = (title, sub, kind, page) => { const names = T.agentNames(), lab = !UI3.agent ? 'All agents' : UI3.agent === '-' ? 'Nobody' : first(UI3.agent);
  const btn = h('button.tm-ag' + (UI3.agent ? '.on' : ''), { 'aria-label': 'Filter by agent', onclick: e => ui.menu(e.currentTarget, [{ header: 'Show ' + kind + ' handled by' }, { label: 'All agents', checked: !UI3.agent, onTap: () => { UI3.agent = ''; page.refresh(); } }].concat(names.map(n => ({ label: n, checked: UI3.agent === n, onTap: () => { UI3.agent = n; page.refresh(); } })), [{ label: 'Nobody (missed, unanswered)', checked: UI3.agent === '-', onTap: () => { UI3.agent = '-'; page.refresh(); } }])) }, icon('person', 16), lab, icon('chevron.up.chevron.down', 12));
  return h('div.tm-inhead', h('div', h('b', title), h('small', sub + ' · unresolved only')), btn); };
T.agentNames = () => office().map(u => u.name);

/** Who is on the phone right now. In the product this comes from the phone system's live call events. */
T.presence = () => { const cs = (data.customers || []).filter(c => !c.archived), mine = WD.r15 && WD.r15.onCall && WD.r15.onCall();
  return office().map((u, i) => { const isMe = S.me && u.id === S.me.id, c = cs[(i * 5 + 2) % Math.max(1, cs.length)];
    if (isMe) return mine ? { u, state: 'call', withName: mine.name || (mine.customer && mine.customer.name) || fmt.phone(mine.number || ''), mins: Math.max(0, Math.round((Date.now() - mine.at) / 60000)), dir: mine.dir || 'in' } : { u, state: 'free', mins: 0 };
    return i % 4 === 1 ? { u, state: 'call', withName: c ? c.name : 'Unknown caller', mins: 4, dir: 'in' } : i % 4 === 3 ? { u, state: 'away', mins: 25 } : i % 4 === 2 ? { u, state: 'call', withName: 'Outbound · ' + (cs[(i * 7) % Math.max(1, cs.length)] || { name: 'a lead' }).name, mins: 1, dir: 'out' } : { u, state: 'free', mins: 0 }; }); };
const stateText = p => p.state === 'call' ? (p.dir === 'out' ? 'Calling ' : 'On a call with ') + String(p.withName).replace(/^Outbound · /, '') + ' · ' + p.mins + ' min' : p.state === 'away' ? 'Away from the app · ' + p.mins + ' min' : 'Available';
T.liveStrip = () => { const on = T.presence().filter(p => p.state === 'call'); return on.length ? h('div.tm-live', { 'aria-label': 'On calls now' }, on.map(p => h('div.tm-pill', ui.avatar(p.u.name, { size: 30 }), h('div', h('b', first(p.u.name) + (S.me && p.u.id === S.me.id ? ' (you)' : '')), h('span.s', (p.dir === 'out' ? 'Calling · ' : 'On a call · ') + p.mins + ' min')), h('i.tm-dot.call')))) : null; };

/** The Texts segment of the Dialer. */
T.textsView = page => { UI3.textBox = 'inbox'; const all = X.list(), inbox = all.filter(X.waiting), src = inbox.filter(t => T.agentOK(X.agents(t).length ? X.agents(t) : null)), late = inbox.filter(X.isOpen), edit = canEdit();
  return [edit && h('div.tx-newbar', ui.button('New text', { icon: 'square.and.pencil', kind: 'tinted', small: true, onTap: () => X.compose() })),
    T.inboxHead('Text inbox', inbox.length ? plural(inbox.length, 'conversation') + ' waiting for a reply' : 'Nothing waiting', 'texts', page),
    UI3.textBox === 'inbox' && late.length ? h('div.footnote.secondary', { style: 'margin:8px 4px 0' }, plural(late.length, 'conversation') + ' waiting more than ' + cst().textWait + ' min, flagged for review.') : null,
    src.length ? ui.section({ footer: UI3.textBox === 'inbox' ? 'A conversation leaves the inbox when someone replies or resolves it, and comes back if the customer writes again.' : 'Every conversation on your numbers, resolved ones included.' }, src.map(t => textRow(t, page, true)))
      : ui.empty({ icon: UI3.textBox === 'inbox' ? 'checkmark.circle' : 'message', title: UI3.textBox === 'inbox' ? 'Inbox clear' : 'No texts match', text: UI3.agent ? 'Nothing for this agent. Choose All agents to see everyone.' : 'Texts that need a reply show here.' }),
    edit && UI3.textBox === 'inbox' && src.length > 1 && h('div', { style: 'margin-top:12px' }, ui.button('Resolve all ' + src.length, { kind: 'plain', onTap: async () => { if (await ui.actionSheet({ title: 'Resolve ' + src.length + ' conversations?', message: 'They leave the inbox. You can undo right after.', buttons: [{ label: 'Resolve all', value: true }] })) X.resolve(src); } })),
    h('div.cl-alllink', 'Answered and resolved conversations leave the inbox. ', h('button', { onclick: () => page.push(X.logSpec()) }, 'The Text log has every text.'))]; };

/** The Team segment of the Dialer: who is on a call, and today's numbers per person. */
T.teamView = page => { const ps = T.presence(), today = agg(D.today(), D.today()), lead = Q().leadId === (S.me || {}).id, nq = findings().filter(f => f.status === 'open').length;
  return [ui.section({ header: 'Right now', fold: false, footer: 'From the phone system’s live call events and from who has the app open.' },
      ps.map(p => ui.row({ leading: ui.avatar(p.u.name, { size: 36 }), title: p.u.name + (S.me && p.u.id === S.me.id ? ' (you)' : ''), subtitle: stateText(p), trailing: h('i.tm-dot.' + p.state) }))),
    ui.section({ header: 'Today so far', fold: false }, ps.map(p => { const a = today.users[p.u.id] || {}; return ui.row({ title: first(p.u.name), detail: [plural(a.in || 0, 'call') + ' in', (a.out || 0) + ' out', plural(a.texts || 0, 'text')].join(' · '), onTap: admin() ? () => { UI3.rAgent = p.u.id; page.push(T.reportSpec()); } : null, chevron: admin() }); })),
    (admin() || lead) && ui.section({ header: 'For managers', fold: false },
      admin() && ui.row({ icon: 'chart.bar', iconColor: 'var(--blue)', title: 'Office staff reports', subtitle: 'Calls, texts, time in the app, busy hours, staffing advice', chevron: true, onTap: () => page.push(T.reportSpec()) }),
      ui.row({ icon: 'star', iconColor: 'var(--orange)', title: 'Call quality', subtitle: 'What the AI flagged against your call protocol', badge: nq ? ui.badge(String(nq), 'var(--red)') : null, chevron: true, onTap: () => page.push(T.qualitySpec()) }))]; };

/* ================= Who created and last changed a job ================= */
T.jobAudit = job => { if (!job) return null; const ev = job.events || [], names = T.agentNames(), made = ev[0], last = ev.length > 1 ? ev[ev.length - 1] : null;
  const by = made ? made.actor : names[Math.floor(hs(job.id) * names.length)] || 'Office';
  return h('div.jb-audit', h('span', 'Created by ', h('b', by), made && made.at ? ' · ' + fmt.rel(made.at) : ''), h('span', last ? ['Last changed by ', h('b', last.actor), ' · ' + fmt.rel(last.at)] : 'Not changed since'),
    h('button.jb-hist', { onclick: () => T.jobHistory(job) }, icon('clock', 15), 'Full job history')); };
/** Everything that happened to a job, newest first: who did it, when, and (for an edit) exactly what changed. */
T.jobHistory = job => { const ev = (job.events || []).slice().reverse(), stamp = at => { const d = new Date(at); return fmt.day(D.key(d), 'md') + ' at ' + fmt.time(d.getHours() * 60 + d.getMinutes()); };
  ui.sheet({ title: 'Job history', leading: [{ label: 'Close', onTap: p => p.dismiss() }],
    render: () => ui.list(h('div.note', { style: 'padding-bottom:10px' }, job.title + ' · ' + fmt.day(job.day)),
      ev.length ? ui.section({ fold: false, showFooter: true, footer: 'Newest first. Tap an edit to see exactly what changed. Version ' + job.version + '.' },
        ev.map(e => { const n = (e.changes || []).length; return ui.row({ leading: ui.avatar(e.actor, { size: 28 }), title: e.text + (n ? ' · ' + n + (n === 1 ? ' change' : ' changes') : ''), subtitle: [h('div', e.actor + ' · ' + stamp(e.at) + ' · ' + fmt.rel(e.at)), n ? h('div', e.changes.map(c => c.label).join(', ')) : null], chevron: !!n, onTap: n ? () => WD.x.showChanges(e) : null }); }))
        : ui.empty({ icon: 'clock', title: 'No history yet', text: 'Changes to this job show here with who made them.' })) }, { detent: 'large' }); };


/* ================= Generated office activity ================= */
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], CURVE = { 7: 1.5, 8: 5, 9: 8.5, 10: 9.5, 11: 8, 12: 4.5, 13: 6.5, 14: 7.5, 15: 6, 16: 4.5, 17: 2.5, 18: .8 }, DOW = [0, 1.3, 1.05, 1, .95, .8, .15], SHIFT = [[8, 17], [7, 16], [9, 18], [8, 15]], HISTORY = 540;
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], hr12 = x => (x % 12 || 12) + (x < 12 ? 'a' : 'p');
const dayCache = new Map();
function dayOf(key) { const ck = org().id + key; if (dayCache.has(ck)) return dayCache.get(ck);
  const dt = D.parse(key), dow = dt.getDay(), us = office(), age = Math.max(0, D.diff(D.today(), key)), season = 1 + .22 * Math.sin((dt.getMonth() + 2) / 12 * 2 * Math.PI), growth = 1 - Math.min(age, HISTORY) / HISTORY * .3;
  const o = { key, dow, hours: {}, users: {}, inbound: 0, missed: 0 }; us.forEach(u => { o.users[u.id] = { in: 0, out: 0, texts: 0, talk: 0, app: 0, sessions: 0, made: 0, changed: 0 }; });
  if (dow && us.length) for (const hr of HOURS) { const isNow = age === 0 && hr > WD.now().getHours(); if (isNow) break;
    const inbound = Math.round(CURVE[hr] * DOW[dow] * season * growth * (.6 + .8 * hs(key + hr)));
    const present = us.filter((u, i) => { const [a, b] = SHIFT[i % 4]; return dow === 6 ? i === 0 && hr >= 8 && hr < 12 : hr >= a && hr < b && hs(key + u.id + 'off') > .06 && !(hr === 12 + (i % 2) && hs(key + u.id + hr) > .3); });
    const missed = Math.min(inbound, present.length ? Math.max(0, inbound - present.length * 4) + (inbound && hs(key + hr + 'm') > .84 ? 1 : 0) : inbound);
    for (let k = 0; k < inbound - missed; k++) { const a = o.users[present[Math.floor(hs(key + hr + 'a' + k) * present.length)].id]; a.in++; a.talk += 90 + Math.round(hs(key + hr + 't' + k) * 200); }
    present.forEach((u, i) => { const a = o.users[u.id], out = Math.round(hs(key + u.id + hr + 'o') * 2.3 * (i === 1 ? 1.4 : i === 0 ? .5 : 1)); a.out += out; a.talk += out * 110; a.texts += Math.round(hs(key + u.id + hr + 'x') * 1.9); a.app += Math.round(60 * (.42 + .5 * hs(key + u.id + hr + 'p')) * (i === 0 ? .6 : 1)); a.sessions += hs(key + u.id + hr + 's') > .55 ? 1 : 0; });
    o.hours[hr] = { inbound, missed, staffed: present.length }; o.inbound += inbound; o.missed += missed; }
  us.forEach(u => { const a = o.users[u.id]; if (a.app) { a.sessions = Math.max(1, a.sessions); a.made = Math.round(hs(key + u.id + 'j') * 5); a.changed = Math.round(hs(key + u.id + 'c') * 8); } });
  if (age > 0) dayCache.set(ck, o); return o; }
/** Totals for a span of days: per person, per weekday and hour, and per day (for the trend). */
function agg(from, to) { const us = office(), R = { users: {}, slots: {}, days: [], inbound: 0, missed: 0, n: 0 }; us.forEach(u => { R.users[u.id] = { in: 0, out: 0, texts: 0, talk: 0, app: 0, sessions: 0, made: 0, changed: 0, days: 0 }; });
  for (let k = from; k <= to; k = D.add(k, 1)) { const d = dayOf(k); R.n++; R.days.push({ key: k, inbound: d.inbound, missed: d.missed, out: us.reduce((s, u) => s + d.users[u.id].out, 0) }); R.inbound += d.inbound; R.missed += d.missed;
    us.forEach(u => { const a = R.users[u.id], b = d.users[u.id]; for (const f in b) a[f] += b[f]; if (b.app) a.days++; });
    for (const hr in d.hours) { const s = R.slots[d.dow + '|' + hr] || (R.slots[d.dow + '|' + hr] = { dow: d.dow, hr: +hr, inbound: 0, missed: 0, staffed: 0, n: 0 }), x = d.hours[hr]; s.inbound += x.inbound; s.missed += x.missed; s.staffed += x.staffed; s.n++; } }
  return R; }
const WINS = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '12 months'], ['all', 'All time'], ['custom', 'Custom']];
const range = () => { const t = D.today(); if (UI3.win === 'custom') { const a = UI3.from || D.add(t, -29), b = UI3.to || t; return a <= b ? [a, b] : [b, a]; } const n = UI3.win === 'all' ? HISTORY : +UI3.win; return [D.add(t, -(n - 1)), t]; };

/** What the numbers say. The targets come from the staffing file the AI reads. */
function staffingAdvice(R, prev) { const tg = Q().targets, slots = Object.values(R.slots).filter(s => s.n).map(s => ({ ...s, in: s.inbound / s.n, st: s.staffed / s.n, miss: s.inbound ? s.missed / s.inbound : 0 })).map(s => ({ ...s, load: s.in / Math.max(.5, s.st) }));
  const group = list => { const by = {}; list.forEach(s => (by[s.dow] = by[s.dow] || []).push(s.hr)); return Object.keys(by).map(d => { const hrs = by[d].sort((a, b) => a - b); return { dow: +d, a: hrs[0], b: hrs[hrs.length - 1] + 1 }; }); };
  const under = group(slots.filter(s => s.load > tg.maxLoad || s.miss > tg.maxMiss).sort((a, b) => b.load - a.load).slice(0, 6)), over = group(slots.filter(s => s.st >= 2 && s.load < tg.minLoad && s.dow !== 6).sort((a, b) => a.load - b.load).slice(0, 5));
  const peak = slots.slice().sort((a, b) => b.in - a.in)[0], rate = R.inbound ? R.missed / R.inbound : 0, delta = prev && prev.inbound ? (R.inbound / R.n) / (prev.inbound / prev.n) - 1 : null;
  const us = office().map(u => ({ u, a: R.users[u.id] })).filter(x => x.a.days), busiest = us.slice().sort((a, b) => (b.a.in + b.a.out) - (a.a.in + a.a.out))[0], quiet = us.slice().sort((a, b) => (a.a.in + a.a.out) / a.a.days - (b.a.in + b.a.out) / b.a.days)[0];
  const lines = [];
  if (delta != null) lines.push(h('span', h('b', 'Trend: '), 'inbound calls are ' + (Math.abs(delta) < .03 ? 'flat' : (delta > 0 ? 'up ' : 'down ') + Math.round(Math.abs(delta) * 100) + '%') + ' against the same number of days before, and ' + Math.round(rate * 100) + '% went unanswered (target under ' + Math.round(tg.maxMiss * 100) + '%).'));
  if (peak) lines.push(h('span', h('b', 'Busiest: '), DN[peak.dow] + ' ' + hr12(peak.hr) + '–' + hr12(peak.hr + 1) + ', about ' + peak.in.toFixed(1) + ' calls an hour with ' + peak.st.toFixed(1) + ' people in the app.'));
  under.forEach(g => lines.push(h('span', h('b', 'Add a person: '), DN[g.dow] + ' ' + hr12(g.a) + '–' + hr12(g.b) + '. More than ' + tg.maxLoad + ' calls per person an hour, or too many missed.')));
  over.slice(0, 2).forEach(g => lines.push(h('span', h('b', 'Could run lighter: '), DN[g.dow] + ' ' + hr12(g.a) + '–' + hr12(g.b) + '. Under ' + tg.minLoad + ' call per person an hour; one person could take a later start, a long lunch or project work.')));
  if (busiest && quiet && busiest !== quiet) lines.push(h('span', h('b', 'People: '), first(busiest.u.name) + ' handled the most calls. ' + first(quiet.u.name) + ' had the fewest per day worked (' + ((quiet.a.in + quiet.a.out) / quiet.a.days).toFixed(1) + '); check whether that matches the role before reading anything into it.'));
  return { lines, under, over, slots }; }

T.reportSpec = () => ({ title: 'Office staff reports', class: 'wide', render: page => {
  if (!admin()) return ui.empty({ icon: 'lock', title: 'Owners and admins only', text: 'Reports about the office team are not shown to other roles.' });
  const [from, to] = range(), R = agg(from, to), len = D.diff(to, from) + 1, prev = agg(D.add(from, -len), D.add(from, -1)), us = office(), sel = UI3.rAgent, re = () => page.refresh();
  const tot = f => us.reduce((s, u) => s + (sel && u.id !== sel ? 0 : R.users[u.id][f]), 0), ptot = f => us.reduce((s, u) => s + (sel && u.id !== sel ? 0 : prev.users[u.id][f]), 0);
  const chg = (a, b) => b ? h('i', { style: { color: a >= b ? 'var(--green)' : 'var(--red)' } }, (a >= b ? ' ▲ ' : ' ▼ ') + Math.round(Math.abs(a / b - 1) * 100) + '%') : null, tile = (v, l, c) => h('div.tm-tile', h('b', v, c), h('span', l));
  const days = sel ? R.users[sel].days : us.reduce((s, u) => s + R.users[u.id].days, 0);
  /* Trend buckets: days up to a month, weeks up to a quarter, months beyond. */
  const size = len <= 31 ? 1 : len <= 100 ? 7 : 30, bk = []; R.days.forEach((d, i) => { const b = bk[Math.floor(i / size)] || (bk[Math.floor(i / size)] = { key: d.key, inbound: 0, missed: 0 }); b.inbound += d.inbound; b.missed += d.missed; }); const mx = Math.max(1, ...bk.map(b => b.inbound));
  const adv = staffingAdvice(R, prev), hv = s => UI3.heat === 'calls' ? s.in : UI3.heat === 'staff' ? s.st : s.miss * 100, hmax = Math.max(.01, ...adv.slots.map(hv)), hcol = UI3.heat === 'missed' ? 'var(--red)' : UI3.heat === 'staff' ? 'var(--green)' : 'var(--tint)';
  const tg = Q().targets, cell = (d, hr) => { const s = adv.slots.find(x => x.dow === d && x.hr === hr); if (!s) return h('div.c', { style: '--v:0' }); const v = hv(s); return h('div.c' + (s.load > tg.maxLoad ? '.hot' : s.st >= 2 && s.load < tg.minLoad && d !== 6 ? '.cold' : ''), { style: '--v:' + Math.round(v / hmax * 85) + ';--k:' + hcol, title: DN[d] + ' ' + hr12(hr) + ': ' + s.in.toFixed(1) + ' calls/h, ' + s.st.toFixed(1) + ' people, ' + Math.round(s.miss * 100) + '% missed' }, UI3.heat === 'missed' ? (v >= 1 ? Math.round(v) : '') : v >= .95 ? Math.round(v * 10) / 10 : ''); };
  return ui.list(
    h('div', { style: 'padding-bottom:8px' }, ui.segmented(WINS.map(([value, label]) => ({ value, label: label.replace(' days', ' d').replace('12 months', '12 mo').replace('All time', 'All') })), UI3.win, v => { UI3.win = v; re(); })),
    UI3.win === 'custom' && ui.section(null, ui.dateRow({ title: 'From', value: from, onChange: v => { UI3.from = v; re(); } }), ui.dateRow({ title: 'To', value: to, onChange: v => { UI3.to = v > D.today() ? D.today() : v; re(); } })),
    h('div.footnote.secondary', { style: 'margin:0 4px' }, fmt.day(from, 'md') + ' – ' + fmt.day(to, 'md') + ' · ' + plural(len, 'day') + (sel ? ' · ' + (q.user(sel) || {}).name : ' · everyone') + ' · arrows compare with the ' + plural(len, 'day') + ' before'),
    h('div.tm-tiles', tile(String(tot('in')), 'Calls answered', chg(tot('in'), ptot('in'))), tile(String(tot('out')), 'Calls made', chg(tot('out'), ptot('out'))), tile(String(tot('texts')), 'Texts sent', chg(tot('texts'), ptot('texts'))),
      !sel && tile(Math.round(R.inbound ? R.missed / R.inbound * 100 : 0) + '%', 'Inbound missed'), tile(days ? (tot('app') / days / 60).toFixed(1) + ' h' : '—', 'In the app per day worked'), tile(String(tot('made') + tot('changed')), 'Jobs created or changed')),
    aiOn() && aiCard({ title: 'AI · trends and staffing', text: 'Read from ' + plural(len, 'day') + ' of calls, texts and time in the app, against the targets in ai/staffing-targets.md.', lines: adv.lines, action: h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, ui.button('Change the targets', { kind: 'tinted', small: true, block: false, onTap: () => page.push(T.fileSpec('ai/staffing-targets.md')) })) }),
    ui.section({ header: 'By person', fold: false, footer: 'Tap a person to show only their numbers above. “In app” is the average on a day they worked; sessions are separate times they opened it.' },
      h('div.tm-tbl', h('table', h('thead', h('tr', ['Person', 'In', 'Out', 'Texts', 'Avg call', 'In app', 'Sessions', 'Jobs made', 'Changed', 'Days'].map(x => h('th', x)))),
        h('tbody', us.map(u => { const a = R.users[u.id], calls = a.in + a.out; return h('tr' + (sel === u.id ? '.on' : ''), { onclick: () => { UI3.rAgent = sel === u.id ? '' : u.id; re(); } }, h('td', h('b', first(u.name)), ' ', h('span.secondary', u.role)), [a.in, a.out, a.texts, calls ? fmt.dur ? Math.floor(a.talk / calls / 60) + ':' + String(Math.round(a.talk / calls % 60)).padStart(2, '0') : '' : '—', a.days ? (a.app / a.days / 60).toFixed(1) + ' h' : '—', a.days ? (a.sessions / a.days).toFixed(1) + '/day' : '—', a.made, a.changed, a.days].map(v => h('td', String(v)))); }))))),
    ui.section({ header: 'Inbound calls over time', fold: false, footer: 'Blue is every inbound call, red the ones nobody answered. Each bar is ' + (size === 1 ? 'a day' : size === 7 ? 'a week' : 'about a month') + '.' },
      h('div.tm-chart', h('div.tm-bars', { style: 'position:relative' }, bk.map(b => h('i', { style: { height: Math.round(b.inbound / mx * 100) + '%', position: 'relative' }, title: fmt.day(b.key, 'md') + ': ' + b.inbound + ' calls, ' + b.missed + ' missed' }, h('i.m', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: (b.inbound ? Math.round(b.missed / b.inbound * 100) : 0) + '%', borderRadius: 0 } })))), h('div.tm-ax', h('span', fmt.day(from, 'md')), h('span', 'peak ' + mx), h('span', fmt.day(to, 'md'))))),
    ui.section({ header: 'By day and hour', fold: false, showFooter: true, footer: 'Averages for the window. A red outline is an hour with more calls than the team on duty can take; a dashed green one has people to spare.' },
      h('div', { style: 'padding:0 0 8px' }, ui.segmented([{ value: 'calls', label: 'Calls per hour' }, { value: 'staff', label: 'People in the app' }, { value: 'missed', label: 'Missed %' }], UI3.heat, v => { UI3.heat = v; re(); })),
      h('div.tm-chart', h('div.tm-heat', h('span'), HOURS.map(x => h('span.hd', hr12(x))), [1, 2, 3, 4, 5, 6].map(d => [h('span', DN[d]), HOURS.map(x => cell(d, x))])))),
    h('div.footnote.secondary', { style: 'margin:8px 4px' }, 'Prototype: this history is generated. In the product it comes from the phone system’s call and message events and from app sessions, and it is kept per business.')); } });

/* ================= Call quality: the files the AI reads, what it flags, and her feedback ================= */
const RULES0 = [
  ['greet', 'Greet with the business name and your own name', 'Every call opens with “Thanks for calling {biz}, this is (name).”'],
  ['number', 'Confirm the caller’s name and a call-back number', 'Before anything else on a new caller, and read the number back.'],
  ['next', 'Offer the next available day before the call ends', 'A caller asking about service leaves with a day on the schedule or a time we will call back.'],
  ['price', 'Quote prices only from the price list', 'No rounding and no discounts on the phone. Unusual jobs go to Price Calc or a call back.'],
  ['recap', 'Read the appointment back', 'Day, window, address and what we are picking up.'],
  ['upset', 'Upset customer: apologize, log it, promise a same-day call back', 'Never argue about fault on the first call. Create a customer request before hanging up.'],
  ['text', 'Reply to a text within the time set in Phone and calls', 'Sign the first message with your first name.'],
];
const SAID = { greet: ['{st}', 'Hello?'], number: ['{st}', 'OK, we’ll get back to you. Bye.'], next: ['{st}', 'Sure, just call us when you’re ready.'], price: ['{st}', 'It’s usually around a hundred, give or take.'], recap: ['{st}', 'You’re all set, see you then.'], upset: ['{st}', 'Well, the driver says nobody was there.'], text: ['', ''] };
const WHAT = { greet: 'The greeting left out the business name and the agent’s name.', number: 'A new caller hung up without a name or call-back number on record.', next: 'The caller asked about service and the call ended with no day offered.', price: 'A price was quoted that is not on the price list.', recap: 'An appointment was booked and not read back.', upset: 'An upset customer was contradicted, and no customer request was logged.', text: 'The first reply took longer than the limit.' };
const TIP = { greet: 'Practice the opening line; it sets the tone and tells the caller they reached the right place.', number: 'Ask for the number first, so a dropped call can be returned.', next: 'Close with “I can have a truck there on (day). Shall I put you down?”', price: 'Open Price Calc during the call, or promise a call back with the exact figure.', recap: 'Read back day, window and address; it catches wrong addresses before the truck rolls.', upset: 'Start with “I’m sorry that happened”, log the request, and give a time for the call back.', text: 'Turn on text notifications, or hand the thread to someone who is at a desk.' };
function Q() { if (data.quality && data.quality.org === org().id) return data.quality;
  const us = office(), lead = us.find(u => u.role === 'office') || us[us.length - 1] || { id: null };
  return data.quality = { org: org().id, leadId: lead.id, rules: RULES0.map(([id, title, text]) => ({ id, title, text: text.replace('{biz}', org().name), on: true })), feedback: [], targets: { maxLoad: 3.2, minLoad: 1, maxMiss: .08, minStaff: 2, open: '8 AM – 5 PM' }, findings: null, notes: [] }; }
function findings() { const Z = Q(); if (Z.findings) return Z.findings; const out = [], rs = Z.rules.filter(r => r.id !== 'text');
  ((WD.calls && WD.calls.list && WD.calls.list()) || []).filter(c => c.status === 'answered' && c.by && !c.archived && now() - c.at < 14 * 864e5).slice(0, 40).forEach(c => { if (out.length >= 9 || hs(c.id + 'q') > .5) return; const r = rs[Math.floor(hs(c.id + 'r') * rs.length)]; out.push({ id: 'f' + c.id, kind: 'call', ref: c.id, agent: c.by, rule: r.id, at: c.at, who: c.customerId ? (q.customer(c.customerId) || {}).name : c.contact || fmt.phone(c.number), status: 'open' }); });
  threads().forEach(t => { const i = t.messages.findIndex((m, k) => m.dir === 'out' && k > 0 && t.messages[k - 1].dir === 'in' && m.at - t.messages[k - 1].at > 5 * 60000); if (i > 0) out.push({ id: 'f' + t.id, kind: 'text', ref: t.id, agent: t.messages[i].by, rule: 'text', at: t.messages[i].at, who: nameOfT(t), status: 'open' }); });
  return Z.findings = out.sort((a, b) => b.at - a.at); }
const ruleOf = id => Q().rules.find(r => r.id === id) || { id, title: id, text: '' };
/** The text of a file the AI reads. Built from what the company set, so the screens and the files never disagree. */
T.fileText = path => { const Z = Q(), tg = Z.targets;
  if (path === 'ai/call-protocol.md') return '# Call and text protocol · ' + org().name + '\n\nThe assistant checks every recorded call and text thread against these rules.\nA rule that is switched off is not checked.\n\n' + Z.rules.map((r, i) => (i + 1) + '. ' + (r.on ? '' : '(off) ') + r.title + '\n   ' + r.text + (r.except && r.except.length ? '\n   Not a problem when: ' + r.except.join('; ') : '')).join('\n') + '\n';
  if (path === 'ai/call-review-feedback.md') return '# Feedback from the call quality lead\n\nNewest first. The assistant reads this before every review and follows it over its own judgment.\n\n' + (Z.feedback.length ? Z.feedback.map(f => '- ' + fmt.day(D.key(new Date(f.at)), 'md') + ' · ' + f.by + ' · ' + f.text).join('\n') : '(no feedback yet)') + '\n';
  return '# Staffing targets · ' + org().name + '\n\nUsed for the staffing advice in Office staff reports.\n\n- Office hours: ' + tg.open + '\n- At least ' + tg.minStaff + ' people on the phones during office hours\n- No more than ' + tg.maxLoad + ' inbound calls per person in an hour\n- Under ' + tg.minLoad + ' call per person in an hour counts as spare time\n- Missed inbound calls: under ' + Math.round(tg.maxMiss * 100) + '%\n'; };
const FILES = [['ai/call-protocol.md', 'Call and text protocol', 'What a good call sounds like'], ['ai/call-review-feedback.md', 'Feedback log', 'What the quality lead told the AI'], ['ai/staffing-targets.md', 'Staffing targets', 'What “too busy” and “spare time” mean']];
T.fileSpec = path => ({ title: path.split('/').pop(), render: page => { const Z = Q(), tg = Z.targets, can = admin() || Z.leadId === (S.me || {}).id, re = () => { WD.changed(); page.refresh(); }, num = (title, key, opts, lab) => ui.pickerRow({ title, value: tg[key], disabled: !admin(), options: opts.map(v => ({ value: v, label: lab(v) })), onChange: v => { tg[key] = v; re(); } });
  return ui.list(ui.note('A file the AI reads before it reviews anything. It is kept with the business, changes here take effect on the next review, and every change is dated.'), h('div.tm-file', T.fileText(path)),
    path === 'ai/staffing-targets.md' && ui.section({ header: 'Change the targets', fold: false, footer: admin() ? null : 'Only an owner or admin can change these.' }, num('Most calls per person an hour', 'maxLoad', [2.5, 3.2, 4, 5], v => String(v)), num('Spare time under', 'minLoad', [.5, 1, 1.5], v => v + ' per hour'), num('Missed calls under', 'maxMiss', [.03, .05, .08, .12], v => Math.round(v * 100) + '%'), num('People on the phones, at least', 'minStaff', [1, 2, 3], v => String(v))),
    path === 'ai/call-protocol.md' && can && ui.section(null, ui.row({ title: 'Edit the rules', tint: true, center: true, onTap: () => page.pop() })),
    path === 'ai/call-review-feedback.md' && can && ui.section(null, ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Tell the AI something', tint: true, onTap: async () => { const v = await ask('Feedback for the AI', 'e.g. Skipping the greeting is fine on a call back'); if (v) { Z.feedback.unshift({ at: now(), by: me(), text: v }); re(); } } }))); } });
const findingSheet = (f, done) => ui.sheet({ title: 'Flagged ' + f.kind, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: p => { const Z = Q(), r = ruleOf(f.rule), c = f.kind === 'call' ? ((WD.calls.list() || []).find(x => x.id === f.ref) || {}) : null, said = SAID[f.rule] || [], fin = s => { f.status = s; WD.changed(); done && done(); p.dismiss(); };
  return ui.list(h('div', { style: 'padding:0 4px 8px' }, h('div.headline', r.title), h('div.footnote.secondary', f.agent + ' · ' + f.who + ' · ' + fmt.rel(f.at))),
    aiCard({ title: 'AI · why it was flagged', text: WHAT[f.rule], lines: [h('span', h('b', 'Rule: '), r.text), h('span', h('b', 'Suggestion for ' + first(f.agent) + ': '), TIP[f.rule])] }),
    c && said[1] && ui.section({ header: 'From the recording', fold: false }, h('div', { style: 'padding:10px 16px;background:var(--cell)' }, (c.transcript || []).slice(0, 2).map(([a, b]) => h('div.tm-q', h('b', a + ': '), b)), h('div.tm-q', { style: 'outline:2px solid var(--orange);outline-offset:-2px' }, h('b', first(f.agent) + ': '), said[1]))),
    ui.section({ header: 'Your call', fold: false, footer: 'Your answer is written to ai/call-review-feedback.md, so the AI flags the same thing next time, or stops flagging it.' },
      ui.row({ icon: 'checkmark.circle', iconColor: 'var(--green)', title: 'Yes, coach ' + first(f.agent) + ' on this', subtitle: 'Adds it to their coaching notes', onTap: () => { Z.feedback.unshift({ at: now(), by: me(), text: 'Confirmed: “' + r.title + '” was missed on a ' + f.kind + ' with ' + f.who + ' (' + first(f.agent) + '). Keep flagging this.' }); Z.notes.unshift({ at: now(), agent: f.agent, by: me(), text: r.title + '. ' + TIP[f.rule] }); ui.toast('Added to ' + first(f.agent) + '’s coaching notes', 'checkmark'); fin('coached'); } }),
      ui.row({ icon: 'xmark.circle.fill', iconColor: 'var(--gray)', title: 'Not a problem here…', subtitle: 'Say why, and the AI learns the exception', onTap: async () => { const v = await ask('Why is this fine?', 'e.g. It was a call back, they already knew us'); if (!v) return; (r.except = r.except || []).push(v); Z.feedback.unshift({ at: now(), by: me(), text: 'Not a problem: “' + r.title + '” when ' + v + '.' }); Z.findings.forEach(x => { if (x !== f && x.rule === f.rule && x.status === 'open' && hs(x.id + v) > .5) x.status = 'dismissed'; }); ui.toast('Learned. Similar flags were cleared', 'sparkles', 2600); fin('dismissed'); } }),
      f.kind === 'call' && ui.row({ icon: 'phone', title: 'Open the call', chevron: true, onTap: () => { p.dismiss(); WD.nav.push(WD.calls.detailSpec(f.ref)); } }),
      f.kind === 'text' && ui.row({ icon: 'message', title: 'Open the conversation', chevron: true, onTap: () => { p.dismiss(); WD.nav.push(X.threadSpec(f.ref)); } }))); } }, { detent: 'large' });
T.qualitySpec = () => ({ title: 'Call quality', render: page => { const Z = Q(), lead = q.user(Z.leadId), mine = Z.leadId === (S.me || {}).id, can = admin() || mine, re = () => { WD.changed(); page.refresh(); };
  if (!can) return ui.empty({ icon: 'lock', title: 'For the call quality lead', text: (lead ? lead.name : 'The person in charge of training') + ', owners and admins see this.' });
  if (!aiOn()) return ui.empty({ icon: 'sparkles', title: 'Part of AI Premium', text: 'The AI call review needs AI Premium. The protocol files are kept either way.' });
  const fs = findings(), open = fs.filter(f => f.status === 'open'), by = {}; fs.forEach(f => { const a = by[f.agent] = by[f.agent] || { n: 0, rules: {} }; if (f.status !== 'dismissed') { a.n++; a.rules[f.rule] = (a.rules[f.rule] || 0) + 1; } });
  const recs = Object.keys(by).filter(a => by[a].n).sort((a, b) => by[b].n - by[a].n).map(a => { const top = Object.keys(by[a].rules).sort((x, y) => by[a].rules[y] - by[a].rules[x])[0]; return h('span', h('b', first(a) + ': '), plural(by[a].n, 'flag') + ', most often “' + ruleOf(top).title.toLowerCase() + '”. ' + TIP[top]); });
  return ui.list(
    aiCard({ title: 'AI · coaching recommendations', text: plural(open.length, 'call or text') + ' to look at, checked against ' + plural(Z.rules.filter(r => r.on).length, 'rule') + ' in your protocol file and ' + plural(Z.feedback.length, 'note') + ' of your feedback.', lines: recs.slice(0, 4) }),
    ui.section({ header: 'Flagged for ' + (mine ? 'you' : lead ? first(lead.name) : 'review') + ' · ' + open.length, fold: false, footer: 'Good protocol was not followed, as far as the AI can tell. Agree or correct it; either way it learns.' },
      open.length ? open.map(f => ui.row({ leading: ui.avatar(f.agent, { size: 34 }), title: ruleOf(f.rule).title, subtitle: first(f.agent) + ' · ' + f.kind + ' with ' + f.who + ' · ' + fmt.rel(f.at), chevron: true, onTap: () => findingSheet(f, () => page.refresh()) })) : ui.row({ title: 'Nothing waiting', subtitle: 'New calls are reviewed as their recordings arrive.' })),
    Z.notes.length ? ui.section({ header: 'Coaching notes', count: Z.notes.length }, Z.notes.map(n => ui.row({ title: first(n.agent) + ': ' + n.text, subtitle: n.by + ' · ' + fmt.rel(n.at) }))) : null,
    ui.section({ header: 'What good looks like', fold: false, footer: 'These rules are the protocol file. Switch one off and it is no longer checked.' },
      Z.rules.map(r => ui.row({ title: r.title, subtitle: r.text + (r.except && r.except.length ? ' Not a problem when: ' + r.except.join('; ') + '.' : ''), trailing: ui.toggle(r.on, v => { r.on = v; re(); }) })),
      ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Add a rule', tint: true, onTap: async () => { const v = await ask('New rule', 'e.g. Ask how they heard about us'); if (v) { Z.rules.push({ id: 'r' + Date.now().toString(36), title: v, text: 'Added by ' + me() + '.', on: true }); Z.feedback.unshift({ at: now(), by: me(), text: 'New rule: ' + v + '.' }); re(); } } })),
    ui.section({ header: 'Files the AI reads', fold: false, footer: 'The business logic lives in these files, not in the AI. Anyone allowed here can read exactly what it was told.' }, FILES.map(([path, title, sub]) => ui.row({ icon: 'doc.text', iconColor: 'var(--indigo)', title: path, subtitle: title + ' · ' + sub, chevron: true, onTap: () => page.push(T.fileSpec(path)) }))),
    ui.section({ header: 'Who reviews call quality', fold: false, footer: 'This person gets the flags. Owners and admins can always see them.' }, ui.pickerRow({ title: 'Quality lead', disabled: !admin(), value: Z.leadId, options: office().map(u => ({ value: u.id, label: u.name })), onChange: v => { Z.leadId = v; re(); } }))); } });
T.qualityCount = () => { try { const Z = Q(); return (admin() || Z.leadId === (S.me || {}).id) && aiOn() ? findings().filter(f => f.status === 'open').length : 0; } catch (e) { return 0; } };

/* ================= Wiring ================= */
{ const t = WD.app.tabs.find(x => x.id === 'dialer'); if (t) t.badge = () => (WD.calls ? (WD.calls.actCount || WD.calls.reviewCount)() : 0) + X.reviewCount(); }   // only what needs someone today: calls to return, texts waiting past the limit or flagged
if (WD.r14 && WD.r14.addSetting) { WD.r14.addSetting('Company', (push, gated) => admin() && WD.r14.link(push, gated, null, 'chart.bar', 'var(--blue)', 'Office staff reports', 'Owners and admins: calls, texts, time in the app, staffing advice', T.reportSpec));
  WD.r14.addSetting('Company', (push, gated) => (admin() || Q().leadId === (S.me || {}).id) && WD.r14.link(push, gated, null, 'star', 'var(--orange)', 'Call quality', 'Protocol, AI flags and coaching', T.qualitySpec, T.qualityCount() ? String(T.qualityCount()) : null)); }
if (WD.aip && WD.aip.feature) { WD.aip.feature('Staffing analysis', 'Inbox → Team → Office staff reports', 'Reads call, text and app activity by hour, shows the trend and says where to add or reduce office cover.'); WD.aip.feature('Call quality coaching', 'Inbox → Team → Call quality', 'Checks calls and texts against your own protocol file, flags what was missed for the quality lead and learns from her feedback.'); }
const toDialer = seg => { if (WD.calls && WD.calls.ui) WD.calls.ui.seg = seg; WD.nav.switchTab('dialer'); WD.changed(); };
WD.panel.addAction('Incoming text', () => { const t = X.list().find(x => lastOf(x).dir === 'out') || X.list()[0]; X.receive(t, 'Hi, one more question. Can you come a day earlier next week?'); ui.banner({ title: 'Text from ' + nameOfT(t), text: lastOf(t).text, icon: 'message', color: 'var(--green)', onTap: () => { toDialer('texts'); WD.nav.push(X.threadSpec(t.id)); } }); });
WD.panel.addJump('Texts inbox', () => toDialer('texts'));
WD.panel.addJump('Team on calls', () => toDialer('team'));
WD.panel.addJump('Office staff reports', () => { toDialer('team'); WD.nav.push(T.reportSpec()); });
WD.panel.addJump('Call quality', () => { toDialer('team'); WD.nav.push(T.qualitySpec()); });
if (WD.app.uiState) WD.app.uiState('staff', UI3);
})();
