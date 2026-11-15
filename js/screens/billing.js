/* Field invoicing: the invoice editor (rates, quantities, add/delete lines, PO and contract numbers), signatures
   (representative signature on file, customer signature on request), paid-on-site (cash, check, card) and the invoice preview.
   Registers WD.screens.billing. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;

WD.addIcons({ 'arrow.uturn.left': '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', 'rotate.right': '<rect x="3" y="9" width="12" height="12" rx="2"/><path d="M10 3.5h3.5a6 6 0 0 1 6 6V12"/><path d="M17 9.5l2.5 2.5 2.5-2.5"/>', 'bi.minus': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12h9" stroke="#fff"/>' });
WD.css(`
.bi-line { padding: 9px 12px 10px 16px; position: relative; }
.bi-nums { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.bi-nums .q { width: 58px; flex: none; } .bi-nums .r { width: 76px; flex: none; }
.bi-line + .bi-line::before { content: ''; position: absolute; top: 0; left: 16px; right: 0; border-top: .5px solid var(--sep); }
.bi-line input { width: 100%; min-width: 0; border: 0; background: var(--fill3); border-radius: 7px; padding: 6px 7px; font-size: 15px; color: var(--label); outline: 0; font-family: inherit; }
.bi-line input.n { text-align: right; font-variant-numeric: tabular-nums; }
.bi-line .bi-name { display: flex; gap: 8px; align-items: center; }
.bi-line .bi-name input { background: none; padding: 2px 0; font-weight: 500; }
.bi-line .bi-tot { flex: 1; font-size: 15px; text-align: right; font-variant-numeric: tabular-nums; color: var(--label); font-weight: 500; }
.bi-line .bi-lab { font-size: 13px; color: var(--label2); letter-spacing: 0; }
.bi-del { border: 0; background: none; padding: 0; color: var(--red); cursor: pointer; line-height: 0; justify-self: end; }
.bi-total { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 17px; font-weight: 600; }
.bi-sig { padding: 10px 16px 12px; }
.bi-sig .bi-ink { height: 64px; display: flex; align-items: flex-end; border-bottom: 1px solid var(--label3); margin-bottom: 5px; color: var(--label); }
.bi-sig .bi-ink img, .bi-sig .bi-ink svg { max-height: 62px; max-width: 220px; }
.bi-sig .bi-cap { font-size: 12px; color: var(--label2); letter-spacing: 0; }
.bi-sig .bi-empty { color: var(--label3); font-size: 14px; padding-bottom: 6px; }
.bi-pad { background: #fff; border-radius: 12px; margin: 10px 0 0; position: relative; touch-action: none; box-shadow: inset 0 0 0 .5px var(--sep); }
.bi-pad canvas { display: block; width: 100%; height: 190px; cursor: crosshair; touch-action: none; }
.bi-pad .x { position: absolute; left: 18px; right: 18px; bottom: 44px; border-bottom: 1.5px solid #c7c7cc; pointer-events: none; }
.bi-pad .x::before { content: '×'; position: absolute; left: 0; bottom: 2px; font-size: 20px; color: #8e8e93; }
.bi-pad .hint { position: absolute; left: 0; right: 0; bottom: 16px; text-align: center; font-size: 12px; color: #8e8e93; pointer-events: none; }
.bi-docwrap { zoom: .58; margin: 8px -8px; }
.bi-land { position: absolute; inset: 0; z-index: 900; background: #f2f2f7; overflow: hidden; }
.bi-land-in { position: absolute; top: 0; transform-origin: top left; display: flex; flex-direction: column; box-sizing: border-box; padding: 10px 50px 14px; }
.bi-land-bar { display: flex; align-items: center; justify-content: space-between; height: 40px; color: #1c1c1e; font-size: 17px; }
.bi-land-bar button { border: 0; background: none; color: #007AFF; font-size: 17px; cursor: pointer; padding: 6px 8px; display: inline-flex; align-items: center; gap: 3px; } .bi-land-bar button.done { font-weight: 600; }
.bi-land-pad { flex: 1; position: relative; background: #fff; border-radius: 14px; box-shadow: inset 0 0 0 .5px #c6c6c8; }
.bi-land-pad canvas { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.bi-land-pad .x { position: absolute; left: 30px; right: 30px; bottom: 54px; border-bottom: 1.5px solid #c7c7cc; pointer-events: none; } .bi-land-pad .x::before { content: '×'; position: absolute; left: 0; bottom: 2px; font-size: 24px; color: #8e8e93; }
.bi-land-pad .hint { position: absolute; left: 0; right: 0; bottom: 20px; text-align: center; font-size: 13px; color: #8e8e93; pointer-events: none; }
.bi-doc { width: 660px; box-sizing: border-box; background: #fff; color: #1c1c1e; margin: 0 auto 18px; padding: 34px 26px 22px; box-shadow: 0 2px 14px rgba(0,0,0,.16); font: 12.5px/16px Calibri, Carlito, -apple-system, sans-serif; letter-spacing: 0; }
.bi-top { display: flex; justify-content: space-between; align-items: flex-start; }
.bi-logo { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.bi-logo i { display: block; color: #9A5B13; font: italic 700 24px/22px Georgia, serif; }
.bi-logo b { display: block; color: #2F8F2F; font: 900 36px/34px -apple-system, Helvetica, sans-serif; letter-spacing: .5px; }
.bi-ttl { font: 700 36px/40px Helvetica, Arial, sans-serif; text-align: right; margin-bottom: 14px; }
.bi-meta { display: grid; grid-template-columns: auto auto; gap: 3px 24px; align-content: start; }
.bi-meta b { text-align: right; } .bi-meta span { text-align: center; }
.bi-addr { display: grid; grid-template-columns: 1fr 1fr 1.1fr; gap: 10px; margin-top: 6px; line-height: 20px; }
.bi-sumh { font-weight: 700; font-size: 15px; margin: 12px 0 2px 10px; }
.bi-tab { width: 100%; border-collapse: collapse; font-size: 11px; line-height: 15px; }
.bi-tab th { background: #000; color: #fff; text-align: left; padding: 2px 4px; font-weight: 700; }
.bi-tab td { padding: 0 4px; border-left: 1px solid #000; white-space: nowrap; } .bi-tab td:first-child { border-left: 1.5px solid #000; } .bi-tab td:last-child { border-right: 1.5px solid #000; }
.bi-tab tbody tr:last-child td { border-bottom: 2px solid #000; padding-bottom: 6px; }
.bi-tab tr.gap td { height: 12px; }
.bi-tab .c { text-align: center; } .bi-tab .r { text-align: right; }
.bi-tab tfoot td { border: 0; padding: 3px 5px; } .bi-tab tfoot td.sub { border: 1.5px solid #000; font-weight: 700; font-size: 12.5px; }
.bi-tab tfoot tr.due td.r { border: 1.5px solid #000; font-weight: 700; font-size: 17px; padding: 4px 6px; }
.bi-doc .paid { display: inline-block; border: 2px solid #34C759; color: #248A3D; font-weight: 800; border-radius: 6px; padding: 1px 8px; transform: rotate(-4deg); margin-top: 10px; }
.bi-doc .sigs { margin-top: 18px; display: flex; flex-direction: column; gap: 14px; }
.bi-doc .sl { border-bottom: 1px solid #1c1c1e; height: 54px; display: flex; align-items: flex-end; } .bi-doc .sl img, .bi-doc .sl svg { max-height: 52px; max-width: 210px; color: #1c1c1e; }
.bi-doc .sc { font-size: 11px; color: #3a3a3c; margin-top: 3px; display: flex; justify-content: space-between; gap: 8px; }
.bi-cod { margin-top: 14px; } .bi-cod b { font-size: 19px; } .bi-cod p { margin: 6px 10px 0; text-align: center; font-style: italic; font-size: 14.5px; line-height: 20px; }
.bi-pg { text-align: center; margin-top: 30px; font-size: 13px; }
.bi-acts { display: flex; flex-direction: column; gap: 10px; margin: 18px 0 6px; }
.bi-doc .sc { font-size: 11px; color: #3a3a3c; margin-top: 3px; display: flex; justify-content: space-between; gap: 8px; }
`);

/* ---------- Signatures ---------- */
/** A stored signature: an SVG path (300 × 90 box) or a PNG data URL drawn on the pad. */
function sigView(sig) {
  if (!sig) return null;
  if (/^data:/.test(sig)) return h('img', { src: sig, alt: 'Signature' });
  return h('span', { html: '<svg viewBox="0 0 300 90" width="200" height="60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + sig + '"/></svg>' });
}
/** Signature pad sheet. o: {title, subtitle, askName, name} → Promise<{image, name} | null>.
    Turning the phone sideways (or tapping Full screen) switches to a landscape pad that uses the whole screen; turning back keeps what was signed. */
function signaturePad(o = {}) {
  return new Promise(resolve => {
    let strokes = 0, name = o.name || '', done = false, canvas = null, ctx = null, land = null, page = null;
    const finish = v => { if (done) return; done = true; resolve(v); };
    /** Ink on a canvas. rotated: the canvas is drawn turned 90° clockwise inside the portrait screen (the prototype's stand-in for turning the phone). */
    const pen = (cv, rotated) => { const c = cv.getContext('2d'); let last = null;
      c.lineWidth = 4.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#1c1c1e'; c.fillStyle = '#1c1c1e';
      const pt = e => { const r = cv.getBoundingClientRect(); return rotated ? [(e.clientY - r.top) / r.height * cv.width, (r.right - e.clientX) / r.width * cv.height] : [(e.clientX - r.left) / r.width * cv.width, (e.clientY - r.top) / r.height * cv.height]; };
      cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } last = pt(e); c.beginPath(); c.arc(last[0], last[1], 1.6, 0, 7); c.fill(); strokes++; });
      cv.addEventListener('pointermove', e => { if (!last) return; const p = pt(e); c.beginPath(); c.moveTo(last[0], last[1]); c.lineTo(p[0], p[1]); c.stroke(); last = p; strokes++; });
      const up = () => { last = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); return c; };
    const done2 = () => {
      if (!strokes) return ui.toast('Sign in the box first', 'signature');
      if (o.askName && !name.trim()) { if (land) exitLand(); return ui.toast('Add the signer’s printed name', 'person'); }
      finish({ image: (land ? land.canvas : canvas).toDataURL('image/png'), name: name.trim() }); if (land) { land.el.remove(); land = null; } sheet.close();
    };
    /* Landscape: real phones switch when turned; the prototype also offers a button, since the frame doesn't rotate. */
    const realTurn = window.matchMedia ? matchMedia('(orientation: landscape) and (pointer: coarse)') : null;
    function enterLand() {
      if (land) return; const scr = document.querySelector('#screen'), W = scr.offsetWidth, H = scr.offsetHeight, rotated = !(realTurn && realTurn.matches);
      const cv = h('canvas', { width: 1500, height: 640 }), el = h('div.bi-land', h('div.bi-land-in', { style: rotated ? { width: H + 'px', height: W + 'px', left: W + 'px', transform: 'rotate(90deg)' } : { width: '100%', height: '100%', left: 0 } },
        h('div.bi-land-bar', h('button', { onclick: exitLand }, icon('arrow.uturn.left', 17), ' Back'), h('b', o.title || 'Signature'), h('span', h('button', { onclick: () => { lctx.clearRect(0, 0, cv.width, cv.height); strokes = 0; } }, 'Clear'), h('button.done', { onclick: done2 }, 'Done'))),
        h('div.bi-land-pad', cv, h('div.x'), h('div.hint', 'Sign above the line'))));
      scr.appendChild(el); const lctx = pen(cv, rotated); if (strokes && canvas) lctx.drawImage(canvas, 0, 0, cv.width, cv.width * canvas.height / canvas.width);
      land = { el, canvas: cv };
    }
    function exitLand() { if (!land) return; if (strokes && ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(land.canvas, 0, 0, canvas.width, canvas.width * land.canvas.height / land.canvas.width); } land.el.remove(); land = null; }
    const onTurn = () => { if (realTurn.matches) enterLand(); else exitLand(); };
    if (realTurn && realTurn.addEventListener) realTurn.addEventListener('change', onTurn);
    const sheet = ui.sheet({ title: o.title || 'Signature', live: false, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
      trailing: [{ label: 'Done', bold: true, onTap: done2 }],
      onClose: () => { finish(null); if (land) { land.el.remove(); land = null; } if (realTurn && realTurn.removeEventListener) realTurn.removeEventListener('change', onTurn); },
      render: p => { page = p;
        canvas = h('canvas', { width: 722, height: 380 }); ctx = pen(canvas, false);
        return ui.list(
          o.subtitle && h('div.footnote', { style: { padding: '4px 4px 0' } }, o.subtitle),
          h('div.bi-pad', canvas, h('div.x'), h('div.hint', 'Sign above the line')),
          h('div.hstack', { style: { margin: '6px 4px 0' } }, h('button.cu-link', { onclick: enterLand }, icon('rotate.right', 15), ' Turn sideways for a full-screen pad'), h('span.spacer'), h('button.cu-link', { onclick: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; } }, 'Clear')),
          o.askName && ui.section({ footer: 'Prints under the signature on the invoice.' }, ui.inputRow({ label: 'Printed name', caps: 'words', placeholder: 'Signer’s name', value: name, onInput: v => { name = v; } })));
      } }, { detent: 'large' });
    sheet.closed.then(() => finish(null));
    if (realTurn && realTurn.matches) setTimeout(enterLand, 500);
  });
}

