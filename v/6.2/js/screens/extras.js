/* Features shared across screens, registered on WD.x: customer pricing and its change history, contract anniversaries and price-change
   letters, service agreements (send a signing link or sign in person), time-off requests, the side-by-side conflict review, missing-address
   notices, dated purchase orders in forms, older job history from the server, the offline-data page and the "what's new" tutorial. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD;
const X = WD.x = {};
const today = () => D.today(), me = () => (S.me && S.me.name) || 'You';
const money = n => fmt.money(n, true), pb = id => data.priceBook.find(x => x.id === id) || { name: id, unit: 'item', rate: 0 };
const longDay = k => fmt.day(k, 'long') + ', ' + k.slice(0, 4), mdy = k => fmt.day(k, 'md') + ', ' + k.slice(0, 4);
const when = t => { const k = D.key(new Date(t)); return mdy(k); };
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

WD.css(`
.x-doc { margin: 12px 16px; padding: 18px 18px 20px; border-radius: 12px; background: #fff; color: #1c1c1e; font-size: 13.5px; line-height: 19px; box-shadow: 0 1px 4px rgba(0,0,0,.14); user-select: text; -webkit-user-select: text; }
.x-doc h4 { margin: 0 0 2px; font-size: 16px; } .x-doc p { margin: 9px 0 0; } .x-doc small { color: #6b6b70; } .x-doc table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
.x-doc td { padding: 4px 0; border-top: .5px solid #d8d8dc; vertical-align: top; } .x-doc td:last-child { text-align: right; white-space: nowrap; } .x-doc .sig { margin-top: 14px; border-bottom: 1px solid #1c1c1e; min-height: 46px; display: flex; align-items: flex-end; overflow: hidden; }
.x-doc .sig img, .x-doc .sig svg { display: block; height: auto; width: auto; max-height: 44px; max-width: min(200px, 100%); object-fit: contain; object-position: left bottom; color: #1c1c1e; }
.x-steps { padding: 4px 16px 10px; } .x-step { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; font-size: 15px; } .x-step.wait { color: var(--label3); } .x-step small { display: block; font-size: 12.5px; color: var(--label2); }
.x-cmp { display: grid; grid-template-columns: 74px 1fr 1fr; font-size: 13px; line-height: 17px; }
.x-cmp > div { padding: 7px 8px; border-top: .5px solid var(--sep); min-width: 0; overflow-wrap: anywhere; }
.x-cmp .hd { font-weight: 700; font-size: 12px; border-top: 0; background: var(--fill3); } .x-cmp .hd small { display: block; font-weight: 400; color: var(--label2); }
.x-cmp .lab { color: var(--label2); font-size: 12px; } .x-cmp .dif { background: color-mix(in srgb, var(--yellow) 26%, var(--cell)); font-weight: 600; } .x-cmp .lab.dif { color: var(--label); }
.x-cmp .same { color: var(--label2); }
.x-cmphead { padding: 10px 16px 4px; font-size: 13px; font-weight: 600; color: var(--label2); text-transform: uppercase; letter-spacing: -.08px; }
.x-pick { display: flex; gap: 8px; width: 100%; } .x-pick .btn { flex: 1; min-width: 0; padding: 0 6px; font-size: 15px; }
.x-chg s { color: var(--label3); } .x-chg b { color: var(--label); }
.x-two { display: flex; gap: 6px; flex: none; }
.x-pct { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 16px; } .x-pct button { border: 0; border-radius: 15px; height: 30px; padding: 0 12px; background: var(--fill3); color: var(--tint); font-size: 14px; font-weight: 600; cursor: pointer; }
.x-pct button.on { background: var(--tint); color: #fff; }
.x-tour { position: absolute; inset: 0; z-index: 2000; }
.x-tour-hole { position: absolute; border-radius: 14px; box-shadow: 0 0 0 2000px rgba(0,0,0,.62); transition: all .28s ease; pointer-events: none; }
.x-tour-hole.none { left: 50%; top: 50%; width: 0; height: 0; }
.x-tour-card { position: absolute; left: 16px; right: 16px; background: var(--cell); color: var(--label); border-radius: 18px; padding: 18px 18px 14px; box-shadow: 0 12px 40px rgba(0,0,0,.4); transition: top .28s ease; }
.x-tour-card h3 { margin: 8px 0 6px; font-size: 20px; letter-spacing: .2px; } .x-tour-card p { margin: 0; font-size: 15px; line-height: 20px; color: var(--label2); } .x-tour-card ul { margin: 8px 0 0; padding-left: 18px; font-size: 14.5px; line-height: 20px; }
.x-tour-ic { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: var(--tint); }
.x-tour-foot { display: flex; align-items: center; gap: 8px; margin-top: 14px; } .x-tour-foot .spacer { flex: 1; }
.x-tour-dots { display: flex; gap: 5px; } .x-tour-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--fill); } .x-tour-dots i.on { background: var(--tint); }
.x-tour-foot button { border: 0; background: none; font-size: 16px; color: var(--tint); cursor: pointer; padding: 6px 4px; } .x-tour-foot button.next { background: var(--tint); color: #fff; border-radius: 16px; padding: 7px 16px; font-weight: 600; }
.x-ai { margin: 0 16px; padding: 11px 13px; border-radius: 12px; background: color-mix(in srgb, var(--purple) 10%, var(--cell)); font-size: 14.5px; line-height: 19.5px; }
.x-ai b.t { display: flex; align-items: center; gap: 5px; font-size: 12px; text-transform: uppercase; color: var(--purple); margin-bottom: 4px; letter-spacing: 0; }
`);

/* ================= Dated purchase orders inside a form ================= */
/** Rows for a PO field that can hold one PO or several, each with the service dates it applies to.
    o: {st (keeps .multi between refreshes), getPO(), setPO(v), schedule (array edited in place), docs, refresh(), required} */
X.poRows = o => {
  const sch = o.schedule, t = today(), multi = !!o.st.multi || sch.length > 0;
  return [
    !multi && ui.inputRow({ label: 'PO number', placeholder: 'None', value: o.getPO(), required: o.required, onInput: v => o.setPO(v) }),
    ui.toggleRow({ title: 'Multiple or date-restricted POs', subtitle: 'Enter each PO with the service dates it applies to', value: multi, onChange: v => {
      if (!v && sch.length) { ui.toast('Remove the dated POs first', 'info.circle', 2400); return false; }
      o.st.multi = v; if (v && o.getPO().trim() && !sch.length) sch.push({ po: o.getPO().trim(), from: t, until: D.add(t, 364) });
      o.refresh(); } }),
    multi && sch.map((e, i) => { const cur = e.from <= t && t <= e.until, past = e.until < t;
      return ui.row({ icon: 'calendar', iconColor: 'var(--teal)', title: e.po, subtitle: mdy(e.from) + ' – ' + mdy(e.until), badge: ui.badge(cur ? 'Current' : past ? 'Ended' : 'Starts ' + fmt.day(e.from, 'md'), cur ? 'var(--green)' : past ? 'var(--gray)' : 'var(--blue)'),
        trailing: h('button.bi-del', { 'aria-label': 'Remove PO', onclick: ev => { ev.stopPropagation(); sch.splice(i, 1); o.refresh(); } }, icon('bi.minus', 22)), onTap: () => WD.workflow.editPO(sch, e, o.refresh) }); }),
    multi && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: sch.length ? 'Add another PO' : 'Add a PO and its dates', tint: true, onTap: () => WD.workflow.editPO(sch, null, o.refresh, o.docs) }),
    multi && sch.length > 0 && h('div.section-footer', { style: 'padding-top:6px' }, 'The next PO can be entered while the current one is still active. It takes over on its start date.')];
};

/* ================= Customer pricing, change history, anniversaries ================= */
const FREQS = ['Weekly', 'Every 2 weeks', 'Every 4 weeks', 'Monthly', 'Quarterly', 'One time', 'On call'];
const loc = c => c.locations[0] || { items: [] };
const perVisit = items => (items || []).reduce((s, i) => s + i.qty * i.rate, 0);
const canSeePricing = () => WD.can('billing.view') || WD.can('billing.manage'), canPrice = () => WD.can('billing.manage');
/** Pricing set to start on a later service date becomes the current pricing once that date arrives. */
function promote(c) { const u = c.upcoming; if (u && u.effective <= today()) { loc(c).items = WD.copyItems(u.items); loc(c).containers = WD.itemsLabel(u.items); c.freq = u.freq; c.upcoming = null; } }
const firstVisitFrom = (c, day) => { const j = q.jobsForCustomer(c.id).find(x => x.day >= day && x.status === 'scheduled'); return j ? j.day : day; };
const changeText = ch => ch.kind === 'price' ? h('span.x-chg', ch.item + ': ', h('s', money(ch.from)), ' → ', h('b', money(ch.to)))
  : ch.kind === 'qty' ? h('span.x-chg', ch.item + ' quantity: ', h('s', String(ch.from)), ' → ', h('b', String(ch.to)))
  : ch.kind === 'freq' ? h('span.x-chg', 'Service interval: ', h('s', ch.from), ' → ', h('b', ch.to)) : ch.text;
const changeIcon = { price: ['dollarsign.circle', 'var(--green)'], qty: ['shippingbox', 'var(--orange)'], freq: ['repeat', 'var(--blue)'], start: ['flag', 'var(--gray)'] };

