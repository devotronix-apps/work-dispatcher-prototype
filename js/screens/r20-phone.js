/* r20-phone.js — WD.phone (6.2): the phone service as a connector.
   The app no longer pretends to place calls itself. What it can do depends on the phone service the company uses (P.can):
     quo      Quo is connected: calls, texts, recordings and summaries arrive from Quo; texts are sent from here; a call is handed to the
              Quo app with a link that carries the number and the company number to call from (phones only; a computer copies the number).
     link     Another phone app (RingCentral, Dialpad, Aircall, Google Voice): a call is handed over with that app's link. Nothing comes back.
     device   The phone's own dialer and Messages. Nothing comes back, so each call is logged by hand as “not recorded”.
     telnyx   Telnyx is connected (6.4): numbers, calling and texting run inside RouteClerk on Telnyx's API. Telnyx has no app of its own,
              no voicemail box and no call summaries, so those lines are off for it.
   Each service is one module that answers the same questions (P.can); a screen asks the capability and never names a service.
   Also here: the combined inbox (All), claim and assign, opt-outs (STOP), text templates, a Call back task for a missed call, the ad
   channel of each company number, and Settings → Integrations → Phone. Requirements R20-6 to R20-14. */
(() => {
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, P = WD.phone = {};
const C = () => WD.calls || {}, X = () => WD.texts || {}, K = () => (WD.screens.customers || {}).crm || {};
const dg = v => String(v || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''), e164 = v => { const d = dg(v); return d.length === 10 ? '+1' + d : String(v || ''); };
const me = () => (S.me && S.me.name) || 'You', first = n => String(n || '').replace(/^Dr\.\s*/, '').split(' ')[0], enc = encodeURIComponent;
const org = () => { const id = (WD.orgs && WD.orgs.dataOrg) || (S.org || data.orgs[0]).id; return data.orgs.find(o => o.id === id) || data.orgs[0]; };
const admin = () => WD.can('settings.manage');

/* ---------- The phone services and what each can do ---------- */
const APPS = { ringcentral: { name: 'RingCentral', call: n => 'rcmobile://call?number=' + enc(n) }, dialpad: { name: 'Dialpad', call: n => 'dialpad:' + n }, aircall: { name: 'Aircall', call: n => 'aircall://call?to=' + enc(n) }, gvoice: { name: 'Google Voice', call: n => 'https://voice.google.com/u/0/calls?a=nc,' + enc(n) } };
const CAPS = [['events', 'Calls and texts appear here by themselves'], ['recordings', 'Call recordings and transcripts'], ['summaries', 'Call summaries written by the phone service'], ['voicemail', 'Voicemail messages'], ['history', 'Earlier calls and texts can be loaded'], ['texts', 'Send and receive texts inside RouteClerk'], ['mms', 'Send pictures by text from RouteClerk'], ['optout', 'STOP replies block further texts'], ['link', 'One tap starts the call in the phone app'], ['from', 'The call goes out from the company number we choose'], ['place', 'Calls are made inside RouteClerk']];
const PROV = {
  device: { name: 'This phone’s own dialer', sub: 'Calls and texts use the phone’s own apps and the person’s own number. Nothing is logged by itself.', can: {} },
  telnyx: { name: 'Telnyx', sub: 'Connected with an API key. Calls and texts are made inside RouteClerk on the company’s Telnyx numbers.', can: { events: 1, recordings: 1, texts: 1, mms: 1, optout: 1, from: 1, place: 1 } },
  quo: { name: 'Quo', sub: 'Connected with an API key. Calls are handed to the Quo app.', can: { events: 1, recordings: 1, summaries: 1, voicemail: 1, history: 1, texts: 1, optout: 1, link: 1, from: 1 } },
  link: { name: 'Another phone app', sub: 'RingCentral, Dialpad, Aircall or Google Voice. A call opens in that app; nothing is logged by itself.', can: { link: 1 } } };
const CHANNELS = ['None', 'Google Ads', 'Google Business Profile', 'Yelp', 'Microsoft Ads', 'Apple Maps', 'Website'];
const guess = label => CHANNELS.find(c => c !== 'None' && c.toLowerCase() === String(label || '').toLowerCase()) || (/bing/i.test(label) ? 'Microsoft Ads' : /google maps/i.test(label) ? 'Google Business Profile' : 'None');
/** Settings and state for the business in front. Kept in its own data, so each business has its own phone service. */
const PH = () => { if (!data.phone) { data.phone = { provider: 'quo', app: 'ringcentral', connected: true, credits: 18.4, a2p: 'approved', sync: false, missedTask: true, noSeat: (data.users || []).filter(u => u.role === 'driver').map(u => u.id), channels: {}, optOut: {}, tip: false };
    (org().lines || []).forEach(l => { data.phone.channels[l.number] = guess(l.label); }); }
  return data.phone; };
P.cfg = PH; P.CHANNELS = CHANNELS;
P.provider = () => PROV[PH().provider] || PROV.quo;
/** Services reached with an API key, which can stop answering or wait on carrier registration. */
const api = () => ['quo', 'telnyx'].includes(PH().provider);
P.can = cap => !!P.provider().can[cap];
P.name = () => PH().provider === 'link' ? (APPS[PH().app] || APPS.ringcentral).name : PH().provider === 'device' ? 'the phone' : P.provider().name;
/** Does the signed-in person have a seat in the company's phone service? Without one a call falls back to the phone's own dialer. */
P.seat = () => PH().provider === 'quo' ? !PH().noSeat.includes((S.me || {}).id) : PH().provider !== 'device';
/** The ad channel a company number is advertised on (Settings → Phone). A lead that first called that number gets it. */
P.channelFor = number => { const c = PH().channels[(org().lines || []).map(l => l.number).find(n => dg(n) === dg(number))]; return c && c !== 'None' ? c : null; };
/** A driver without customer access may still call the customers on the route they run today, and nobody else (R20-13). */
P.driverMay = o => { if (!S.me || S.me.role !== 'driver') return false; const rid = WD.app.driverRoute ? WD.app.driverRoute(D.today()) : null;
  return q.jobsOn(D.today()).some(j => (!rid || j.routeId === rid) && ((o.customerId && j.customerId === o.customerId) || (j.phone && dg(j.phone) === dg(o.number)))) ; };
P.mayCall = o => WD.can('crm.view') || P.driverMay(o);

WD.css(`
.ph-hand { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 20px 24px; text-align: center; }
.ph-from { margin: 8px 0 4px; padding: 10px 12px; border-radius: 12px; background: var(--fill3); width: 100%; box-sizing: border-box; text-align: left; }
.ph-from b { display: block; } .ph-from span { color: var(--label2); font-size: 13px; }
.ph-link { font: 12px/16px ui-monospace, Menlo, monospace; color: var(--label2); overflow-wrap: anywhere; margin-top: 2px; }
.ph-hand .btn { width: 100%; } .ph-tip { font-size: 13px; color: var(--label2); text-align: left; width: 100%; }
.ph-chips { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 8px; scrollbar-width: none; } .ph-chips::-webkit-scrollbar { display: none; }
.ph-chip { flex: none; min-height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--sep); background: var(--cell); color: var(--label); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; position: relative; }
.ph-chip::after { content: ''; position: absolute; inset: -6px 0; } .ph-chip.on { background: var(--tint); border-color: var(--tint); color: #fff; }
.ph-warn { display: flex; gap: 8px; align-items: flex-start; margin: 0 0 10px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--red) 12%, var(--cell)); color: var(--label); font-size: 13px; cursor: pointer; }
.ph-warn b { color: var(--red); } .ph-warn.amber { background: color-mix(in srgb, var(--orange) 14%, var(--cell)); } .ph-warn.amber b { color: var(--label); }
.ph-out { margin: 0 0 10px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--red) 12%, var(--cell)); font-size: 13px; } .ph-out b { color: var(--red); }
.ph-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: var(--cell); border-radius: 12px; margin-top: 8px; cursor: pointer; }
.ph-row.sel { outline: 2px solid var(--tint); outline-offset: -2px; } .ph-row.new .ph-t { font-weight: 700; }
.ph-main { flex: 1; min-width: 0; } .ph-t { font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ph-snip { font-size: 13px; color: var(--label2); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.ph-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 5px; } .ph-meta { flex: none; text-align: right; font-size: 12px; color: var(--label2); display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.ph-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--tint); flex: none; margin-top: 7px; } .ph-dot.off { background: none; }
.ph-cap { display: flex; gap: 8px; align-items: center; font-size: 14px; padding: 3px 0; } .ph-cap.no { color: var(--label2); }
.ph-brief { margin-top: 6px; font-size: 13px; text-align: left; } .ph-brief b { font-weight: 600; }
`);

/* ---------- Handing a call to the phone service (R20-7) ---------- */
/** Called by WD.calls.place when the phone service can't place calls inside the app. `finish(hand)` logs the call. */
P.handoff = (o, finish) => {
  const cfg = PH(), prov = cfg.provider, seat = P.seat(), phoneApp = prov === 'quo' || prov === 'link', useApp = phoneApp && seat, name = P.name(), num = e164(o.num), who = o.title;
  const link = prov === 'quo' ? 'openphone://dial?number=' + enc(num) + '&from=' + enc(o.line.number) + '&action=call' : prov === 'link' ? (APPS[cfg.app] || APPS.ringcentral).call(num) : 'tel:' + num;
  const viaDevice = async sheet => { sheet.close(); ui.toast('Opening the phone’s dialer…', 'phone');
    await WD.delay(1400, 1800); const r = await ui.actionSheet({ title: 'Did you reach ' + who + '?', message: 'This call was made with the phone’s own dialer' + (phoneApp ? ', not ' + name : '') + ', so it was not recorded and has no transcript. It is logged as “not recorded”.', buttons: [{ label: 'Yes, we talked', value: 'yes' }, { label: 'No answer', value: 'no' }] });
    finish({ dur: r === 'yes' ? 90 : 0, unrecorded: true, via: 'Phone dialer' }); };
  const viaApp = async sheet => { sheet.close();
    if (S.desktop && prov === 'quo') { cfg.tip = true; ui.toast('Number copied · opening Quo', 'doc', 2400); } else ui.toast('Opening ' + name + '…', 'phone.fill');
    if (P.can('events')) { await WD.delay(3200, 4200); finish({ dur: 60 + Math.floor(Math.random() * 180), via: name }); ui.banner({ title: name + ': call ended', text: 'The call with ' + who + ' is on the log. The recording and summary follow when ' + name + ' has them.', icon: 'phone.down', color: 'var(--green)', duration: 5000 }); }
    else { await WD.delay(1400, 1800); const r = await ui.actionSheet({ title: 'Did you reach ' + who + '?', message: name + ' does not report calls to RouteClerk, so this one is logged by hand, with no recording.', buttons: [{ label: 'Yes, we talked', value: 'yes' }, { label: 'No answer', value: 'no' }] }); finish({ dur: r === 'yes' ? 90 : 0, unrecorded: true, via: name }); } };
  const sheet = ui.sheet({ title: useApp ? 'Call with ' + name : 'Call', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], render: () => h('div.ph-hand',
    ui.avatar(o.cu ? o.cu.name : '#', { size: 64 }), h('div.title2', who), h('div.footnote.secondary', [o.cu && o.p && o.p.name, fmt.phone(num)].filter(Boolean).join(' · ')),
    useApp && P.can('from') && h('div.ph-from', h('b', 'Call from ' + o.line.label + ' · ' + fmt.phone(o.line.number)), h('span', 'Chosen because it is ' + o.lineWhy + '.' + (S.desktop ? ' Pick this number in Quo before you call.' : ' Quo is told to use it.'))),
    !seat && phoneApp && h('div.ph-from', h('b', 'You don’t have a ' + name + ' seat'), h('span', 'The call goes out from this phone’s own number and is not recorded. An admin can add you in Settings → Phone.')),
    prov === 'device' && h('div.ph-from', h('b', 'Calls use this phone’s own dialer'), h('span', 'The customer sees this phone’s number. The call is logged here as “not recorded”.')),
    useApp && ui.button(S.desktop && prov === 'quo' ? 'Copy number and open Quo' : 'Call with ' + name, { icon: 'phone.fill', onTap: () => viaApp(sheet) }),
    useApp && !(S.desktop && prov === 'quo') && h('div.ph-link', link),
    useApp && S.desktop && prov === 'quo' && !cfg.tip && h('div.ph-tip', 'Quo’s call links only work in its iPhone and Android apps. On a computer, RouteClerk copies the number; paste it into Quo. You’ll see this tip once.'),
    ui.button(useApp ? 'Use this phone’s dialer instead' : 'Call ' + fmt.phone(num), { kind: useApp ? 'gray' : null, icon: 'phone', onTap: () => viaDevice(sheet) }),
    h('div.caption.secondary', P.can('events') && useApp ? 'When the call ends, ' + name + ' sends it here with its recording and summary.' : 'Nothing comes back from this call by itself.')) }, { detent: 'large' });
};
/** One call button for every screen: WD.phone.call(number, {customerId, contact}). */
P.call = (number, o = {}) => { if (!number) return ui.toast('No phone number on file', 'phone'); return C().place ? C().place({ number, customerId: o.customerId, contact: o.contact }) : ui.toast('Calling isn’t available', 'phone'); };
P.callButtonLabel = () => P.can('place') ? 'Call' : P.seat() && PH().provider !== 'device' ? 'Call with ' + P.name() : 'Call';

/* ---------- Opt-outs and texting rules (R20-9) ---------- */
P.optedOut = number => !!PH().optOut[dg(number)];
P.optOut = (number, how) => { PH().optOut[dg(number)] = { at: +WD.now(), how: how || 'Replied STOP' }; };
P.optIn = number => { delete PH().optOut[dg(number)]; };
const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]?\s*$/i, START = /^\s*(start|unstop|yes)\s*[.!]?\s*$/i;
const refuse = number => ui.alert({ title: 'This number opted out of texts', message: fmt.phone(number) + ' replied STOP, so no text can be sent to it from any company number. They can text START to hear from you again. Call them, or email.' });
const lowCredit = () => P.can('texts') && PH().provider === 'quo' && PH().credits < 5;
function wrapTexts() { const x = X(); if (!x.send || x.send.r20) return;
  const send = x.send, receive = x.receive, sendTo = x.sendTo;
  x.send = (t, text) => { if (P.optedOut(t.number)) { refuse(t.number); return false; } if (PH().provider === 'quo') PH().credits = Math.max(0, +(PH().credits - .01 * Math.ceil(String(text).length / 160)).toFixed(2)); t.seen = true; return send(t, text); }; x.send.r20 = true;
  x.receive = (t, text) => { receive(t, text); t.seen = false;
    if (STOP.test(text)) { P.optOut(t.number); t.resolved = true; t.resolvedHow = 'Opted out of texts'; t.resolvedBy = 'Automatic'; t.resolvedAt = +WD.now(); WD.changed(); ui.banner({ title: 'Opted out of texts', text: (x.nameOf ? x.nameOf(t) : fmt.phone(t.number)) + ' replied STOP. No more texts will be sent to that number.', icon: 'hand.raised', color: 'var(--red)' }); }
    else if (START.test(text) && P.optedOut(t.number)) { P.optIn(t.number); WD.changed(); } };
  x.sendTo = (number, text, o) => { if (P.optedOut(number)) { refuse(number); return (x.list ? x.list() : []).find(t => dg(t.number) === dg(number)) || null; } return sendTo(number, text, o); };
}
/** Ready-made texts for the conversation (R20-9). The wording lives with the company's other templates in the real app. */
P.templates = t => { const c = t.customerId && q.customer(t.customerId), n = first(t.contact || ''), hi = 'Hi' + (n ? ' ' + n : '') + ', this is ' + first(me()) + ' from ' + org().name + '. ';
  return [['On my way', hi + 'Our driver is on the way and should reach you in about 20 minutes.'], ['Running late', hi + 'We’re running about 30 minutes behind today. Sorry for the wait; we’ll text when the driver is close.'],
    ['Service complete', hi + 'Your service is complete. Thank you' + (c ? ' for choosing us' : '') + '!'], ['Invoice link', hi + 'Here is your invoice: https://pay.routeclerk.example/i/' + (c ? c.id : 'new') + ' . You can pay online there.'], ['Reminder for tomorrow', hi + 'A reminder that we’ll be out tomorrow. Reply here if anything has changed.']]; };