/* ---------- Helpers ---------- */
let invSeq = 2600;
const pbItem = id => data.priceBook.find(x => x.id === id) || { name: id, rate: 0 };
const total = lines => lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);
/** The person whose signature goes on the invoice: the signed-in driver running this route today, else the route's driver, else whoever creates it. */
function repFor(job) { if (S.shift && S.shift.routeId === job.routeId) return S.me; if (S.me && S.me.role === 'driver') return S.me; return q.driverFor(job.routeId) || S.me; }
/** Starting lines for a job: its containers, with this customer's rates. */
function linesForJob(job) {
  const lines = (job.items || []).filter(i => i.qty > 0).map(i => ({ id: i.id, name: pbItem(i.id).name, qty: i.qty, rate: i.rate != null ? i.rate : pbItem(i.id).rate }));
  if (!lines.length) lines.push(job.type === 'purge' ? { id: 'box', name: pbItem('box').name, qty: 1, rate: 8 } : { id: 'console', name: pbItem('console').name, qty: 1, rate: 30 });
  return lines;   /* The certificate of destruction prints on every invoice, so it isn't a line. */
}
const methodLabel = f => ({ cash: 'Cash', check: 'Check' + (f.checkNo.trim() ? ' #' + f.checkNo.trim() : ''), card: 'Card (Tap to Pay on iPhone)', other: (f.other || '').trim() || 'Other' })[f.pay];
const canInvoice = () => WD.can('billing.field') || WD.can('billing.manage');