X.pricingSection = c => {
  if (!canSeePricing() || !['customer', 'serviced', 'scheduled'].includes(c.lifecycle)) return null;
  promote(c); const items = loc(c).items || [], u = c.upcoming, an = anniversaryOf(c);
  const rows = (list, dim) => list.filter(i => i.qty > 0).map(i => ui.row({ title: pb(i.id).name, subtitle: i.qty + ' × ' + pb(i.id).unit, detail: h('span', { style: dim ? null : 'color:var(--label);font-weight:600' }, money(i.rate) + ' each') }));
  return [ui.section({ header: 'Current pricing', footer: u ? null : 'Rates each visit starts from. A change can start on any service date and can send the customer a letter.' },
      rows(items), !items.some(i => i.qty > 0) && ui.row({ title: 'No containers on file' }),
      ui.row({ title: 'Per visit', detail: h('b', { style: 'color:var(--label)' }, money(perVisit(items))) }), ui.row({ title: 'Service interval', detail: c.freq }),
      an && ui.row({ title: 'Anniversary', subtitle: 'Customer since ' + mdy(c.stats.firstInvoice), detail: fmt.day(an.day, 'md') + ' · ' + an.years + (an.years === 1 ? ' year' : ' years') }),
      !u && canPrice() && ui.row({ icon: 'pencil', iconPlain: true, title: 'Change pricing or service…', tint: true, onTap: () => X.changeService(c) })),
    u && ui.section({ header: 'Starting ' + longDay(u.effective), footer: 'Visits on or after this date already carry the new pricing.' + (u.letter ? ' The customer was sent a letter.' : '') },
      rows(u.items, true), ui.row({ title: 'Per visit', detail: money(perVisit(u.items)) }), u.freq !== c.freq && ui.row({ title: 'Service interval', detail: u.freq }),
      canPrice() && ui.row({ title: 'Change again…', tint: true, onTap: () => X.changeService(c) }))];
};
X.historySection = c => {
  const list = (c.changes || []).slice().sort((a, b) => b.at - a.at); if (!canSeePricing() || !list.length) return null;
  const row = ch => { const [ic, col] = changeIcon[ch.kind] || changeIcon.start;
    return ui.row({ icon: ic, iconColor: col, title: changeText(ch), subtitle: (ch.kind === 'start' ? mdy(ch.effective) : 'From service on ' + mdy(ch.effective)) + ' · ' + ch.by + (ch.letter ? ' · letter sent' : ''), chevron: !!ch.letterDoc, onTap: ch.letterDoc ? () => WD.nav.push(letterSpec(c, ch.letterDoc)) : null }); };
  return ui.section({ header: 'Price and service history', footer: 'Every change to price, container quantity and service interval, with who made it and the service date it started.' },
    list.slice(0, 6).map(row), list.length > 6 && ui.row({ title: 'Show all ' + list.length, tint: true, center: true, onTap: () => WD.nav.push({ title: 'Price and service history', render: () => ui.list(ui.section(null, list.map(row))) }) }));
};
/** Record what changed between two item lists / intervals on the customer's history. Returns the new entries. */
function recordChanges(c, before, after, freqFrom, freqTo, effective, letter) {
  const out = [], at = +WD.now(), by = me();
  after.forEach(i => { const o = before.find(x => x.id === i.id);
    if (o && o.rate !== i.rate && i.qty > 0) out.push({ at, by, kind: 'price', item: pb(i.id).name, from: o.rate, to: i.rate, effective, letter });
    if ((o ? o.qty : 0) !== i.qty) out.push({ at, by, kind: 'qty', item: pb(i.id).name, from: o ? o.qty : 0, to: i.qty, effective, letter }); });
  before.forEach(o => { if (!after.some(i => i.id === o.id) && o.qty > 0) out.push({ at, by, kind: 'qty', item: pb(o.id).name, from: o.qty, to: 0, effective, letter }); });
  if (freqFrom !== freqTo) out.push({ at, by, kind: 'freq', from: freqFrom, to: freqTo, effective, letter });
  c.changes = (c.changes || []).concat(out); return out;
}
/** Put new rates and quantities on the customer's scheduled visits from a service date on. Returns how many visits changed. */
function applyToJobs(c, items, from, exceptId) {
  let n = 0;
  data.jobs.forEach(j => { if (j.customerId !== c.id || j.id === exceptId || j.status !== 'scheduled' || j.day < from || j.invoice || j.billing) return;
    const extra = (j.items || []).filter(i => !WD.CONTAINERS.includes(i.id)); j.items = WD.copyItems(items.filter(i => i.qty > 0)).concat(extra); j.containers = WD.itemsLabel(j.items, j.type === 'purge'); n++; });
  return n;
}
function letterBody(c, changes, effective) {
  if (WD.co) return WD.co.letterDoc(c, changes, effective);   // laid out from the editable “Price or service change” template
  const p = c.contacts[0] || {}, org = S.org || data.orgs[0], lines = changes.filter(ch => ch.kind !== 'start');
  return h('div.x-doc', h('h4', org.name), h('small', (org.remit || []).slice(1).join(' · ') + (org.phone ? ' · ' + org.phone : '')),
    h('p', longDay(today())), h('p', c.name, h('br'), loc(c).address || ''), h('p', 'Dear ' + (p.name || 'Customer') + ','),
    h('p', 'Thank you for trusting ' + org.name + ' with your document destruction. This letter is to let you know about a change to your service, beginning with your service on ', h('b', longDay(effective)), '.'),
    h('table', lines.map(ch => h('tr', h('td', ch.kind === 'price' ? ch.item : ch.kind === 'qty' ? ch.item + ' — quantity' : 'Service interval'),
      h('td', ch.kind === 'price' ? money(ch.from) + ' → ' + money(ch.to) : ch.from + ' → ' + ch.to)))),
    h('p', 'Services before that date are billed at your current rate. Nothing else about your service changes, and there is nothing you need to do.'),
    h('p', 'If you have any questions, call us at ' + (org.phone || 'the office') + ' or reply to this email.'), h('p', 'Sincerely,', h('br'), (q.user('u1') || {}).name || org.name, h('br'), org.name));
}
const letterSpec = (c, doc) => ({ title: 'Letter', trailing: [{ icon: 'share', label: 'Share', onTap: () => ui.toast('Share sheet: print, email or save as PDF', 'share', 2400) }],
  render: () => [letterBody(c, doc.changes, doc.effective), h('div', { style: 'padding:0 16px 16px' }, ui.note(doc.sentTo ? 'Emailed to ' + doc.sentTo + ' on ' + when(doc.at) + '.' : 'Preview — sent when you save the change.'))] });
