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
.bi-line input.n { text-align: right; font-variant-numeric: tabular-nums; min-height: 44px; }
.bi-line .bi-name { display: flex; gap: 8px; align-items: center; }
.bi-line .bi-name input { background: none; padding: 2px 0; font-weight: 500; }
.bi-line .bi-tot { flex: 1; font-size: 15px; text-align: right; font-variant-numeric: tabular-nums; color: var(--label); font-weight: 500; }
.bi-line .bi-lab { font-size: 13px; color: var(--label2); letter-spacing: 0; }
.bi-del { border: 0; background: none; padding: 0; color: var(--red); cursor: pointer; line-height: 0; justify-self: end; flex: none; width: 44px; height: 44px; margin: -9px -11px -9px 0; display: grid; place-items: center; }
.bi-jump .btn, .bi-dbar .btn, .bi-dest .btn.small { min-height: 44px; }
.bi-ask { padding: 12px 16px 12px; }
.bi-askq { font-size: 16px; font-weight: 600; letter-spacing: -.3px; line-height: 21px; margin-bottom: 10px; color: var(--label); }
.bi-ask.need .bi-askq { color: var(--red); }
.bi-first { display: flex; gap: 10px; align-items: flex-start; margin: 0 12px 12px; padding: 11px 12px; border-radius: 11px; background: color-mix(in srgb, var(--orange) 16%, var(--cell)); border: 1px solid color-mix(in srgb, var(--orange) 55%, transparent); color: var(--label); font-size: 15px; line-height: 20px; font-weight: 600; letter-spacing: -.2px; }
.bi-first .ic { color: var(--orange); flex: none; margin-top: 1px; }
.bi-dbar { display: flex; gap: 8px; margin: 10px 0 0; } .bi-dbar .btn { flex: 1 1 0; min-width: 0; white-space: nowrap; font-size: 15px; padding: 0 8px; }
.bi-dest .row-acts { display: flex; align-items: center; }
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
.bi-tab { width: 100%; border-collapse: collapse; font-size: 12px; line-height: 15px; }
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
.bi-doc .sc { font-size: 12px; color: #3a3a3c; margin-top: 3px; display: flex; justify-content: space-between; gap: 8px; }
.bi-cod { margin-top: 14px; } .bi-cod b { font-size: 19px; } .bi-cod p { margin: 6px 10px 0; text-align: center; font-style: italic; font-size: 14.5px; line-height: 20px; }
.bi-pg { text-align: center; margin-top: 30px; font-size: 13px; }
.bi-acts { display: flex; flex-direction: column; gap: 10px; margin: 18px 0 6px; }
.bn-doc { width: 660px; min-height: 854px; display: flex; flex-direction: column; box-sizing: border-box; background: #fff; color: #1c1c1e; margin: 0 auto 18px; padding: 40px 56px 30px; box-shadow: 0 2px 14px rgba(0,0,0,.16); font: 13px/16px Georgia, 'Times New Roman', serif; letter-spacing: 0; }
.bn-top, .bn-mid, .bn-bot { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
.bn-top .bn-co { line-height: 19px; } .bn-top .bi-logo { margin-top: 0; }
.bn-mid { margin-top: 34px; } .bn-mid .bn-to { line-height: 16px; padding-top: 4px; }
.bn-ttl { color: #1E7B34; font-size: 23px; line-height: 26px; margin-bottom: 4px; }
.bn-meta { display: grid; grid-template-columns: auto auto; gap: 1px 14px; }
.bn-tab { width: 100%; border-collapse: collapse; margin-top: 28px; }
.bn-tab th { background: #f4f4f4; text-align: left; font-weight: 700; padding: 13px 10px; vertical-align: middle; }
.bn-tab td { padding: 12px 10px; border-bottom: 1px solid #ddd; vertical-align: middle; }
.bn-tab tbody tr:nth-child(even) td { background: #f4f4f4; }
.bn-tab th:first-child { width: 21%; } .bn-tab .r { text-align: right; } .bn-tab .n { white-space: nowrap; }
.bn-bot { margin-top: 12px; }
.bn-sig { position: relative; flex: 1; min-height: 110px; padding-top: 6px; }
.bn-sig .bn-ink { height: 62px; display: flex; align-items: flex-end; } .bn-sig .bn-ink img, .bn-sig .bn-ink svg { max-height: 60px; max-width: 200px; color: #1c1c1e; }
.bn-sig .bn-cap { font-size: 12px; line-height: 14px; color: #555; margin: 2px 0 6px; }
.bn-stamp { position: absolute; left: 4px; top: 10px; transform: rotate(-6deg); border: 4px double #f3b6bd; color: #f3b6bd; font: 800 42px/50px Helvetica, Arial, sans-serif; letter-spacing: 2px; padding: 12px 26px; pointer-events: none; }
.bn-tot { width: 250px; flex: none; } .bn-tot div { display: flex; justify-content: space-between; padding: 5px 9px; font-weight: 700; } .bn-tot div.x { font-weight: 400; } .bn-tot div.due { background: #e5e5e5; padding: 8px 9px; margin-top: 3px; }
.bn-doc .bi-scan { font-family: -apple-system, Helvetica, sans-serif; margin-top: 12px; }
.bn-fill { flex: 1; min-height: 30px; }
.bn-cod { border-top: 1.5px solid #000; padding-top: 8px; } .bn-cod b { font-size: 14px; display: block; }
.bi-doc .sc { font-size: 12px; color: #3a3a3c; margin-top: 3px; display: flex; justify-content: space-between; gap: 8px; }
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
/* Sales tax (Settings → Sales tax) is off unless the company turns it on. Wording comes from Settings → Business type and wording. */
const taxInfo = (lines, cust) => WD.taxInfo ? WD.taxInfo(lines, cust) : { tax: 0, rate: 0, label: '' };
const biz = () => data.biz || {}, repTitle = () => biz().repTitle || 'Shredding Service Representative';
/** The person whose signature goes on the invoice: the signed-in driver running this route today, else the route's driver, else whoever creates it. */
function repFor(job) { if (S.shift && S.shift.routeId === job.routeId) return S.me; if (S.me && S.me.role === 'driver') return S.me; return q.driverFor(job.routeId) || S.me; }
/** Starting lines for a job: its containers, with this customer's rates. */
function linesForJob(job) {
  const lines = (job.items || []).filter(i => i.qty > 0).map(i => ({ id: i.id, name: pbItem(i.id).name, qty: i.qty, rate: i.rate != null ? i.rate : pbItem(i.id).rate }));
  if (!lines.length) lines.push(job.type === 'purge' ? (data.purgePricing.method === 'bin' ? { id: 'binFlat', name: pbItem('binFlat').name, qty: 1, rate: data.purgePricing.binFlat } : { id: 'box', name: pbItem('box').name, qty: 1, rate: pbItem('box').rate }) : { id: 'console', name: pbItem('console').name, qty: 1, rate: 30 });
  return lines;   /* The certificate of destruction prints on every invoice, so it isn't a line. */
}
/* First delivery to a new customer (a Setup / First Service job, or any job flagged “New setup”): the invoice itemizes every container
   delivered at $0.00, and asks whether anything was shredded today. If it was, the normal service lines are charged as well. */
const DELIVERABLE = ['console', 'bin64', 'bin96'], capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const isFirstDelivery = job => job.type === 'setup' || !!(job.flags && job.flags.setup);
function firstLines(job, shredded) {
  const got = (job.items || []).filter(i => DELIVERABLE.includes(i.id) && i.qty > 0).map(i => ({ name: capFirst(pbItem(i.id).unit) + ' delivered', qty: i.qty, rate: 0, first: 'delivered' }));
  if (!got.length) got.push({ name: 'Containers delivered', qty: 1, rate: 0, first: 'delivered' });
  return (shredded ? linesForJob(job).map(l => ({ ...l, first: 'service' })) : []).concat(got);
}
const FIRST_NOTE = 'Ask the customer to check that this first invoice reached them — every invoice after this arrives the same way.';
/* Off-site destruction (Settings → Business type and wording): the truck only collects, so the certificate of destruction waits until
   someone at the plant confirms the material was destroyed. The state lives on the job: job.destruction = {status: 'pending' | 'confirmed', day, by, pounds, at}. */
const offsite = () => biz().industry === 'shredding' && biz().destroy === 'offsite';
const canConfirmDestroyed = () => WD.can('billing.manage') || WD.can('jobs.edit');
const PROOF_WAIT = 'Certificate of destruction to follow once destruction is confirmed.';
const methodLabel = f =>({ cash: 'Cash', check: 'Check' + (f.checkNo.trim() ? ' #' + f.checkNo.trim() : ''), card: 'Card (Tap to Pay on iPhone)', other: (f.other || '').trim() || 'Other' })[f.pay];
const canInvoice = () => WD.can('billing.field') || WD.can('billing.manage');

/** Mirror an invoice into the customer billing records (Customers → Invoices). */
function mirror(job) {
  const inv = job.invoice; if (!data.invoices || !job.customerId) return;
  let rec = data.invoices.find(x => x.jobId === job.id);
  if (!rec) { rec = { id: 'inv-f' + inv.number, number: inv.number, customerId: job.customerId, jobId: job.id, day: job.day, payments: [], at: +WD.now(), auto: false }; data.invoices.push(rec);
    const c = q.customer(job.customerId); if (c && c.stats && inv.status !== 'Draft') { c.stats.invoiced += inv.amount; c.successful = true; if (!c.stats.firstInvoice) c.stats.firstInvoice = job.day; } }
  Object.assign(rec, { amount: inv.amount, status: inv.status, lines: inv.lines, tax: inv.tax, taxLabel: inv.taxLabel, taxes: inv.taxes });
  if (inv.status === 'Paid' && inv.paid && !rec.payments.length && data.payments) { const pay = { id: 'pay-f' + inv.number, invoiceId: rec.id, customerId: job.customerId, at: inv.paid.at, amount: inv.amount, method: inv.paid.method + ' · on site' }; data.payments.push(pay); rec.payments.push(pay.id); const c = q.customer(job.customerId); if (c && c.stats) c.stats.paid += inv.amount; }
}

/* ---------- Invoice editor ---------- */
/** o: {pay, lines, note, flow, onDone} — e.g. "Skip and charge" starts with a trip charge; "Mark as paid" starts with cash selected.
    flow: opened by Complete stop (billing details first, then Get signature / Create invoice). onDone runs after it's billed.
    Customers billed by service note (monthly master invoice) get a signed service note instead of an invoice. */
function openEditor(jobId, o = {}) {
  const job = q.job(jobId); if (!job) return;
  if (!canInvoice()) return ui.toast('Your role can’t create invoices', 'lock');
  const wf = WD.workflow || {}, cust = q.customer(job.customerId), contact = cust && (cust.contacts || [])[0], prev = job.invoice && job.invoice.status === 'Draft' ? job.invoice : null, rep = repFor(job);
  const note = !!(cust && cust.billingMode === 'serviceNote' && !o.lines), firstJob = !note && !o.lines && isFirstDelivery(job), shredding = biz().industry === 'shredding' || !biz().industry, pol = note ? 'always' : WD.sigPolicy(cust), poOf = day => wf.poFor && cust && cust.poSchedule && cust.poSchedule.length ? wf.poFor(cust, day).po : null;
  /* Scans are kept on the job, so anything scanned at the stop before billing is already here. */
  const JS = WD.jobScans ? WD.jobScans(job) : { containers: [], containerNote: '', drives: [], driveNote: '' };
  if (prev) { if (!JS.containers.length) JS.containers.push(...(prev.scans || [])); if (!JS.drives.length) JS.drives.push(...(prev.drives || [])); }
  const f = prev ? { lines: prev.lines.map(l => ({ ...l })), po: prev.po || '', contract: prev.contract || '', billTo: prev.billTo || '', includeDate: prev.includeDate !== false, serviceDate: prev.serviceDate || job.day, scans: JS.containers, scanNote: JS.containerNote || prev.scanNote || '', drives: JS.drives, driveScan: prev.driveScan != null ? prev.driveScan : !!job.hddScan, driveNote: JS.driveNote || prev.driveNote || '', custSig: prev.custSig || null, custName: prev.custName || '', pounds: prev.pounds || '', pay: 'none', checkNo: '', other: '', note: prev.note || '', first: prev.first || null, firstAck: !!prev.firstAck }
    : { lines: o.lines || (firstJob ? firstLines(job, false) : linesForJob(job)), first: null, firstAck: false, po: poOf(job.day) != null ? poOf(job.day) : job.po || (cust && cust.po) || '', contract: job.contract || (cust && cust.contract) || '', billTo: (cust && (cust.billingEmail || (contact && contact.email))) || '', includeDate: true, serviceDate: job.day, scans: JS.containers, scanNote: JS.containerNote, drives: JS.drives, driveScan: !!job.hddScan, driveNote: JS.driveNote, custSig: null, custName: '', pounds: '', pay: o.pay || 'none', checkNo: '', other: '', note: o.note || '' };
  let totalEl = null, taxEl = null;
  const FIRST_Q = shredding ? 'Did you shred today, or only drop off the containers?' : 'Did you do the service today, or only drop off the containers?', FIRST_OPTS = [{ value: 'drop', label: 'Dropped off only' }, { value: 'shred', label: shredding ? 'Shredded today' : 'Serviced today' }];
  /** Rebuild the automatic lines for the answer; lines the driver added by hand are kept. */
  const setFirst = (v, p) => { f.first = v; f.lines = firstLines(job, v === 'shred').concat(f.lines.filter(l => !l.first)); p.refresh(); };
  /* Off site: whatever was collected today waits for the plant to confirm it was destroyed. Nothing is collected on a drop-off or a trip charge. */
  const collects = () => offsite() && !o.lines && !(firstJob && f.first === 'drop');
  /* Container barcodes (Settings → Container barcodes): scan each container at the stop to prove service. */
  const tags = WD.co && WD.co.scanFor(job) ? WD.co.containers(job) : [], scanShort = () => tags.length > 0 && f.scans.length < tags.length && !f.scanNote;
  /* Hard drives: when this job asks for it, each drive's barcode or serial number is scanned before it is destroyed. */
  const hddQty = () => f.lines.filter(l => l.id === 'hdd').reduce((s, l) => s + (+l.qty || 0), 0), driveShort = () => f.driveScan && hddQty() > 0 && f.drives.length < hddQty() && !f.driveNote;
  const syncTotal = () => { const t = taxInfo(f.lines, cust); if (taxEl) taxEl.textContent = fmt.money(t.tax, true); if (totalEl) totalEl.textContent = fmt.money(total(f.lines) + t.tax, true); };
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
    const r = await signaturePad({ title: 'Your signature', subtitle: 'Saved on file and printed on every invoice you create, under “' + repTitle() + ' Signature”.' });
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
      if (firstJob && !f.first) { const v = await ui.actionSheet({ title: FIRST_Q, message: 'The first invoice lists every container delivered at $0.00. ' + (shredding ? 'Shredding' : 'Service') + ' done today is charged at the normal rates.', buttons: FIRST_OPTS.map(x => ({ label: x.label, value: x.value })) }); if (!v) return; setFirst(v, p); return ui.toast('Check the lines, then create the invoice', 'doc.text', 2600); }
      if (firstJob && !f.firstAck) { const v = await ui.actionSheet({ title: 'First invoice for this customer', message: FIRST_NOTE, buttons: [{ label: 'I asked them', value: 'yes' }, { label: 'Nobody was there to ask', value: 'no' }] }); if (!v) return; f.firstAck = v === 'yes'; }
      /* A price changed on the invoice can become the customer's price for this and all future visits. */
      if (!o.lines && !(await WD.x.priceChangePrompt(job, f.lines))) return;
      if (scanShort() && WD.co.scanRequired(job)) {
        const v = await ui.actionSheet({ title: f.scans.length + ' of ' + tags.length + ' containers scanned', message: 'Every container is scanned to prove it was serviced.', buttons: [{ label: 'Scan containers', value: 'scan' }, { label: 'A label is missing or damaged…', value: 'why' }] });
        if (v === 'scan') return WD.co.scanSheet(job, f.scans, () => p.refresh());
        if (v !== 'why') return; const r = await ui.alert({ title: 'What happened?', input: { placeholder: 'e.g. Label torn off console 2' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return; f.scanNote = JS.containerNote = r.text.trim();
      }
      if (driveShort() && WD.ops) {
        const v = await ui.actionSheet({ title: f.drives.length + ' of ' + hddQty() + ' hard drives scanned', message: 'This job asks for every drive’s serial number.', buttons: [{ label: 'Scan hard drives', value: 'scan' }, { label: 'A drive has no readable label…', value: 'why' }] });
        if (v === 'scan') return WD.ops.scanDrives(job, f.drives, hddQty(), () => p.refresh());
        if (v !== 'why') return; const r = await ui.alert({ title: 'What happened?', input: { placeholder: 'e.g. 2 drives had no label' }, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', value: true, bold: true }] }); if (!r || !r.value || !r.text.trim()) return; f.driveNote = JS.driveNote = r.text.trim();
      }
      if (sigMissing()) {
        const v = await ui.actionSheet({ title: (cust ? cust.name : 'This customer') + ' requires a signature', message: note ? 'Service notes are always signed by the site contact.' : 'Set in the customer’s settings: always required.', buttons: [{ label: 'Get signature', value: 'sign' }] });
        if (v !== 'sign' || !(await getCustomerSig(p))) return;
      }
      if (!(await ensureRepSig())) return;
      if (!note && f.pay === 'card') { const hud = ui.hud('Hold card near the top of iPhone'); await WD.delay(1600); hud.set('Approved', 'checkmark'); await WD.delay(650); hud.close(); }
      if (!note && f.pay === 'check' && !f.checkNo.trim()) { const r = await ui.alert({ title: 'Check number', message: 'Optional — helps match the deposit.', input: { placeholder: 'e.g. 4417', type: 'text' }, buttons: [{ label: 'Skip', value: 'skip' }, { label: 'Save', value: 'save', bold: true }] }); if (r && r.value === 'save') f.checkNo = r.text; }
    }
    const tx = note ? { tax: 0 } : taxInfo(f.lines, cust), amount = total(f.lines) + tx.tax, me = S.me.name;
    if (note && !draft) {
      let sn = null;
      api.op({ kind: 'edit', title: job.title, scope: 'Service note', jobIds: [job.id], apply() {
        sn = wf.addServiceNote(job, { lines: f.lines, po: f.po.trim(), signer: f.custName, sig: f.custSig, day: f.serviceDate, pounds: f.pounds || null, scans: f.scans.slice(), scanNote: f.scanNote, drives: f.driveScan ? f.drives.slice() : [], driveNote: f.driveNote });
        job.billing = { kind: 'serviceNote', number: sn.number, amount, at: +WD.now(), by: me, signer: f.custName }; job.po = f.po.trim(); if (collects() && !job.destruction) job.destruction = { status: 'pending', at: +WD.now() };
        job.events.push({ at: +WD.now(), actor: me, text: 'Service note ' + sn.number + ' signed by ' + (f.custName || 'customer') + ' · ' + fmt.money(amount, true) + ' · added to the master invoice' + (sn.emailedTo ? ' · emailed to ' + sn.emailedTo : '') }); } });
      return finish(p, (sn ? sn.number : 'Service note') + ' saved' + (sn && sn.emailedTo ? ' · emailed to ' + sn.emailedTo : '') + ' · added to the master invoice', 'tray');
    }
    const paid = !draft && f.pay !== 'none', number = prev ? prev.number : WD.nextInvoiceNumber ? WD.nextInvoiceNumber() : 'INV-' + (++invSeq), method = paid ? methodLabel(f) : null, waits = !draft && collects();
    api.op({ kind: 'edit', title: job.title, scope: draft ? 'Invoice draft' : paid ? 'Invoice paid on site' : 'Invoice created', jobIds: [job.id], apply() {
      job.invoice = { number, status: draft ? 'Draft' : paid ? 'Paid' : 'Sent', amount, tax: tx.tax, taxRate: tx.rate, taxLabel: tx.label, taxes: tx.taxes, auto: false, lines: f.lines.map(l => ({ ...l })), po: f.po.trim(), contract: f.contract.trim(), billTo: f.billTo.trim(), includeDate: f.includeDate, serviceDate: f.serviceDate, pounds: f.pounds || null, note: f.note, scans: f.scans.slice(), scanNote: f.scanNote, drives: f.driveScan ? f.drives.slice() : [], driveScan: f.driveScan, driveNote: f.driveNote,
        repId: rep && rep.id, repName: rep && rep.name, repSig: rep && rep.signature, custSig: f.custSig, custName: f.custName, paid: paid ? { method, at: +WD.now() } : null, sentAt: draft ? null : +WD.now(), first: firstJob ? f.first : null, firstAck: firstJob ? !!f.firstAck : null };
      job.po = f.po.trim(); job.contract = f.contract.trim();
      job.events.push({ at: +WD.now(), actor: me, text: draft ? 'Invoice ' + number + ' saved as draft' : 'Invoice ' + number + ' ' + (paid ? 'paid on site · ' + method : 'created and sent to ' + (f.billTo || 'the customer')) + ' · ' + fmt.money(amount, true) });
      if (firstJob && !draft) job.events.push({ at: +WD.now(), actor: me, text: 'First delivery — ' + (f.first === 'shred' ? (shredding ? 'shredded' : 'serviced') + ' today, charged at the normal rates' : 'containers dropped off only, no charge') + ' · containers delivered listed at $0.00 · ' + (f.firstAck ? '☑ asked the customer to check that this first invoice reached them' : '☐ customer not asked to check for the first invoice — the office should follow up') });
      if (waits && !job.destruction) { job.destruction = { status: 'pending', at: +WD.now() }; job.events.push({ at: +WD.now(), actor: me, text: 'Material taken off site · destruction not yet confirmed · the certificate of destruction follows once it is' }); }
      if (!draft) mirror(job);
    } });
    if (draft) { p.dismiss(); return ui.toast('Draft saved', 'doc.text'); }
    finish(p, (paid ? number + ' paid · receipt sent' : number + ' created and sent') + (waits ? ' · certificate follows once destruction is confirmed' : ''));
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
      const sigSec = pol !== 'never' && ui.section({ header: 'Customer signature', footer: pol === 'always' ? (note ? 'Service notes are always signed.' : c.name + ' always requires a signature.') + ' Create unlocks once they sign.' : 'Optional for this customer. Get a signature if they want to sign.' },
          f.custSig ? [h('div.bi-sig', h('div.bi-ink', sigView(f.custSig)), h('div.bi-cap', 'Customer Signature' + (f.custName ? ' · ' + f.custName : ''))), ui.row({ title: 'Sign again', tint: true, onTap: () => getCustomerSig(p) })]
            : ui.row({ title: pol === 'always' ? 'Signature required' : 'No signature yet', icon: 'signature', iconPlain: true, iconColor: pol === 'always' ? 'var(--orange)' : 'var(--label3)' }));
      return ui.list(
        /* One tap brings the signature into view, without scrolling past the lines, service details and payment. */
        sigSec && h('div.bi-jump', ui.button(f.custSig ? 'Signed' + (f.custName ? ' · ' + f.custName : '') : pol === 'always' ? 'Signature required' : 'Signature', { kind: f.custSig ? 'gray' : pol === 'always' ? 'filled' : 'tinted', small: true, block: false, icon: f.custSig ? 'checkmark' : 'signature', onTap: () => p.body.scrollTo({ top: sigSec.offsetTop - 8, behavior: 'smooth' }) }),
          !f.custSig && ui.button('Sign now', { kind: 'gray', small: true, block: false, icon: 'pencil', onTap: () => getCustomerSig(p) })),
        firstJob && ui.section({ header: 'First delivery to this customer', fold: false, showFooter: true, footer: f.first === 'drop' ? 'Each container delivered is its own line at $0.00. Nothing is charged for today.' : f.first === 'shred' ? 'Today’s ' + (shredding ? 'shredding' : 'service') + ' is charged at this customer’s normal rates. The containers delivered are still listed at $0.00.' : 'Choose one before creating the invoice. Either way, every container delivered is listed at $0.00.' },
          h('div.bi-ask' + (f.first ? '' : '.need'), h('div.bi-askq', FIRST_Q), ui.segmented(FIRST_OPTS, f.first, v => setFirst(v, p))),
          h('div.bi-first', { role: 'note' }, icon('envelope', 22), h('span', FIRST_NOTE)),
          ui.toggleRow({ title: 'I asked the customer to check for it', subtitle: 'Recorded on the job', value: !!f.firstAck, onChange: v => { f.firstAck = v; } })),
        collects() && h('div', { style: 'padding:4px 4px 0' }, ui.note('Material is destroyed off site. This invoice prints “' + PROOF_WAIT + '” The certificate is sent when the plant confirms it.')),
        note && h('div', { style: 'padding:4px 4px 0' }, ui.note((c ? c.name : 'This customer') + ' gets one master invoice a month. This visit is saved as a signed service note and added to it in the database.')),
        ui.section({ header: (c ? c.name : job.title) + (job.address ? ' · ' + job.address.split(',')[0] : ''), footer: f.note || 'Adjust quantities, rates and line items. Rates start from this customer’s pricing.' },
          f.lines.map((l, i) => lineRow(l, i, p)),
          f.lines.some(l => l.id === 'binFlat') && (bins => ui.row({ title: '65-gallon bins shredded', subtitle: fmt.money(data.purgePricing.binFlat) + ' covers the first ' + data.purgePricing.binIncluded + ', then ' + fmt.money(data.purgePricing.binExtra) + ' each', detail: String(bins),
            trailing: ui.stepper(bins, 1, 200, v => { const at = f.lines.findIndex(l => l.id === 'binFlat'); f.lines = f.lines.filter(l => l.id !== 'binFlat' && l.id !== 'binExtra'); f.lines.splice(at, 0, ...WD.binLines(v).map(x => ({ ...x, name: pbItem(x.id).name }))); p.refresh(); }) }))(data.purgePricing.binIncluded + ((f.lines.find(l => l.id === 'binExtra') || {}).qty || 0) - (((f.lines.find(l => l.id === 'binFlat') || {}).bins || data.purgePricing.binIncluded) < data.purgePricing.binIncluded ? data.purgePricing.binIncluded - f.lines.find(l => l.id === 'binFlat').bins : 0)),
          ui.row({ title: 'Add line', icon: 'plus.circle.fill', iconPlain: true, iconColor: 'var(--green)', tint: true, onTap: (e, el) => addLine(el, p) }),
          (t => [taxEl = null, !note && t.rate > 0 && h('div.bi-total', { style: 'font-weight:400;font-size:15px;padding-bottom:0' }, h('span', t.label), taxEl = h('span', fmt.money(t.tax, true))), h('div.bi-total', h('span', 'Total'), totalEl = h('span', fmt.money(total(f.lines) + (note ? 0 : t.tax), true)))])(taxInfo(f.lines, cust))),
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
        hddQty() > 0 && WD.ops && ui.section({ header: 'Hard drives', footer: f.driveScan ? (f.driveNote ? 'Not all scanned: ' + f.driveNote : 'The serial numbers print on the invoice as proof each drive was destroyed.') : 'Counted and destroyed without scanning. Switch on if this customer needs the serial numbers.' },
          ui.toggleRow({ title: 'Scan each drive', subtitle: 'Barcode or serial number, for this job', value: f.driveScan, onChange: v => { f.driveScan = job.hddScan = v; p.refresh(); } }),
          f.driveScan && ui.row({ icon: f.drives.length >= hddQty() ? 'checkmark.circle.fill' : 'barcode', iconPlain: true, iconColor: f.drives.length >= hddQty() ? 'var(--green)' : 'var(--orange)', title: 'Scan hard drives', subtitle: f.drives.length + ' of ' + hddQty() + ' scanned', chevron: true, onTap: () => WD.ops.scanDrives(job, f.drives, hddQty(), () => p.refresh()) })),
        sigSec,
        !note && ui.section({ header: 'Payment', footer: f.pay === 'none' ? 'The invoice is emailed with a pay link.' : 'Marks the invoice paid and emails a receipt. ' + (f.pay === 'card' ? 'Tap to Pay runs through Stripe.' : 'Hand the ' + (f.pay === 'other' ? 'payment' : f.pay) + ' to the office.') },
          ui.pickerRow({ title: 'Paid on site', value: f.pay, options: [{ value: 'none', label: 'Not paid — send invoice' }, { value: 'cash', label: 'Cash' }, { value: 'check', label: 'Check' }, { value: 'card', label: 'Credit card' }, { value: 'other', label: 'Other' }], onChange: v => { f.pay = v; p.refresh(); } }),
          f.pay === 'check' && ui.inputRow({ label: 'Check #', placeholder: 'Optional', inputmode: 'numeric', value: f.checkNo, onInput: v => { f.checkNo = v; } }),
          f.pay === 'other' && ui.inputRow({ label: 'Paid by', placeholder: 'e.g. ACH, Venmo', value: f.other, onInput: v => { f.other = v; } }),
          !prev && wf.paidNoInvoice && ui.row({ title: 'Paid — no invoice…', subtitle: 'Customer paid and doesn’t want an invoice', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: async () => { if (await wf.paidNoInvoice(job, total(f.lines))) { p.dismiss(); if (o.onDone) setTimeout(o.onDone, 350); } } })),
        h('div.bi-acts', pol !== 'never' && !f.custSig && ui.button('Get signature', { kind: pol === 'always' ? 'filled' : 'gray', icon: 'signature', onTap: () => getCustomerSig(p) }),
          ui.button(createLabel(), { kind: sigMissing() ? 'gray' : 'filled', icon: note ? 'tray' : 'doc.text', onTap: () => submit(p, false) })),
        ui.section(null, !note && ui.row({ title: 'Preview invoice', icon: 'doc.text', iconPlain: true, tint: true, chevron: true, onTap: () => p.push(previewSpec(() => draftInvoice(job, f, rep))) }),
          !note && ui.row({ title: 'Save as draft', icon: 'tray', iconPlain: true, tint: true, onTap: () => submit(p, true) }),
          h('div.bi-sig', h('div.bi-ink', rep && rep.signature ? sigView(rep.signature) : h('span.bi-empty', rep === S.me ? 'Added when you create it' : 'No signature on file')), h('div.bi-cap', repTitle() + ' Signature' + (rep ? ' · ' + rep.name : '')))));
    } });
}
const draftInvoice = (job, f, rep) => ({ number: (job.invoice && job.invoice.number) || 'Draft', status: 'Draft', ...(t => ({ tax: t.tax, taxLabel: t.label }))(taxInfo(f.lines, q.customer(job.customerId))), amount: total(f.lines), lines: f.lines, po: f.po, contract: f.contract, billTo: f.billTo, includeDate: f.includeDate, serviceDate: f.serviceDate, pounds: f.pounds || null, scans: f.scans, scanNote: f.scanNote, drives: f.driveScan ? f.drives : [], driveNote: f.driveNote, repName: rep && rep.name, repSig: rep && rep.signature, custSig: f.custSig, custName: f.custName, paid: null, first: f.first, job });

/* ---------- Invoice document (what the customer receives) ----------
   Layout follows the company's invoice: logo and "Invoice" with Account / Invoice # / Date, Bill To (with Attn), Please Remit To,
   Service Location / Terms / Agreement, a SERVICE SUMMARY table (Date, Location, Description, Qty, Price, Pounds, Amount) grouped by
   location, a subtotal of bins, pounds and amount on every page, Total DUE on the last page, and the certificate of destruction. */
const DESC = { console: 'Consoles of Shredding', bin64: '64 Gallon Containers of Shredding', bin96: '96 Gallon Containers of Shredding', box: 'Boxes of Shredding' };
const descOf = l => l.id && DESC[l.id] ? l.qty + ' - ' + DESC[l.id] : l.name;
const mdy = day => { const d = D.parse(day); return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear(); };
const money2 = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ROWS_PER_PAGE = 30;
/** The certificate wording for a document. d is the job's destruction record: waiting → “to follow”; confirmed → the usual certificate with the destruction date. */
const proofLine = (d, text) => d && d.status === 'pending' ? PROOF_WAIT : text + (d && d.status === 'confirmed' ? ' Destruction confirmed ' + mdy(d.day) + (d.pounds ? ' · ' + Number(d.pounds).toLocaleString('en-US') + ' lb' : '') + (d.by ? ' · ' + d.by : '') + '.' : '');
/** Rows for one visit: one row per line, pounds on the first container line. */
function visitRows(day, location, lines, pounds) {
  let lb = pounds; return lines.filter(l => l.qty || l.rate).map(l => { const bin = WD.CONTAINERS.includes(l.id), row = { day, location, desc: descOf(l), qty: +l.qty || 0, rate: +l.rate || 0, bins: bin ? +l.qty || 0 : 0, pounds: bin && lb ? lb : null }; if (bin && lb) lb = null; return row; });
}
function logo() {
  const org = S.org || data.orgs[0], name = org.name, [first, ...rest] = name.split(' '); if (org.logo) return h('div.bi-logo', h('img', { src: org.logo, alt: name, style: 'max-height:54px;max-width:170px' }));
  return h('div.bi-logo', icon('repeat', 40, '#3A9B3A'), h('div', h('i', first), h('b', rest.join(' ').toUpperCase() || first.toUpperCase())));
}
/** o: {number, date, customer, billTo, attn, serviceLocation, terms, agreement, po, rows, paid, sigs} → one element per page. */
function invoicePages(o) {
  const org = S.org || data.orgs[0], remit = org.remit || [org.name.toUpperCase()], c = o.customer || {};
  const pages = []; let cur = [];
  o.rows.forEach((r, i) => { if (r.gap && !cur.length) return; cur.push(r); if (cur.length >= ROWS_PER_PAGE && i < o.rows.length - 1) { pages.push(cur); cur = []; } });
  if (cur.length || !pages.length) pages.push(cur);
  const all = o.rows.filter(r => !r.gap), tax = +o.tax || 0, totAmt = all.reduce((s, r) => s + r.qty * r.rate, 0) + tax, N = pages.length;
  const meta = pairs => h('div.bi-meta', pairs.filter(p => p[1]).map(([k, v]) => [h('b', k + ':'), h('span', v)]));
  return pages.map((rows, pi) => {
    const real = rows.filter(r => !r.gap), bins = real.reduce((s, r) => s + r.bins, 0), lbs = real.reduce((s, r) => s + (r.pounds || 0), 0), amt = real.reduce((s, r) => s + r.qty * r.rate, 0), last = pi === N - 1;
    let prevLoc = null;
    return h('div.bi-doc',
      h('div.bi-top', logo(), h('div', h('div.bi-ttl', 'Invoice'), meta([['Account', c.account || (c.name || '').toUpperCase()], ['Invoice #', o.number], ['Date', mdy(o.date)], ['Revised', o.revised]]))),
      h('div.bi-addr', h('div', h('b', 'Bill To:'), (o.billTo || []).map(x => h('div', x))), h('div', h('b', 'Please Remit To:'), remit.map(x => h('div', x))),
        meta([['Service Location', o.serviceLocation], ['Terms', o.terms || 'Net 30'], ['Agreement', o.agreement], ['PO', o.po]])),
      h('div.bi-sumh', 'SERVICE SUMMARY'),
      h('table.bi-tab', h('thead', h('tr', ['Date', 'Location', 'Description', 'Qty', 'Price', 'Pounds', 'Amount'].map((t, k) => h('th' + (k >= 3 ? '.r' : ''), t)))),
        h('tbody', rows.map(r => { if (r.gap) return h('tr.gap', h('td', { colspan: 7 })); const same = r.location === prevLoc; prevLoc = r.location;
          return h('tr', h('td', mdy(r.day)), h('td.c', r.location), h('td.c', r.desc), h('td.r', String(r.qty)), h('td.r', money2(r.rate)), h('td.r', r.pounds != null ? String(r.pounds) : ''), h('td.r', money2(r.qty * r.rate))); })),
        h('tfoot', h('tr', h('td', { colspan: 2 }), h('td.r.sub', N > 1 ? 'Subtotal Page ' + (pi + 1) : 'Subtotal'), h('td.r.sub', String(bins)), h('td.sub', real.some(r => r.bins && !/Gallon/.test(r.desc)) ? 'Units' : 'Bins'), h('td.r.sub', lbs ? lbs.toLocaleString('en-US') : ''), h('td.r.sub', money2(amt))),
          last && tax > 0 && h('tr', h('td', { colspan: 2 }), h('td', { colspan: 3, class: 'r' }, o.taxLabel || 'Sales tax'), h('td', { colspan: 2, class: 'r' }, money2(tax))),
          last && h('tr.due', h('td', { colspan: 2 }), h('td', { colspan: 3, class: 'r' }, 'Total DUE This Invoice'), h('td', { colspan: 2, class: 'r' }, o.paid ? '$0.00' : money2(totAmt))))),
      last && o.paid && h('div.paid', 'PAID' + (o.paid.method ? ' · ' + o.paid.method : '') + ' · ' + money2(totAmt)),
      last && o.scans && o.scans.length > 0 && h('div.bi-scan', h('b', 'CONTAINERS SERVICED (BARCODE SCANS): '), o.scans.map(s => s.code + ' ' + fmt.clock(new Date(s.at))).join(' · ') + (o.scanNote ? ' · Note: ' + o.scanNote : '')),
      last && o.drives && o.drives.length > 0 && h('div.bi-scan', h('b', 'HARD DRIVES DESTROYED (SERIAL NUMBERS): '), o.drives.map(s => s.code).join(' · ') + (o.driveNote ? ' · Note: ' + o.driveNote : '')),
      last && o.sigs,
      biz().proofOn !== false && h('div.bi-cod', h('b', (biz().proofTitle || 'CERTIFICATE OF DESTRUCTION') + ':'), h('p', proofLine(o.destruction, (biz().proofText || '{company} certifies that all materials related to services included on this invoice have been shredded per the terms of the service agreement. Additionally, 100% of the shredded materials were recycled.').replace(/\{company\}/g, org.name)))),
      h('div.bi-pg', 'Page ' + (pi + 1) + ' of ' + N));
  });
}
const docWrap = pages => h('div.bi-docwrap', pages);
/* ---------- The standard invoice (a route visit or a purge job) ----------
   Follows the company's everyday invoice: logo and the company address; the customer's address beside "Invoice" with Invoice Number,
   Invoice Date and Due Date; a table of Item, Description, Unit Cost, Quantity and Line Total; the signature beside Total, Paid to Date
   and Balance Due (with a PAID stamp once paid); and the certificate of destruction at the foot of the page.
   The service-summary layout above is kept for master invoices built from service notes. */
const ITEM = { console: ['Console Route Service', 'Recurring Service Console Shredded On-site'], bin64: ['64 Gal Bin Route Service', 'Recurring Service 64 Gallon Bin Shredded On-site'], bin96: ['96 Gal Bin Route Service', 'Recurring Service 96 Gallon Bin Shredded On-site'],
  box: ['File boxes', 'Regular Size File Boxes 12x15x10 (1 cu. ft.)'], hdd: ['Hard drives', 'Onsite hard drive destruction'], binExtra: ['Additional bins', '65 Gallon Bin Shredded On-site'], trip: ['Trip charge', 'Trip to the service location'],
  stairsDown: ['Stairs', 'Boxes carried down stairs'], stairsUp: ['Stairs', 'Boxes carried up stairs'], haul: ['Haul away', 'Empty boxes hauled away'] };
/** [Item, Description] for a line. A line the driver renamed, or a custom charge, prints its own wording. */
function itemText(l) {
  const pb = l.id && data.priceBook.find(x => x.id === l.id);
  if (pb && (pb.item || pb.desc)) return [pb.item || pb.name, pb.desc || ''];
  if (l.id === 'binFlat' && pb && l.name === pb.name) return ['Flat Rate', 'Shredding first ' + data.purgePricing.binIncluded + ' 65 gallon ' + (data.purgePricing.binIncluded === 1 ? 'bin' : 'bins')];
  /* A company that destroys material at its own facility doesn't shred at the customer: the wording says collected, not shredded on site. */
  if (pb && ITEM[l.id] && l.name === pb.name && biz().industry !== 'other') return biz().destroy === 'offsite' ? [ITEM[l.id][0], ITEM[l.id][1].replace(/Shredded On-site/, 'Collected for Off-site Shredding').replace(/^Onsite hard drive destruction$/, 'Hard drives collected for off-site destruction')] : ITEM[l.id];
  return [l.name, pb && l.name !== pb.name ? pb.name : ''];
}
const mdy2 = day => { const d = D.parse(day), z = n => String(n).padStart(2, '0'); return z(d.getMonth() + 1) + '/' + z(d.getDate()) + '/' + d.getFullYear(); };
const stdProof = () => { const t = biz().proofText; return !t || /per the terms of the service agreement/.test(t) ? 'This certifies that {company} has destroyed all confidential data and products received from the above mentioned company.' : t; };
/** o: {number, date, terms, billTo, lines, tax, taxLabel, paid, po, serviceDate, revised, pounds, sigs: [{sig, cap}], scans, scanNote, drives, driveNote, destruction} */
function standardInvoice(o) {
  const org = S.org || data.orgs[0], lines = o.lines.filter(l => l.qty || l.rate), tax = +o.tax || 0, tot = total(lines) + tax, net = parseInt((String(o.terms || '').match(/\d+/) || [30])[0], 10);
  const meta = [['Invoice Number', o.number], ['Invoice Date', mdy2(o.date)], ['Due Date', mdy2(D.add(o.date, net))], o.serviceDate && o.serviceDate !== o.date && ['Service Date', mdy2(o.serviceDate)], o.po && ['PO Number', o.po], o.revised && ['Revised', o.revised]].filter(Boolean);
  /* Settings → Company → Forms and documents: the default invoice layout can rename the title, the column headings and the totals, and hide blocks. */
  const FM = WD.money && WD.money.docLabel ? WD.money : null, L = (k, d) => FM ? FM.docLabel('invoice', k, d) : d, show = k => !FM || FM.docShows('invoice', k), two = t => { const w = String(t).split(' '); return w.length === 2 ? [w[0], h('br'), w[1]] : t; };
  return h('div.bn-doc', FM && FM.docAccent('invoice') ? { style: { '--mny-accent': FM.docAccent('invoice') } } : null,
    h('div.bn-top', show('logo') ? logo() : h('div'), show('company') === false ? h('div') : h('div.bn-co', [org.name].concat((org.remit || []).slice(1), org.phone || [], org.fax ? 'Fax ' + org.fax : [], org.email || [], org.website || [], data.tax && data.tax.on && data.tax.regNo ? 'Tax reg. # ' + data.tax.regNo : []).map(x => h('div', x)))),
    h('div.bn-mid', h('div.bn-to', (o.billTo || []).map(x => h('div', x))), h('div', h('div.bn-ttl', FM && FM.docAccent('invoice') ? { style: { color: FM.docAccent('invoice') } } : null, L('title', 'Invoice')), h('div.bn-meta', meta.map(([k, v]) => [h('span', k), h('span', v)])))),
    h('table.bn-tab', h('thead', h('tr', h('th', L('col.item', 'Item')), h('th', L('col.desc', 'Description')), h('th', two(L('col.rate', 'Unit Cost'))), h('th', L('col.qty', 'Quantity')), h('th.r', two(L('col.total', 'Line Total'))))),
      h('tbody', lines.map(l => { const [item, desc] = itemText(l); return h('tr', h('td', item), h('td', desc), h('td.n', money2(+l.rate || 0)), h('td.n', String(+l.qty || 0)), h('td.r.n', money2((+l.qty || 0) * (+l.rate || 0)))); }))),
    h('div.bn-bot',
      h('div.bn-sig', (o.stamp || o.paid) && h('div.bn-stamp', o.stamp || 'PAID'), (o.sigs || []).filter(s => s.sig || s.blank).map(s => [h('div.bn-ink', sigView(s.sig)), h('div.bn-cap', s.cap)])),
      h('div.bn-tot', tax > 0 && ((o.taxes || []).filter(t => t.amount > 0).length > 1 ? o.taxes.filter(t => t.amount > 0).map(t => h('div.x', h('span', t.label || t.name), h('span', money2(t.amount)))) : h('div.x', h('span', o.taxLabel || 'Sales tax'), h('span', money2(tax)))), h('div', h('span', L('total', 'Total')), h('span', money2(tot))), h('div', h('span', L('paid', 'Paid to Date')), h('span', money2(o.paid ? tot : 0))), h('div.due', h('span', L('balance', 'Balance Due')), h('span', money2(o.paid || o.stamp ? 0 : tot))))),
    o.pounds && h('div.bi-scan', h('b', 'WEIGHT SHREDDED: '), Number(o.pounds).toLocaleString('en-US') + ' lb'),
    o.scans && o.scans.length > 0 && h('div.bi-scan', h('b', 'CONTAINERS SERVICED (BARCODE SCANS): '), o.scans.map(s => s.code + ' ' + fmt.clock(new Date(s.at))).join(' · ') + (o.scanNote ? ' · Note: ' + o.scanNote : '')),
    o.drives && o.drives.length > 0 && h('div.bi-scan', h('b', 'HARD DRIVES DESTROYED (SERIAL NUMBERS): '), o.drives.map(s => s.code).join(' · ') + (o.driveNote ? ' · Note: ' + o.driveNote : '')),
    FM && FM.docFooter('invoice') && h('div.bi-scan', FM.docFooter('invoice')),
    h('div.bn-fill'),
    biz().proofOn !== false && h('div.bn-cod', h('b', (biz().proofTitle || 'CERTIFICATE OF DESTRUCTION') + ':'), proofLine(o.destruction, stdProof().replace(/\{company\}/g, org.name))));
}
function invoiceDoc(inv, job) {
  const c = q.customer(job.customerId), lines = inv.lines || linesForJob(job), day = inv.serviceDate || job.day, parts = (job.address || '').split(',').map(x => x.trim()).filter(Boolean);
  const billTo = c ? [c.name].concat(c.attn ? ['Attn: ' + c.attn] : [], c.billAddress || [parts[0], parts.slice(1).join(', ')].filter(Boolean)) : [job.title].concat(parts[0] ? [parts[0], parts.slice(1).join(', ')].filter(Boolean) : []);
  const sigs = [{ sig: inv.custSig, blank: WD.sigPolicy(c) === 'always', cap: 'Customer Signature' + (inv.custName ? ' · ' + inv.custName : '') },
    { sig: inv.repSig, cap: [repTitle() + ' Signature', inv.repName].filter(Boolean).join(' · ') }];
  return docWrap(standardInvoice({ number: inv.number, date: inv.sentAt ? D.key(new Date(inv.sentAt)) : D.today(), terms: c && c.terms, billTo, lines, tax: inv.tax, taxLabel: inv.taxLabel, taxes: inv.taxes, stamp: WD.invStamp && WD.invStamp(inv), paid: inv.status === 'Paid', po: inv.po,
    serviceDate: inv.includeDate !== false ? day : null, revised: inv.revisedAt ? mdy2(D.key(new Date(inv.revisedAt))) : null, pounds: inv.pounds, sigs,
    scans: data.settings && data.settings.barcodes.onInvoice ? inv.scans : null, scanNote: inv.scanNote, drives: inv.drives, driveNote: inv.driveNote,
    /* A draft being previewed for an off-site company shows the “to follow” wording it will be sent with. */
    destruction: job.destruction || (inv.status === 'Draft' && offsite() && inv.first !== 'drop' ? { status: 'pending' } : null) }));
}
/** A master invoice: every service note it was built from, grouped by location (blank row between locations), paged like the paper invoice. */
function masterDoc(mi) {
  const c = q.customer(mi.customerId), notes = mi.noteIds.map(id => data.serviceNotes.find(n => n.id === id)).filter(Boolean).sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true }) || a.day.localeCompare(b.day));
  const rows = []; let prev = null;
  notes.forEach(n => { if (prev != null && n.location !== prev) rows.push({ gap: true }); prev = n.location; rows.push(...visitRows(n.day, n.location, n.lines, n.pounds)); });
  const rec = data.invoices && data.invoices.find(x => x.id === 'inv-' + mi.id);
  const ds = notes.map(n => (q.job(n.jobId) || {}).destruction).filter(Boolean), destruction = ds.some(d => d.status === 'pending') ? { status: 'pending' } : ds.slice().sort((a, b) => (a.day < b.day ? 1 : -1))[0] || null;
  return docWrap(invoicePages({ number: mi.number, date: D.key(new Date(mi.at)), customer: c, billTo: [c.name, 'Attn: ' + (c.attn || (c.contacts[0] || {}).name || '')].concat(c.billAddress || []), serviceLocation: new Set(notes.map(n => n.location)).size > 1 ? 'MULTIPLE LOCATIONS' : (notes[0] || {}).location,
    terms: c.terms, agreement: c.agreement || c.contract, po: mi.po, rows, paid: rec && rec.status === 'Paid' ? {} : null, destruction }));
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
      WD.r9 && WD.r9.revisionSection((WD.workflow && WD.workflow.invRecFor(job)) || inv),
      ui.section(null, destructionRow(job), invActions(job), ui.row({ title: 'Resend to customer', icon: 'envelope', iconPlain: true, tint: true, onTap: async () => { if (await ui.run('Sending…', null, { done: 'Sent' })) { const rec = WD.workflow && WD.workflow.invRecFor(job); if (rec) rec.lastSent = +WD.now(); } } }),
        WD.money && WD.money.emailPreview && ui.row({ title: 'Preview the email', subtitle: 'The invoice attached as a PDF and a button to the portal', icon: 'envelope', iconPlain: true, tint: true, chevron: true, onTap: () => WD.money.emailPreview({ kind: 'invoice', customer: q.customer(job.customerId), rec: (WD.workflow && WD.workflow.invRecFor(job)) || { number: inv.number, amount: inv.amount, day: job.day, jobId: job.id, customerId: job.customerId, status: inv.status } }) })));
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
  return [WD.r9 && WD.r9.editRow(null, job), job.invoice.status !== 'Paid' && canInvoice() && ui.row({ title: 'Mark paid…', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => recordPayment(job) }),
    ui.row({ title: 'Open in Invoice Ninja', icon: 'arrow.up.right', iconPlain: true, tint: true, onTap: () => ui.toast('Opening Invoice Ninja…', 'arrow.up.right') })];
}
/** Rows for the job details Billing section. */
function billingRows(job) {
  const inv = job.invoice, can = canInvoice(), color = { Paid: 'var(--green)', Draft: 'var(--gray)', Sent: 'var(--orange)', Overdue: 'var(--red)' }, wf = WD.workflow;
  if (job.billing) { const b = job.billing, sn = b.kind === 'serviceNote';
    return [ui.row({ title: sn ? 'Service note ' + b.number : 'Paid — no invoice', subtitle: (sn ? (b.signer ? 'Signed by ' + b.signer + ' · ' : '') + 'on the monthly master invoice' : b.method + ' · ' + (b.by || '')) , icon: sn ? 'tray' : 'dollarsign.circle', iconColor: sn ? 'var(--brown)' : 'var(--green)', detail: fmt.money(b.amount, true),
      chevron: sn && !!wf, onTap: sn && wf ? () => WD.nav.push(wf.masterSpec(job.customerId)) : null }), destructionRow(job)]; }
  if (inv) return [ui.row({ title: inv.number + ' · ' + fmt.money(inv.amount, true), subtitle: inv.auto ? 'Card on file charged automatically' : inv.status === 'Draft' ? 'Draft — not sent yet' : inv.paid ? 'Paid · ' + inv.paid.method : 'Invoice Ninja', icon: 'dollarsign', iconColor: 'var(--green)', badge: ui.badge(inv.status, color[inv.status] || 'var(--orange)'), chevron: true, onTap: () => openInvoice(job.id) }),
    destructionRow(job), inv.status !== 'Draft' && invActions(job)];
  if (!can) return [ui.row({ title: 'Not billed yet' })];
  const c = q.customer(job.customerId), note = c && c.billingMode === 'serviceNote', go = () => { if (job.status !== 'completed' && WD.workflow) return WD.workflow.completeStop(job); openEditor(job.id); };
  return [ui.row({ title: note ? 'Create service note…' : 'Create invoice…', subtitle: job.status === 'completed' ? 'Billing details, signature and payment' : 'Completes the stop and opens the billing details', icon: note ? 'tray' : 'doc.text', iconPlain: true, tint: true, onTap: go }),
    !note && wf && ui.row({ title: 'Paid — no invoice…', subtitle: 'Paid on the spot and no invoice wanted', icon: 'dollarsign.circle', iconPlain: true, tint: true, onTap: () => { if (job.status !== 'completed') WD.api.setStatus(job.id, 'completed'); wf.paidNoInvoice(job); } })];
}

/* ---------- Off-site destruction: awaiting confirmation ---------- */
const awaiting = () => data.jobs.filter(j => j.destruction && j.destruction.status === 'pending').sort((a, b) => a.day.localeCompare(b.day) || q.order(a, b));
const docNo = j => (j.invoice && j.invoice.number) || (j.billing && j.billing.number) || '';
const sendTo = j => { const c = q.customer(j.customerId); return (j.invoice && j.invoice.billTo) || (c && (c.billingEmail || ((c.contacts || [])[0] || {}).email)) || j.email || 'the customer'; };
/** The destruction state of a job, as a row for its invoice and its Billing section. null when the job has none (on-site companies). */
function destructionRow(job) {
  const d = job.destruction; if (!d) return null; const can = canConfirmDestroyed();
  if (d.status === 'pending') return ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Destruction not yet confirmed', subtitle: 'The certificate of destruction is sent once it is', detail: can ? 'Confirm' : null, tint: false, chevron: can, onTap: can ? () => confirmDestroyed([job]) : null });
  return ui.row({ icon: 'checkmark.circle.fill', iconColor: 'var(--green)', title: 'Destroyed ' + fmt.day(d.day, 'long'), subtitle: 'Confirmed by ' + (d.by || 'the plant') + (d.pounds ? ' · ' + Number(d.pounds).toLocaleString('en-US') + ' lb' : '') + ' · certificate of destruction sent' });
}
/** Confirm that what was collected on these jobs has been destroyed (date, who, optional weight), then send each customer the certificate of destruction. */
function confirmDestroyed(jobs, done) {
  jobs = jobs.filter(j => j && j.destruction && j.destruction.status === 'pending'); if (!jobs.length) return;
  if (!canConfirmDestroyed()) return ui.toast('Your role can’t confirm destruction', 'lock');
  const f = { day: D.today(), by: S.me.name, pounds: '' }, many = jobs.length > 1;
  const go = async p => {
    const by = f.by.trim(), lb = parseInt(String(f.pounds).replace(/\D/g, ''), 10) || null;
    if (!by) return ui.alert({ title: 'Who confirmed it?', message: 'Add the name of the person who saw the material destroyed.' });
    if (f.day > D.today()) return ui.alert({ title: 'Check the date', message: 'The destruction date can’t be in the future.' });
    const early = jobs.filter(j => j.day > f.day); if (early.length) return ui.alert({ title: 'Check the date', message: early[0].title + ' was collected on ' + fmt.day(early[0].day) + ', after the destruction date.' });
    const ok = await ui.run(many ? 'Sending ' + jobs.length + ' certificates of destruction…' : 'Sending the certificate of destruction…', () => {
      jobs.forEach(j => { j.destruction = { status: 'confirmed', day: f.day, by, pounds: many ? null : lb, batchPounds: many ? lb : null, at: +WD.now(), enteredBy: S.me.name };
        j.events.push({ at: +WD.now(), actor: S.me.name, text: 'Destruction confirmed for ' + fmt.day(f.day) + ' by ' + by + (lb ? ' · ' + lb.toLocaleString('en-US') + ' lb' + (many ? ' in a batch of ' + jobs.length : '') : '') + ' · certificate of destruction sent to ' + sendTo(j) }); });
    }, { done: many ? 'Certificates sent' : 'Certificate sent' });
    if (!ok) return; p.dismiss(); WD.changed(); ui.toast(many ? jobs.length + ' confirmed · certificates of destruction sent' : 'Confirmed · certificate sent to ' + sendTo(jobs[0]), 'checkmark', 2800); if (done) done();
  };
  ui.sheet({ title: 'Confirm destroyed', leading: [{ label: 'Cancel', onTap: p => p.dismiss() }], trailing: [{ label: 'Confirm', bold: true, onTap: go }],
    render: p => ui.list(
      ui.section({ header: many ? jobs.length + ' loads' : 'Load', fold: many, folded: many && jobs.length > 4 }, jobs.map(j => ui.row({ leading: ui.dot(q.routeColor(j.routeId)), title: j.title, subtitle: 'Collected ' + fmt.day(j.day) + (docNo(j) ? ' · ' + docNo(j) : '') }))),
      ui.section({ header: 'Destruction', fold: false, showFooter: true, footer: 'Confirming marks ' + (many ? 'each job' : 'the job') + ', notes it in the job history and sends the customer the certificate of destruction with this date.' + (many ? ' The weight is for the whole batch.' : '') },
        ui.dateRow({ title: 'Destroyed on', icon: 'calendar', iconColor: 'var(--red)', value: f.day, onChange: v => { f.day = v; } }),
        ui.inputRow({ label: 'Confirmed by', caps: 'words', placeholder: 'Name', value: f.by, required: true, onInput: v => { f.by = v; } }),
        ui.inputRow({ label: many ? 'Total weight' : 'Weight', placeholder: 'Pounds (optional)', inputmode: 'numeric', value: String(f.pounds || ''), onInput: v => { f.pounds = v; } })),
      h('div.bi-acts', ui.button(many ? 'Confirm ' + jobs.length + ' and send certificates' : 'Confirm and send certificate', { icon: 'checkmark', onTap: () => go(p) }))) }, { detent: 'large' });
}
/** The list an office or plant user works through: every load collected whose destruction hasn't been confirmed. Confirm one by one, or tick several and confirm them together. */
function destructionSpec() {
  const sel = new Set();
  return { title: 'Awaiting destruction', render: page => {
    const list = awaiting(), can = canConfirmDestroyed(); [...sel].forEach(id => { if (!list.some(j => j.id === id)) sel.delete(id); });
    if (!list.length) return ui.empty({ icon: 'checkmark.circle.fill', title: 'Nothing is waiting', text: offsite() ? 'Every load collected has been confirmed destroyed and its certificate of destruction sent.' : 'This list is used when material is destroyed off site (Settings → Business type and wording).' });
    const picked = list.filter(j => sel.has(j.id)), all = picked.length === list.length;
    return ui.list(
      h('div', { style: 'padding:4px 4px 0' }, ui.note(can ? 'These loads were collected but not yet confirmed destroyed. Their invoices say the certificate of destruction will follow. Confirm each one, or tick several and confirm them together.' : 'These loads were collected but not yet confirmed destroyed. The office or plant confirms them; the certificate of destruction is sent then.')),
      can && h('div.bi-dbar', ui.button(picked.length ? 'Confirm ' + picked.length + ' destroyed' : 'Confirm destroyed', { block: false, icon: 'checkmark', disabled: !picked.length, onTap: () => confirmDestroyed(picked, () => { sel.clear(); page.refresh(); }) }),
        ui.button(all ? 'Select none' : 'Select all', { kind: 'gray', block: false, onTap: () => { if (all) sel.clear(); else list.forEach(j => sel.add(j.id)); page.refresh(); } })),
      ui.section({ header: 'Awaiting destruction confirmation', fold: false, footer: can ? 'Tap a load to tick it.' : null },
        list.map(j => { const on = sel.has(j.id), what = WD.itemsLabel(j.items, j.type === 'purge');
          return ui.row({ class: 'bi-dest', leading: can ? icon(on ? 'checkmark.circle.fill' : 'circle', 24, on ? 'var(--tint)' : 'var(--label3)') : ui.dot(q.routeColor(j.routeId)), title: j.title,
            subtitle: 'Collected ' + fmt.day(j.day) + (docNo(j) ? ' · ' + docNo(j) : '') + (what ? ' · ' + what : '') + ' · ' + q.routeName(j.routeId),
            trailing: can ? ui.button('Confirm', { kind: 'tinted', small: true, block: false, onTap: e => { e.stopPropagation(); confirmDestroyed([j], () => page.refresh()); } }) : ui.badge('Waiting', 'var(--orange)'),
            onTap: can ? () => { if (on) sel.delete(j.id); else sel.add(j.id); page.refresh(); } : () => WD.screens.jobs && WD.screens.jobs.openDetails && WD.screens.jobs.openDetails(j.id) }); })));
  } };
}
/** A compact row for the Invoices list (and anywhere else): shown only while something is waiting. push opens a page spec. */
function destructionEntry(push) {
  const n = awaiting().length; if (!n || !(WD.can('billing.view') || WD.can('billing.field') || canConfirmDestroyed())) return null;
  return ui.section({ fold: false }, ui.row({ icon: 'clock', iconColor: 'var(--orange)', title: 'Awaiting destruction confirmation', subtitle: 'Certificates of destruction go out once confirmed', badge: ui.badge(String(n), 'var(--orange)'), chevron: true, onTap: () => (push || WD.nav.push)(destructionSpec()) }));
}
/** When a company switches to off-site destruction: recent billed stops haven't been confirmed yet, so they start on the list. Returns how many. */
function seedAwaiting() {
  const from = D.add(D.today(), -1), list = data.jobs.filter(j => !j.allDay && j.status === 'completed' && j.day >= from && j.day <= D.today() && !j.destruction && (j.billing ? j.billing.kind === 'serviceNote' : j.invoice && j.invoice.status !== 'Draft' && j.invoice.first !== 'drop'));
  list.forEach(j => { j.destruction = { status: 'pending', at: +WD.now() }; }); return list.length;
}

WD.screens.billing = { standardInvoice, docWrap, logo, openEditor, openInvoice, recordPayment, billingRows, invActions, masterDocSpec, invoiceDoc, signaturePad, sigView, linesForJob, canInvoice,
  isFirstDelivery, firstLines, offsite, destructionSpec, destructionEntry, destructionRow, confirmDestroyed, awaitingDestruction: awaiting, seedAwaiting };
WD.panel.addJump('Invoice editor', () => { WD.nav.switchTab('board'); const j = data.jobs.filter(x => x.day === D.today() && x.status === 'completed' && !x.invoice && x.customerId).sort(q.order)[0]; if (j) openEditor(j.id); else ui.toast('No completed job without an invoice today'); });
})();