/** Above the composer of a conversation: the opt-out notice, or the template chips. `setDraft(text)` fills the message box. */
P.threadTop = (t, setDraft) => P.optedOut(t.number) ? h('div.ph-out', h('b', 'Opted out of texts. '), 'This number replied STOP ' + fmt.rel(PH().optOut[dg(t.number)].at) + '. Nothing can be sent to it until they text START.')
  : WD.can('crm.edit') && P.can('texts') ? h('div.ph-chips', { 'aria-label': 'Ready-made texts' }, P.templates(t).map(([label, text]) => h('button.ph-chip', { onclick: () => setDraft(text) }, label))) : null;
/** Under the composer: pictures can't be sent through Quo's API, so the button opens the conversation in Quo. */
P.threadExtras = t => !P.optedOut(t.number) && WD.can('crm.edit') && P.can('texts') && !P.can('mms') ? h('div', { style: 'margin:6px 0 2px' }, ui.button('Send a photo in ' + P.name(), { kind: 'gray', small: true, icon: 'camera', onTap: () => S.desktop ? ui.toast('Open this conversation in Quo to attach a photo. It appears here once sent.', 'camera', 3200) : ui.toast('Opening the conversation in Quo…', 'camera', 2400) }), h('div.caption.secondary', { style: 'margin-top:4px' }, 'Pictures customers send show up here. Sending one is done in ' + P.name() + '.')) : null;