/** Change a customer's rates, container quantities or service interval from a service date on, with an optional letter. o: {effective, reason} */
X.changeService = (c, o = {}) => {
  promote(c); const base = WD.copyItems(loc(c).items), t = today(), email = c.billingEmail || (c.contacts[0] || {}).email || '';
  const f = { items: WD.copyItems((c.upcoming || {}).items || base), freq: (c.upcoming || {}).freq || c.freq, effective: o.effective || firstVisitFrom(c, D.add(t, WD.r11 ? WD.r11.cfg.letters.days : 30)), letter: true, method: WD.r11 ? WD.r11.cfg.letters.method : 'email', pct: 0 };
  WD.CONTAINERS.filter(id => id !== 'box').forEach(id => { if (!f.items.some(i => i.id === id)) f.items.push({ id, qty: 0, rate: pb(id).rate }); });
  const diff = () => { const tmp = { changes: [] }; return recordChanges(tmp, base, f.items.filter(i => i.qty > 0 || base.some(b => b.id === i.id)), c.freq, f.freq, f.effective, false); };
  const sheet = ui.sheet({ title: 'Change pricing or service', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Save', bold: true, disabled: !diff().length, onTap: async p => {
      const changes = diff(); if (!changes.length) return; const send = f.letter && changes.length > 0, items = f.items.filter(i => i.qty > 0); let n = 0;
      if (!await ui.run(send && email ? 'Saving and sending the letter…' : 'Saving…', () => {
        const doc = send ? { at: +WD.now(), effective: f.effective, sentTo: email, changes: changes.map(x => ({ ...x })) } : null;
        const added = recordChanges(c, base, f.items.filter(i => i.qty > 0 || base.some(b => b.id === i.id)), c.freq, f.freq, f.effective, send && !!email); added.forEach(x => { if (doc) x.letterDoc = doc; });
        if (f.effective <= t) { loc(c).items = WD.copyItems(items); loc(c).containers = WD.itemsLabel(items); c.freq = f.freq; c.upcoming = null; } else c.upcoming = { items: WD.copyItems(items), freq: f.freq, effective: f.effective, letter: send && !!email };
        n = applyToJobs(c, items, f.effective);
        if (doc) c.documents.push({ id: 'doc-l' + Date.now(), kind: 'other', name: 'Price change letter ' + f.effective + '.pdf', size: '64 KB', at: +WD.now() });
      }, { done: send && email && f.method !== 'print' ? 'Saved · letter sent' : 'Saved' })) return;
      if (send && f.method !== 'email') setTimeout(() => ui.toast('Letter added to the print-and-mail list', 'doc.text', 2800), 400);
      p.dismiss(); ui.toast(n ? n + (n === 1 ? ' scheduled visit' : ' scheduled visits') + ' updated from ' + fmt.day(f.effective, 'md') : 'New pricing starts ' + fmt.day(f.effective, 'md'), 'checkmark', 2800); } }],
    render: p => { const changes = diff(), was = perVisit(base), now = perVisit(f.items), up = now > was, visits = q.jobsForCustomer(c.id).filter(j => j.status === 'scheduled' && j.day >= f.effective).length;
      const setPct = n => { f.pct = n; f.items.forEach(i => { const b = base.find(x => x.id === i.id); if (b) i.rate = Math.round(b.rate * (1 + n / 100) * 100) / 100; }); p.refresh(); };
      return ui.list(
        o.reason && h('div', { style: 'padding:4px 4px 0' }, ui.note(o.reason)),
        ui.section({ header: c.name + ' · rates and quantities', footer: 'Per visit: ' + money(was) + (now !== was ? ' → ' + money(now) + ' (' + (up ? '+' : '−') + money(Math.abs(now - was)) + ')' : '') },
          h('div.x-pct', h('span.footnote', { style: 'align-self:center;margin-right:4px' }, 'Raise all rates'), [0, 3, 5, 8, 10].map(n => h('button' + (f.pct === n ? '.on' : ''), { onclick: () => setPct(n) }, n ? '+' + n + '%' : 'None'))),
          f.items.map(i => { const b = base.find(x => x.id === i.id);
            return h('div.row.jb-item', h('div.row-main', h('div.row-title', pb(i.id).name), h('div.row-sub', b && b.rate !== i.rate ? 'Was ' + money(b.rate) : 'Rate each')),
              h('input.jb-rate', { type: 'text', inputmode: 'decimal', 'aria-label': pb(i.id).name + ' rate', value: '$' + i.rate, oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); i.rate = isNaN(v) ? 0 : v; f.pct = -1; }, onchange: () => p.refresh() }),
              ui.numField(i.qty, 0, 500, v => { i.qty = v; p.refresh(); }), ui.stepper(i.qty, 0, 500, v => { i.qty = v; p.refresh(); })); })),
        ui.section('Service interval', ui.pickerRow({ title: 'Service every', value: f.freq, options: FREQS.includes(f.freq) ? FREQS : [f.freq].concat(FREQS), onChange: v => { f.freq = v; p.refresh(); } })),
        ui.section({ header: 'Starts with service on', footer: (visits ? visits + (visits === 1 ? ' scheduled visit' : ' scheduled visits') + ' on or after this date will use the new pricing.' : 'Every visit on or after this date uses the new pricing.') + ' Earlier visits keep the current pricing.' },
          ui.dateRow({ title: 'Service date', icon: 'calendar', iconColor: 'var(--red)', value: f.effective, onChange: v => { f.effective = v; p.refresh(); } })),
        ui.section({ header: 'Letter to the customer', footer: (f.method === 'print' ? 'Added to the print-and-mail list when you save, and kept with the customer’s documents.' : email ? 'Sent automatically to ' + email + ' when you save, and kept with the customer’s documents.' : 'No email on file. Add one to send the letter automatically; you can still print it from the preview.') + ' The notice period (' + (WD.r11 ? WD.r11.cfg.letters.days : 30) + ' days) and how letters go out are set in Settings → Company → Pricing and Agreements.' },
          ui.toggleRow({ title: 'Send a letter about this change', value: f.letter, onChange: v => { f.letter = v; p.refresh(); } }),
          f.letter && ui.pickerRow({ title: 'Send it by', value: f.method, options: [{ value: 'email', label: 'Email' }, { value: 'print', label: 'Print and mail' }, { value: 'both', label: 'Email, and print and mail' }], onChange: v => { f.method = v; p.refresh(); } }),
          f.letter && ui.row({ title: 'Preview letter', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, disabled: !changes.length, onTap: () => p.push(letterSpec(c, { effective: f.effective, changes })) })));
    } });
  return sheet;
};
/** After the price on an invoice was changed: offer to make it the price for this and all future visits. Resolves false to cancel creating the invoice. */
/* Anyone who can invoice in the field (drivers included) may change a standing price for this and all future visits. A company can require an
   owner or admin to approve it first (Settings → Company → Pricing and Agreements); the request then waits in CRM → Tasks. */
X.priceChangePrompt = async (job, lines) => {
  const c = q.customer(job.customerId), needsOK = !canPrice() && WD.r11 && WD.r11.approvalsOn(); if (!c || !(canPrice() || WD.can('billing.field'))) return true;
  const changed = lines.filter(l => l.id && WD.CONTAINERS.includes(l.id)).map(l => ({ l, it: (job.items || []).find(i => i.id === l.id) })).filter(x => x.it && x.it.rate !== l_rate(x.l));
  if (!changed.length) return true;
  const future = q.jobsForCustomer(c.id).filter(j => j.status === 'scheduled' && j.day > job.day && j.id !== job.id).length;
  const v = await ui.actionSheet({ title: 'You changed the price', message: h('div', changed.map(x => h('div', pb(x.l.id).name + ': ' + money(x.it.rate) + ' → ' + money(l_rate(x.l)))), h('div', { style: 'margin-top:4px' }, 'Apply the new price to:')),
    buttons: [{ label: 'This invoice only', value: 'one' }, { label: 'This and all future visits' + (future ? ' (' + future + ')' : '') + (needsOK ? ' · needs approval' : ''), value: 'future' }], cancel: 'Back to the invoice' });
  if (!v) return false; if (v === 'one') return true;
  if (needsOK) { WD.r11.requestPrice(c, job, changed.map(x => ({ id: x.l.id, name: pb(x.l.id).name, from: x.it.rate, to: l_rate(x.l) }))); ui.toast('This invoice uses the new price. Future visits change once an owner or admin approves.', 'clock', 3600); return true; }
  promote(c); const before = WD.copyItems(loc(c).items), after = WD.copyItems(before);
  changed.forEach(x => { const a = after.find(i => i.id === x.l.id); if (a) a.rate = l_rate(x.l); else after.push({ id: x.l.id, qty: x.it.qty, rate: l_rate(x.l) }); x.it.rate = l_rate(x.l); });
  recordChanges(c, before, after, c.freq, c.freq, job.day, false); loc(c).items = after;
  if (c.upcoming) c.upcoming.items.forEach(i => { const a = after.find(y => y.id === i.id); if (a) i.rate = a.rate; });
  data.jobs.forEach(j => { if (j.customerId === c.id && j.status === 'scheduled' && j.day > job.day) (j.items || []).forEach(i => { const a = changed.find(x => x.l.id === i.id); if (a) i.rate = l_rate(a.l); }); });
  ui.toast('New price saved for ' + c.name + (future ? ' · ' + future + ' future visits' : ''), 'checkmark', 2800); WD.changed(); return true;
};
const l_rate = l => +l.rate || 0;

/** Anniversary of the customer's first invoice in a given month ('YYYY-MM'), if they have completed at least a year by then. */
function anniversaryIn(c, ym) { const f = c.stats && c.stats.firstInvoice; if (!f || !['customer', 'serviced'].includes(c.lifecycle) || f.slice(5, 7) !== ym.slice(5)) return null;
  const years = +ym.slice(0, 4) - +f.slice(0, 4); return years >= 1 ? { c, day: ym + f.slice(7), years } : null; }
