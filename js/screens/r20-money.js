/* Card price and cash price (R20-5). One company setting decides how the cost of taking credit cards is handled:
     off    our price is the price, however it is paid
     built  the percent is built into every price shown to the customer (the card price); cash, check and bank transfer pay our price
     line   invoices show our price; an invoice paid by credit card gets one more line, the card service fee
   Stored rates, invoice records and reports always hold our price (the cash price). The percent is applied only when a document is
   shown or a payment is taken, so nothing in the price book changes. WD.cardPrice is the only place that does the arithmetic. */
(() => {
const { h, ui, data, fmt } = WD;
const CP = WD.cardPrice = {}, r2 = n => Math.round((+n || 0) * 100) / 100;
const DEF = { built: 'Prices include a {pct}% card processing cost. Pay by cash, check or bank transfer and take {pct}% off.', line: 'A {pct}% card service fee is added to invoices paid by credit card. Debit cards, cash, checks and bank transfers are not charged the fee.', label: 'Card service fee ({pct}%)' };
const cfg = () => data.cardPay || (data.cardPay = { mode: 'off', pct: 3, words: { built: DEF.built, line: DEF.line }, label: DEF.label });
const pctText = () => String(r2(cfg().pct)), put = t => String(t || '').replace(/\{pct\}/g, pctText());
CP.cfg = cfg; CP.DEF = DEF;
CP.mode = () => cfg().pct > 0 ? cfg().mode : 'off';
CP.pct = () => +cfg().pct || 0;
/** Our price with the percent built in, to the cent. */
CP.up = amount => r2((+amount || 0) * (1 + CP.pct() / 100));
/** The card service fee on an amount (the separate-line mode). */
CP.fee = amount => r2((+amount || 0) * CP.pct() / 100);
/** What the customer is shown as the price: the card price in built-in mode, else our price. */
CP.shown = amount => CP.mode() === 'built' ? CP.up(amount) : +amount || 0;
CP.wording = () => CP.mode() === 'off' ? '' : put(cfg().words[CP.mode()] || DEF[CP.mode()]);
CP.lineLabel = () => put(cfg().label || DEF.label);
/** Was this payment a credit card ('card'), something else ('cash'), or unknown (null)? Debit cards pay the cash price and no fee. */
CP.kindOf = method => { const m = String(method || ''); if (!m) return null; if (/debit/i.test(m)) return 'cash'; return /card|visa|master|amex|american express|discover|tap to pay/i.test(m) ? 'card' : 'cash'; };
/** How one payment of an invoice works out. → {base (the price before any fee line), fee (card service fee line), discount (cash discount off the card price), charged} */
CP.split = (amount, method) => { const a = +amount || 0, k = CP.kindOf(method), mode = CP.mode();
  if (mode === 'built') return k === 'card' ? { base: CP.up(a), fee: 0, discount: 0, charged: CP.up(a) } : { base: a, fee: 0, discount: r2(CP.up(a) - a), charged: a };
  if (mode === 'line' && k === 'card') return { base: a, fee: CP.fee(a), discount: 0, charged: r2(a + CP.fee(a)) };
  return { base: a, fee: 0, discount: 0, charged: a }; };
CP.charge = (amount, method) => CP.split(amount, method).charged;
/** “Card $103.00 · cash, check or bank $100.00”, for the sheets that ask how something was paid. Empty when the setting is off. */
CP.bothText = amount => CP.mode() === 'off' ? '' : 'Credit card ' + fmt.money(CP.charge(amount, 'card'), true) + ' · cash, check or bank ' + fmt.money(+amount || 0, true);
/** The payment method an invoice record was paid with, from its payments. */
CP.methodOf = rec => { if (!rec || rec.status !== 'Paid') return null; const p = (data.payments || []).filter(x => x.invoiceId === rec.id).pop(); return p ? p.method : (rec.paid && rec.paid.method) || null; };

/* The portal's fee for a card now comes from here, and in built-in mode a bank payment pays the cash price with no fee (R11-20 as changed by R20-5). */
if (WD.r11 && WD.r11.portalFee) { const base = WD.r11.portalFee; WD.r11.portalFee = (amount, method) => method === 'card' ? (CP.mode() === 'line' ? CP.fee(amount) : 0) : CP.mode() === 'built' ? 0 : base(amount, method); }

/* ---------- Settings → Company → Invoicing and payments → Card payments ---------- */
const MODES = [['off', 'Off', 'One price however the customer pays. You absorb the card cost.'], ['built', 'Built into prices', 'Customers see a card price and a lower cash price'], ['line', 'Separate line on the invoice', 'Added only to invoices paid by credit card']];
CP.modeName = () => (MODES.find(m => m[0] === CP.mode()) || MODES[0])[1] + (CP.mode() === 'off' ? '' : ' · ' + pctText() + '%');
CP.settingsSpec = () => ({ title: 'Card payments', render: page => { const C = cfg(), ex = 100, re = () => { WD.changed(); page.refresh(); }, m = C.mode;
  if (!(WD.can && WD.can('settings.manage'))) return ui.empty({ icon: 'lock', title: 'Ask an admin', text: 'Only an admin can change how card payments are priced.' });
  return ui.list(
    ui.section({ header: 'How the cost of taking cards is handled', fold: false },
      MODES.map(([v, title, sub]) => ui.row({ icon: m === v ? 'checkmark.circle.fill' : 'circle', iconPlain: true, iconColor: m === v ? 'var(--tint)' : 'var(--label3)', title, subtitle: sub, onTap: () => { C.mode = v; re(); } }))),
    m !== 'off' && ui.section({ header: 'Percent', fold: false, showFooter: true, footer: m === 'built' ? 'Example: a job priced at ' + fmt.money(ex, true) + ' shows as ' + fmt.money(CP.up(ex), true) + '. Paid by credit card the customer pays ' + fmt.money(CP.up(ex), true) + '; paid by cash, check or bank transfer they pay ' + fmt.money(ex, true) + '. Your price list stays as it is: the percent is added when an invoice is shown or paid.'
        : 'Example: a ' + fmt.money(ex, true) + ' invoice paid by credit card is ' + fmt.money(ex + CP.fee(ex), true) + ' (' + fmt.money(ex, true) + ' + ' + fmt.money(CP.fee(ex), true) + '). Paid any other way it stays ' + fmt.money(ex, true) + '.' },
      h('div.row', h('div.row-main', h('div.row-title', m === 'built' ? 'Added to every price' : 'Card service fee')), h('input.jb-rate', { style: 'width:74px', type: 'text', inputmode: 'decimal', 'aria-label': 'Percent', value: String(C.pct), onchange: e => { C.pct = Math.max(0, Math.min(10, parseFloat(e.target.value) || 0)); re(); } }), h('span.secondary', { style: 'margin-left:4px' }, '%')),
      m === 'line' && C.pct > 3 && h('div.row', h('div.row-main', h('div.row-title', { style: 'color:var(--red);font-weight:700;white-space:normal' }, 'Visa allows at most 3%, and never on debit or prepaid cards.')))),
    m !== 'off' && ui.section({ header: 'Wording shown to customers', fold: false, showFooter: true, footer: 'Printed under the total on invoices, in the invoice email and in the portal before the customer pays. {pct} is replaced with the percent.' },
      ui.inputRow({ multiline: true, value: C.words[m], onInput: v => { C.words[m] = v; } }),
      m === 'line' && ui.inputRow({ label: 'Name of the line', value: C.label, onInput: v => { C.label = v; } }),
      ui.row({ title: 'Back to the standard wording', tint: true, onTap: () => { C.words[m] = DEF[m]; if (m === 'line') C.label = DEF.label; re(); } })),
    m !== 'off' && ui.section({ header: 'What the customer reads', fold: false }, h('div.row', h('div.row-main', h('div.row-title', { style: 'white-space:normal;font-weight:400' }, CP.wording()), m === 'line' && h('div.row-sub', 'Invoice line: ' + CP.lineLabel())))),
    h('div', { style: 'padding:10px 16px 0' }, ui.note('Rules on card fees differ by state and by card network. Confirm your wording and percent with your lawyer before turning this on.')));
} });
if (WD.panel && WD.panel.addJump) WD.panel.addJump('Card payments (card and cash price)', () => { WD.nav.switchTab('settings'); WD.nav.push(CP.settingsSpec()); });
})();