/* ---------- A missed call becomes a Call back task (R20-10) ---------- */
P.onCall = c => { try { if (!PH().missedTask || c.dir !== 'in' || !['missed', 'voicemail'].includes(c.status) || c.taskId || !c.customerId || !K().addTask) return;
    const t = K().addTask(c.customerId, 'Call back ' + (c.contact || 'them') + ' · ' + (c.status === 'voicemail' ? 'voicemail' : 'missed call'), 0, { lead: false }); t.callId = c.id; c.taskId = t.id; } catch (e) { /* tasks not loaded yet */ } };
/** The call and its task are one thing: finishing either finishes the other. */
function syncTasks() { const cs = C().list ? C().list() : [], tasks = data.tasks || [];
  cs.forEach(c => { if (!c.taskId) return; const t = tasks.find(x => x.id === c.taskId); if (!t) return;
    if (t.done && !c.resolved) Object.assign(c, { resolved: true, resolvedAt: +WD.now(), resolvedBy: me(), resolvedHow: 'Call back task done' });
    else if (c.resolved && !t.done) { t.done = true; t.doneAt = +WD.now(); } }); }

/* ---------- The combined inbox (R20-8) ---------- */
const UI = { f: 'open', line: null }; P.ui = UI;
const office = () => (data.users || []).filter(u => ['owner', 'admin', 'dispatcher', 'office'].includes(u.role) && u.status !== 'invited');
const items = () => { const c = C(), x = X(), out = [], cut = +WD.now() - 14 * 864e5;
  (c.list ? c.list() : []).forEach(k => { if (!k.archived && (k.at >= cut || c.isOpen(k))) out.push({ kind: 'call', it: k, at: k.at, open: c.isOpen(k), missed: k.dir === 'in' && k.status !== 'answered', line: k.lineLabel, name: c.nameOf ? c.nameOf(k) : fmt.phone(k.number) }); });
  (x.list ? x.list() : []).forEach(t => { const l = t.messages[t.messages.length - 1]; if (l) out.push({ kind: 'text', it: t, at: l.at, open: x.waiting(t), missed: false, line: t.line, name: x.nameOf ? x.nameOf(t) : fmt.phone(t.number), last: l }); });
  return out.sort((a, b) => b.at - a.at); };