/** Mirror an invoice into the customer billing records (Customers → Invoices). */
function mirror(job) {
  const inv = job.invoice; if (!data.invoices || !job.customerId) return;
  let rec = data.invoices.find(x => x.jobId === job.id);
  if (!rec) { rec = { id: 'inv-f' + inv.number, number: inv.number, customerId: job.customerId, jobId: job.id, day: job.day, payments: [], at: +WD.now(), auto: false }; data.invoices.push(rec);
    const c = q.customer(job.customerId); if (c && c.stats && inv.status !== 'Draft') { c.stats.invoiced += inv.amount; c.successful = true; if (!c.stats.firstInvoice) c.stats.firstInvoice = job.day; } }
  Object.assign(rec, { amount: inv.amount, status: inv.status, lines: inv.lines });
  if (inv.status === 'Paid' && inv.paid && !rec.payments.length && data.payments) { const pay = { id: 'pay-f' + inv.number, invoiceId: rec.id, customerId: job.customerId, at: inv.paid.at, amount: inv.amount, method: inv.paid.method + ' · on site' }; data.payments.push(pay); rec.payments.push(pay.id); const c = q.customer(job.customerId); if (c && c.stats) c.stats.paid += inv.amount; }
}

/* ---------- Invoice editor ---------- */
/** o: {pay, lines, note, flow, onDone} — e.g. "Skip and charge" starts with a trip charge; "Mark as paid" starts with cash selected.
    flow: opened by Complete stop (billing details first, then Get signature / Create invoice). onDone runs after it's billed.
    Customers billed by service note (monthly master invoice) get a signed service note instead of an invoice. */