function anniversaryOf(c) { const f = c.stats && c.stats.firstInvoice; if (!f) return null; const t = today(); let y = +t.slice(0, 4), day = y + f.slice(4); if (day < t) day = (++y) + f.slice(4); const years = y - +f.slice(0, 4); return years >= 1 ? { day, years } : null; }
const nextMonthKey = () => { const d = D.parse(today()); d.setDate(1); d.setMonth(d.getMonth() + 1); return D.key(d).slice(0, 7); };
X.anniversaries = () => { const ym = nextMonthKey(); return data.customers.map(c => anniversaryIn(c, ym)).filter(Boolean).sort((a, b) => a.day.localeCompare(b.day)); };
const lastPrice = c => (c.changes || []).filter(x => x.kind === 'price').sort((a, b) => b.at - a.at)[0];
/** Internals other files reuse to change prices for many customers at once (r14-money.js: Suggested price changes). */
X.priceInt = { recordChanges: (...a) => recordChanges(...a), applyToJobs: (...a) => applyToJobs(...a), firstVisitFrom: (...a) => firstVisitFrom(...a), perVisit, loc, promote: c => promote(c), canPrice: () => canPrice(), canSeePricing: () => canSeePricing(), lastPrice, pb };
/** Customers → Suggested price changes (5.0; the page is in r14-money.js). The yearly-anniversary list below is only the fallback. */
X.anniversarySpec = () => WD.money && WD.money.priceSpec ? WD.money.priceSpec() : anniversaryFallback();
const anniversaryFallback = () => ({ title: 'Suggested price changes', render: page => { const list = X.anniversaries(), month = fmt.day(nextMonthKey() + '-01', 'month');
  return ui.list(h('div', { style: 'padding:4px 4px 0' }, ui.note('Customers reaching their yearly anniversary in ' + month + '. This report is ready on the 1st of each month for the month ahead, so price changes can go out with a letter before the anniversary.')),
    ui.section({ header: month + ' · ' + list.length + (list.length === 1 ? ' customer' : ' customers'), footer: 'Tap a customer to change their pricing from the anniversary visit, or mark them reviewed with no change.' },
      list.map(a => { const lp = lastPrice(a.c), done = a.c.annivReviewed === a.day || (a.c.upcoming && a.c.upcoming.effective >= a.day);
        return ui.row({ leading: ui.avatar(a.c.name, { size: 36 }), title: a.c.name, subtitle: [a.years + (a.years === 1 ? ' year' : ' years') + ' on ' + fmt.day(a.day, 'md'), money(perVisit(loc(a.c).items)) + ' per visit · ' + a.c.freq, lp ? 'Last price change ' + when(lp.at) : 'No price change on record'].map(x => h('div', x)),
          badge: done ? ui.badge(a.c.upcoming ? 'Price change set' : 'Reviewed', 'var(--green)') : ui.badge('To review', 'var(--orange)'), chevron: true, onTap: async () => {
            const v = await ui.actionSheet({ title: a.c.name, message: 'Anniversary ' + longDay(a.day), buttons: [canPrice() && { label: 'Change pricing…', value: 'price' }, { label: 'Open customer', value: 'open' }, { label: 'Reviewed — no change', value: 'ok' }].filter(Boolean) });
            if (v === 'price') X.changeService(a.c, { effective: firstVisitFrom(a.c, a.day), reason: a.years + '-year anniversary on ' + longDay(a.day) + '. The change starts with the first visit on or after it.' });
            else if (v === 'open') WD.screens.customers.openDetail(a.c.id); else if (v === 'ok') { a.c.annivReviewed = a.day; page.refresh(); } } }); }),
      !list.length && ui.row({ title: 'No anniversaries in ' + month })));
} });
/** Rows shown above the customer list: suggested price changes and agreements waiting for a signature. */
X.customerNotices = () => {
  const an = canSeePricing() ? X.anniversaries() : [], todo = an.filter(a => a.c.annivReviewed !== a.day && !(a.c.upcoming && a.c.upcoming.effective >= a.day)).length, open = canManageAg() ? data.agreements.filter(a => a.status === 'sent' || a.status === 'viewed') : [];
  return ui.section(null,
    WD.money && WD.money.priceDue ? canSeePricing() && (n => ui.row({ icon: 'dollarsign.circle', iconColor: 'var(--orange)', title: 'Suggested price changes', subtitle: n ? n + (n === 1 ? ' customer' : ' customers') + ' with no change in over 11 months' : 'Nobody is due · raise anyone’s pricing', chevron: true, onTap: () => WD.nav.push(X.anniversarySpec()) }))(WD.money.priceDue().length)
      : an.length > 0 && ui.row({ icon: 'calendar', iconColor: 'var(--orange)', title: 'Suggested price changes', subtitle: todo ? todo + ' to review for a price change' : 'All reviewed', chevron: true, onTap: () => WD.nav.push(X.anniversarySpec()) }),
    canManageAg() && ui.row({ icon: 'signature', iconColor: 'var(--indigo)', title: 'Service agreements', subtitle: open.length ? open.length + ' waiting for a signature' : 'Create, send and track', chevron: true, onTap: () => WD.nav.push(X.agreementsSpec()) }),
    WD.co && ui.row({ icon: 'star', iconColor: 'var(--orange)', title: 'Customer feedback', subtitle: (n => n ? n + ' to follow up' : data.feedback.length + ' replies to the follow-up text')(WD.co.feedbackOpen()), chevron: true, onTap: () => WD.nav.push(WD.co.feedbackSpec()) }));
};

/* ================= Service agreements ================= */
const canManageAg = () => WD.can('contracts.manage');
const AG = { draft: ['Draft', 'var(--gray)'], sent: ['Sent · not signed', 'var(--blue)'], viewed: ['Viewed · not signed', 'var(--orange)'], signed: ['Signed', 'var(--green)'] };
const agBadge = a => ui.badge(AG[a.status][0], AG[a.status][1]);
X.agreementsFor = cid => (data.agreements || []).filter(a => a.customerId === cid).sort((a, b) => b.createdAt - a.createdAt);
/** The agreement a driver can still get signed in person: sent to the customer but not signed yet. */
X.unsignedFor = cid => X.agreementsFor(cid).find(a => a.status === 'sent' || a.status === 'viewed') || null;
X.createAgreement = c => {
  const a = { id: 'ag' + Date.now().toString(36), number: 'SA-' + (1041 + data.agreements.length), customerId: c.id, status: 'draft', term: WD.r11 ? WD.r11.cfg.contract.term : 12, start: firstVisitFrom(c, today()), createdBy: me(), createdAt: +WD.now(), sentVia: null, sentAt: null, viewedAt: null, signedAt: null, signer: '', sig: null, method: null, to: (c.contacts[0] || {}).email || '' };
  data.agreements.push(a); WD.changed(); return a;
};
async function sendAgreement(a, via) {
  const c = q.customer(a.customerId), p = c.contacts[0] || {}, to = via === 'Email' ? (c.billingEmail || p.email) : p.phone && fmt.phone(p.phone);
  if (!to) return ui.alert({ title: via === 'Email' ? 'No email on file' : 'No phone on file', message: 'Add one to the customer’s contact, or collect the signature in person.' });
  if (await ui.run('Sending signing link…', () => { if (a.status === 'draft') a.status = 'sent'; a.sentVia = via; a.sentAt = +WD.now(); a.to = to; a.revised = false; }, { done: 'Link sent' })) ui.toast('Signing link sent to ' + to, via === 'Email' ? 'envelope' : 'message', 2600);
}
/** Collect the customer's signature on the phone. Anyone can do this for an agreement that has been sent; job (optional) gets a history line. */
X.signAgreement = async (a, job) => {
  const c = q.customer(a.customerId), sp = WD.screens.billing && WD.screens.billing.signaturePad; if (!sp || a.status === 'signed') return false;
  const r = await sp({ title: 'Service agreement', subtitle: c.name + ' · ' + a.number + ' · hand the iPhone to the customer to sign.', askName: true, name: (c.contacts[0] || {}).name || '' });
  if (!r) return false;
  Object.assign(a, { status: 'signed', method: 'inperson', sig: r.image, signer: r.name || (c.contacts[0] || {}).name || 'Customer', signedAt: +WD.now(), collectedBy: me() });
  if (job) job.events.push({ at: +WD.now(), actor: me(), text: 'Service agreement ' + a.number + ' signed in person by ' + a.signer });
  WD.changed(); ui.toast('Agreement signed · copy emailed to the customer', 'checkmark', 2600); return true;
};
function agreementDoc(a) {
  if (WD.co) return WD.co.agreementDoc(a);   // each agreement carries its own editable wording, items and rates
  const c = q.customer(a.customerId), org = S.org || data.orgs[0], items = (loc(c).items || []).filter(i => i.qty > 0), end = D.add(a.start, Math.round(a.term * 30.44) - 1), sv = WD.screens.billing && WD.screens.billing.sigView;
  return h('div.x-doc', h('h4', 'Service Agreement ' + a.number), h('small', org.name + ' · ' + (org.remit || []).slice(1).join(', ')),
    h('p', 'Between ', h('b', org.name), ' and ', h('b', c.name), ', ' + (loc(c).address || 'address to be confirmed') + '.'),
    h('table', items.map(i => h('tr', h('td', i.qty + ' × ' + pb(i.id).name), h('td', money(i.rate) + ' each'))), h('tr', h('td', 'Service interval'), h('td', c.freq)), h('tr', h('td', 'Per visit'), h('td', h('b', money(perVisit(items))))),
      h('tr', h('td', 'Term'), h('td', a.term + ' months')), h('tr', h('td', 'Starts'), h('td', mdy(a.start))), h('tr', h('td', 'Through'), h('td', mdy(end)))),
    h('p', 'All material is shredded on site and recycled. A certificate of destruction is issued with every invoice. Rates may be adjusted once a year on the anniversary with 30 days’ written notice. The agreement renews for the same term unless either party gives 30 days’ notice.'),
    h('div.sig', a.sig && sv ? sv(a.sig) : null), h('small', a.status === 'signed' ? 'Signed by ' + a.signer + ' on ' + when(a.signedAt) + (a.method === 'inperson' ? ' · in person' + (a.collectedBy ? ', collected by ' + a.collectedBy : '') : ' · from the emailed link') : 'Customer signature'));
}
X.agreementSpec = (a, job) => ({ title: () => a.number, render: page => {
  const c = q.customer(a.customerId), manage = canManageAg(), signed = a.status === 'signed', rank = ['draft', 'sent', 'viewed', 'signed'].indexOf(a.status);
  const step = (on, title, sub) => h('div.x-step' + (on ? '' : '.wait'), icon(on ? 'checkmark.circle.fill' : 'circle', 20, on ? 'var(--green)' : 'var(--label3)'), h('div', title, sub && h('small', sub)));
  return [h('div', { style: 'padding:12px 16px 0;display:flex;align-items:center;gap:8px' }, h('span.headline', c.name), h('span.spacer'), agBadge(a)), agreementDoc(a),
    ui.list(ui.section('Progress', h('div.x-steps',
        step(true, 'Created', a.createdBy + ' · ' + when(a.createdAt)), step(rank >= 1, a.sentAt ? 'Sent by ' + a.sentVia.toLowerCase() : 'Send for signature', a.sentAt ? a.to + ' · ' + when(a.sentAt) : 'A link lets the customer read and sign on their phone or computer'),
        step(rank >= 2 || !!a.viewedAt, 'Opened by the customer', a.viewedAt ? when(a.viewedAt) : null), step(signed, 'Signed', signed ? a.signer + ' · ' + when(a.signedAt) + (a.method === 'inperson' ? ' · in person' : ' · from the link') : null))),
      !signed && ui.section({ header: 'Get it signed', footer: manage ? 'Any driver can also collect the signature in person from the job once the agreement has been sent.' : 'The customer can sign here on your iPhone.' },
        manage && WD.co && ui.row({ icon: 'pencil', iconPlain: true, title: 'Edit this agreement', subtitle: a.revised ? 'Changed after it was sent — send the link again' : 'Wording, containers, rates, schedule and every section', tint: true, chevron: true, onTap: () => WD.co.editAgreementDoc(a, { onSave: () => page.refresh() }) }),
        manage && a.status === 'draft' && ui.pickerRow({ title: 'Term', value: a.term, options: [{ value: 0, label: 'Month to month' }].concat([12, 24, 36, 48, 60].filter(n => n <= (WD.r11 ? WD.r11.cfg.contract.max : 60)).map(n => ({ value: n, label: n / 12 + (n === 12 ? ' year' : ' years') }))), onChange: v => { a.term = v; page.refresh(); } }),
        manage && ui.row({ title: 'After the term', subtitle: 'It can be canceled with ' + (WD.r11 ? WD.r11.cfg.contract.notice : 60) + ' days’ notice. Only your staff can set the term; the customer sees it on the signing page but cannot change it.' }),
        manage && a.status === 'draft' && ui.dateRow({ title: 'Starts', value: a.start, onChange: v => { a.start = v; page.refresh(); } }),
        manage && ui.row({ icon: 'envelope', iconPlain: true, title: a.sentAt ? 'Send the link again by email' : 'Email a signing link', tint: true, onTap: () => sendAgreement(a, 'Email') }),
        manage && ui.row({ icon: 'message', iconPlain: true, title: a.sentAt ? 'Send the link again by text' : 'Text a signing link', tint: true, onTap: () => sendAgreement(a, 'Text') }),
        (manage || a.status !== 'draft') && ui.row({ icon: 'signature', iconPlain: true, title: 'Sign in person now', subtitle: 'Hand the iPhone to the customer', tint: true, onTap: () => X.signAgreement(a, job) }),
        manage && a.status === 'draft' && ui.row({ title: 'Delete draft', destructive: true, onTap: async () => { if (await ui.actionSheet({ title: 'Delete this draft agreement?', buttons: [{ label: 'Delete draft', role: 'destructive', value: true }] })) { data.agreements = data.agreements.filter(x => x !== a); WD.changed(); page.pop(); } } })),
      signed && ui.section(null, ui.row({ icon: 'doc.text', iconPlain: true, title: 'Share signed copy', tint: true, onTap: () => ui.toast('Share sheet: signed PDF', 'share') })))];
} });
X.agreementsSpec = () => ({ title: 'Service agreements', render: page => {
  if (!canManageAg()) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Tracking service agreements needs the Service agreements permission.' });
  const row = a => { const c = q.customer(a.customerId); return ui.row({ leading: ui.avatar(c ? c.name : '?', { size: 34 }), title: c ? c.name : 'Customer removed', subtitle: a.number + ' · ' + (a.term ? a.term + ' months' : 'month to month') + ' · ' + (a.status === 'signed' ? 'signed ' + when(a.signedAt) : a.sentAt ? 'sent ' + fmt.rel(a.sentAt).toLowerCase() + ' by ' + a.sentVia.toLowerCase() : 'not sent yet'), badge: agBadge(a), chevron: true, onTap: () => page.push(X.agreementSpec(a)) }); };
  const by = (...st) => data.agreements.filter(a => st.includes(a.status)).sort((a, b) => (b.sentAt || b.createdAt) - (a.sentAt || a.createdAt));
  return ui.list(ui.section({ header: 'Waiting for a signature', footer: 'Drivers see these on the customer’s next job and can collect the signature in person.' }, by('sent', 'viewed').map(row), !by('sent', 'viewed').length && ui.row({ title: 'Nothing waiting' })),
    ui.section('Drafts', by('draft').map(row)), ui.section('Signed', by('signed').map(row)),
    h('div', { style: 'margin-top:10px' }, ui.note('Start an agreement from a customer’s record, or switch on “Create a service agreement” when adding a new customer.')));
} });
/** Customer record: the customer's agreements, and a way to start one. */
X.agreementSection = c => {
  const list = X.agreementsFor(c.id), manage = canManageAg(); if (!list.length && !manage) return null;
  return ui.section({ header: 'Service agreement', footer: list.length ? null : 'Create an agreement from this customer’s pricing, then send a link to sign or collect the signature in person.' },
    list.map(a => ui.row({ icon: 'signature', iconColor: AG[a.status][1], title: a.number + ' · ' + (a.term ? a.term + ' months' : 'month to month'), subtitle: a.status === 'signed' ? 'Signed by ' + a.signer + ' · ' + when(a.signedAt) : a.sentAt ? 'Sent ' + fmt.rel(a.sentAt).toLowerCase() + ' by ' + a.sentVia.toLowerCase() : 'Not sent yet', badge: agBadge(a), chevron: true, onTap: () => WD.nav.push(X.agreementSpec(a)) })),
    manage && !list.some(a => a.status !== 'signed') && ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: list.length ? 'New agreement' : 'Create service agreement', tint: true, onTap: () => WD.nav.push(X.agreementSpec(X.createAgreement(c))) }));
};
/** Job details: an agreement that was sent but isn't signed yet — every driver can collect the signature in person. */
X.jobAgreementSection = (job, pushSpec) => {
  const a = job.customerId && X.unsignedFor(job.customerId); if (!a) return null;
  return ui.section({ header: 'Service agreement', footer: 'Sent ' + fmt.rel(a.sentAt).toLowerCase() + ' and not signed yet. If the customer would rather sign in person, collect it here.' },
    ui.row({ icon: 'signature', iconColor: 'var(--orange)', title: a.number + ' · not signed', subtitle: 'Review the agreement', chevron: true, onTap: () => pushSpec(X.agreementSpec(a, job)) }),
    ui.row({ icon: 'signature', iconPlain: true, title: 'Collect signature in person', tint: true, onTap: () => X.signAgreement(a, job) }));
};