const unread = r => r.open && !r.it.seen && !r.it.owner;
const stateOf = r => r.it.resolved ? ['Handled', 'var(--gray)'] : r.it.owner ? [(r.it.owner === (S.me || {}).id ? 'Yours' : first((q.user(r.it.owner) || {}).name)), 'var(--blue)'] : r.open ? ['New', 'var(--red)'] : null;
P.openCount = () => { try { return S.signedIn && WD.can('crm.view') ? items().filter(r => r.open).length : 0; } catch (e) { return 0; } };
const handle = r => r.kind === 'call' ? C().resolve(r.it) : X().resolve(r.it);
const assign = async (r, page) => { const v = await ui.actionSheet({ title: 'Who takes this?', message: r.name, buttons: office().map(u => ({ label: u.name + (S.me && u.id === S.me.id ? ' (you)' : ''), value: u.id })).concat(r.it.owner ? [{ label: 'Nobody', value: 'none', role: 'destructive' }] : []) });
  if (!v) return; r.it.owner = v === 'none' ? null : v; if (r.it.taskId) { const t = (data.tasks || []).find(x => x.id === r.it.taskId); if (t && r.it.owner) t.owner = r.it.owner; } WD.changed(); page.refresh(); };
const rowMenu = (r, el, page) => { const edit = WD.can('crm.edit'), mine = r.it.owner === (S.me || {}).id;
  ui.menu(el, [edit && !mine && !r.it.resolved && { label: 'Claim', icon: 'hand.raised', onTap: () => { r.it.owner = S.me.id; r.it.seen = true; WD.changed(); page.refresh(); ui.toast('It’s yours', 'checkmark'); } },
    edit && !r.it.resolved && { label: 'Assign to…', icon: 'person', onTap: () => assign(r, page) }, edit && !r.it.resolved && { label: 'Mark handled', icon: 'checkmark.circle', onTap: () => handle(r) },
    edit && r.it.resolved && { label: 'Reopen', icon: 'arrow.uturn.left', onTap: () => { r.kind === 'call' ? C().reopen(r.it) : (r.it.resolved = false, WD.changed()); page.refresh(); } }, 'divider',
    { label: P.callButtonLabel(), icon: 'phone.fill', onTap: () => r.kind === 'call' ? C().callBack(r.it) : P.call(r.it.number, { customerId: r.it.customerId, contact: r.it.contact }) },
    edit && P.can('texts') && { label: 'Text', icon: 'message', onTap: () => X().compose && X().compose({ number: r.it.number }) }].filter(Boolean)); };