function openEditor(jobId, o = {}) {
  const job = q.job(jobId); if (!job) return;
  if (!canInvoice()) return ui.toast('Your role can’t create invoices', 'lock');
  const wf = WD.workflow || {}, cust = q.customer(job.customerId), contact = cust && cust.contacts[0], prev = job.invoice && job.invoice.status === 'Draft' ? job.invoice : null, rep = repFor(job);
  const note = !!(cust && cust.billingMode === 'serviceNote' && !o.lines), pol = note ? 'always' : WD.sigPolicy(cust), poOf = day => wf.poFor && cust && cust.poSchedule && cust.poSchedule.length ? wf.poFor(cust, day).po : null;
  const f = prev ? { lines: prev.lines.map(l => ({ ...l })), po: prev.po || '', contract: prev.contract || '', billTo: prev.billTo || '', includeDate: prev.includeDate !== false, serviceDate: prev.serviceDate || job.day, scans: (prev.scans || []).slice(), scanNote: prev.scanNote || '', custSig: prev.custSig || null, custName: prev.custName || '', pounds: prev.pounds || '', pay: 'none', checkNo: '', other: '', note: prev.note || '' }
    : { lines: o.lines || linesForJob(job), po: poOf(job.day) != null ? poOf(job.day) : job.po || (cust && cust.po) || '', contract: job.contract || (cust && cust.contract) || '', billTo: (cust && (cust.billingEmail || (contact && contact.email))) || '', includeDate: true, serviceDate: job.day, scans: [], scanNote: '', custSig: null, custName: '', pounds: '', pay: o.pay || 'none', checkNo: '', other: '', note: o.note || '' };
  let totalEl = null;
  /* Container barcodes (Settings → Container barcodes): scan each container at the stop to prove service. */
  const tags = WD.co && WD.co.barcodesOn() ? WD.co.containers(job) : [], scanShort = () => tags.length > 0 && f.scans.length < tags.length && !f.scanNote;
  const syncTotal = () => { if (totalEl) totalEl.textContent = fmt.money(total(f.lines), true); };
  const createLabel = () => note ? 'Create service note' : f.pay === 'none' ? 'Create invoice' : 'Create invoice · paid';
  const sigMissing = () => pol === 'always' && !f.custSig;
  function lineRow(l, i, p) {
    const num = (k, cls) => h('input.n.' + cls, { type: 'text', inputmode: 'decimal', value: String(l[k]), 'aria-label': k === 'qty' ? 'Quantity' : 'Rate', oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); l[k] = isNaN(v) ? 0 : v; tot.textContent = fmt.money(l.qty * l.rate, true); syncTotal(); } });
    const tot = h('span.bi-tot', fmt.money(l.qty * l.rate, true));
    return h('div.bi-line', h('div.bi-name', h('input', { type: 'text', value: l.name, 'aria-label': 'Description', oninput: e => { l.name = e.target.value; } }),
      h('button.bi-del', { 'aria-label': 'Delete line', onclick: () => { f.lines.splice(i, 1); p.refresh(); } }, icon('bi.minus', 22))),
      h('div.bi-nums', h('span.bi-lab', 'Qty'), num('qty', 'q'), h('span.bi-lab', '× $'), num('rate', 'r'), tot));
  }
  function addLine(el, p) {
    ui.menu(el, [{ header: 'Add a charge' }, ...data.priceBook.map(x => ({ label: x.name, subtitle: fmt.money(x.rate, true), onTap: () => { f.lines.push({ id: x.id, name: x.name, qty: 1, rate: x.rate }); p.refresh(); } })),
      'divider', { label: 'Custom charge…', icon: 'plus', onTap: async () => { const r = await ui.alert({ title: 'Custom charge', input: { placeholder: 'Description, e.g. Extra bags' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Add', value: true, bold: true }] }); if (r && r.value && r.text.trim()) { f.lines.push({ name: r.text.trim(), qty: 1, rate: 0 }); p.refresh(); } } }]);
  }
  async function ensureRepSig() {
    if (rep && rep.signature) return true;
    if (rep !== S.me) { const v = await ui.alert({ title: 'No signature on file', message: (rep ? rep.name : 'The driver') + ' hasn’t added a signature yet, so the representative line will be blank.', buttons: [{ label: 'Cancel', value: false }, { label: 'Continue', value: true, bold: true }] }); return v; }
    const r = await signaturePad({ title: 'Your signature', subtitle: 'Saved on file and printed on every invoice you create, under “Shredding Service Representative Signature”.' });
    if (!r) return false; S.me.signature = r.image; ui.toast('Signature saved to your profile', 'signature'); return true;
  }
  async function getCustomerSig(p) {
    const r = await signaturePad({ title: 'Customer signature', subtitle: (cust ? cust.name + ' · ' : '') + 'Hand the iPhone to the customer.', askName: true, name: contact ? contact.name : '' });
    if (r) { f.custSig = r.image; f.custName = r.name; p.refresh(); } return !!r;
  }
  const finish = (p, msg, ic) => { p.dismiss(); ui.toast(msg, ic || 'checkmark', 2400); if (o.onDone) setTimeout(o.onDone, 350); };
  async function submit(p, draft) {
    if (!f.lines.length) return ui.alert({ title: 'No charges', message: 'Add at least one line, even if it’s $0.' });
    if (!draft) {
      /* A price changed on the invoice can become the customer's price for this and all future visits. */
      if (!o.lines && !(await WD.x.priceChangePrompt(job, f.lines))) return;
      if (scanShort() && data.settings.barcodes.require) {
        const v = await ui.actionSheet({ title: f.scans.length + ' of ' + tags.length + ' containers scanned', message: 'Every container is scanned to prove it was serviced.', buttons: [{ label: 'Scan containers', value: 'scan' }, { label: 'A label is missing or damaged…', value: 'why' }] });
        if (v === 'scan') return WD.co.scanSheet(job, f.scans, () => p.refresh());
        if (v !== 'why') return; const r = await ui.alert({ title: 'What happened?', input: { placeholder: 'e.g. Label torn off console 2' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return; f.scanNote = r.text.trim();
      }
      if (sigMissing()) {
        const v = await ui.actionSheet({ title: (cust ? cust.name : 'This customer') + ' requires a signature', message: note ? 'Service notes are always signed by the site contact.' : 'Set in the customer’s settings: always required.', buttons: [{ label: 'Get signature', value: 'sign' }] });
        if (v !== 'sign' || !(await getCustomerSig(p))) return;
      }
      if (!(await ensureRepSig())) return;
      if (!note && f.pay === 'card') { const hud = ui.hud('Hold card near the top of iPhone'); await WD.delay(1600); hud.set('Approved', 'checkmark'); await WD.delay(650); hud.close(); }
      if (!note && f.pay === 'check' && !f.checkNo.trim()) { const r = await ui.alert({ title: 'Check number', message: 'Optional — helps match the deposit.', input: { placeholder: 'e.g. 4417', type: 'text' }, buttons: [{ label: 'Skip', value: 'skip' }, { label: 'Save', value: 'save', bold: true }] }); if (r && r.value === 'save') f.checkNo = r.text; }
    }
    const amount = total(f.lines), me = S.me.name;
    if (note && !draft) {
      let sn = null;
      api.op({ kind: 'edit', title: job.title, scope: 'Service note', jobIds: [job.id], apply() {
        sn = wf.addServiceNote(job, { lines: f.lines, po: f.po.trim(), signer: f.custName, sig: f.custSig, day: f.serviceDate, pounds: f.pounds || null });
        job.billing = { kind: 'serviceNote', number: sn.number, amount, at: +WD.now(), by: me, signer: f.custName }; job.po = f.po.trim();
        job.events.push({ at: +WD.now(), actor: me, text: 'Service note ' + sn.number + ' signed by ' + (f.custName || 'customer') + ' · ' + fmt.money(amount, true) + ' · added to the master invoice' }); } });
      return finish(p, (sn ? sn.number : 'Service note') + ' saved · added to the master invoice', 'tray');
    }
    const paid = !draft && f.pay !== 'none', number = prev ? prev.number : 'INV-' + (++invSeq), method = paid ? methodLabel(f) : null;
    api.op({ kind: 'edit', title: job.title, scope: draft ? 'Invoice draft' : paid ? 'Invoice paid on site' : 'Invoice created', jobIds: [job.id], apply() {
      job.invoice = { number, status: draft ? 'Draft' : paid ? 'Paid' : 'Sent', amount, auto: false, lines: f.lines.map(l => ({ ...l })), po: f.po.trim(), contract: f.contract.trim(), billTo: f.billTo.trim(), includeDate: f.includeDate, serviceDate: f.serviceDate, pounds: f.pounds || null, note: f.note, scans: f.scans.slice(), scanNote: f.scanNote,
        repId: rep && rep.id, repName: rep && rep.name, repSig: rep && rep.signature, custSig: f.custSig, custName: f.custName, paid: paid ? { method, at: +WD.now() } : null, sentAt: draft ? null : +WD.now() };
      job.po = f.po.trim(); job.contract = f.contract.trim();
      job.events.push({ at: +WD.now(), actor: me, text: draft ? 'Invoice ' + number + ' saved as draft' : 'Invoice ' + number + ' ' + (paid ? 'paid on site · ' + method : 'created and sent to ' + (f.billTo || 'the customer')) + ' · ' + fmt.money(amount, true) });
      if (!draft) mirror(job);
    } });
    if (draft) { p.dismiss(); return ui.toast('Draft saved', 'doc.text'); }
    finish(p, paid ? number + ' paid · receipt sent' : number + ' created and sent');
  }
  function setDate(v, p) {
    f.serviceDate = v; const po = poOf(v);
    if (po != null && po !== f.po) { f.po = po; ui.toast(po ? 'PO changed to ' + po + ' for this service date' : 'No PO covers this service date', po ? 'doc.text' : 'exclamationmark.triangle', 2600); }
    p.refresh();
  }
  ui.sheet({ title: note ? 'Service note' : prev ? 'Edit invoice' : o.flow ? 'Billing details' : 'New invoice', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: 'Create', bold: true, onTap: p => submit(p, false) }],
    render(p) {
      const c = cust, po = poOf(f.serviceDate), alert = wf.poAlert && c && wf.poAlert(c, f.serviceDate);
      return ui.list(
        note && h('div', { style: 'padding:4px 4px 0' }, ui.note((c ? c.name : 'This customer') + ' gets one master invoice a month. This visit is saved as a signed service note and added to it in the database.')),
        ui.section({ header: (c ? c.name : job.title) + (job.address ? ' · ' + job.address.split(',')[0] : ''), footer: f.note || 'Adjust quantities, rates and line items. Rates start from this customer’s pricing.' },
          f.lines.map((l, i) => lineRow(l, i, p)),
          ui.row({ title: 'Add line', icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', tint: true, onTap: (e, el) => addLine(el, p) }),
          h('div.bi-total', h('span', 'Total'), totalEl = h('span', fmt.money(total(f.lines), true)))),
        ui.section({ header: 'Service', footer: po != null ? 'The PO comes from ' + (c ? c.name : 'the customer') + '’s PO schedule for the service date. Changing the date picks the PO that covers it.' : 'PO and contract numbers come from the customer. Changes here apply to this job only.' },
          ui.dateRow({ title: 'Service date', icon: 'calendar', iconColor: 'var(--red)', value: f.serviceDate, onChange: v => setDate(v, p) }),
          !note && ui.toggleRow({ title: 'Print service date', value: f.includeDate, onChange: v => { f.includeDate = v; } }),
          ui.inputRow({ label: 'Pounds', placeholder: 'From the truck scale (optional)', inputmode: 'numeric', value: String(f.pounds || ''), onInput: v => { f.pounds = parseInt(v.replace(/\D/g, ''), 10) || ''; } }),
          ui.inputRow({ label: 'PO number', placeholder: 'None', value: f.po, onInput: v => { f.po = v; } }),
          alert && wf.alertRow(alert),
          ui.inputRow({ label: 'Contract', placeholder: 'None', value: f.contract, onInput: v => { f.contract = v; } }),
          !note && ui.inputRow({ label: 'Send to', type: 'email', caps: 'off', placeholder: 'Billing email', value: f.billTo, onInput: v => { f.billTo = v; } })),
        tags.length > 0 && ui.section({ header: 'Containers', footer: f.scanNote ? 'Not all scanned: ' + f.scanNote : data.settings.barcodes.onInvoice ? 'The container numbers and scan times print on the invoice.' : null },
          ui.row({ icon: f.scans.length >= tags.length ? 'checkmark.circle.fill' : 'barcode', iconPlain: true, iconColor: f.scans.length >= tags.length ? 'var(--green)' : 'var(--orange)', title: 'Scan container barcodes', subtitle: f.scans.length + ' of ' + tags.length + ' scanned', chevron: true, onTap: () => WD.co.scanSheet(job, f.scans, () => p.refresh()) })),
        pol !== 'never' && ui.section({ header: 'Customer signature', footer: pol === 'always' ? (note ? 'Service notes are always signed.' : c.name + ' always requires a signature.') + ' Create unlocks once they sign.' : 'Optional for this customer. Get a signature if they want to sign.' },
          f.custSig ? [h('div.bi-sig', h('div.bi-ink', sigView(f.custSig)), h('div.bi-cap', 'Customer Signature' + (f.custName ? ' · ' + f.custName : ''))), ui.row({ title: 'Sign again', tint: true, onTap: () => getCustomerSig(p) })]
            : ui.row({ title: pol === 'always' ? 'Signature required' : 'No signature yet', icon: 'signature', iconPlain: true, iconColor: pol === 'always' ? 'var(--orange)' : 'var(--label3)' })),
        !note && ui.section({ header: 'Payment', footer: f.pay === 'none' ? 'The invoice is emailed with a pay link.' : 'Marks the invoice paid and emails a receipt. ' + (f.pay === 'card' ? 'Tap to Pay runs through Stripe.' : 'Hand the ' + (f.pay === 'other' ? 'payment' : f.pay) + ' to the office.') },
          ui.pickerRow({ title: 'Paid on site', value: f.pay, options: [{ value: 'none', label: 'Not paid — send invoice' }, { value: 'cash', label: 'Cash' }, { value: 'check', label: 'Check' }, { value: 'card', label: 'Credit card' }, { value: 'other', label: 'Other' }], onChange: v => { f.pay = v; p.refresh(); } }),
          f.pay === 'check' && ui.inputRow({ label: 'Check #', placeholder: 'Optional', inputmode: 'numeric', value: f.checkNo, onInput: v => { f.checkNo = v; } }),
          f.pay === 'other' && ui.inputRow({ label: 'Paid by', placeholder: 'e.g. ACH, Venmo', value: f.other, onInput: v => { f.other = v; } }),
          !prev && wf.paidNoInvoice && ui.row({ title: 'Paid — no invoice…', subtitle: 'Customer paid and doesn’t want an invoice', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: async () => { if (await wf.paidNoInvoice(job, total(f.lines))) { p.dismiss(); if (o.onDone) setTimeout(o.onDone, 350); } } })),
        h('div.bi-acts', pol !== 'never' && !f.custSig && ui.button('Get signature', { kind: pol === 'always' ? 'filled' : 'gray', icon: 'signature', onTap: () => getCustomerSig(p) }),
          ui.button(createLabel(), { kind: sigMissing() ? 'gray' : 'filled', icon: note ? 'tray' : 'doc.text', onTap: () => submit(p, false) })),
        ui.section(null, !note && ui.row({ title: 'Preview invoice', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => p.push(previewSpec(() => draftInvoice(job, f, rep))) }),
          !note && ui.row({ title: 'Save as draft', icon: 'tray', iconPlain: true, tint: true, onTap: () => submit(p, true) }),
          h('div.bi-sig', h('div.bi-ink', rep && rep.signature ? sigView(rep.signature) : h('span.bi-empty', rep === S.me ? 'Added when you create it' : 'No signature on file')), h('div.bi-cap', 'Shredding Service Representative Signature' + (rep ? ' · ' + rep.name : '')))));
    } });
}
const draftInvoice = (job, f, rep) => ({ number: (job.invoice && job.invoice.number) || 'Draft', status: 'Draft', amount: total(f.lines), lines: f.lines, po: f.po, contract: f.contract, billTo: f.billTo, includeDate: f.includeDate, serviceDate: f.serviceDate, pounds: f.pounds || null, scans: f.scans, scanNote: f.scanNote, repName: rep && rep.name, repSig: rep && rep.signature, custSig: f.custSig, custName: f.custName, paid: null, job });

/* ---------- Invoice document (what the customer receives) ----------
   Layout follows the company's invoice: logo and "Invoice" with Account / Invoice # / Date, Bill To (with Attn), Please Remit To,
   Service Location / Terms / Agreement, a SERVICE SUMMARY table (Date, Location, Description, Qty, Price, Pounds, Amount) grouped by
   location, a subtotal of bins, pounds and amount on every page, Total DUE on the last page, and the certificate of destruction. */
const DESC = { console: 'Consoles of Shredding', bin64: '64 Gallon Containers of Shredding', bin96: '96 Gallon Containers of Shredding', box: 'Boxes of Shredding' };
const descOf = l => l.id && DESC[l.id] ? l.qty + ' - ' + DESC[l.id] : l.name;
const mdy = day => { const d = D.parse(day); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); };
const money2 = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ROWS_PER_PAGE = 30;
/** Rows for one visit: one row per line, pounds on the first container line. */
function visitRows(day, location, lines, pounds) {
  let lb = pounds; return lines.filter(l => l.qty || l.rate).map(l => { const bin = WD.CONTAINERS.includes(l.id), row = { day, location, desc: descOf(l), qty: +l.qty || 0, rate: +l.rate || 0, bins: bin ? +l.qty || 0 : 0, pounds: bin && lb ? lb : null }; if (bin && lb) lb = null; return row; });
}
function logo() {
  const name = (S.org || data.orgs[0]).name, [first, ...rest] = name.split(' ');
  return h('div.bi-logo', icon('repeat', 40, '#3A9B3A'), h('div', h('i', first), h('b', rest.join(' ').toUpperCase() || first.toUpperCase())));
}
/** o: {number, date, customer, billTo, attn, serviceLocation, terms, agreement, po, rows, paid, sigs} → one element per page. */
function invoicePages(o) {
  const org = S.org || data.orgs[0], remit = org.remit || [org.name.toUpperCase()], c = o.customer || {};
  const pages = []; let cur = [];
  o.rows.forEach((r, i) => { if (r.gap && !cur.length) return; cur.push(r); if (cur.length >= ROWS_PER_PAGE && i < o.rows.length - 1) { pages.push(cur); cur = []; } });
  if (cur.length || !pages.length) pages.push(cur);
  const all = o.rows.filter(r => !r.gap), totAmt = all.reduce((s, r) => s + r.qty * r.rate, 0), N = pages.length;
  const meta = pairs => h('div.bi-meta', pairs.filter(p => p[1]).map(([k, v]) => [h('b', k + ':'), h('span', v)]));
  return pages.map((rows, pi) => {
    const real = rows.filter(r => !r.gap), bins = real.reduce((s, r) => s + r.bins, 0), lbs = real.reduce((s, r) => s + (r.pounds || 0), 0), amt = real.reduce((s, r) => s + r.qty * r.rate, 0), last = pi === N - 1;
    let prevLoc = null;
    return h('div.bi-doc',
      h('div.bi-top', logo(), h('div', h('div.bi-ttl', 'Invoice'), meta([['Account', c.account || (c.name || '').toUpperCase()], ['Invoice #', o.number], ['Date', mdy(o.date)]]))),
      h('div.bi-addr', h('div', h('b', 'Bill To:'), (o.billTo || []).map(x => h('div', x))), h('div', h('b', 'Please Remit To:'), remit.map(x => h('div', x))),
        meta([['Service Location', o.serviceLocation], ['Terms', o.terms || 'Net 30'], ['Agreement', o.agreement], ['PO', o.po]])),
      h('div.bi-sumh', 'SERVICE SUMMARY'),
      h('table.bi-tab', h('thead', h('tr', ['Date', 'Location', 'Description', 'Qty', 'Price', 'Pounds', 'Amount'].map((t, k) => h('th' + (k >= 3 ? '.r' : ''), t)))),
        h('tbody', rows.map(r => { if (r.gap) return h('tr.gap', h('td', { colspan: 7 })); const same = r.location === prevLoc; prevLoc = r.location;
          return h('tr', h('td', mdy(r.day)), h('td.c', r.location), h('td.c', r.desc), h('td.r', String(r.qty)), h('td.r', money2(r.rate)), h('td.r', r.pounds != null ? String(r.pounds) : ''), h('td.r', money2(r.qty * r.rate))); })),
        h('tfoot', h('tr', h('td', { colspan: 2 }), h('td.r.sub', N > 1 ? 'Subtotal Page ' + (pi + 1) : 'Subtotal'), h('td.r.sub', String(bins)), h('td.sub', real.some(r => r.bins && !/Gallon/.test(r.desc)) ? 'Units' : 'Bins'), h('td.r.sub', lbs ? lbs.toLocaleString('en-US') : ''), h('td.r.sub', money2(amt))),
          last && h('tr.due', h('td', { colspan: 2 }), h('td', { colspan: 3, class: 'r' }, 'Total DUE This Invoice'), h('td', { colspan: 2, class: 'r' }, o.paid ? '$0.00' : money2(totAmt))))),
      last && o.paid && h('div.paid', 'PAID' + (o.paid.method ? ' · ' + o.paid.method : '') + ' · ' + money2(totAmt)),
      last && o.scans && o.scans.length > 0 && h('div.bi-scan', h('b', 'CONTAINERS SERVICED (BARCODE SCANS): '), o.scans.map(s => s.code + ' ' + fmt.clock(new Date(s.at))).join(' · ') + (o.scanNote ? ' · Note: ' + o.scanNote : '')),
      last && o.sigs,
      h('div.bi-cod', h('b', 'CERTIFICATE OF DESTRUCTION:'), h('p', (org.name) + ' certifies that all materials related to services included on this invoice have been shredded per the terms of the service agreement. Additionally, 100% of the shredded materials were recycled.')),
      h('div.bi-pg', 'Page ' + (pi + 1) + ' of ' + N));
  });
}
const docWrap = pages => h('div.bi-docwrap', pages);
function invoiceDoc(inv, job) {
  const c = q.customer(job.customerId), lines = inv.lines || linesForJob(job), loc = c && (c.locations.find(l => l.id === job.locationId) || c.locations[0]), day = inv.serviceDate || job.day;
  const contact = c && c.contacts[0], billTo = c ? [c.name].concat(c.attn || contact ? ['Attn: ' + (c.attn || contact.name)] : [], c.billAddress || [job.address.split(',')[0], (job.address.split(',')[1] || '').trim()].filter(Boolean)) : [job.title, job.address];
  const sigs = h('div.sigs',
    h('div', h('div.sl', sigView(inv.repSig)), h('div.sc', h('span', 'Shredding Service Representative Signature'), h('span', [inv.repName, inv.includeDate !== false ? 'Service date ' + mdy(day) : null].filter(Boolean).join(' · ')))),
    (inv.custSig || WD.sigPolicy(c) === 'always') && h('div', h('div.sl', sigView(inv.custSig)), h('div.sc', h('span', 'Customer Signature'), h('span', inv.custName || ''))));
  return docWrap(invoicePages({ number: inv.number, date: inv.sentAt ? D.key(new Date(inv.sentAt)) : day, customer: c || { name: job.title }, billTo, serviceLocation: loc ? job.address.split(',')[0] : job.address, terms: c && c.terms, agreement: (c && c.agreement) || inv.contract, po: inv.po,
    rows: visitRows(day, loc ? loc.label : job.title, lines, inv.pounds), paid: inv.status === 'Paid' ? (inv.paid || {}) : null, sigs, scans: data.settings && data.settings.barcodes.onInvoice ? inv.scans : null, scanNote: inv.scanNote }));
}
/** A master invoice: every service note it was built from, grouped by location (blank row between locations), paged like the paper invoice. */
function masterDoc(mi) {
  const c = q.customer(mi.customerId), notes = mi.noteIds.map(id => data.serviceNotes.find(n => n.id === id)).filter(Boolean).sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true }) || a.day.localeCompare(b.day));
  const rows = []; let prev = null;
  notes.forEach(n => { if (prev != null && n.location !== prev) rows.push({ gap: true }); prev = n.location; rows.push(...visitRows(n.day, n.location, n.lines, n.pounds)); });
  const rec = data.invoices && data.invoices.find(x => x.id === 'inv-' + mi.id);
  return docWrap(invoicePages({ number: mi.number, date: D.key(new Date(mi.at)), customer: c, billTo: [c.name, 'Attn: ' + (c.attn || (c.contacts[0] || {}).name || '')].concat(c.billAddress || []), serviceLocation: new Set(notes.map(n => n.location)).size > 1 ? 'MULTIPLE LOCATIONS' : (notes[0] || {}).location,
    terms: c.terms, agreement: c.agreement || c.contract, po: mi.po, rows, paid: rec && rec.status === 'Paid' ? {} : null }));
}
const masterDocSpec = mi => ({ title: mi.number, render: () => masterDoc(mi) });
function previewSpec(get) {
  return { title: 'Invoice preview', render: () => { const inv = get(); return invoiceDoc(inv, inv.job); } };
}
function openInvoice(jobId) {
  const job = q.job(jobId); if (!job || !job.invoice) return;
  if (job.invoice.status === 'Draft') return openEditor(jobId);
  ui.sheet({ title: job.invoice.number, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: p => {
    const inv = job.invoice, unpaid = inv.status !== 'Paid';
    return ui.list(invoiceDoc(inv, job),
      ui.section(null, invActions(job), ui.row({ title: 'Resend to customer', icon: 'envelope', iconPlain: true, tint: true, onTap: () => ui.run('Sending…', null, { done: 'Sent' }) })));
  } });
}
async function recordPayment(job) {
  const m = await ui.actionSheet({ title: 'Record payment', message: job.invoice.number + ' · ' + fmt.money(job.invoice.amount, true), buttons: [{ label: 'Cash', value: 'cash' }, { label: 'Check', value: 'check' }, { label: 'Credit card (Tap to Pay)', value: 'card' }] });
  if (!m) return; const f = { pay: m, checkNo: '' };
  if (m === 'check') { const r = await ui.alert({ title: 'Check number', input: { placeholder: 'Optional' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value) return; f.checkNo = r.text; }
  if (m === 'card') { const hud = ui.hud('Hold card near the top of iPhone'); await WD.delay(1500); hud.set('Approved', 'checkmark'); await WD.delay(600); hud.close(); }
  const method = methodLabel(f), me = S.me.name;
  api.op({ kind: 'edit', title: job.title, scope: 'Payment · ' + method, jobIds: [job.id], apply() { job.invoice.status = 'Paid'; job.invoice.paid = { method, at: +WD.now() }; job.events.push({ at: +WD.now(), actor: me, text: 'Paid · ' + method + ' · ' + fmt.money(job.invoice.amount, true) }); mirror(job); } });
  ui.toast('Marked paid · ' + method, 'checkmark');
}

/** Invoice actions for a job's invoice: mark paid (card, check, cash, other), send reminder, charge card, open in Invoice Ninja. */
function invActions(job) {
  const wf = WD.workflow, rec = wf && wf.invRecFor(job);
  if (rec) return wf.invoiceActionRows(rec, job, { noView: true });
  return [job.invoice.status !== 'Paid' && canInvoice() && ui.row({ title: 'Mark paid…', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => recordPayment(job) }),
    ui.row({ title: 'Open in Invoice Ninja', icon: 'arrow.up.right', iconPlain: true, tint: true, onTap: () => ui.toast('Opening Invoice Ninja…', 'arrow.up.right') })];
}
/** Rows for the job details Billing section. */
function billingRows(job) {
  const inv = job.invoice, can = canInvoice(), color = { Paid: 'var(--green)', Draft: 'var(--gray)', Sent: 'var(--orange)', Overdue: 'var(--red)' }, wf = WD.workflow;
  if (job.billing) { const b = job.billing, sn = b.kind === 'serviceNote';
    return [ui.row({ title: sn ? 'Service note ' + b.number : 'Paid — no invoice', subtitle: (sn ? (b.signer ? 'Signed by ' + b.signer + ' · ' : '') + 'on the monthly master invoice' : b.method + ' · ' + (b.by || '')) , icon: sn ? 'tray' : 'dollarsign.circle', iconColor: sn ? 'var(--brown)' : 'var(--green)', detail: fmt.money(b.amount, true),
      chevron: sn && !!wf, onTap: sn && wf ? () => WD.nav.push(wf.masterSpec(job.customerId)) : null })]; }
  if (inv) return [ui.row({ title: inv.number + ' · ' + fmt.money(inv.amount, true), subtitle: inv.auto ? 'Card on file charged automatically' : inv.status === 'Draft' ? 'Draft — not sent yet' : inv.paid ? 'Paid · ' + inv.paid.method : 'Invoice Ninja', icon: 'dollarsign', iconColor: 'var(--green)', badge: ui.badge(inv.status, color[inv.status] || 'var(--orange)'), chevron: true, onTap: () => openInvoice(job.id) }),
    inv.status !== 'Draft' && invActions(job)];
  if (!can) return [ui.row({ title: 'Not billed yet' })];
  const c = q.customer(job.customerId), note = c && c.billingMode === 'serviceNote', go = () => { if (job.status !== 'completed' && WD.workflow) return WD.workflow.completeStop(job); openEditor(job.id); };
  return [ui.row({ title: note ? 'Create service note…' : 'Create invoice…', subtitle: job.status === 'completed' ? 'Billing details, signature and payment' : 'Completes the stop and opens the billing details', icon: note ? 'tray' : 'doc.text', iconPlain: true, tint: true, onTap: go }),
    !note && wf && ui.row({ title: 'Paid — no invoice…', subtitle: 'Paid on the spot and no invoice wanted', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => { if (job.status !== 'completed') WD.api.setStatus(job.id, 'completed'); wf.paidNoInvoice(job); } })];
}

WD.screens.billing = { openEditor, openInvoice, recordPayment, billingRows, invActions, masterDocSpec, invoiceDoc, signaturePad, sigView, linesForJob, canInvoice };
WD.panel.addJump('Invoice editor', () => { WD.nav.switchTab('board'); const j = data.jobs.filter(x => x.day === D.today() && x.status === 'completed' && !x.invoice && x.customerId).sort(q.order)[0]; if (j) openEditor(j.id); else ui.toast('No completed job without an invoice today'); });
})();