/* ================= Time off ================= */
/* Approving time off needs HR authority (owner and admins by default; it can be granted to anyone). */
const canApprove = () => WD.can('hr.manage');
const TO = { pending: ['Waiting for approval', 'var(--orange)'], approved: ['Approved', 'var(--green)'], denied: ['Not approved', 'var(--red)'] };
function requestTimeOff() {
  let from = D.add(today(), 7), to = from, allDay = true, fromTime = '13:00', untilTime = '17:00', reason = '';
  ui.sheet({ title: 'Request time off', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Send', bold: true, disabled: to < from, onTap: async p => { if (to < from) return;
      let auto = false;
      if (!await ui.run('Sending request…', () => { const t = { id: 'to' + Date.now().toString(36), userId: S.me.id, from, to, fromTime: allDay || from !== to ? '' : fromTime, untilTime: allDay || from !== to ? '' : untilTime, reason: reason.trim(), status: 'pending', decidedBy: null, at: +WD.now() };
        auto = !!(WD.co && WD.co.autoApprove(t)); data.timeOff.push(t); }, { done: auto ? 'Approved' : 'Request sent' })) return;
      p.dismiss(); if (auto) { const t = data.timeOff[data.timeOff.length - 1]; ui.alert({ title: 'Time off approved', message: WD.timeOffLabel(t) + '\n\n' + t.note }); } } }],
    render: p => ui.list(ui.section({ footer: to < from ? 'The last day is before the first day.' : 'The office gets your request. Once it’s approved, the dispatch board shows you as off so nobody plans your route around you.' },
        ui.dateRow({ title: 'First day off', value: from, onChange: v => { from = v; if (to < from) to = from; p.refresh(); } }), ui.dateRow({ title: 'Last day off', value: to, onChange: v => { to = v; p.refresh(); } }),
        from === to && ui.toggleRow({ title: 'All day', value: allDay, onChange: v => { allDay = v; p.refresh(); } }),
        from === to && !allDay && [ui.quarterRow({ title: 'From', value: fromTime, optional: false, onChange: v => { fromTime = v; } }), ui.quarterRow({ title: 'Until', value: untilTime, optional: false, onChange: v => { untilTime = v; } })]),
      ui.section('Reason (optional)', ui.inputRow({ placeholder: 'Appointment, vacation…', value: reason, onInput: v => { reason = v; } }))) }, { detent: 'large' });
}
/** Shift tab: my time-off requests, a way to ask for more, and (for whoever approves) the team's requests. */
X.timeOffSection = () => {
  if (!S.me) return null; const mine = data.timeOff.filter(t => t.userId === S.me.id && t.to >= today()).sort((a, b) => a.from.localeCompare(b.from)), waiting = data.timeOff.filter(t => t.status === 'pending' && t.userId !== S.me.id).length;
  return ui.section({ header: 'Time off', footer: 'Approved time off shows on the dispatch board for those days.' },
    mine.map(t => ui.row({ icon: 'calendar', iconColor: TO[t.status][1], title: WD.timeOffLabel(t), subtitle: [t.reason, t.note].filter(Boolean).map(x => h('div', x)), badge: ui.badge(t.auto ? 'Auto-approved' : TO[t.status][0], TO[t.status][1]), onTap: async () => {
      if (await ui.actionSheet({ title: WD.timeOffLabel(t), message: t.status === 'pending' ? 'Withdraw this request?' : 'Cancel this time off? The office is told.', buttons: [{ label: t.status === 'pending' ? 'Withdraw request' : 'Cancel time off', role: 'destructive', value: true }], cancel: 'Keep' })) { data.timeOff = data.timeOff.filter(x => x !== t); WD.changed(); } } })),
    ui.row({ icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', title: 'Request time off', tint: true, onTap: requestTimeOff }),
    canApprove() && ui.row({ icon: 'person.2', iconColor: 'var(--indigo)', title: 'Team time-off requests', badge: waiting ? ui.badge(waiting + ' to approve', 'var(--orange)') : null, chevron: true, onTap: () => WD.nav.push(X.timeOffSpec()) }));
};
X.timeOffSpec = () => ({ title: 'Time off', render: page => {
  if (!canApprove()) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Approving time off needs HR authority. An owner or admin can grant it in Team and roles.' });
  const decide = (t, status) => ui.run(status === 'approved' ? 'Approving…' : 'Saving…', () => { t.status = status; t.decidedBy = me(); }, { done: status === 'approved' ? 'Approved' : 'Not approved' });
  const impact = t => { const r = data.routes.find(x => x.driverId === t.userId); if (!r) return null; let n = 0; for (let d = t.from; d <= t.to; d = D.add(d, 1)) n += q.stopList(r.id, d).filter(j => !WD.calledOff(j)).length; return 'Drives ' + q.routeName(r) + ' · ' + n + (n === 1 ? ' stop' : ' stops') + ' on those days'; };
  const row = (t, acts) => { const u = q.user(t.userId) || { name: 'Former employee' };
    return h('div.row', { style: 'flex-wrap:wrap;gap:8px' }, ui.avatar(u.name, { size: 34 }), h('div.row-main', h('div.row-title', u.name), h('div.row-sub', WD.timeOffLabel(t) + (t.reason ? ' · ' + t.reason : '')), impact(t) && h('div.row-sub', impact(t)), !acts && t.decidedBy && h('div.row-sub', t.auto ? 'Auto-approved · “' + t.note + '”' : TO[t.status][0] + ' by ' + t.decidedBy)),
      acts ? h('div.x-two', ui.button('Deny', { kind: 'gray', small: true, block: false, onTap: () => decide(t, 'denied') }), ui.button('Approve', { kind: 'filled', small: true, block: false, onTap: () => decide(t, 'approved') })) : ui.badge(TO[t.status][0], TO[t.status][1])); };
  const list = st => data.timeOff.filter(t => t.status === st).sort((a, b) => a.from.localeCompare(b.from)), pending = list('pending'), ok = list('approved').filter(t => t.to >= today()), no = list('denied');
  return ui.list(ui.section({ header: 'To approve', footer: 'Approving shows the person as off on the dispatch board for those days.' }, pending.map(t => row(t, true)), !pending.length && ui.row({ title: 'No requests waiting' })),
    ui.section('Upcoming time off', ok.map(t => row(t))), ui.section('Not approved', no.map(t => row(t))),
    WD.co && WD.can('settings.manage') && ui.section({ footer: 'Requests can be approved automatically, with a message you write.' }, ui.row({ icon: 'gearshape', iconColor: 'var(--gray)', title: 'Auto-approval', detail: data.settings.timeOff.auto ? 'On' : 'Off', chevron: true, onTap: () => page.push(WD.co.timeOffSpec()) })));
} });

/* ================= Conflict review: the two versions side by side ================= */
const CMP = [['Route', j => q.routeName(j.routeId)], ['Date', j => fmt.day(j.day)], ['Stop', j => j.allDay ? 'Day note' : 'Stop ' + j.seq], ['Title', j => j.title], ['Address', j => j.address || 'None'],
  ['Containers', j => WD.itemsLabel(j.items, j.type === 'purge') || j.containers || 'None'], ['Window', j => j.custFrom || j.custUntil ? (j.custFrom || 'any') + ' – ' + (j.custUntil || 'any') : j.needsWindow ? 'Needs a window' : 'None'],
  ['Status', j => (WD.jobStatuses[j.status] || {}).title || j.status], ['PO', j => j.po || 'None'], ['Notes', j => j.notes || 'None']];
X.compareOp = op => {
  const sv = op.server || { by: 'Someone else', at: op.at, jobs: [] }, ids = op.jobIds, sJob = id => sv.jobs.find(j => j.id === id), mJob = id => q.job(id);
  const cell = (cls, ...kids) => h('div' + cls, kids), diffs = new Set();
  const table = id => { const s = sJob(id), m = mJob(id);
    return h('div.x-cmp', cell('.hd', ''), cell('.hd', 'On the server', h('small', sv.by + ' · ' + fmt.rel(sv.at).toLowerCase())), cell('.hd', 'Your change', h('small', me() + ' · ' + fmt.rel(op.at).toLowerCase())),
      !s || !m ? [cell('.lab.dif', 'Job'), cell(s ? '' : '.dif', s ? 'Still on the board' : 'Not on the server'), cell(m ? '' : '.dif', m ? 'New job' : 'Deleted by you')] : null,
      CMP.map(([label, get]) => { const a = s ? get(s) : '—', b = m ? get(m) : '—', dif = a !== b && s && m; if (dif) diffs.add(label);
        return [cell('.lab' + (dif ? '.dif' : ''), label), cell(dif ? '.dif' : '.same', a), cell(dif ? '.dif' : '.same', b)]; })); };
  const order = () => { const s = sv.jobs.filter(j => !j.allDay).sort((a, b) => a.seq - b.seq), m = ids.map(mJob).filter(j => j && !j.allDay).sort((a, b) => a.seq - b.seq), n = Math.max(s.length, m.length);
    return h('div.x-cmp', cell('.hd', 'Order'), cell('.hd', 'On the server', h('small', sv.by)), cell('.hd', 'Your change', h('small', me())),
      Array.from({ length: n }, (_, i) => { const a = s[i], b = m[i], dif = !a || !b || a.id !== b.id; if (dif) diffs.add('Stop order'); return [cell('.lab' + (dif ? '.dif' : ''), String(i + 1)), cell(dif ? '.dif' : '.same', a ? a.title : '—'), cell(dif ? '.dif' : '.same', b ? b.title : '—')]; })); };
  const many = ids.length > 1, shown = many ? ids.filter(id => { const s = sJob(id), m = mJob(id); return s && m && CMP.some(([l, get]) => l !== 'Stop' && get(s) !== get(m)); }).slice(0, 3) : ids;
  const body = [many && h('div.x-cmphead', 'Stop order · ' + ids.length + ' jobs'), many && h('div.cells', { style: 'margin:0 16px;border-radius:10px;overflow:hidden' }, order()),
    shown.map(id => [h('div.x-cmphead', (mJob(id) || sJob(id) || {}).title || 'Job'), h('div.cells', { style: 'margin:0 16px;border-radius:10px;overflow:hidden' }, table(id))])];
  const pick = (p, keep) => { p.dismiss(); WD.api.resolve(op.id, keep); ui.toast(keep === 'server' ? 'Keeping the server version' : 'Keeping your version', 'checkmark'); };
  ui.sheet({ title: 'Compare versions', leading: [{ label: 'Close', onTap: p => p.dismiss() }],
    toolbar: p => h('div.x-pick', ui.button('Keep server version', { kind: 'gray', block: false, onTap: () => pick(p, 'server') }), ui.button('Keep my version', { kind: 'filled', block: false, onTap: () => pick(p, 'mine') })),
    render: () => [h('div', { style: 'padding:10px 4px 0' }, ui.note((diffs.size ? diffs.size + (diffs.size === 1 ? ' difference: ' : ' differences: ') + [...diffs].join(', ') + '. ' : 'No differences in the fields shown. ') + 'Highlighted rows differ. ' + sv.by + ' saved a change while yours was waiting to sync, so only one version can be kept.')), body, h('div', { style: 'height:14px' })] });
};

/* ================= Jobs missing an address ================= */
/** o: {inView(job), label} from the board: the jobs on the day (or days) showing are listed first, apart from the other upcoming days.
    Ignoring hides the board's line for now; an ignored job is back the next time the app is opened (WD.reopenApp) until it has an address. */
X.missingSheet = (o = {}) => {
  ui.sheet({ title: 'Missing addresses', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
    render: p => { const list = WD.missingAddresses(), ignored = data.jobs.filter(j => j.addrIgnored && j.day >= today() && !WD.closed[j.status] && WD.addressIssue(j));
      const here = o.inView ? list.filter(o.inView) : [], rest = list.filter(j => !here.includes(j)), re = () => { WD.changed(); p.refresh(); };
      const row = (j, ign) => h('div.row', { style: 'flex-wrap:wrap;gap:8px' }, h('div.row-main', h('div.row-title', j.title), h('div.row-sub', fmt.day(j.day, 'rel') + ' · ' + q.routeName(j.routeId) + ' · ' + q.jobType(j.type).title), h('div.row-sub', { style: 'color:var(--red);font-weight:600' }, WD.addressIssue(j))),
        h('div.x-two', ui.button(ign ? 'Stop ignoring' : 'Ignore', { kind: 'gray', small: true, block: false, onTap: () => { j.addrIgnored = !ign; re(); } }),
          !ign && WD.can('jobs.edit') && ui.button('Fix', { kind: 'filled', small: true, block: false, onTap: () => WD.screens.jobs.openEditor({ jobId: j.id }) })));
      const all = xs => xs.length > 1 && ui.row({ title: 'Ignore all ' + xs.length + ' for now', tint: true, center: true, onTap: () => { xs.forEach(j => { j.addrIgnored = true; }); re(); } });
      const none = title => ui.row({ icon: 'checkmark.circle.fill', iconPlain: true, iconColor: 'var(--green)', title });
      const foot = 'Jobs can be saved without an address when the customer will call back with it. Ignoring one only hides the line on the board: it comes back the next time the app is opened, until the address is added. Which job types need a street address, a city or ZIP, or nothing is set in Settings → Job types and fields.';
      return ui.list(
        o.inView && ui.section({ header: (o.label || 'Showing now') + ' · ' + here.length, fold: false }, here.map(j => row(j)), all(here), !here.length && none('Nothing left to review here')),
        (rest.length > 0 || !o.inView) && ui.section({ header: o.inView ? 'Other upcoming days · ' + rest.length : 'Upcoming jobs', fold: false, footer: foot }, rest.map(j => row(j)), !o.inView && all(rest), !rest.length && none('Every upcoming job has what it needs')),
        ui.section({ header: 'Ignored for now', fold: false }, ignored.map(j => row(j, true)))); } });
};

/* ================= Older job history from the server ================= */
let histSeq = 0;
/** Jobs kept on the phone cover the last 10 days and everything upcoming. This asks the server for older visits matching the search
    (mock: builds them from each matching customer's service interval) and adds them to the loaded jobs. Returns how many were added. */
X.fetchHistory = text => {
  const s = String(text || '').trim().toLowerCase(); if (s.length < 2) return 0; let added = 0;
  const step = c => ({ Weekly: 7, 'Every 2 weeks': 14, 'Every 4 weeks': 28, Monthly: 28, Quarterly: 91 })[c.freq] || 0;
  const hits = data.customers.filter(c => !c.historyLoaded && c.stats && c.stats.firstInvoice && (q.searchCustomers(text, 30).some(m => m.customer === c) || data.jobs.some(j => j.customerId === c.id && [j.title, j.address, j.notes].some(v => String(v || '').toLowerCase().includes(s)))));
  hits.forEach(c => { c.historyLoaded = true; const every = step(c), route = q.route(c.route), drv = route && q.user(route.driverId); if (!route) return;
    const oldest = q.jobsForCustomer(c.id)[0], from = oldest ? oldest.day : today();
    const dates = every ? Array.from({ length: 26 }, (_, i) => D.add(from, -(i + 1) * every)) : [c.stats.firstInvoice];
    dates.filter(day => day >= c.stats.firstInvoice && day < from).forEach((day, i) => { const amt = perVisit(loc(c).items) || c.stats.rate, at = +D.parse(day);
      WD.makeJob({ routeId: route.id, day, customerId: c.id, status: (i + c.name.length) % 11 === 5 ? 'skipped' : 'completed', arrivedAt: 9 * 60 + (i % 5) * 37, departedAt: 9 * 60 + (i % 5) * 37 + 25, fromServer: true, version: 3,
        invoice: { number: 'INV-' + (1900 - (++histSeq)), status: 'Paid', amount: amt }, events: [{ at: at - 6 * 864e5, actor: 'Priya Raman', text: 'Scheduled' }, { at, actor: drv ? drv.name : 'Driver', text: 'Completed' }] }); added++; }); });
  if (added) WD.changed(); return added;
};

/* ================= Job edit history: what changed ================= */
const FIELD_LABELS = [['title', 'Title'], ['type', 'Job type', v => q.jobType(v).title], ['custType', 'Customer type', v => WD.custType(v).title], ['routeId', 'Route', v => q.routeName(v)], ['day', 'Date', v => fmt.day(v)], ['address', 'Address'], ['cityZip', 'City or ZIP'],
  ['bizOpen', 'Opens', v => v && fmt.time(fmt.fromHHMM(v))], ['bizClose', 'Closes', v => v && fmt.time(fmt.fromHHMM(v))], ['custFrom', 'Window from', v => v && fmt.time(fmt.fromHHMM(v))], ['custUntil', 'Window until', v => v && fmt.time(fmt.fromHHMM(v))],
  ['custStrict', 'Window is', v => v ? 'Required' : 'Preferred'], ['needsWindow', 'Needs a window', v => v ? 'Yes' : 'No'], ['po', 'PO number'], ['contract', 'Contract'], ['callAhead', 'Call ahead', v => v ? v + ' min' : 'No'],
  ['lunchFrom', 'Lunch from', v => v && fmt.time(fmt.fromHHMM(v))], ['lunchUntil', 'Lunch until', v => v && fmt.time(fmt.fromHHMM(v))], ['notes', 'Notes'], ['allDay', 'Note only', v => v ? 'Yes' : 'No']];
/** [{label, from, to}] for every field that differs between a job as it was and the fields about to be saved (prices, flags and closed days included). */
X.diffJob = (before, after) => {
  const out = [], show = (fn, v) => { const t = fn ? fn(v) : v; return t == null || t === '' ? 'None' : String(t); };
  FIELD_LABELS.forEach(([k, label, fn]) => { const a = show(fn, before[k]), b = show(fn, after[k]); if (a !== b) out.push({ label, from: a, to: b }); });
  const cont = j => WD.itemsLabel(j.items, j.type === 'purge') || j.containers || 'None'; if (cont(before) !== cont(after)) out.push({ label: 'Containers', from: cont(before), to: cont(after) });
  const rates = items => (items || []).filter(i => i.qty > 0).map(i => pb(i.id).name + ' ' + money(i.rate)).join(', ') || 'None'; if (rates(before.items) !== rates(after.items)) out.push({ label: 'Rates', from: rates(before.items), to: rates(after.items) });
  const FL = { setup: 'New setup', extraBin: 'Bring an extra container', extraShred: 'Has extra to shred', early: 'Called in for early service' }, flags = f => Object.keys(FL).filter(k => f && f[k]).map(k => FL[k]).join(', ') || 'None';
  if (flags(before.flags) !== flags(after.flags)) out.push({ label: 'Heads-up', from: flags(before.flags), to: flags(after.flags) });
  const cd = d => (d || []).join(', ') || 'None'; if (cd(before.closedDays) !== cd(after.closedDays)) out.push({ label: 'Closed on', from: cd(before.closedDays), to: cd(after.closedDays) });
  return out;
};
X.showChanges = e => ui.sheet({ title: 'What changed', trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }],
  render: () => ui.list(ui.section({ header: e.actor + ' · ' + fmt.rel(e.at), footer: e.text + '.' }, e.changes.map(ch => ui.row({ title: ch.label, subtitle: h('span.x-chg', h('s', ch.from), ' → ', h('b', ch.to)) })))) }, { detent: 'medium' });