const row = (r, page) => { const c = C(), st = stateOf(r), k = r.it, call = r.kind === 'call', tap = () => { k.seen = true; c.pick ? c.pick(r.kind, k.id, page) : null; };
  const snip = call ? (k.status === 'missed' ? (k.dir === 'in' ? 'Missed call' : 'No answer') : k.status === 'voicemail' ? (/^voicemail/i.test(k.summary || '') ? k.summary : 'Voicemail' + (k.summary ? ': ' + k.summary : '')) : (k.dir === 'in' ? 'Call in' : 'Call out') + (k.summary ? ' · ' + k.summary : '')) : (r.last.dir === 'out' ? first(r.last.by) + ': ' : '') + r.last.text;
  const more = h('button.nav-btn', { 'aria-label': 'Actions for ' + r.name, onclick: e => { e.stopPropagation(); rowMenu(r, more, page); } }, icon('ellipsis', 20));
  return h('div.ph-row' + (unread(r) ? '.new' : '') + (c.isSel && c.isSel(r.kind, k.id) ? '.sel' : ''), { onclick: tap }, h('span.ph-dot' + (unread(r) ? '' : '.off')),
    icon(call ? (r.missed ? 'phone.down' : 'phone.fill') : 'message', 20, r.missed ? 'var(--red)' : 'var(--label2)'),
    h('div.ph-main', h('div.ph-t', r.name), h('div.ph-snip', snip),
      h('div.ph-tags', st && ui.badge(st[0], st[1]), call && c.why && c.why(k) && !k.resolved && ui.badge(c.why(k), r.missed ? 'var(--red)' : 'var(--orange)'), !call && X().why(k) && !k.resolved && ui.badge(X().why(k), 'var(--red)'), k.taskId && !k.resolved && ui.badge('Call back task', 'var(--purple)'), k.unrecorded && ui.badge('Not recorded', 'var(--gray)'), !call && P.optedOut(k.number) && ui.badge('Opted out', 'var(--red)'))),
    h('div.ph-meta', h('div', fmt.rel(r.at)), h('div', r.line + ' line'), more)); };
