/* Field invoicing: the invoice editor (rates, quantities, add/delete lines, PO and contract numbers), signatures
   (representative signature on file, customer signature on request), paid-on-site (cash, check, card) and the invoice preview.
   Registers WD.screens.billing. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D, api } = WD;

WD.addIcons({ 'bi.minus': '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12h9" stroke="#fff"/>' });
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
.bi-doc { background: #fff; color: #1c1c1e; border-radius: 6px; margin: 12px 0; padding: 18px 16px 20px; box-shadow: 0 2px 10px rgba(0,0,0,.12); font-size: 12.5px; line-height: 17px; letter-spacing: 0; }
.bi-doc h3 { margin: 0; font-size: 18px; line-height: 22px; } .bi-doc .mut { color: #6e6e73; }
.bi-doc .top { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.bi-doc .refs { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin: 10px 0 12px; }
.bi-doc table { width: 100%; border-collapse: collapse; } .bi-doc th { text-align: left; font-weight: 600; border-bottom: 1px solid #d1d1d6; padding: 4px 0; } .bi-doc td { padding: 4px 0; border-bottom: .5px solid #e5e5ea; vertical-align: top; }
.bi-doc .r { text-align: right; white-space: nowrap; } .bi-doc tfoot td { border: 0; font-weight: 700; font-size: 14px; padding-top: 8px; }
.bi-doc .paid { display: inline-block; border: 2px solid #34C759; color: #248A3D; font-weight: 800; border-radius: 6px; padding: 1px 8px; transform: rotate(-6deg); margin-top: 6px; }
.bi-doc .sigs { margin-top: 22px; display: flex; flex-direction: column; gap: 16px; }
.bi-doc .sl { border-bottom: 1px solid #1c1c1e; height: 54px; display: flex; align-items: flex-end; } .bi-doc .sl img, .bi-doc .sl svg { max-height: 52px; max-width: 210px; color: #1c1c1e; }
.bi-doc .sc { font-size: 11px; color: #3a3a3c; margin-top: 3px; display: flex; justify-content: space-between; gap: 8px; }
`);

/* ---------- Signatures ---------- */
/** A stored signature: an SVG path (300 × 90 box) or a PNG data URL drawn on the pad. */
function sigView(sig) {
  if (!sig) return null;
  if (/^data:/.test(sig)) return h('img', { src: sig, alt: 'Signature' });
  return h('span', { html: '<svg viewBox="0 0 300 90" width="200" height="60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + sig + '"/></svg>' });
}
/** Signature pad sheet. o: {title, subtitle, askName, name} → Promise<{image, name} | null>. */
function signaturePad(o = {}) {
  return new Promise(resolve => {
    let strokes = 0, name = o.name || '', done = false, canvas = null, ctx = null, last = null;
    const finish = v => { if (done) return; done = true; resolve(v); };
    const sheet = ui.sheet({ title: o.title || 'Signature', live: false, leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
      trailing: [{ label: 'Done', bold: true, onTap: p => {
        if (!strokes) return ui.toast('Sign in the box first', 'signature');
        if (o.askName && !name.trim()) return ui.toast('Add the signer’s printed name', 'person');
        finish({ image: canvas.toDataURL('image/png'), name: name.trim() }); p.dismiss();
      } }],
      onClose: () => finish(null),
      render: () => {
        canvas = h('canvas', { width: 722, height: 380 }); ctx = canvas.getContext('2d');
        ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1c1c1e';
        const pt = e => { const p = ui.localPoint(e, canvas); return [p.x * canvas.width / canvas.offsetWidth, p.y * canvas.height / canvas.offsetHeight]; };
        canvas.addEventListener('pointerdown', e => { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ } last = pt(e); ctx.beginPath(); ctx.arc(last[0], last[1], 1.6, 0, 7); ctx.fill(); });
        canvas.addEventListener('pointermove', e => { if (!last) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; strokes++; });
        const up = () => { last = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
        return ui.list(
          o.subtitle && h('div.footnote', { style: { padding: '4px 4px 0' } }, o.subtitle),
          h('div.bi-pad', canvas, h('div.x'), h('div.hint', 'Sign above the line')),
          h('div', { style: { textAlign: 'right', margin: '6px 4px 0' } }, h('button.cu-link', { onclick: () => { ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; } }, 'Clear')),
          o.askName && ui.section({ footer: 'Prints under the signature on the invoice.' }, ui.inputRow({ label: 'Printed name', caps: 'words', placeholder: 'Signer’s name', value: name, onInput: v => { name = v; } })));
      } }, { detent: 'large' });
    sheet.closed.then(() => finish(null));
  });
}

/* ---------- Helpers ---------- */
let invSeq = 2600;
const pbItem = id => data.priceBook.find(x => x.id === id) || { name: id, rate: 0 };
const total = lines => lines.reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0);
/** The person whose signature goes on the invoice: the signed-in driver running this route today, else the route's driver, else whoever creates it. */
function repFor(job) { if (S.shift && S.shift.routeId === job.routeId) return S.me; if (S.me && S.me.role === 'driver') return S.me; return q.driverFor(job.routeId) || S.me; }
/** Starting lines for a job: its containers (with this customer's rates), then a certificate of destruction. */
function linesForJob(job) {
  const lines = (job.items || []).filter(i => i.qty > 0).map(i => ({ name: pbItem(i.id).name, qty: i.qty, rate: i.rate != null ? i.rate : pbItem(i.id).rate }));
  if (!lines.length) lines.push({ name: job.type === 'purge' ? pbItem('box').name : pbItem('console').name, qty: 1, rate: job.type === 'purge' ? 8 : 30 });
  lines.push({ name: pbItem('cod').name, qty: 1, rate: 0 });
  return lines;
}
const methodLabel = f => ({ cash: 'Cash', check: 'Check' + (f.checkNo.trim() ? ' #' + f.checkNo.trim() : ''), card: 'Card (Tap to Pay on iPhone)' })[f.pay];
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
/** o: {pay: 'cash'|..., lines: [...], note, title} — e.g. "Skip and charge" starts with a trip charge; "Mark as paid" starts with cash selected. */
function openEditor(jobId, o = {}) {
  const job = q.job(jobId); if (!job) return;
  if (!canInvoice()) return ui.toast('Your role can’t create invoices', 'lock');
  const cust = q.customer(job.customerId), contact = cust && cust.contacts[0], prev = job.invoice && job.invoice.status === 'Draft' ? job.invoice : null, rep = repFor(job);
  const f = prev ? { lines: prev.lines.map(l => ({ ...l })), po: prev.po || '', contract: prev.contract || '', billTo: prev.billTo || '', includeDate: prev.includeDate !== false, custSig: prev.custSig || null, custName: prev.custName || '', pay: 'none', checkNo: '', note: prev.note || '' }
    : { lines: o.lines || linesForJob(job), po: job.po || (cust && cust.po) || '', contract: job.contract || (cust && cust.contract) || '', billTo: (cust && (cust.billingEmail || (contact && contact.email))) || '', includeDate: true, custSig: null, custName: '', pay: o.pay || 'none', checkNo: '', note: o.note || '' };
  let totalEl = null, sendBtn = null;
  const syncTotal = () => { if (totalEl) totalEl.textContent = fmt.money(total(f.lines), true); if (sendBtn) sendBtn.querySelector('span') && (sendBtn.querySelector('span').textContent = sendLabel()); };
  const sendLabel = () => f.pay === 'none' ? 'Send' : 'Mark paid';
  function lineRow(l, i, p) {
    const num = (k, cls) => h('input.n.' + cls, { type: 'text', inputmode: 'decimal', value: String(l[k]), 'aria-label': k === 'qty' ? 'Quantity' : 'Rate', oninput: e => { const v = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); l[k] = isNaN(v) ? 0 : v; tot.textContent = fmt.money(l.qty * l.rate, true); syncTotal(); } });
    const tot = h('span.bi-tot', fmt.money(l.qty * l.rate, true));
    return h('div.bi-line', h('div.bi-name', h('input', { type: 'text', value: l.name, 'aria-label': 'Description', oninput: e => { l.name = e.target.value; } }),
      h('button.bi-del', { 'aria-label': 'Delete line', onclick: () => { f.lines.splice(i, 1); p.refresh(); } }, icon('bi.minus', 22))),
      h('div.bi-nums', h('span.bi-lab', 'Qty'), num('qty', 'q'), h('span.bi-lab', '× $'), num('rate', 'r'), tot));
  }
  function addLine(el, p) {
    ui.menu(el, [{ header: 'Add a charge' }, ...data.priceBook.map(x => ({ label: x.name, subtitle: fmt.money(x.rate, true), onTap: () => { f.lines.splice(Math.max(0, f.lines.length - (f.lines[f.lines.length - 1] && /Certificate/.test(f.lines[f.lines.length - 1].name) ? 1 : 0)), 0, { name: x.name, qty: 1, rate: x.rate }); p.refresh(); } })),
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
  async function submit(p, draft) {
    if (!f.lines.length) return ui.alert({ title: 'No charges', message: 'Add at least one line, even if it’s $0.' });
    if (!draft) {
      if (!f.custSig) {
        const need = cust && cust.requiresSignature;
        const v = await ui.actionSheet({ title: need ? cust.name + ' requires a customer signature' : 'Get a customer signature?', message: need ? 'It prints on the invoice under “Customer Signature”.' : 'Some customers sign for the service. It prints on the invoice under “Customer Signature”.',
          buttons: [{ label: 'Get signature', value: 'sign' }, { label: need ? 'Continue without signature' : 'No signature needed', value: 'skip', role: need ? 'destructive' : undefined }] });
        if (!v) return; if (v === 'sign' && !(await getCustomerSig(p))) return;
      }
      if (!(await ensureRepSig())) return;
      if (f.pay === 'card') { const hud = ui.hud('Hold card near the top of iPhone'); await WD.delay(1600); hud.set('Approved', 'checkmark'); await WD.delay(650); hud.close(); }
      if (f.pay === 'check' && !f.checkNo.trim()) { const r = await ui.alert({ title: 'Check number', message: 'Optional — helps match the deposit.', input: { placeholder: 'e.g. 4417', type: 'text' }, buttons: [{ label: 'Skip', value: 'skip' }, { label: 'Save', value: 'save', bold: true }] }); if (r && r.value === 'save') f.checkNo = r.text; }
    }
    const amount = total(f.lines), paid = !draft && f.pay !== 'none', number = prev ? prev.number : 'INV-' + (++invSeq), me = S.me.name, method = paid ? methodLabel(f) : null;
    api.op({ kind: 'edit', title: job.title, scope: draft ? 'Invoice draft' : paid ? 'Invoice paid on site' : 'Invoice sent', jobIds: [job.id], apply() {
      job.invoice = { number, status: draft ? 'Draft' : paid ? 'Paid' : 'Sent', amount, auto: false, lines: f.lines.map(l => ({ ...l })), po: f.po.trim(), contract: f.contract.trim(), billTo: f.billTo.trim(), includeDate: f.includeDate, note: f.note,
        repId: rep && rep.id, repName: rep && rep.name, repSig: rep && rep.signature, custSig: f.custSig, custName: f.custName, paid: paid ? { method, at: +WD.now() } : null, sentAt: draft ? null : +WD.now() };
      job.po = f.po.trim(); job.contract = f.contract.trim();
      job.events.push({ at: +WD.now(), actor: me, text: draft ? 'Invoice ' + number + ' saved as draft' : 'Invoice ' + number + ' ' + (paid ? 'paid on site · ' + method : 'sent to ' + (f.billTo || 'the customer')) + ' · ' + fmt.money(amount, true) });
      if (!draft) mirror(job);
    } });
    p.dismiss(); ui.toast(draft ? 'Draft saved' : paid ? 'Paid · receipt sent' : 'Invoice sent', draft ? 'doc.text' : 'checkmark', 2200);
  }
  ui.sheet({ title: prev ? 'Edit invoice' : 'New invoice', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }],
    trailing: () => [{ label: sendLabel(), bold: true, onTap: p => submit(p, false) }],
    render(p) {
      const c = cust, sigNeed = c && c.requiresSignature;
      return ui.list(
        ui.section({ header: (c ? c.name : job.title) + ' · ' + fmt.day(job.day), footer: f.note || 'Change rates and quantities, or add and delete lines for extra charges. Rates start from this customer’s pricing.' },
          f.lines.map((l, i) => lineRow(l, i, p)),
          ui.row({ title: 'Add line', icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', tint: true, onTap: (e, el) => addLine(el, p) }),
          h('div.bi-total', h('span', 'Total'), totalEl = h('span', fmt.money(total(f.lines), true)))),
        ui.section({ header: 'Prints on the invoice', footer: 'PO and contract numbers come from the customer. Changes here apply to this job and invoice only.' },
          ui.inputRow({ label: 'PO number', placeholder: 'None', value: f.po, onInput: v => { f.po = v; } }),
          ui.inputRow({ label: 'Contract', placeholder: 'None', value: f.contract, onInput: v => { f.contract = v; } }),
          ui.inputRow({ label: 'Send to', type: 'email', caps: 'off', placeholder: 'Billing email', value: f.billTo, onInput: v => { f.billTo = v; } })),
        ui.section({ header: 'Signatures', footer: sigNeed ? c.name + ' requires a customer signature on every invoice.' : 'You’ll be asked whether the customer needs to sign before sending.' },
          h('div.bi-sig', h('div.bi-ink', rep && rep.signature ? sigView(rep.signature) : h('span.bi-empty', rep === S.me ? 'Added when you send' : 'No signature on file')),
            h('div.bi-cap', 'Shredding Service Representative Signature' + (rep ? ' · ' + rep.name : '') + (f.includeDate ? ' · Service date ' + fmt.day(job.day, 'md') : ''))),
          ui.toggleRow({ title: 'Include service date', value: f.includeDate, onChange: v => { f.includeDate = v; p.refresh(); } }),
          f.custSig ? h('div.bi-sig', h('div.bi-ink', sigView(f.custSig)), h('div.bi-cap', 'Customer Signature' + (f.custName ? ' · ' + f.custName : '')))
            : ui.row({ title: sigNeed ? 'Get customer signature (required)' : 'Get customer signature', icon: 'signature', iconPlain: true, iconColor: sigNeed ? 'var(--orange)' : 'var(--tint)', tint: true, onTap: () => getCustomerSig(p) }),
          f.custSig && ui.row({ title: 'Sign again', tint: true, onTap: () => getCustomerSig(p) })),
        ui.section({ header: 'Payment', footer: f.pay === 'none' ? 'The invoice is emailed with a pay link.' : 'Marks the invoice paid and emails a receipt. ' + (f.pay === 'card' ? 'Tap to Pay runs through Stripe.' : 'Hand the ' + f.pay + ' to the office.') },
          ui.pickerRow({ title: 'Paid on site', value: f.pay, options: [{ value: 'none', label: 'Not paid — send invoice' }, { value: 'cash', label: 'Cash' }, { value: 'check', label: 'Check' }, { value: 'card', label: 'Credit card' }], onChange: v => { f.pay = v; p.refresh(); } }),
          f.pay === 'check' && ui.inputRow({ label: 'Check #', placeholder: 'Optional', inputmode: 'numeric', value: f.checkNo, onInput: v => { f.checkNo = v; } })),
        ui.section(null, ui.row({ title: 'Preview invoice', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => p.push(previewSpec(() => draftInvoice(job, f, rep))) }),
          ui.row({ title: 'Save as draft', icon: 'tray', iconPlain: true, tint: true, onTap: () => submit(p, true) })));
    } });
}
const draftInvoice = (job, f, rep) => ({ number: (job.invoice && job.invoice.number) || 'Draft', status: 'Draft', amount: total(f.lines), lines: f.lines, po: f.po, contract: f.contract, billTo: f.billTo, includeDate: f.includeDate, repName: rep && rep.name, repSig: rep && rep.signature, custSig: f.custSig, custName: f.custName, paid: null, job });

/* ---------- Invoice preview (what the customer receives) ---------- */
function invoiceDoc(inv, job) {
  const c = q.customer(job.customerId), lines = inv.lines || linesForJob(job), org = (S.org || data.orgs[0]).name;
  return h('div.bi-doc',
    h('div.top', h('div', h('h3', org), h('div.mut', '400 Industrial Way, Lakemont · (512) 555-0300')), h('div', { style: { textAlign: 'right' } }, h('b', 'INVOICE'), h('div.mut', inv.number), h('div.mut', fmt.day(job.day, 'md') + ', ' + job.day.slice(0, 4)))),
    h('div', h('b', 'Bill to'), h('div', c ? c.name : job.title), h('div.mut', job.address || ''), inv.billTo && h('div.mut', inv.billTo)),
    (inv.po || inv.contract) && h('div.refs', inv.po && [h('b', 'PO number'), h('span', inv.po)], inv.contract && [h('b', 'Contract'), h('span', inv.contract)]),
    h('table', h('thead', h('tr', h('th', 'Description'), h('th.r', 'Qty'), h('th.r', 'Rate'), h('th.r', 'Amount'))),
      h('tbody', lines.map(l => h('tr', h('td', l.name), h('td.r', String(l.qty)), h('td.r', fmt.money(l.rate, true)), h('td.r', fmt.money(l.qty * l.rate, true))))),
      h('tfoot', h('tr', h('td', { colspan: 3 }, 'Total'), h('td.r', fmt.money(inv.amount != null ? inv.amount : total(lines), true))))),
    inv.status === 'Paid' && h('div.paid', 'PAID' + (inv.paid ? ' · ' + inv.paid.method : '')),
    h('div.sigs',
      h('div', h('div.sl', sigView(inv.repSig)), h('div.sc', h('span', 'Shredding Service Representative Signature'), h('span', [inv.repName, inv.includeDate !== false ? 'Service date ' + fmt.day(job.day, 'md') + ', ' + job.day.slice(0, 4) : null].filter(Boolean).join(' · ')))),
      (inv.custSig || (c && c.requiresSignature)) && h('div', h('div.sl', sigView(inv.custSig)), h('div.sc', h('span', 'Customer Signature'), h('span', inv.custName || '')))));
}
function previewSpec(get) {
  return { title: 'Invoice preview', render: () => { const inv = get(); return h('div', { style: { padding: '0 4px' } }, invoiceDoc(inv, inv.job)); } };
}
function openInvoice(jobId) {
  const job = q.job(jobId); if (!job || !job.invoice) return;
  if (job.invoice.status === 'Draft') return openEditor(jobId);
  ui.sheet({ title: job.invoice.number, trailing: [{ label: 'Done', bold: true, onTap: p => p.dismiss() }], render: p => {
    const inv = job.invoice, unpaid = inv.status !== 'Paid';
    return ui.list(h('div', { style: { padding: '0 4px' } }, invoiceDoc(inv, job)),
      ui.section(null, unpaid && canInvoice() && ui.row({ title: 'Record payment', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => recordPayment(job) }),
        ui.row({ title: 'Resend to customer', icon: 'envelope', iconPlain: true, tint: true, onTap: () => ui.run('Sending…', null, { done: 'Sent' }) }),
        ui.row({ title: 'Open in Invoice Ninja', icon: 'arrow.up.right', iconPlain: true, tint: true, onTap: () => ui.toast('Opening Invoice Ninja…', 'arrow.up.right') })));
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

/** Rows for the job details Billing section. */
function billingRows(job) {
  const inv = job.invoice, can = canInvoice(), color = { Paid: 'var(--green)', Draft: 'var(--gray)', Sent: 'var(--orange)', Overdue: 'var(--red)' };
  if (inv) return [ui.row({ title: inv.number + ' · ' + fmt.money(inv.amount, true), subtitle: inv.auto ? 'Card on file charged automatically' : inv.status === 'Draft' ? 'Draft — not sent yet' : inv.paid ? 'Paid on site · ' + inv.paid.method : 'Invoice Ninja', icon: 'dollarsign', iconColor: 'var(--green)', badge: ui.badge(inv.status, color[inv.status] || 'var(--orange)'), chevron: inv.lines || inv.status === 'Draft' ? true : false, onTap: inv.lines || inv.status === 'Draft' ? () => openInvoice(job.id) : null }),
    can && inv.status !== 'Paid' && inv.status !== 'Draft' && ui.row({ title: 'Record payment', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => recordPayment(job) })];
  if (!can) return [ui.row({ title: 'Not invoiced yet' })];
  return [ui.row({ title: 'Create invoice…', subtitle: 'Review charges, signatures and payment before sending', icon: 'doc.text', iconPlain: true, tint: true, onTap: () => openEditor(job.id) }),
    ui.row({ title: 'Paid on site…', subtitle: 'Cash, check or credit card', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => openEditor(job.id, { pay: 'cash' }) })];
}

WD.screens.billing = { openEditor, openInvoice, recordPayment, billingRows, signaturePad, sigView, linesForJob, canInvoice };
WD.panel.addJump('Invoice editor', () => { WD.nav.switchTab('board'); const j = data.jobs.filter(x => x.day === D.today() && x.status === 'completed' && !x.invoice && x.customerId).sort(q.order)[0]; if (j) openEditor(j.id); else ui.toast('No completed job without an invoice today'); });
})();