/* ================= Offline data ================= */
const offline = { map: true, updated: Date.now() - 3 * 3600e3 };
/* How many months of jobs each way are kept on the phone (the owner's preference: the last 12 and the next 12). */
const range = () => (data.settings.offlineRange = data.settings.offlineRange || { back: 12, ahead: 12 }), months = n => n + (n === 1 ? ' month' : ' months');
X.offlineSpec = () => ({ title: 'Offline data', render: page => {
  const R = range(), local = data.jobs.filter(j => !j.fromServer), perMonth = local.length / 25 * 26, est = Math.round(perMonth * (R.back + R.ahead) / 100) * 100, mb = Math.max(1, Math.round(est * 0.0021 * 10) / 10), heavy = R.back + R.ahead > 30;
  const step = (k, title, sub) => ui.row({ title, subtitle: sub, detail: months(R[k]), trailing: ui.stepper(R[k], 1, 36, v => { R[k] = v; WD.changed(); page.refresh(); }) });
  const locs = data.customers.flatMap(c => c.locations), got = locs.filter(l => l.located !== false && l.x != null).length, days = data.jobs.reduce((a, j) => j.fromServer ? a : [j.day < a[0] ? j.day : a[0], j.day > a[1] ? j.day : a[1]], [today(), today()]);
  return ui.list(h('div', { style: 'padding:4px 4px 0' }, ui.note('RouteClerk opens from what is saved on this iPhone first, then checks the server in the background. That keeps it fast and lets it work with no signal.')),
    ui.section({ header: 'Saved on this iPhone', footer: 'Changes made offline wait under Pending changes and sync when the connection returns.' },
      ui.row({ icon: 'calendar', iconColor: 'var(--blue)', title: 'Jobs', subtitle: 'The last ' + months(R.back) + ' and the next ' + months(R.ahead) + ' · anything outside that is fetched from the server when you search', detail: '≈ ' + est.toLocaleString() }),
      ui.row({ icon: 'person.2', iconColor: 'var(--green)', title: 'Customers and contacts', detail: String(data.customers.length) }),
      ui.row({ icon: 'mappin', iconColor: 'var(--red)', title: 'GPS coordinates for addresses', subtitle: 'Looked up once and kept, so pins and AutoRoute don’t wait on Apple Maps', detail: got + ' of ' + locs.length })),
    ui.section({ header: 'How much is kept', footer: 'About ' + est.toLocaleString() + ' jobs, ' + mb + ' MB on this iPhone. ' + (heavy ? 'That is a lot for an older iPhone. If the board or search feels slow, shorten the range; nothing is lost, older and later jobs stay on the server.' : 'This is quick on any recent iPhone. If the app ever feels slow, shorten the range; nothing is lost, older and later jobs stay on the server.') + ' The range rolls forward every day and applies to this iPhone only.' },
      step('back', 'Past jobs', 'How far back the board and search work with no signal'), step('ahead', 'Upcoming jobs', 'How far ahead'),
      (R.back !== 12 || R.ahead !== 12) && ui.row({ title: 'Back to 12 months each way', tint: true, onTap: () => { R.back = R.ahead = 12; WD.changed(); page.refresh(); } })),
    ui.section({ header: 'Map', footer: offline.map ? 'The service area map is saved for offline use. Updated ' + fmt.rel(offline.updated).toLowerCase() + '.' : 'The map needs a connection to load.' },
      ui.toggleRow({ icon: 'map', iconColor: 'var(--teal)', title: 'Keep the map for offline', subtitle: 'Lakemont service area · 48 MB', value: offline.map, onChange: v => { offline.map = v; page.refresh(); } }),
      ui.row({ title: 'Update saved data now', tint: true, onTap: async () => { if (await ui.run('Updating saved data…', () => { offline.updated = Date.now(); }, { done: 'Up to date', min: 1200, max: 2000 })) page.refresh(); } })));
} });