/** Warnings that stop the phone from working: shown at the top of the inbox and on the settings page. */
P.warnings = push => { const cfg = PH(), out = [], go = () => push && push(P.settingsSpec());
  if (api() && !cfg.connected) out.push(h('div.ph-warn', { onclick: go }, icon('exclamationmark.triangle', 18, 'var(--red)'), h('div', h('b', P.name() + ' is not connected. '), 'New calls and texts are not arriving, and texts can’t be sent. Tap to reconnect.')));
  if (api() && cfg.a2p !== 'approved') out.push(h('div.ph-warn.amber', { onclick: go }, icon('exclamationmark.triangle', 18, 'var(--orange)'), h('div', h('b', 'Text registration is not approved yet. '), 'US carriers block business texts until it is. Check it in ' + P.name() + '.')));
  if (lowCredit()) out.push(h('div.ph-warn.amber', { onclick: go }, icon('exclamationmark.triangle', 18, 'var(--orange)'), h('div', h('b', 'Text credit is low: ' + fmt.money(cfg.credits) + '. '), 'Texts sent from RouteClerk cost 1¢ a segment from the Quo balance and stop when it runs out.')));
  return out; };
const FILTERS = [['open', 'Needs follow-up'], ['unread', 'Unread'], ['missed', 'Missed'], ['mine', 'Mine'], ['all', 'Everything']];
/** The All segment of the Inbox: calls and texts in one list, newest first. */
P.allView = page => { syncTasks(); const all = items(), lines = org().lines || [], uid = (S.me || {}).id;
  const pass = r => (!UI.line || r.line === UI.line) && (UI.f === 'all' ? true : UI.f === 'open' ? r.open : UI.f === 'unread' ? unread(r) : UI.f === 'missed' ? r.missed && r.open : r.it.owner === uid && !r.it.resolved);
  const list = all.filter(pass), count = f => all.filter(r => f === 'open' ? r.open : f === 'unread' ? unread(r) : f === 'missed' ? r.missed && r.open : f === 'mine' ? r.it.owner === uid && !r.it.resolved : false).length;
  const lineBtn = h('button.ph-chip' + (UI.line ? '.on' : ''), { onclick: () => ui.menu(lineBtn, [{ label: 'Every number', checked: !UI.line, onTap: () => { UI.line = null; page.refresh(); } }, 'divider'].concat(lines.map(l => ({ label: l.label + ' · ' + fmt.phone(l.number), checked: UI.line === l.label, onTap: () => { UI.line = l.label; page.refresh(); } })))) }, UI.line ? UI.line + ' line' : 'Every number');
  return [P.warnings(s => page.push(s)), WD.staff && WD.staff.liveStrip && WD.staff.liveStrip(),
    h('div.ph-chips', { 'aria-label': 'Show' }, FILTERS.map(([v, label]) => { const n = count(v); return h('button.ph-chip' + (UI.f === v ? '.on' : ''), { onclick: () => { UI.f = v; page.refresh(); } }, label + (n ? ' · ' + n : '')); }), lines.length > 1 && lineBtn),
    list.length ? list.slice(0, 60).map(r => row(r, page)) : ui.empty({ icon: 'checkmark.circle', title: UI.f === 'all' ? 'Nothing in the last two weeks' : 'Nothing here', text: UI.f === 'open' ? 'Missed calls, voicemails, short calls and texts waiting for a reply show here until someone handles them.' : 'Try another filter. The Call log and Text log have everything.' }),
    h('div.caption.secondary', { style: 'margin:12px 4px 0' }, 'Calls and texts from the last two weeks, plus anything still open. The Call log and Text log have the whole history.')]; };
/** First thing to select in the split view. */
P.firstOpen = () => { const r = items().find(x => x.open); return r ? { kind: r.kind, id: r.it.id } : null; };
P.has = sel => !!sel && items().some(r => r.kind === sel.kind && r.it.id === sel.id);

/* ---------- The caller card: jobs and next service (R20-11) ---------- */
P.briefLine = cu => { if (!cu) return null; const today = D.today(), open = (data.jobs || []).filter(j => j.customerId === cu.id && j.day >= today && !WD.closed[j.status]).sort((a, b) => a.day.localeCompare(b.day)), next = open[0];
  return h('div.ph-brief', h('b', 'Next service: '), next ? fmt.day(next.day) + ' · ' + q.routeName(next.routeId) : 'nothing scheduled', open.length > 1 ? ' · ' + (open.length - 1) + ' more open job' + (open.length === 2 ? '' : 's') : ''); };
if (WD.r15 && WD.r15.callBrief) { const base = WD.r15.callBrief; WD.r15.callBrief = (cu, o) => { const b = base(cu, o), x = P.briefLine(cu); return b && x ? h('div', b, x) : b || x; }; }

/* ---------- Settings → Integrations → Phone (R20-6, R20-12) ---------- */
P.optOutSpec = () => ({ title: 'Opted out of texts', render: page => { const list = Object.entries(PH().optOut);
  return ui.list(ui.section({ showFooter: true, footer: 'A number lands here when it replies STOP, or when the phone service refuses a text because the number opted out. No text is sent to these numbers from any company number, whoever presses Send. A customer texts START to come off the list; an admin can remove a number only with the customer’s say-so.' },
    list.length ? list.map(([n, o]) => ui.row({ title: fmt.phone('+1' + n), subtitle: o.how + ' · ' + fmt.rel(o.at), trailing: admin() ? ui.button('Remove', { small: true, kind: 'gray', block: false, onTap: async () => { if (await ui.actionSheet({ title: 'Text ' + fmt.phone('+1' + n) + ' again?', message: 'Only do this if the customer asked to get texts again.', buttons: [{ label: 'They asked, remove', value: true, role: 'destructive' }] })) { P.optIn(n); WD.changed(); page.refresh(); } } }) : null }))
      : ui.row({ title: 'Nobody has opted out' }))); } });