/* ================= Call context: summary of earlier contact ================= */
/** A short summary of the customer's recent calls, texts and emails for whoever answers the phone (comms.view). */
X.contactSummary = (c, items, describe) => {
  if (!WD.can('comms.view')) return null; const recent = items.filter(i => ['call', 'voicemail', 'text', 'email'].includes(i.type)).slice(0, 4); if (!recent.length) return null;
  const n = t => recent.filter(i => i.type === t).length, parts = [n('call') && n('call') + (n('call') === 1 ? ' call' : ' calls'), n('text') && n('text') + (n('text') === 1 ? ' text thread' : ' text threads'), n('email') && n('email') + (n('email') === 1 ? ' email' : ' emails'), n('voicemail') && n('voicemail') + ' voicemail'].filter(Boolean);
  const up = q.jobsForCustomer(c.id).find(j => j.day >= today() && j.status === 'scheduled'), kind = { call: 'Call', voicemail: 'Voicemail', text: 'Text', email: 'Email' };
  const line = i => { const d = describe(i); return h('div', { style: 'margin-top:3px' }, h('b', kind[i.type] + ', ' + fmt.rel(i.at).toLowerCase() + ': '), (i.type === 'email' ? d.title + '. ' : '') + (d.snippet || d.title)); };
  return h('div.x-ai', h('b.t', icon('sparkles', 13), 'Summary of recent contact'), h('div', 'Last ' + parts.join(', ') + '.' + (c.stats.balance > 0 && WD.can('billing.view') ? ' Balance due ' + fmt.money(c.stats.balance) + '.' : '') + (up ? ' Next visit ' + fmt.day(up.day, 'rel').replace(/^T/, 't') + '.' : ' Nothing scheduled.')),
    recent.slice(0, 3).map(line), h('div.footnote', { style: 'margin-top:5px' }, 'Written from Quo call transcripts, texts and Gmail. Open an entry below for the full transcript.'));
};

/* ================= What's new tutorial ================= */
const TOUR = [
  { icon: 'sparkles', title: 'New in ' + WD.version, text: 'Calls are handed to your phone service, the Inbox is one list, drivers are asked about review requests, and invoices can show a card price and a cash price. Run this tour again from Menu → Settings → About.' },
  { tab: 'Inbox', icon: 'phone', title: 'Inbox and calls', list: ['Inbox opens on All: calls and texts in one list. Claim one, assign it or mark it handled from the ⋯ on its row.', 'A call button opens Call with Quo: it shows the company number to call from, then opens the Quo app. On a computer it copies the number.', 'A customer who replies STOP can’t be texted again until they reply START.', 'A missed call from a customer makes a Call back task.', 'Settings → Integrations → Phone: the phone service, company numbers and their ad channels, who has a seat.'] },
  { tab: 'Dispatch', icon: 'calendar', title: 'Dispatch', list: ['Month lines use a narrower typeface, so more of each name shows.', 'Assigning a driver or truck: everyone can be chosen, and the ones not qualified for that day’s jobs are in red with the reason.', 'Changing how often a job repeats now rebuilds its later visits.'] },
  { tab: 'Shift', icon: 'star', title: 'Review requests', list: ['After a job is completed and billed, the app asks whether to send that customer a Google review request.', 'Settings → Client communications → Reviews and feedback sets how often a customer may be asked.'] },
  { tab: 'Menu', icon: 'creditcard', title: 'Card price and cash price', list: ['Settings → Company → Invoicing and payments → Card payments.', 'Built into prices: invoices show the card price and a lower price for cash, check or bank transfer.', 'Or a separate card fee line, only on invoices paid by credit card.'] },
];
X.tutorial = () => {
  const screen = document.getElementById('screen'), old = screen.querySelector('.x-tour'); if (old) old.remove();
  const target = st => { if (st.tab) return [...screen.querySelectorAll('.tabbar .tab')].find(b => b.textContent.trim().startsWith(st.tab)); if (st.find) return screen.querySelector('.navstack.active ' + st.find) || screen.querySelector(st.find); return null; };
  const steps = TOUR.filter(st => (!st.tab && !st.find) || target(st)), startTab = WD.nav.activeTab(); let i = 0;
  const hole = h('div.x-tour-hole.none'), card = h('div.x-tour-card'), el = h('div.x-tour', { onclick: e => e.stopPropagation() }, hole, card);
  const done = () => { store.set('wd.tour', WD.version); el.remove(); if (startTab && WD.nav.activeTab() !== startTab) WD.nav.switchTab(startTab); };
  function show() {
    const st = steps[i], t = target(st), last = i === steps.length - 1, sr = screen.getBoundingClientRect(), k = sr.width / screen.offsetWidth || 1 /* the tour sits outside the text-size zoom */, H = screen.offsetHeight;
    if (st.tab && t && !t.classList.contains('active') && WD.nav.activeTab()) t.click();
    let top = H * 0.3;
    if (t) { const r = t.getBoundingClientRect(), x = (r.left - sr.left) / k, y = (r.top - sr.top) / k, w = r.width / k, hh = r.height / k; hole.classList.remove('none'); Object.assign(hole.style, { left: x - 4 + 'px', top: y - 4 + 'px', width: w + 8 + 'px', height: hh + 8 + 'px' }); top = y > H / 2 ? H * 0.24 : y + hh + 22; }
    else { hole.classList.add('none'); Object.assign(hole.style, { left: '', top: '', width: '', height: '' }); }
    card.style.top = top + 'px';
    card.replaceChildren(...[h('div.x-tour-ic', icon(st.icon, 26)), h('h3', st.title), st.text && h('p', st.text), st.list && h('ul', st.list.map(x => h('li', x))),
      h('div.x-tour-foot', h('button', { onclick: done }, last ? '' : 'Skip'), h('span.spacer'), h('span.x-tour-dots', steps.map((_, n) => h('i' + (n === i ? '.on' : '')))), h('span.spacer'),
        i > 0 && h('button', { onclick: () => { i--; show(); } }, 'Back'), h('button.next', { onclick: () => { if (last) done(); else { i++; show(); } } }, last ? 'Done' : 'Next'))].filter(Boolean));
  }
  screen.appendChild(el); show();
};
/** Show the tutorial once per version, after the tabs appear (not during automated runs with ?notour). */
X.maybeTutorial = () => { if (/[?&]notour/.test(location.search) || store.get('wd.tour') === WD.version) return; setTimeout(() => { if (S.signedIn && WD.nav.activeTab()) X.tutorial(); }, 700); };
const baseSignIn = WD.app.signIn; WD.app.signIn = () => { baseSignIn(); X.maybeTutorial(); };

/* ================= Control panel ================= */
WD.panel.addAction('Monthly reminder: suggested price changes', () => { const n = WD.money && WD.money.priceDue ? WD.money.priceDue().length : X.anniversaries().length; ui.banner({ title: 'Suggested price changes', text: n + (n === 1 ? ' customer has' : ' customers have') + ' gone more than 11 months without a price change. Review pricing.', icon: 'dollarsign.circle', color: 'var(--orange)', duration: 7000, onTap: () => { WD.nav.switchTab('customers'); WD.nav.push(X.anniversarySpec()); } }); });
WD.panel.addAction('Customer signs agreement from the link', () => { const a = data.agreements.find(x => x.status === 'sent' || x.status === 'viewed'); if (!a) return ui.toast('No agreement is waiting', 'info.circle'); const c = q.customer(a.customerId);
  Object.assign(a, { status: 'signed', method: 'link', signer: (c.contacts[0] || {}).name || 'Customer', signedAt: +WD.now(), viewedAt: a.viewedAt || +WD.now() }); WD.changed();
  ui.banner({ title: 'Agreement signed', text: c.name + ' signed ' + a.number + ' from the link.', icon: 'signature', color: 'var(--green)', onTap: () => { WD.nav.switchTab('customers'); WD.nav.push(X.agreementSpec(a)); } }); });
WD.panel.addJump('Service agreements', () => { WD.nav.switchTab(WD.can('crm.view') ? 'customers' : 'settings'); WD.nav.push(X.agreementsSpec()); });
WD.panel.addJump('Suggested price changes', () => { WD.nav.switchTab(WD.can('crm.view') ? 'customers' : 'settings'); WD.nav.push(X.anniversarySpec()); });
WD.panel.addJump('Time off', () => { WD.nav.switchTab('shift'); WD.nav.push(X.timeOffSpec()); });
WD.panel.addJump('Tutorial', () => X.tutorial());
})();