P.settingsSpec = () => ({ title: 'Phone', render: page => { const cfg = PH(), o = org(), ok = admin(), re = () => { WD.changed(); page.refresh(); }, quo = cfg.provider === 'quo', viaApi = api(), name = P.name();
  const dot = on => h('span', { style: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block', background: on ? 'var(--green)' : 'var(--red)' } });
  const calls = WD.calls && WD.calls.list ? WD.calls.list() : [], last = calls[0];
  const people = (data.users || []).filter(u => u.status !== 'invited' && ['owner', 'admin', 'dispatcher', 'office', 'driver'].includes(u.role));
  return ui.list(P.warnings(),
    ui.section({ header: 'Phone service', fold: false, showFooter: true, footer: 'Choose one. What the Inbox and the call buttons can do depends on the service; anything it can’t do is hidden or turned off, and listed below.' },
      Object.entries(PROV).map(([id, p]) => ui.row({ icon: cfg.provider === id ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: cfg.provider === id ? 'var(--tint)' : 'var(--label3)', title: p.name, subtitle: p.sub, badge: p.soon ? ui.badge('Planned', 'var(--gray)') : null, disabled: !ok || !!p.soon, onTap: () => { cfg.provider = id; re(); } })),
      cfg.provider === 'link' && ui.pickerRow({ title: 'Which app', value: cfg.app, disabled: !ok, options: Object.entries(APPS).map(([value, a]) => ({ value, label: a.name })), onChange: v => { cfg.app = v; re(); } })),
    ui.section({ header: 'What works with ' + (cfg.provider === 'device' ? 'the phone’s dialer' : P.name()), fold: false }, h('div', { style: 'padding:8px 16px' }, CAPS.map(([cap, text]) => h('div.ph-cap' + (P.can(cap) ? '' : '.no'), icon(P.can(cap) ? 'checkmark.circle.fill' : 'xmark.circle.fill', 18, P.can(cap) ? 'var(--green)' : 'var(--label3)'), text)))),
    viaApi && ui.section({ header: name + ' connection', fold: false, showFooter: true, footer: quo ? 'RouteClerk reads calls, recordings, summaries and texts with the API key, and Quo tells it about new ones. The connection is set up for you when the key is saved. Quo has no way for another app to place a call, so calls are handed to the Quo app.'
        : 'RouteClerk places and answers calls and sends texts on the company’s Telnyx numbers, and Telnyx tells it what happened. Telnyx has no app, voicemail box or call summaries of its own, and keeps no history to load, so RouteClerk keeps every call and text as it happens. Telnyx bills the company for minutes and texts.' },
      ui.row({ leading: dot(cfg.connected), title: 'API key', subtitle: (quo ? 'Workspace ' : 'Account ') + o.name + ' · key ending 4f2a', detail: cfg.connected ? 'Connected' : 'Not connected' }),
      ui.row({ leading: dot(cfg.connected), title: 'Last event from ' + name, detail: cfg.connected && last ? fmt.rel(last.at) : 'None arriving' }),
      ui.row({ leading: dot(cfg.a2p === 'approved'), title: 'Text registration with the carriers', detail: cfg.a2p === 'approved' ? 'Approved' : 'Waiting' }),
      quo && ui.row({ leading: dot(!lowCredit()), title: 'Text credit', subtitle: 'Texts sent from RouteClerk cost 1¢ a segment from the Quo balance', detail: fmt.money(cfg.credits) }),
      !cfg.connected && ui.row({ title: 'Reconnect', tint: true, center: true, disabled: !ok, onTap: () => ui.run('Checking the key with ' + name + '…', () => { cfg.connected = true; }, { done: 'Connected · events are arriving' }).then(re) }),
      ui.row({ title: 'Send a test event', tint: true, center: true, disabled: !ok || !cfg.connected, onTap: () => ui.run('Sending a test event to ' + name + '…', () => {}, { done: name + ' answered' }) }),
      quo && ui.toggleRow({ title: 'Copy customers to Quo contacts', subtitle: 'So Quo shows the customer’s name. A contact appears in Quo once it has a call or text.', value: !!cfg.sync, disabled: !ok, onChange: v => { cfg.sync = v; re(); } })),
    cfg.provider !== 'device' && ui.section({ header: 'Company numbers', fold: false, showFooter: true, footer: 'The ad channel is where the number is advertised. A lead that first called that number is counted for that channel, separately from how they reached us (phone, text, form).' },
      (o.lines || []).map(l => ui.pickerRow({ title: l.label + ' · ' + fmt.phone(l.number), disabled: !ok, value: cfg.channels[l.number] || 'None', options: CHANNELS.map(c => ({ value: c, label: c === 'None' ? 'No ad channel' : c })), onChange: v => { cfg.channels[l.number] = v; re(); } }))),
    quo && ui.section({ header: 'Who has a Quo seat', fold: true, folded: true, showFooter: true, footer: 'Read from Quo. Someone without a seat calls from their own phone’s number; those calls are logged as “not recorded”.' },
      people.map(u => ui.toggleRow({ title: u.name, subtitle: (WD.roles[u.role] || {}).title, value: !cfg.noSeat.includes(u.id), disabled: !ok, onChange: v => { cfg.noSeat = cfg.noSeat.filter(x => x !== u.id); if (!v) cfg.noSeat.push(u.id); re(); } }))),
    ui.section({ header: 'Rules', fold: false },
      ui.toggleRow({ title: 'A missed call makes a Call back task', subtitle: 'For a customer or lead, owned by their owner and due today. Finishing the task or the call finishes both.', value: !!cfg.missedTask, disabled: !ok, onChange: v => { cfg.missedTask = v; re(); } }),
      P.can('optout') && ui.row({ icon: 'hand.raised', iconColor: 'var(--red)', title: 'Opted out of texts', detail: String(Object.keys(cfg.optOut).length), chevron: true, onTap: () => page.push(P.optOutSpec()) }),
      WD.calls && WD.calls.settingsSpec && ui.row({ icon: 'flag', iconColor: 'var(--orange)', title: 'Ring order and review rules', subtitle: 'Who each number rings, and which calls are flagged', chevron: true, onTap: () => page.push(WD.calls.settingsSpec()) }),
      WD.ops && WD.ops.commsSpec && ui.row({ icon: 'phone.fill', iconColor: 'var(--blue)', title: 'Which number calls and texts come from', chevron: true, onTap: () => page.push(WD.ops.commsSpec()) })));
} });
const integ = (WD.integrations || []).find(x => x.id === 'quo');
if (integ) { integ.name = 'Phone'; integ.pitch = 'Calls and texts in the Inbox and on customer timelines'; integ.open = () => P.settingsSpec(); }

wrapTexts();
if (WD.app.uiState) WD.app.uiState('phone', UI);
WD.panel.addAction('Customer replies STOP to a text', () => { const x = X(), t = x.list && x.list().find(k => !P.optedOut(k.number)); if (!t) return ui.toast('No conversation to use', 'message'); x.receive(t, 'STOP'); });
WD.panel.addAction('Quo connection breaks', () => { PH().connected = false; WD.changed(); ui.banner({ title: 'Quo is not connected', text: 'Calls and texts are not arriving. Tap to open Settings → Phone.', icon: 'exclamationmark.triangle', color: 'var(--red)', onTap: () => { WD.nav.switchTab('settings'); WD.nav.push(P.settingsSpec()); } }); });
WD.panel.addAction('Text credit runs low', () => { PH().credits = 1.2; WD.changed(); ui.toast('Text credit is now $1.20', 'exclamationmark.triangle'); });
WD.panel.addJump('Phone settings', () => { WD.nav.switchTab('settings'); WD.nav.push(P.settingsSpec()); });
})();
