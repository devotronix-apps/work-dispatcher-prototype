/* RouteClerk prototype — version 5.0 phone features, built on the Quo phone service (Quo API + webhooks).
   `WD.calls`           every call on every Quo number of the business: the log, the flag-for-review rule, AI call review, routing an
                        incoming call to the business it is for, and the Phone and calls settings.
   `WD.screens.dialer`  the Dialer tab: Keypad | Recent | Needs review.
   Calls live in `data.calls` (seeded the first time a business's calls are read, so each business has its own). Calls the older flows
   write to `data.interactions` (customer timeline) are adopted into the log each time it is read, so nothing is lost. */
(function () {
'use strict';
const WD = window.WD, { h, ui, icon, state: S, data, q, fmt, date: D } = WD, RC = WD.rc || {}, C = WD.calls = {};
const K = () => (WD.screens.customers || {}).crm || {};
const me = () => (S.me && S.me.name) || 'You', first = n => String(n || '').replace(/^Dr\.\s*/, '').split(' ')[0];
const dg = s => fmt.phoneDigits(s), norm = s => { const d = dg(s); return d.length === 10 ? '+1' + d : String(s || ''); };
const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'), plural = (n, w) => n + ' ' + (n === 1 ? w : w + 's');
const PIPE = ['lead', 'contacted', 'quoted', 'scheduled', 'lost'], DAY = 864e5;
const frontId = () => (WD.orgs && WD.orgs.dataOrg) || (S.org || data.orgs[0]).id;
const orgOf = id => data.orgs.find(o => o.id === id) || data.orgs[0], cur = () => orgOf(frontId());
const dataFor = id => !id || id === frontId() ? data : WD.orgs.dataOf(id);
const multi = () => (data.orgs || []).length > 1;
const fill = (el, ...kids) => { el.replaceChildren(...kids.flat(Infinity).filter(x => x instanceof Node)); return el; };
/** Review rules are a setting of each business. */
const ST = d => { d = d || data; return d.callSettings || (d.callSettings = { threshold: 20, outShort: false, autoResolve: true, ring: {} }); };
const when = at => { const d = new Date(at), k = D.key(d), n = D.diff(D.today(), k); return (n === 0 ? '' : n === 1 ? 'Yesterday ' : fmt.day(k, 'md') + ' ') + fmt.clock(d); };
const dayLabel = k => { const n = D.diff(D.today(), k); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : fmt.day(k); };
const durLabel = c => !c.duration ? '—' : c.duration < 60 ? c.duration + ' s' : mmss(c.duration);

WD.addIcons({
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  'speaker.wave': '<path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.500a5 5 0 0 1 0 7M19 6a8.500 8.500 0 0 1 0 12"/>',
  'delete.left': '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7zM12 9.500l5 5M17 9.500l-5 5"/>',
  archivebox: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4"/>',
  'phone.down': '<g transform="rotate(135 12 12)"><path fill="currentColor" stroke="none" d="M6.500 3h3.200l1.700 4.600-2.100 1.600a11 11 0 0 0 5.500 5.500l1.600-2.100L21 14.300v3.200c0 1.400-1.100 2.500-2.500 2.500C10.500 20 4 13.500 4 5.500 4 4.100 5.100 3 6.500 3z"/></g>'
});

WD.css(`
.cl-why { display: inline-flex; align-items: center; gap: 5px; margin-top: 6px; padding: 3px 10px; border-radius: 12px; background: color-mix(in srgb, var(--green) 16%, transparent); color: var(--label); font-size: 12px; font-weight: 600; }
.cl-autowhy { text-align: center; font-size: 12px; color: var(--label2); margin: 4px 0 0; height: 16px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 5.2: the number, the match line and up to two matches sit in a zone of fixed height above the pad, so typing never moves the pad. */
.cl-zone { height: 160px; padding-top: 2px; overflow: hidden; } .cl-zone .cl-hits { gap: 4px; } .cl-zone .cl-hit { min-height: 44px; padding: 4px 12px; }
.cl-dial { padding-top: 8px; }
.cl-kp { max-width: 340px; margin: 0 auto; text-align: center; }
.cl-from { max-width: 100%; white-space: nowrap; overflow: hidden; appearance: none; border: 0; background: var(--fill3); color: var(--label); border-radius: 17px; min-height: 36px; padding: 0 14px; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 12px; }
.cl-from b { font-weight: 600; } .cl-from .ic { color: var(--label2); }
.cl-num { font-size: 34px; font-weight: 400; letter-spacing: .5px; min-height: 40px; line-height: 40px; margin-top: 0; color: var(--label); cursor: text; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cl-num.blank { color: var(--label3); font-size: 17px; letter-spacing: -.2px; }
.cl-sub { font-size: 14px; color: var(--tint); min-height: 18px; line-height: 18px; }
.cl-hits { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.cl-hit { appearance: none; border: 0; background: var(--cell); border-radius: 12px; min-height: 48px; padding: 6px 12px; display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; color: var(--label); width: 100%; }
.cl-hit .m { flex: 1; min-width: 0; } .cl-hit .n { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .cl-hit .p { font-size: 13px; color: var(--label2); }
.cl-pad { display: grid; grid-template-columns: repeat(3, 66px); gap: 8px 26px; justify-content: center; }
.cl-key { appearance: none; border: 0; width: 66px; height: 66px; border-radius: 50%; background: var(--fill3); color: var(--label); font-size: 30px; line-height: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
.cl-key small { font-size: 12px; font-weight: 600; letter-spacing: 2px; color: var(--label2); height: 14px; line-height: 14px; margin-right: -2px; }
.cl-key:active { background: var(--fill); }
.cl-pad.mini { grid-template-columns: repeat(3, 56px); gap: 8px 18px; } .cl-pad.mini .cl-key { width: 56px; height: 56px; font-size: 24px; } .cl-pad.mini small { display: none; }
.cl-go { display: grid; grid-template-columns: repeat(3, 72px); gap: 0 26px; justify-content: center; margin-top: 8px; align-items: center; }
.cl-callbtn { appearance: none; border: 0; width: 64px; height: 64px; border-radius: 50%; background: var(--green); color: #fff; display: grid; place-items: center; cursor: pointer; }
.cl-callbtn:disabled { opacity: .45; } .cl-callbtn:active { opacity: .7; }
.cl-del { appearance: none; border: 0; background: none; color: var(--label2); width: 72px; height: 72px; display: grid; place-items: center; cursor: pointer; }
.cl-di { width: 32px; height: 32px; border-radius: 50%; flex: none; display: grid; place-items: center; margin-right: 12px; background: color-mix(in srgb, var(--c) 15%, transparent); color: var(--c); }
.cl-pick { width: 32px; flex: none; margin-right: 12px; display: grid; place-items: center; color: var(--label3); } .cl-pick.on { color: var(--tint); }
.cl-t { font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.cl-flagdot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); display: inline-block; flex: none; }
.cl-snip { color: var(--label2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cl-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cl-meta { flex: none; text-align: right; font-size: 13px; line-height: 18px; color: var(--label2); margin-left: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; white-space: nowrap; }
.cl-rev { background: var(--cell); border-radius: 12px; padding: 12px; margin-top: 10px; }
.cl-rev-top { display: flex; align-items: flex-start; cursor: pointer; } .cl-rev-main { flex: 1; min-width: 0; font-size: 15px; line-height: 20px; }
.cl-rev-btns { display: flex; gap: 8px; margin-top: 10px; } .cl-rev-btns .btn { flex: 1; min-height: 44px; }
.cl-log { padding: 8px 16px 28px; } .cl-log .cl-inner { padding: 0; }
.cl-chips { display: flex; gap: 8px; overflow-x: auto; padding: 10px 16px 2px; margin: 0 -16px; scrollbar-width: none; } .cl-chips::-webkit-scrollbar { display: none; }
.cl-log.wide .cl-chips { flex-wrap: wrap; overflow: visible; }
.cl-act { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; font-size: 13px; color: var(--label2); }
.cl-act:empty { display: none; }
.chip.cl-x { background: color-mix(in srgb, var(--tint) 14%, transparent); color: var(--tint); font-size: 13px; height: 32px; padding: 0 10px; }
.chip.cl-x .ic { color: var(--tint); }
.cl-rhead { display: flex; align-items: center; min-height: 44px; margin-top: 6px; }
.cl-bulk { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: var(--cell); border-radius: 12px; padding: 8px 12px; box-shadow: 0 2px 10px rgba(0,0,0,.12); font-size: 15px; }
.cl-tab { width: 100%; border-collapse: collapse; background: var(--cell); border-radius: 12px; overflow: hidden; font-size: 14px; line-height: 19px; }
.cl-tab th { text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--label2); padding: 11px 10px; white-space: nowrap; cursor: pointer; border-bottom: 1px solid var(--sep); user-select: none; }
.cl-tab th.on { color: var(--tint); } .cl-tab th .ic { vertical-align: -1px; margin-left: 3px; }
.cl-tab td { padding: 10px; border-bottom: 1px solid var(--sep); vertical-align: top; color: var(--label); }
.cl-tab tbody tr { cursor: pointer; } .cl-tab tbody tr:hover td { background: var(--fill3); } .cl-tab tr.sel td { background: color-mix(in srgb, var(--tint) 10%, transparent); }
.cl-tab tr.dim td { color: var(--label2); } .cl-tab tr:last-child td { border-bottom: 0; }
.cl-tab td.c, .cl-tab th.c { width: 36px; color: var(--label3); cursor: pointer; } .cl-tab tr.sel td.c { color: var(--tint); }
.cl-tab td.nw { white-space: nowrap; } .cl-tab td.sum { color: var(--label2); min-width: 220px; } .cl-tab td.a { width: 92px; }
.cl-tab .cl-di { width: 26px; height: 26px; margin: 0; }
.cl-head { display: flex; align-items: center; gap: 14px; padding: 12px 4px 4px; } .cl-head .m { flex: 1; min-width: 0; }
.cl-flag { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--orange) 16%, var(--cell)); font-size: 15px; }
.cl-flag .ic { color: var(--orange); flex: none; } .cl-flag .t { flex: 1; min-width: 120px; }
.cl-qas { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
.cl-qa { appearance: none; border: 0; background: var(--cell); color: var(--tint); border-radius: 12px; min-height: 60px; padding: 8px 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 500; cursor: pointer; }
.cl-qa:disabled { opacity: .4; }
.cl-rec { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--cell); }
.cl-play { appearance: none; border: 0; width: 44px; height: 44px; border-radius: 50%; background: var(--tint); color: #fff; display: grid; place-items: center; cursor: pointer; flex: none; }
.cl-track { flex: 1; height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; } .cl-track i { display: block; height: 100%; width: 0; background: var(--tint); }
.cl-line { padding: 8px 16px; background: var(--cell); font-size: 15px; line-height: 20px; } .cl-line b { display: block; font-size: 12px; font-weight: 600; color: var(--label2); }
.cl-call { display: flex; flex-direction: column; align-items: center; padding: 18px 20px 28px; text-align: center; }
.cl-call .title2 { margin-top: 10px; }
.cl-live { font-size: 17px; color: var(--label2); margin-top: 8px; font-variant-numeric: tabular-nums; } .cl-live.on { color: var(--green); font-weight: 600; }
.cl-cgrid { display: grid; grid-template-columns: repeat(3, 76px); gap: 16px 22px; margin: 22px 0 14px; }
.cl-cbtn { appearance: none; border: 0; background: none; color: var(--label); cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 0; }
.cl-cbtn span { width: 64px; height: 64px; border-radius: 50%; background: var(--fill3); display: grid; place-items: center; }
.cl-cbtn.on span { background: var(--label); color: var(--bg); } .cl-cbtn small { font-size: 12px; color: var(--label2); }
.cl-tones { min-height: 24px; font-size: 20px; letter-spacing: 2px; margin-bottom: 8px; }
.cl-notes { width: 100%; max-width: 340px; min-height: 76px; border: 0; outline: 0; border-radius: 12px; background: var(--cell); color: var(--label); font: inherit; font-size: 16px; padding: 10px 12px; margin-bottom: 12px; resize: none; }
.cl-end { appearance: none; border: 0; width: 72px; height: 72px; border-radius: 50%; background: var(--red); color: #fff; display: grid; place-items: center; cursor: pointer; margin-top: 6px; }
.cl-caller { display: flex; align-items: center; gap: 14px; padding: 6px 20px 4px; } .cl-oncall { display: block; font-size: 14px; font-weight: 600; color: var(--green); margin-top: 2px; font-variant-numeric: tabular-nums; }
.cl-ai { padding: 12px 16px; background: var(--cell); border-bottom: 1px solid var(--sep); font-size: 15px; line-height: 20px; } .cl-ai:last-child { border-bottom: 0; }
.cl-ai .w { cursor: pointer; } .cl-ai .w b { font-weight: 600; }
.cl-ai .mt { font-size: 13px; color: var(--label2); margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cl-ai .bt { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; } .cl-ai .bt .btn { min-height: 36px; }
.cl-org { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--label); } .cl-org i { width: 8px; height: 8px; border-radius: 50%; background: var(--c, var(--gray)); display: inline-block; }
.cl-dot { width: 10px; height: 10px; border-radius: 50%; flex: none; margin-right: 14px; display: inline-block; }
.cl-aiwrap { margin-top: 10px; } .cl-aiwrap .btn { margin-top: 8px; }
.cl-dates { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; color: var(--label2); } .cl-dates .pill-input { font-size: 15px; min-height: 36px; }
`);

/* ================= Call data ================= */
/* {id, at, dir: 'in'|'out', number, to (our Quo number), lineLabel, customerId, contact, duration (s), status: 'answered'|'missed'|'voicemail',
    by (staff name), summary, transcript: [[speaker, text]], follow: {pri, text} (what the AI review found), resolved, resolvedAt/By/How,
    archived, flag: 'manual'|null, note, src (the timeline interaction this call was adopted from or written to)} */
const UNK = [['Dr. Patel’s office', '0871'], [null, '0872'], [null, '0873'], [null, '0874'], ['Ridgeline Property Mgmt', '0875'], [null, '0876']];
const TPL = {
  vmQuote: { s: 'Voicemail: about 40 boxes of old patient files to shred before the end of the month. Asked for a call back today with a quote.', t: [['{who}', 'Hi, this is Dr. Patel’s office. We have about 40 boxes of old patient files that need to be shredded before the end of the month. Could someone call us back today with a quote? Thank you.']], f: ['urgent', 'asked for a quote on 40 boxes'] },
  vmLead: { s: 'Voicemail: returning our call about the quote. Ready to book a first pickup and free after 1 PM today.', t: [['{who}', 'Hi, it’s {n} returning your call about the quote. We’d like to go ahead and book the first pickup. I’m free after one today.']], f: ['urgent', 'ready to book a first pickup, free after 1 PM'] },
  vmResched: { s: 'Voicemail: the office is closed on Friday. Asked to move this week’s pickup to Thursday or Monday.', t: [['{who}', 'Hi, this is {n}. Our office is closed this Friday, so could you move the pickup to Thursday or to Monday instead? Call me back to confirm, thanks.']], f: ['urgent', 'asked to move this week’s pickup because the office is closed Friday'] },
  vmPallets: { s: 'Voicemail: clearing out a storage unit, roughly 3 pallets of boxes. Wants a price and a date this month.', t: [['{who}', 'Hello, I manage a building on the east side and we’re clearing out a storage unit. It’s roughly three pallets of boxes. I’d like a price and a date some time this month.']], f: ['week', 'storage clean-out of about 3 pallets, wants a price and a date'] },
  missed: { s: 'Missed call. No voicemail left.' },
  short: { s: 'The call ended after {s} s. Nobody spoke after the greeting.', t: [['{st}', 'Thanks for calling {biz}, this is {st}.'], ['{who}', '(the line dropped)']] },
  shortOut: { s: 'Reached the front desk; the line dropped before the transfer.', t: [['{st}', 'Hi, it’s {st} from {biz}. Is {n} in?'], ['{who}', 'One moment…']] },
  extra: { s: 'Asked whether the driver can take 6 extra boxes on the next visit. Told them yes, at the per-box rate.', t: [['{who}', 'Hi, just checking you’re still coming on the next visit?'], ['{st}', 'Yes, you’re on the schedule.'], ['{who}', 'Can the driver take six extra boxes?'], ['{st}', 'Sure, those are charged at the per-box rate.']], f: ['fyi', '6 extra boxes on the next visit; add them to the job', 'Note for'] },
  invoice: { s: 'Question about the last invoice. Wants a copy sent to accounting with the PO number on it.', t: [['{who}', 'Our accounting team can’t find the last invoice. Could you resend it with the PO number on it?'], ['{st}', 'Of course. I’ll send it over today.']], f: ['week', 'resend the last invoice to accounting with the PO number on it', 'Follow up with'] },
  console: { s: 'Wants one more console for the front desk and asked what it adds per visit. Quoted the standard rate; they will confirm by email.', t: [['{who}', 'We’re filling the console at the front desk too fast. What would one more cost?'], ['{st}', 'It’s the same rate as your others per visit. Want me to add it?'], ['{who}', 'Let me check with the partners and email you.']], f: ['week', 'wants one more console; waiting for their confirmation', 'Follow up with'] },
  confirm: { s: 'Confirmed the next pickup and the container count. No changes.', t: [['{st}', 'Hi {n}, it’s {st} from {biz}, confirming your next pickup.'], ['{who}', 'Yes, everything is still on. Same count as usual.']] },
  callback: { s: 'Called back after the missed call. They only wanted to check the driver’s arrival window.', t: [['{st}', 'Hi {n}, sorry we missed you earlier.'], ['{who}', 'No problem. Roughly when will the driver be here?'], ['{st}', 'Between 10 and 1.']] },
  dropoff: { s: 'Asked about drop-off shredding prices and hours. Gave the per-box rate; they may come by this week.', t: [['{who}', 'Do you take drop-offs? I have a few boxes from home.'], ['{st}', 'We do, weekdays 8 to 4, charged per box.']], f: ['fyi', 'asked about drop-off prices and may come by this week', 'Heads-up from'] },
  leadIn: { s: 'New enquiry: 3 consoles for a dental office, every 4 weeks. Wants the service agreement by email.', t: [['{who}', 'We’re opening a second office and need shredding there. Probably three consoles.'], ['{st}', 'Every four weeks works for most offices that size. I’ll email the service agreement.']], f: ['week', 'send the service agreement for 3 consoles, every 4 weeks', 'Follow up with'] },
  leadOut: { s: 'Followed up on the quote. They are comparing two companies and will decide next week.', t: [['{st}', 'Hi {n}, just following up on the quote I sent.'], ['{who}', 'We’re comparing it with one other company. We’ll decide next week.']] },
  leftVm: { s: 'No answer. Left a voicemail asking them to call back about the quote.', t: [['{st}', 'Hi {n}, it’s {st} from {biz} about your quote. Call us back when you have a minute.']] },
  noAnswer: { s: 'No answer. No voicemail left.' }
};
/* [days ago, minutes after midnight, direction, who (c = customer, l = lead, u = unknown number), our line, status, seconds, staff, template, resolved how] */
const ROWS = [
  [0, 612, 'out', 'l1', 0, 'missed', 0, 2, 'noAnswer'], [0, 605, 'in', 'l0', 1, 'voicemail', 41, 0, 'vmLead'], [0, 595, 'in', 'c0', 0, 'answered', 12, 1, 'short'],
  [0, 571, 'in', 'c1', 0, 'answered', 184, 2, 'extra'], [0, 552, 'in', 'u0', 0, 'voicemail', 34, 0, 'vmQuote'], [0, 527, 'in', 'u1', 1, 'missed', 0, 0, 'missed'], [0, 500, 'out', 'c2', 0, 'answered', 96, 1, 'confirm'],
  [1, 1002, 'in', 'c3', 0, 'voicemail', 27, 0, 'vmResched'], [1, 910, 'in', 'u2', 0, 'answered', 9, 0, 'short'], [1, 842, 'in', 'c4', 0, 'answered', 263, 2, 'invoice'], [1, 795, 'out', 'l0', 1, 'voicemail', 22, 0, 'leftVm'],
  [1, 690, 'out', 'c5', 0, 'answered', 142, 1, 'confirm'], [1, 648, 'in', 'u3', 1, 'answered', 208, 2, 'dropoff'], [1, 560, 'out', 'c6', 0, 'answered', 75, 2, 'callback'], [1, 545, 'in', 'c6', 0, 'missed', 0, 0, 'missed', 'Called back 15 minutes later'],
  [2, 933, 'in', 'u4', 0, 'voicemail', 48, 0, 'vmPallets'], [2, 851, 'in', 'c7', 0, 'answered', 321, 0, 'console'], [2, 662, 'in', 'c0', 0, 'answered', 16, 1, 'short', 'They called straight back'], [2, 619, 'out', 'c1', 0, 'answered', 18, 2, 'shortOut'],
  [2, 580, 'in', 'l2', 1, 'answered', 233, 0, 'leadIn'], [2, 495, 'in', 'u5', 1, 'missed', 0, 0, 'missed', 'Spam caller'],
  [3, 965, 'in', 'c2', 0, 'answered', 154, 2, 'extra', 'Added to the job'], [3, 827, 'out', 'c3', 0, 'answered', 201, 1, 'confirm'], [3, 732, 'in', 'c5', 0, 'voicemail', 31, 0, 'vmResched', 'Pickup moved'], [3, 630, 'in', 'u3', 1, 'answered', 14, 2, 'short', 'Wrong number'],
  [3, 542, 'out', 'l1', 0, 'answered', 187, 0, 'leadOut'],
  [4, 950, 'in', 'c4', 0, 'answered', 97, 1, 'invoice', 'Invoice resent'], [4, 862, 'in', 'c6', 0, 'missed', 0, 0, 'missed', 'Called back the same afternoon'], [4, 705, 'out', 'c7', 0, 'answered', 66, 2, 'confirm'], [4, 608, 'in', 'u2', 0, 'answered', 172, 0, 'dropoff', 'Nothing to do'],
  [4, 552, 'in', 'l2', 1, 'voicemail', 38, 0, 'vmLead', 'Booked the first pickup']
];
const why = (c, st) => { st = st || ST(); return c.flag === 'manual' ? 'Flagged by ' + first(c.flagBy || 'staff') : c.dir === 'in' && c.status === 'missed' ? 'Missed' : c.dir === 'in' && c.status === 'voicemail' ? 'Voicemail' : c.status === 'answered' && c.duration < st.threshold && (c.dir === 'in' || st.outShort) ? 'Only ' + c.duration + ' s' : null; };
const isOpen = (c, st) => !c.resolved && !c.archived && !!why(c, st);
const phoneMap = d => { const m = {}; ((d || data).customers || []).forEach(c => (c.contacts || []).forEach(p => { const n = dg(p.phone); if (n.length === 10 && !m[n]) m[n] = { c, p }; })); return m; };
const custOf = (c, d) => c.customerId ? (!d || d === data ? q.customer(c.customerId) : (d.customers || []).find(x => x.id === c.customerId)) || null : null;
const nameOf = (c, d) => { const cu = custOf(c, d); return cu ? cu.name : c.contact || fmt.phone(c.number) || 'Unknown number'; };
const fromI = (i, org) => { const ln = i.line && typeof i.line === 'object' ? i.line : { channel: i.line || 'Main' }, vm = i.type === 'voicemail', lines = org.lines || [], mine = lines.find(l => dg(l.number) === dg(ln.number)) || lines.find(l => l.label === ln.channel);
  return { id: 'ki' + i.id, iid: i.id, src: i, at: i.at, dir: vm ? 'in' : i.dir || 'in', number: i.number || '', to: mine ? mine.number : ln.number || (lines[0] || {}).number || '', lineLabel: mine ? mine.label : ln.channel || 'Main', customerId: i.customerId || null, contact: i.contact || null, duration: i.duration || 0, status: vm ? 'voicemail' : i.duration ? 'answered' : 'missed', by: vm ? null : i.by || null, summary: i.summary || '', transcript: i.transcript || [], follow: null, resolved: false, archived: false, flag: null, note: '' }; };
const stamp = (c, how, by) => Object.assign(c, { resolved: true, resolvedAt: +WD.now(), resolvedBy: by || me(), resolvedHow: how || 'Handled' });
/** Calling a flagged number back and talking for at least the threshold clears the flag (a setting, on by default). → the calls it cleared. */
function autoResolve(d, c) { const st = ST(d); if (!st.autoResolve || c.dir !== 'out' || c.status !== 'answered' || c.duration < st.threshold) return [];
  const n = dg(c.number), hit = (d.calls || []).filter(x => x !== c && dg(x.number) === n && x.at <= c.at && isOpen(x, st)); hit.forEach(x => stamp(x, 'Called back ' + when(c.at), c.by)); return hit; }
/** Bring calls the timeline flows wrote to data.interactions into the log. Ones that were already there when call review started are history, not work. */
function adopt(d, org, historic) {
  const seen = d.callSeen || (d.callSeen = {}), src = d.interactions || [], st = ST(d); let fresh = null;
  if (d.callSeenN !== src.length) { d.callSeenN = src.length;
    src.forEach(i => { if ((i.type !== 'call' && i.type !== 'voicemail') || seen[i.id]) return; seen[i.id] = 1; const c = fromI(i, org);
      if (historic) { if (why(c, st)) { c.resolved = true; c.resolvedHow = 'Before call review was turned on'; } } else (fresh = fresh || []).push(c); d.calls.push(c); }); }
  d.calls.forEach(c => { if (c.src) { c.customerId = c.src.customerId || null; c.summary = c.src.summary || ''; c.transcript = c.src.transcript || []; } });
  if (fresh) fresh.forEach(c => autoResolve(d, c));
}
function seed(d, org) {
  const lines = org.lines && org.lines.length ? org.lines : [{ label: 'Main', number: '+15125550300' }], area = (org.areaCodes || ['512'])[0];
  const cs = (d.customers || []).filter(c => !c.archived && (c.contacts || []).some(p => p.phone)), reg = cs.filter(c => !PIPE.includes(c.lifecycle)), leads = cs.filter(c => PIPE.includes(c.lifecycle) && c.lifecycle !== 'lost');
  const staff = (d.users || []).filter(u => ['owner', 'admin', 'dispatcher', 'office'].includes(u.role)).map(u => u.name); if (!staff.length) staff.push('Office');
  const now = +WD.now(), day0 = new Date(+D.parse(D.today())).setHours(0, 0, 0, 0);
  d.calls = []; d.callsOrg = org.id; d.callSeen = {}; d.callSeenN = -1;
  ROWS.forEach(([days, mins, dir, who, ln, status, dur, sf, tpl, done], k) => {
    const pool = who[0] === 'c' ? (reg.length ? reg : cs) : who[0] === 'l' ? (leads.length ? leads : cs) : [], c = pool.length ? pool[+who.slice(1) % pool.length] : null, p = c && c.contacts.find(x => x.phone), u = c ? null : UNK[(who[0] === 'u' ? +who.slice(1) : k) % UNK.length];
    const line = lines[ln % lines.length], by = status === 'answered' || dir === 'out' ? staff[sf % staff.length] : null, T = TPL[tpl], whoName = c ? p.name : u[0] || 'Caller';
    const put = s => s.replace(/\{who\}/g, whoName).replace(/\{n\}/g, first(whoName)).replace(/\{st\}/g, first(by || staff[0])).replace(/\{biz\}/g, org.name).replace(/\{s\}/g, dur);
    let at = day0 - days * DAY + mins * 60000; if (at > now - 120000) at = now - (k + 2) * 150000;
    d.calls.push({ id: org.id + 'k' + (k + 1), at, dir, number: c ? p.phone : '+1' + area + '555' + u[1], to: line.number, lineLabel: line.label, customerId: c ? c.id : null, contact: c ? p.name : u[0] || null, duration: dur, status, by,
      summary: put(T.s), transcript: (T.t || []).map(([a, b]) => [put(a), put(b)]), follow: dir === 'in' && T.f ? { pri: T.f[0], text: T.f[1], verb: T.f[2] || null } : null,
      resolved: !!done, resolvedHow: done || null, resolvedBy: done ? staff[(k + 1) % staff.length] : null, resolvedAt: done ? at + 35 * 60000 : null, archived: false, flag: null, note: '' });
  });
  adopt(d, org, true);
}
/** The live array of a business's calls (the one in front when no id is given). Seeds it the first time. */
function callsOf(orgId) { const id = orgId || frontId(), d = dataFor(id), org = orgOf(id); if (!d.calls || d.callsOrg !== id) seed(d, org); else adopt(d, org, false); return d.calls; }
/** Every call of a business, newest first. Unknown numbers that now belong to a customer or lead are linked on the way. */
function list(orgId) { const d = dataFor(orgId), cs = callsOf(orgId); let map = null, ids = null;
  cs.forEach(c => { if (c.customerId) { ids = ids || new Set((d.customers || []).map(x => x.id)); if (ids.has(c.customerId)) return; c.customerId = null; }
    if (c.src) return; map = map || phoneMap(d); const hit = map[dg(c.number)]; if (hit) { c.customerId = hit.c.id; c.contact = hit.p.name; } });
  return cs.slice().sort((a, b) => b.at - a.at); }
const byId = id => callsOf().find(c => c.id === id) || null;
let seq = 0;
const add = o => { const cs = callsOf(), c = Object.assign({ id: frontId() + 'n' + Date.now().toString(36) + (++seq), at: +WD.now(), customerId: null, contact: null, duration: 0, by: null, summary: '', transcript: [], follow: null, resolved: false, archived: false, flag: null, note: '' }, o); cs.push(c); return c; };

const undo = (title, fn) => ui.banner({ title, text: 'Tap to undo.', icon: 'arrow.uturn.left', color: 'var(--gray)', duration: 6000, onTap: () => { fn(); WD.changed(); ui.toast('Undone', 'arrow.uturn.left'); } });
const canEdit = () => WD.can('crm.edit') || (ui.toast('You can’t change calls with this role', 'lock'), false);
/** Handled: drops out of the default log and off the Needs review list. */
C.resolve = (cs, how, quiet) => { cs = [].concat(cs).filter(c => c && !c.resolved); if (!cs.length || !canEdit()) return; cs.forEach(c => stamp(c, how)); WD.changed();
  if (!quiet) undo(cs.length === 1 ? 'Resolved · ' + nameOf(cs[0]) : plural(cs.length, 'call') + ' resolved', () => cs.forEach(c => { c.resolved = false; c.resolvedAt = c.resolvedBy = c.resolvedHow = null; })); };
/** Archived: hidden everywhere unless “Archived” is switched on in the log. */
C.archive = cs => { cs = [].concat(cs).filter(c => c && !c.archived); if (!cs.length || !canEdit()) return; cs.forEach(c => { c.archived = true; c.archivedAt = +WD.now(); c.archivedBy = me(); }); WD.changed();
  undo(cs.length === 1 ? 'Archived · ' + nameOf(cs[0]) : plural(cs.length, 'call') + ' archived', () => cs.forEach(c => { c.archived = false; })); };
C.reopen = cs => { cs = [].concat(cs).filter(c => c && (c.resolved || c.archived)); if (!cs.length || !canEdit()) return; const was = cs.map(c => [c, c.resolved, c.archived, c.resolvedHow, c.resolvedBy, c.resolvedAt]);
  cs.forEach(c => { c.resolved = c.archived = false; c.resolvedAt = c.resolvedBy = c.resolvedHow = null; }); WD.changed();
  undo(plural(cs.length, 'call') + ' reopened', () => was.forEach(([c, r, a, hw, by, at]) => { c.resolved = r; c.archived = a; c.resolvedHow = hw; c.resolvedBy = by; c.resolvedAt = at; })); };
/** Open flagged calls of the business in front: drives the Dialer tab's badge. */
C.reviewCount = () => { try { if (!S.signedIn || !WD.can('crm.view')) return 0; const st = ST(); return callsOf().filter(c => isOpen(c, st)).length; } catch (e) { return 0; } };
C.list = list; C.why = why; C.isOpen = c => isOpen(c);
C.forCustomer = id => list().filter(c => c.customerId === id);

/* ================= Small pieces ================= */
const dirIcon = c => { const un = c.status !== 'answered', col = c.status === 'missed' ? (c.dir === 'in' ? 'var(--red)' : 'var(--gray)') : c.status === 'voicemail' ? 'var(--orange)' : c.dir === 'in' ? 'var(--green)' : 'var(--blue)';
  return h('div.cl-di', { style: { '--c': col }, title: (c.dir === 'in' ? 'Inbound' : 'Outbound') + (un ? ', ' + c.status : '') }, icon(c.status === 'voicemail' ? 'voicemail' : c.status === 'missed' ? 'phone.down' : c.dir === 'in' ? 'arrow.down' : 'arrow.up.right', 17)); };
const statusBadge = c => c.status === 'answered' ? ui.badge(c.dir === 'in' ? 'Answered' : 'Talked', 'var(--green)') : c.status === 'missed' ? ui.badge(c.dir === 'in' ? 'Missed' : 'No answer', c.dir === 'in' ? 'var(--red)' : 'var(--gray)') : ui.badge(c.dir === 'in' ? 'Voicemail' : 'Left voicemail', c.dir === 'in' ? 'var(--orange)' : 'var(--gray)');
const orgTag = org => h('span.cl-org', { style: { '--c': org.color } }, h('i'), org.short || org.name);
const subLine = c => [c.customerId && c.contact, fmt.phone(c.number), c.lineLabel + ' line', c.by && first(c.by)].filter(Boolean).join(' · ');
/** One call as a list row. o: {select, picked, onTap, info: fn} */
function callRow(c, o = {}) { const st = ST(), y = why(c, st), open = !!y && !c.resolved && !c.archived;
  return ui.row({ leading: o.select ? h('div.cl-pick' + (o.picked ? '.on' : ''), icon(o.picked ? 'checkmark.circle.fill' : 'circle', 24)) : dirIcon(c),
    title: h('span.cl-t', nameOf(c), open && h('i.cl-flagdot', { title: 'Needs review' })),
    subtitle: [h('div', subLine(c)), c.summary && h('div.cl-snip', c.summary), h('div.cl-badges', statusBadge(c), open && !['Missed', 'Voicemail'].includes(y) && ui.badge(y, 'var(--orange)'), c.resolved && ui.badge('Resolved', 'var(--gray)'), c.archived && ui.badge('Archived', 'var(--gray)'))],
    trailing: [h('div.cl-meta', h('div', when(c.at)), h('div', durLabel(c))), o.info && ui.iconBtn('info.circle', 'Call details', o.info)], onTap: o.onTap }); }
const pad = (onKey, mini) => h('div.cl-pad' + (mini ? '.mini' : ''), [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].map(([k, l]) => h('button.cl-key', { 'aria-label': k, onclick: () => onKey(k) }, k, h('small', l))));
/** A sheet to choose one of this business's customers or leads. */
function pickCustomer(title, done) { let term = '';
  const sheet = ui.sheet({ title, leading: [{ label: 'Cancel', onTap: pg => pg.dismiss() }], search: { placeholder: 'Search customers and leads', onInput: (v, pg) => { term = v; pg.refresh(); } },
    render: () => { const t = term.trim().toLowerCase(), cs = (data.customers || []).filter(c => !c.archived && (!t || c.name.toLowerCase().includes(t) || (c.contacts || []).some(p => (p.name || '').toLowerCase().includes(t)))).slice(0, 40);
      return ui.list(cs.length ? ui.section(null, cs.map(c => ui.row({ leading: h('div', { style: 'margin-right:12px' }, ui.avatar(c.name, { size: 34 })), title: c.name, subtitle: ((c.contacts || [])[0] || {}).name || null, detail: PIPE.includes(c.lifecycle) ? 'Lead' : null, onTap: () => { sheet.close(); setTimeout(() => done(c), 450); } }))) : ui.empty({ icon: 'person.2', title: 'No match', text: 'Try another name.' })); } }, { detent: 'large' }); }
const addNumberTo = (number, after) => pickCustomer('Add to customer', async cu => { if (!canEdit()) return;
  if (await ui.run('Adding number…', () => { cu.contacts.push({ name: 'Caller ' + fmt.phone(number), role: '', phone: norm(number), email: '' }); }, { done: 'Number added to ' + cu.name })) { WD.changed(); after && after(cu); } });
const newLead = (number, label) => { const cs = WD.screens.customers; if (!cs || !cs.openNew) return ui.toast('Customers aren’t available', 'lock'); cs.openNew({ phone: number, channel: (K().CHANNELS || []).includes(label) ? label : '' }); };
const openRecord = cu => { const lead = PIPE.includes(cu.lifecycle); if (lead && WD.screens.crm && WD.screens.crm.openLead) WD.screens.crm.openLead(cu.id); else if (WD.screens.customers && WD.screens.customers.openDetail) WD.screens.customers.openDetail(cu.id); };

/* ================= Which of our numbers a call goes out from (5.1) ================= */
/* Each service area has its own local number. A call back goes out from the number the person called in on; a first call goes out from the
   number with their area code, or failing that the one nearest to it; the main number is the last resort. Rough centers of the area codes we serve. */
const AC = { 512: [30.27, -97.74], 559: [36.74, -119.78], 661: [35.37, -119.02], 209: [37.96, -121.29], 415: [37.77, -122.42], 916: [38.58, -121.49], 805: [34.42, -119.7], 831: [36.6, -121.89], 213: [34.05, -118.24], 818: [34.18, -118.44], 760: [33.2, -117.2], 330: [41.08, -81.52], 216: [41.5, -81.69], 440: [41.4, -81.9], 234: [41.08, -81.52], 614: [39.96, -83], 419: [41.65, -83.54], 404: [33.75, -84.39], 770: [33.95, -84.55], 678: [33.9, -84.4], 470: [33.8, -84.4], 706: [33.47, -81.97], 912: [32.08, -81.09] };
const far = (a, b) => Math.hypot((a[0] - b[0]) * 69, (a[1] - b[1]) * 55);
/** → {line, why, how: 'same' | 'area' | 'near' | 'main'} for a number we are about to call. */
C.pickLine = number => { const org = cur(), lines = org.lines || [], n = dg(number), main = lines[0] || { label: 'Main', number: '' }, area = n.slice(0, 3);
  let last = null; try { last = list().find(c => c.dir === 'in' && dg(c.number) === n && lines.some(l => dg(l.number) === dg(c.to))); } catch (e) { /* no log yet */ }
  if (last) { const l = lines.find(x => dg(x.number) === dg(last.to)); return { line: l, how: 'same', why: 'the number they called us on' }; }
  const same = lines.find(l => dg(l.number).slice(0, 3) === area); if (same) return { line: same, how: 'area', why: 'our local ' + area + ' number' };
  if (AC[area]) { const near = lines.filter(l => AC[dg(l.number).slice(0, 3)]).map(l => ({ l, d: far(AC[area], AC[dg(l.number).slice(0, 3)]) })).sort((a, b) => a.d - b.d)[0]; if (near && near.d < 220) return { line: near.l, how: 'near', why: 'our closest number to the ' + area + ' area code' }; }
  return { line: main, how: 'main', why: 'no local number near ' + (area || 'them') }; };

/* ================= Placing a call ================= */
/** o: {number, from: one of our lines, to: our number to call from, customerId, contact, back: the flagged call being returned}. Shows the
    in-call sheet; End writes the call to the log, and to the customer's timeline when the number belongs to one. */
function place(o) {
  if (!WD.can('crm.view')) return ui.toast('Calling needs customer access', 'lock');
  const num = norm(o.number); if (dg(num).length < 3) return ui.toast('Enter a number first', 'phone');
  if (S.offline) return ui.toast('You’re offline. Quo calls need a connection.', 'wifi.slash');
  callsOf();
  const org = cur(), lines = org.lines || [], auto = !o.from && !lines.some(l => dg(l.number) === dg(o.to)) ? C.pickLine(num) : null, line = o.from || lines.find(l => dg(l.number) === dg(o.to)) || (auto && auto.line) || lines[0] || { label: 'Main', number: '' };
  const lineWhy = o.from ? 'chosen by you' : auto ? auto.why : 'the number they called us on';
  const hit = phoneMap(data)[dg(num)], cu = (o.customerId && q.customer(o.customerId)) || (hit && hit.c) || null;
  const p = cu ? (hit && hit.c === cu && hit.p) || (cu.contacts || []).find(x => x.phone) || (cu.contacts || [])[0] || null : null;
  const title = cu ? cu.name : o.contact || fmt.phone(num), t0 = Date.now(); let conn = null, ended = false, notes = '', held = false, tones = '';
  const live = h('div.cl-live', 'Calling…'), toneEl = h('div.cl-tones'), R15 = WD.r15 || {};
  R15.callBegin && R15.callBegin({ dir: 'out', number: num, line, customerId: cu ? cu.id : null, contact: p ? p.name : o.contact || null });
  const tick = setInterval(() => { if (!conn && Date.now() - t0 > 2400) { conn = Date.now(); live.classList.add('on'); } live.textContent = conn ? (held ? 'On hold · ' : '') + mmss((Date.now() - conn) / 1000) : 'Calling…'; }, 250);
  const finish = () => { if (ended) return; ended = true; clearInterval(tick); R15.callEnd && R15.callEnd();
    const dur = conn ? Math.max(1, Math.round((Date.now() - conn) / 1000)) : 0, st = ST(), lead = cu && PIPE.includes(cu.lifecycle), back = o.back, meN = me(), them = p ? p.name : o.contact || 'Caller';
    const summary = notes.trim() || (!dur ? 'No answer. Hung up before anyone picked up.' : dur < st.threshold ? 'Short call: ended after ' + dur + ' s.'
      : back ? 'Called back about the ' + (back.status === 'voicemail' ? 'voicemail' : back.status === 'missed' ? 'missed call' : 'earlier call') + ' from ' + when(back.at) + '. Sorted out on the call; nothing else to do.'
      : lead ? 'Followed up on the request. They want to start next month; send the service agreement.' : cu ? 'Confirmed the next pickup and the container count. No changes.' : 'Spoke with the caller. Quo adds the full transcript when the recording is ready.');
    const transcript = dur >= st.threshold ? [[meN, 'Hi' + (p ? ' ' + first(p.name) : '') + ', it’s ' + first(meN) + ' from ' + org.name + '.'], [them, back ? 'Thanks for calling back so quickly.' : 'Hi, thanks for the call.'], [meN, 'Happy to help. I’ll note this on your account.']] : [];
    let src = null;
    if (cu && K().addI) { src = K().addI({ customerId: cu.id, type: 'call', dir: 'out', at: +WD.now(), duration: dur, contact: them, number: num, line: { number: line.number, channel: line.label }, by: meN, summary, transcript }); (data.callSeen || (data.callSeen = {}))[src.id] = 1; }
    const c = add({ dir: 'out', number: num, to: line.number, lineLabel: line.label, customerId: cu ? cu.id : null, contact: p ? p.name : o.contact || null, duration: dur, status: dur ? 'answered' : 'missed', by: meN, summary, transcript, note: notes.trim() });
    if (src) { c.src = src; c.iid = src.id; c.at = src.at; }
    if (cu && cu.lifecycle === 'lead' && dur >= st.threshold) cu.lifecycle = 'contacted';
    const cleared = autoResolve(data, c); WD.changed();
    setTimeout(() => {
      if (cleared.length) ui.banner({ title: 'Called back · flag cleared', text: nameOf(c) + ' is off the Needs review list' + (cleared.length > 1 ? ' (' + cleared.length + ' calls)' : '') + '. Tap to undo.', icon: 'checkmark', color: 'var(--green)', duration: 6000, onTap: () => { cleared.forEach(x => { x.resolved = false; x.resolvedAt = x.resolvedBy = x.resolvedHow = null; }); WD.changed(); } });
      else if (back && isOpen(back)) ui.banner({ title: 'Still needs review', text: (!st.autoResolve ? 'Calling back doesn’t clear flags by itself' : dur ? 'That call was under ' + st.threshold + ' s' : 'Nobody answered') + ', so ' + nameOf(back) + ' stays on the list. Tap to resolve it anyway.', icon: 'flag', color: 'var(--orange)', duration: 7000, onTap: () => C.resolve(back, 'Resolved by hand after calling back') });
      else ui.toast(cu ? 'Call logged to ' + cu.name : 'Call logged', 'checkmark');
    }, 500);
  };
  const tog = (ic, label, fn) => { const b = h('button.cl-cbtn', { 'aria-label': label, onclick: () => { const on = b.classList.toggle('on'); fn && fn(on, b); } }, h('span', icon(ic, 26)), h('small', label)); return b; };
  const notesBox = h('textarea.cl-notes', { placeholder: 'Notes for this call. They become the call’s summary.', style: 'display:none', oninput: e => { notes = e.target.value; } });
  const mini = h('div', { style: 'display:none' }, toneEl, pad(k => { tones += k; toneEl.textContent = tones; }, true), h('div', { style: 'height:14px' }));
  const sheet = ui.sheet({ title: 'Quo call', live: false, onClose: finish, render: () => h('div.cl-call',
    ui.avatar(cu ? cu.name : '#', { size: 72 }), h('div.title2', title),
    h('div.footnote.secondary', [cu && p && p.name, fmt.phone(num)].filter(Boolean).join(' · ')), h('div.caption.secondary', 'From ' + line.label + ' · ' + fmt.phone(line.number) + ' · ' + org.name), h('div.cl-why', icon('phone.fill', 12), 'Calling from ' + lineWhy),
    live, R15.callBrief && R15.callBrief(cu, { number: num }),
    h('div.cl-cgrid', tog('mic', 'Mute'), tog('pause', 'Hold', on => { held = on; }), tog('speaker.wave', 'Speaker'),
      tog('square.grid', 'Keypad', on => { mini.style.display = on ? '' : 'none'; }), tog('pencil', 'Notes', on => { notesBox.style.display = on ? '' : 'none'; if (on) notesBox.focus(); }),
      tog('arrow.left.arrow.right', 'Transfer', (on, b) => { b.classList.remove('on'); ui.toast('Transfers go to another Quo user. Not in the prototype.', 'info.circle', 2600); })),
    mini, notesBox,
    h('button.cl-end', { 'aria-label': 'End call', onclick: () => sheet.close() }, icon('phone.down', 32)), h('div.caption.secondary', { style: 'margin-top:6px' }, 'End')) }, { detent: 'large', dismissable: false });
}
C.place = place;
/** Call the number of a logged call back: from the line it came in on, or for a call we placed, the line C.pickLine chooses. */
C.callBack = c => place({ number: c.number, to: c.dir === 'in' ? c.to : null, customerId: c.customerId, contact: c.contact, back: c });
function textTo(c) { if (!canEdit()) return; const cu = custOf(c), nm = first(c.contact || ''), un = c.status !== 'answered' && c.dir === 'in';
  let text = (nm && cu ? 'Hi ' + nm + ', ' : 'Hi, ') + (un ? 'sorry we missed your call. ' : '') + 'This is ' + first(me()) + ' from ' + cur().name + '. ' + (un ? 'How can we help?' : 'Following up on our call.');
  ui.sheet({ title: 'Text ' + fmt.phone(c.number), leading: [{ label: 'Cancel', onTap: pg => pg.dismiss() }],
    trailing: [{ label: 'Send', bold: true, onTap: async pg => { if (!text.trim()) return; const at = +WD.now();
      if (await ui.run('Sending text…', () => { c.texted = at; if (cu && K().addI) K().addI({ customerId: cu.id, type: 'text', at, contact: c.contact || nameOf(c), number: c.number, line: { number: c.to, channel: c.lineLabel }, messages: [{ dir: 'out', text: text.trim(), at, by: me() }] }); }, { done: 'Text sent' })) { pg.dismiss(); WD.changed(); } } }],
    render: () => ui.list(ui.section({ footer: 'Sent from ' + c.lineLabel + ' · ' + fmt.phone(c.to) + ' through Quo.' + (cu ? ' It is added to ' + cu.name + '’s timeline.' : '') }, ui.inputRow({ label: 'Message', multiline: true, value: text, autofocus: true, onInput: v => { text = v; } }))) }, { detent: 'medium' }); }

/* ================= Call detail ================= */
C.detailSpec = id => ({ title: 'Call', render: page => {
  const c = byId(id); if (!c) return ui.empty({ icon: 'phone', title: 'Call not found', text: 'It may belong to the other business.' });
  list(); const st = ST(), cu = custOf(c), lead = cu && PIPE.includes(cu.lifecycle), y = why(c, st), open = !!y && !c.resolved && !c.archived, edit = WD.can('crm.edit'), re = () => { WD.changed(); page.refresh(); };
  const qa = (ic, label, fn, off) => h('button.cl-qa', { disabled: !!off, onclick: fn }, icon(ic, 22), label);
  const track = h('i'); let playing = false;
  const play = h('button.cl-play', { 'aria-label': 'Play recording', onclick: () => { playing = !playing; fill(play, icon(playing ? 'stop.fill' : 'play.fill', 18)); track.style.transition = playing ? 'width ' + Math.max(3, Math.min(c.duration, 14)) + 's linear' : 'none'; track.style.width = playing ? '100%' : '0'; } }, icon('play.fill', 18));
  const others = list().filter(x => x.id !== c.id && dg(x.number) === dg(c.number)).slice(0, 5), ai = WD.aip && WD.aip.on() && aiItems().find(i => i.call === c);
  return ui.list(
    h('div.cl-head', ui.avatar(cu ? cu.name : c.contact || '#', { size: 56 }), h('div.m', h('div.title3', nameOf(c)), h('div.footnote.secondary', [cu && c.contact, fmt.phone(c.number)].filter(Boolean).join(' · ')),
      h('div.cl-badges', statusBadge(c), cu ? ui.badge(lead ? 'Lead' : 'Customer', lead ? 'var(--blue)' : 'var(--green)') : ui.badge('Unknown number', 'var(--gray)'), c.resolved && ui.badge('Resolved', 'var(--gray)'), c.archived && ui.badge('Archived', 'var(--gray)')))),
    open && h('div.cl-flag', icon('flag', 20), h('div.t', h('b', 'Needs review: ' + y), h('div.footnote', 'Stays on the list until someone resolves it' + (st.autoResolve ? ' or calls back and talks for ' + st.threshold + ' s.' : '.'))),
      ui.button('Call back now', { small: true, block: false, icon: 'phone.fill', onTap: () => C.callBack(c) }), ui.button('Resolve', { kind: 'gray', small: true, block: false, disabled: !edit, onTap: () => { C.resolve(c); page.refresh(); } })),
    h('div.cl-qas', qa('phone.fill', 'Call back', () => C.callBack(c)), qa('message', 'Text', () => textTo(c), !edit),
      cu ? qa('person.crop.circle', lead ? 'Open lead' : 'Open customer', () => openRecord(cu)) : qa('person.badge.plus', 'Create lead', () => newLead(c.number, c.lineLabel), !edit),
      qa('pencil', c.note ? 'Edit note' : 'Add note', async () => { const v = RC.ask ? await RC.ask('Note on this call', 'What happened or what to do next', c.note) : null; if (v != null) { c.note = String(v).trim(); re(); } }, !edit)),
    ai && h('div.cl-aiwrap', WD.aip.card({ title: 'AI call review', text: aiSentence(ai) })),
    ui.section({ header: 'Summary', fold: false, footer: c.status === 'missed' ? null : 'Written by Quo from the recording.' }, h('div.cl-line', c.summary || 'No summary.')),
    c.note && ui.section({ header: 'Note', fold: false }, h('div.cl-line', c.note)),
    c.status !== 'missed' && c.duration > 0 && ui.section({ header: c.status === 'voicemail' ? 'Voicemail' : 'Recording', fold: false, footer: 'Kept by Quo. The prototype has no audio.' }, h('div.cl-rec', play, h('div.cl-track', track), h('span.footnote.secondary', mmss(c.duration)))),
    (c.transcript || []).length ? ui.section({ header: 'Transcript', fold: false }, c.transcript.map(([who, text]) => h('div.cl-line', h('b', who), text))) : null,
    ui.section({ header: 'Details', fold: false },
      ui.row({ title: 'When', detail: when(c.at) }), ui.row({ title: 'Direction', detail: c.dir === 'in' ? 'Inbound' : 'Outbound' }), ui.row({ title: 'Length', detail: durLabel(c) }),
      ui.row({ title: 'Our number', detail: c.lineLabel + ' · ' + fmt.phone(c.to) }), c.by && ui.row({ title: c.dir === 'in' ? 'Answered by' : 'Called by', detail: c.by }),
      c.texted && ui.row({ title: 'Texted', detail: when(c.texted) }),
      c.resolved && ui.row({ title: 'Resolved', subtitle: c.resolvedHow || null, detail: [c.resolvedBy && first(c.resolvedBy), c.resolvedAt && when(c.resolvedAt)].filter(Boolean).join(' · ') || 'Yes' })),
    !cu && edit && ui.section({ footer: 'The call and any later ones from this number then show under that customer.' }, ui.row({ icon: 'person.2', iconPlain: true, title: 'Add to an existing customer', tint: true, onTap: () => addNumberTo(c.number, () => page.refresh()) })),
    edit && ui.section({ footer: 'Resolved calls leave the default log. Archived calls are hidden everywhere unless “Archived” is switched on in the log.' },
      c.resolved ? ui.row({ icon: 'arrow.uturn.left', iconPlain: true, title: 'Reopen', tint: true, onTap: () => { C.reopen(c); page.refresh(); } }) : ui.row({ icon: 'checkmark.circle', iconPlain: true, title: 'Resolve', subtitle: 'Handled. Nothing more to do.', tint: true, onTap: () => { C.resolve(c); page.refresh(); } }),
      c.archived ? ui.row({ icon: 'tray', iconPlain: true, title: 'Restore from archive', tint: true, onTap: () => { c.archived = false; re(); ui.toast('Restored', 'checkmark'); } }) : ui.row({ icon: 'archivebox', iconPlain: true, title: 'Archive', subtitle: 'Spam, wrong numbers and anything not worth keeping in view', tint: true, onTap: () => { C.archive(c); page.refresh(); } }),
      !why({ ...c, flag: null }, st) && ui.row({ icon: 'flag', iconPlain: true, iconColor: 'var(--orange)', title: c.flag === 'manual' ? 'Remove the review flag' : 'Flag for review', onTap: () => { if (c.flag === 'manual') c.flag = null; else { c.flag = 'manual'; c.flagBy = me(); c.resolved = false; } re(); } })),
    others.length ? ui.section({ header: 'Other calls with this number', fold: false }, others.map(x => callRow(x, { onTap: () => page.push(C.detailSpec(x.id)) }))) : null);
} });

/* ================= Dialer tab ================= */
const UI = { seg: 'keypad', typed: '', from: {} };
function keypadView(page) {
  const org = cur(), lines = org.lines || [], sel = UI.from[org.id], isAuto = sel == null || sel === 'auto', idx = isAuto ? -1 : Math.min(sel, Math.max(0, lines.length - 1)), from = isAuto ? null : lines[idx] || { label: 'Main', number: '' };
  const fromB = h('b', isAuto ? 'Automatic · local number' : from.label + ' · ' + fmt.phone(from.number));
  const disp = h('div.cl-num', { role: 'button', title: 'Tap to type or paste a number', onclick: async () => { const v = RC.ask ? await RC.ask('Number to call', '555-0100', fmt.phoneTyping(UI.typed), null, 'tel') : null; if (v != null) { UI.typed = String(v).replace(/[^\d*#]/g, '').slice(0, 15); sync(); } } });
  const sub = h('div.cl-sub'), hits = h('div.cl-hits'), callBtn = h('button.cl-callbtn', { 'aria-label': 'Call', onclick: () => { const n = UI.typed; if (dg(n).length < 3) return ui.toast('Enter a number first', 'phone'); UI.typed = ''; sync(); place(from ? { number: n, from } : { number: n }); } }, icon('phone.fill', 32));
  const autoWhy = h('div.cl-autowhy');
  const del = h('button.cl-del', { 'aria-label': 'Delete', onclick: () => { UI.typed = UI.typed.slice(0, -1); sync(); } }, icon('delete.left', 28));
  function sync() { const t = UI.typed, n = t.replace(/\D/g, '');
    disp.textContent = t ? (/[*#]/.test(t) || n.length > 10 ? t : fmt.phoneTyping(t)) : 'Enter a number'; disp.classList.toggle('blank', !t); del.style.visibility = t ? 'visible' : 'hidden'; callBtn.disabled = n.length < 3;
    const found = []; if (n.length >= 2) for (const c of data.customers || []) { if (c.archived) continue; const p = (c.contacts || []).find(x => dg(x.phone).includes(n)); if (p) found.push({ c, p }); if (found.length >= 12) break; }
    if (isAuto) { const pk = n.length >= 3 ? C.pickLine(t) : null; fromB.textContent = pk ? pk.line.label + ' · ' + fmt.phone(pk.line.number) : 'Automatic · local number'; autoWhy.textContent = pk ? 'Automatic: ' + pk.why : 'Automatic: the number they called us on, or the closest local one'; }
    const exact = found.find(x => dg(x.p.phone) === dg(t)); sub.textContent = exact ? exact.p.name + ' · ' + exact.c.name : found.length > 2 ? plural(found.length, 'match') + (found.length >= 12 ? ' or more' : '') : '';
    fill(hits, exact ? [] : found.slice(0, 2).map(({ c, p }) => h('button.cl-hit', { onclick: () => { UI.typed = dg(p.phone); sync(); } }, ui.avatar(c.name, { size: 34 }), h('div.m', h('div.n', c.name), h('div.p', p.name + ' · ' + fmt.phone(p.phone))), ui.badge(PIPE.includes(c.lifecycle) ? 'Lead' : 'Customer', PIPE.includes(c.lifecycle) ? 'var(--blue)' : 'var(--green)')))); }
  sync();
  return h('div.cl-kp',
    h('button.cl-from', { onclick: e => ui.menu(e.currentTarget, [{ header: 'Call from' }, { label: 'Automatic', subtitle: 'The number they called us on, or the closest local one', checked: isAuto, onTap: () => { UI.from[org.id] = 'auto'; page.refresh(); } }].concat(lines.map((l, i) => ({ label: l.label + ' · ' + fmt.phone(l.number), checked: i === idx, onTap: () => { UI.from[org.id] = i; page.refresh(); } })))) }, 'Call from', fromB, icon('chevron.up.chevron.down', 13)), isAuto && autoWhy,
    h('div.cl-zone', disp, sub, hits), pad(k => { if (UI.typed.length < 15) { UI.typed += k; sync(); } }), h('div.cl-go', h('span'), callBtn, del));
}
/* 5.2: Calls is one segment with an Inbox (what still needs someone) and All, and an agent filter shared with Texts (r16.js). */
const TS = () => WD.staff, agentOK = c => !TS() || TS().agentOK(c.by);
function callsView(page) { const T = TS(), n = C.reviewCount(); if (!T) return [recentView(page)];
  return [T.liveStrip(), T.boxBar('callBox', n, page, T.agentNames()), T.box('callBox') === 'inbox' ? reviewView(page) : recentView(page)]; }
function recentView(page) { const cs = list().filter(c => !c.archived && agentOK(c)).slice(0, 25);
  return cs.length ? ui.section({ footer: 'Tap a call to call back from the same line. ⓘ opens the call. The call log has every call and the filters.' }, cs.map(c => callRow(c, { onTap: () => C.callBack(c), info: () => page.push(C.detailSpec(c.id)) })),
    ui.row({ title: 'Open the call log', tint: true, center: true, onTap: () => page.push(C.logSpec()) })) : ui.empty({ icon: 'phone', title: 'No calls yet', text: 'Calls on your Quo numbers show here.' }); }
function reviewView(page) { const st = ST(), cs = list().filter(c => isOpen(c, st) && agentOK(c)), edit = WD.can('crm.edit');
  return [C.aiCard(s => page.push(s)),
    cs.length ? [h('div.footnote.secondary', { style: 'margin:12px 4px 0' }, plural(cs.length, 'call') + ' not answered or under ' + st.threshold + ' s. Each stays here until someone resolves it' + (st.autoResolve ? ' or calls back.' : '.')),
      cs.map(c => { const y = why(c, st); return h('div.cl-rev', h('div.cl-rev-top', { onclick: () => page.push(C.detailSpec(c.id)) }, dirIcon(c),
        h('div.cl-rev-main', h('div.cl-t', nameOf(c)), h('div.footnote.secondary', subLine(c)), c.summary && c.status !== 'missed' && h('div.cl-snip.footnote', c.summary)),
        h('div.cl-meta', ui.badge(y, y === 'Missed' ? 'var(--red)' : 'var(--orange)'), h('div', when(c.at)))),
        h('div.cl-rev-btns', ui.button('Call back now', { small: true, icon: 'phone.fill', onTap: () => C.callBack(c) }), ui.button('Resolve', { kind: 'gray', small: true, icon: 'checkmark', disabled: !edit, onTap: () => C.resolve(c) }))); }),
      edit && cs.length > 1 && h('div', { style: 'margin-top:14px' }, ui.button('Resolve all ' + cs.length, { kind: 'plain', onTap: async () => { if (await ui.actionSheet({ title: 'Resolve all ' + cs.length + ' calls?', message: 'They leave this list. You can undo right after.', buttons: [{ label: 'Resolve all', value: true }] })) C.resolve(cs); } }))]
    : ui.empty({ icon: 'checkmark.circle', title: 'Nothing to review', text: 'Missed calls, voicemails and calls under ' + st.threshold + ' s show here until someone resolves them.' })]; }
function root() { return { title: 'Dialer', trailing: page => [{ label: 'Call log', onTap: () => page.push(C.logSpec()) }], render: page => {
  if (!WD.can('crm.view')) return ui.empty({ icon: 'lock', title: 'The dialer needs customer access', text: 'Ask an admin to change your role.' });
  const n = C.reviewCount(), T = TS(), tn = T && WD.texts ? WD.texts.inboxCount() : 0; if (UI.seg === 'recent' || UI.seg === 'review') { if (T) T.ui.callBox = UI.seg === 'review' ? 'inbox' : 'all'; UI.seg = 'calls'; }
  if (!['keypad', 'calls', 'texts', 'team'].includes(UI.seg) || (!T && UI.seg !== 'calls')) UI.seg = 'keypad';
  return ui.list(h('div.cl-dial', ui.segmented([{ value: 'keypad', label: 'Keypad' }, { value: 'calls', label: 'Calls' + (n ? ' · ' + n : '') }].concat(T ? [{ value: 'texts', label: 'Texts' + (tn ? ' · ' + tn : '') }, { value: 'team', label: 'Team' }] : []), UI.seg, v => { UI.seg = v; page.refresh(); })),
    UI.seg === 'keypad' ? keypadView(page) : UI.seg === 'calls' ? callsView(page) : UI.seg === 'texts' ? T.textsView(page) : T.teamView(page)); } }; }
C.ui = UI;
WD.screens.dialer = { root };

/* ================= Call log ================= */
/** Every call, in and out, on every number, with filters. preset: any of {dir, status, line, by, who, range, dur, flagged, text, resolved,
    archived, customerId}, e.g. C.logSpec({customerId: 'c1', resolved: true}) for one customer's calls. */
C.logSpec = (preset = {}) => {
  const F = Object.assign({ dir: '', status: '', line: '', by: '', who: '', range: '', from: D.add(D.today(), -7), to: D.today(), dur: '', flagged: false, text: '', resolved: false, archived: false, customerId: null }, preset);
  const sel = new Set(); let selMode = false, sort = { k: 'at', d: -1 }, limit = 60;
  const VAL = { at: c => c.at, dir: c => c.dir, who: c => nameOf(c).toLowerCase(), number: c => dg(c.number), line: c => c.lineLabel || '', by: c => c.by || '', duration: c => c.duration, status: c => c.status, summary: c => c.summary || '' };
  const COLS = [['at', 'Time'], ['dir', 'In/out'], ['who', 'Who'], ['number', 'Number'], ['line', 'Our number'], ['by', 'Staff'], ['duration', 'Length'], ['status', 'Status'], ['summary', 'Summary']];
  return { title: 'Call log', render: page => {
    if (!WD.can('crm.view')) return ui.empty({ icon: 'lock', title: 'The call log needs customer access' });
    const st = ST(), all = list(), edit = WD.can('crm.edit'), desk = !!S.desktop, org = cur(), bar = h('div.cl-chips'), act = h('div.cl-act'), res = h('div.cl-res');
    const uniq = f => [...new Set(all.map(f).filter(Boolean))].sort(), numOf = l => (all.find(c => c.lineLabel === l) || {}).to;
    const DEFS = [['dir', 'Direction', [['in', 'Inbound'], ['out', 'Outbound']]], ['status', 'Status', [['answered', 'Answered'], ['missed', 'Missed'], ['voicemail', 'Voicemail']]],
      ['line', 'Our number', uniq(c => c.lineLabel).map(l => [l, l + ' · ' + fmt.phone(numOf(l))])], ['by', 'Staff', uniq(c => c.by).map(n => [n, n])],
      ['who', 'Caller', [['known', 'Customers and leads'], ['customer', 'Customers only'], ['lead', 'Leads only'], ['unknown', 'Unknown numbers']]],
      ['range', 'Date', [['today', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['custom', 'Custom range']]], ['dur', 'Length', [['short', 'Under ' + st.threshold + ' s'], ['long', st.threshold + ' s or longer']]]];
    const TOG = [['flagged', 'Flagged', 'flag'], ['resolved', 'Resolved', 'checkmark.circle'], ['archived', 'Archived', 'archivebox']];
    const set = (k, v) => { F[k] = v; limit = 60; draw(); };
    const rows = () => { const t = F.text.trim().toLowerCase(), td = dg(t), now = +WD.now(), today = D.today();
      return all.filter(c => {
        if (c.archived ? !F.archived : c.resolved && !F.resolved) return false;
        if ((F.dir && c.dir !== F.dir) || (F.status && c.status !== F.status) || (F.line && c.lineLabel !== F.line) || (F.by && c.by !== F.by) || (F.customerId && c.customerId !== F.customerId)) return false;
        if (F.who) { const cu = custOf(c), lead = !!cu && PIPE.includes(cu.lifecycle); if (F.who === 'unknown' ? cu : F.who === 'known' ? !cu : F.who === 'lead' ? !lead : !cu || lead) return false; }
        if (F.range === 'today' && D.key(new Date(c.at)) !== today) return false; if ((F.range === '7' || F.range === '30') && now - c.at > +F.range * DAY) return false;
        if (F.range === 'custom') { const k = D.key(new Date(c.at)); if ((F.from && k < F.from) || (F.to && k > F.to)) return false; }
        if (F.dur === 'short' && !(c.status !== 'missed' && c.duration < st.threshold)) return false; if (F.dur === 'long' && c.duration < st.threshold) return false;
        if (F.flagged && !why(c, st)) return false;
        if (t) { const hay = [nameOf(c), c.contact, c.summary, c.note, c.lineLabel, c.by, fmt.phone(c.number)].filter(Boolean).join(' ').toLowerCase(); if (!hay.includes(t) && !(td.length >= 3 && dg(c.number).includes(td))) return false; }
        return true; }); };
    const drawBar = () => fill(bar, DEFS.map(([k, name, opts]) => { const on = opts.find(o => o[0] === F[k]);
        return h('button.chip' + (on ? '.on' : ''), { onclick: e => ui.menu(e.currentTarget, [{ header: name }, { label: 'Any', checked: !on, onTap: () => set(k, '') }].concat(opts.map(([v, l]) => ({ label: l, checked: F[k] === v, onTap: () => set(k, v) })))) }, on ? on[1] : name, icon('chevron.down', 12)); }),
      TOG.map(([k, name, ic]) => h('button.chip' + (F[k] ? '.on' : ''), { title: k === 'flagged' ? 'Only calls flagged for review' : 'Also show ' + name.toLowerCase() + ' calls', onclick: () => set(k, !F[k]) }, icon(ic, 15), name)));
    const drawAct = () => { const x = (text, clear) => h('button.chip.cl-x', { 'aria-label': 'Remove filter ' + text, onclick: clear }, text, icon('xmark', 12)), chips = [];
      if (F.customerId) chips.push(x('Customer: ' + ((q.customer(F.customerId) || {}).name || 'removed'), () => set('customerId', null)));
      DEFS.forEach(([k, name, opts]) => { const on = opts.find(o => o[0] === F[k]); if (on) chips.push(x(name + ': ' + on[1], () => set(k, ''))); });
      TOG.forEach(([k, name]) => { if (F[k]) chips.push(x(k === 'flagged' ? 'Flagged only' : 'Showing ' + name.toLowerCase(), () => set(k, false))); });
      const dates = F.range === 'custom' && h('div.cl-dates', 'From', h('input.pill-input', { type: 'date', value: F.from, max: F.to, onchange: e => { if (e.target.value) { F.from = e.target.value; drawRes(); } } }), 'to', h('input.pill-input', { type: 'date', value: F.to, min: F.from, onchange: e => { if (e.target.value) { F.to = e.target.value; drawRes(); } } }));
      fill(act, chips, chips.length > 1 && ui.button('Clear all', { kind: 'plain', small: true, block: false, onTap: () => { DEFS.forEach(([k]) => { F[k] = ''; }); TOG.forEach(([k]) => { F[k] = false; }); F.customerId = null; draw(); } }), dates && h('div', { style: 'flex-basis:100%' }, dates)); };
    const drawRes = () => { const rs = rows(), openN = rs.filter(c => isOpen(c, st)).length; [...sel].forEach(id => { if (!rs.some(c => c.id === id)) sel.delete(id); });
      const picked = () => rs.filter(c => sel.has(c.id)), flip = id => { sel.has(id) ? sel.delete(id) : sel.add(id); drawRes(); }, done = () => { sel.clear(); selMode = false; drawRes(); };
      const head = h('div.cl-rhead', h('div.footnote.secondary', plural(rs.length, 'call') + (openN ? ' · ' + openN + ' to review' : '') + (!F.resolved && !F.archived ? ' · resolved and archived calls are hidden' : '')), h('span.spacer'),
        edit && !desk && rs.length ? ui.button(selMode ? 'Done' : 'Select', { kind: 'plain', small: true, block: false, onTap: () => { selMode = !selMode; if (!selMode) sel.clear(); drawRes(); } }) : null);
      const b = (label, fn, kind) => ui.button(label, { kind: kind || 'tinted', small: true, block: false, disabled: !sel.size, onTap: fn });
      const bulk = edit && (selMode || sel.size) ? h('div.cl-bulk', h('b', sel.size + ' selected'), h('span.spacer'),
        ui.button(sel.size === rs.length ? 'None' : 'All', { kind: 'plain', small: true, block: false, onTap: () => { if (sel.size === rs.length) sel.clear(); else rs.forEach(c => sel.add(c.id)); drawRes(); } }),
        b('Resolve', () => { const p = picked(); done(); C.resolve(p); }), b('Archive', () => { const p = picked(); done(); C.archive(p); }), picked().some(c => c.resolved || c.archived) && b('Reopen', () => { const p = picked(); done(); C.reopen(p); }, 'gray'),
        desk && ui.button('Cancel', { kind: 'plain', small: true, block: false, onTap: done })) : null;
      const more = rs.length > limit && ui.button('Show ' + Math.min(60, rs.length - limit) + ' more', { kind: 'plain', onTap: () => { limit += 60; drawRes(); } });
      if (!rs.length) return fill(res, head, ui.empty({ icon: 'phone', title: 'No calls match', text: all.length ? 'Remove a filter, or switch on Resolved to see calls that were handled.' : 'Calls on your Quo numbers show here.' }));
      if (desk) { const sorted = rs.slice().sort((a, c2) => { const x = VAL[sort.k](a), y2 = VAL[sort.k](c2); return (x < y2 ? -1 : x > y2 ? 1 : 0) * sort.d || c2.at - a.at; }).slice(0, limit);
        return fill(res, head, bulk, h('table.cl-tab',
          h('thead', h('tr', edit && h('th.c', { title: 'Select all', onclick: () => { if (sel.size === rs.length) sel.clear(); else rs.forEach(c => sel.add(c.id)); drawRes(); } }, icon(sel.size && sel.size === rs.length ? 'checkmark.circle.fill' : 'circle', 18)),
            COLS.map(([k, t]) => h('th' + (sort.k === k ? '.on' : ''), { onclick: () => { sort = { k, d: sort.k === k ? -sort.d : k === 'at' || k === 'duration' ? -1 : 1 }; drawRes(); } }, t, sort.k === k && icon(sort.d > 0 ? 'chevron.up' : 'chevron.down', 11))), h('th', ''))),
          h('tbody', sorted.map(c => { const y = why(c, st), open = !!y && !c.resolved && !c.archived, cu = custOf(c);
            return h('tr' + (sel.has(c.id) ? '.sel' : '') + (c.resolved || c.archived ? '.dim' : ''), { onclick: () => page.push(C.detailSpec(c.id)) },
              edit && h('td.c', { onclick: e => { e.stopPropagation(); flip(c.id); } }, icon(sel.has(c.id) ? 'checkmark.circle.fill' : 'circle', 18)),
              h('td.nw', when(c.at)), h('td', dirIcon(c)), h('td', h('span.cl-t', nameOf(c), open && h('i.cl-flagdot')), cu && c.contact ? h('div.footnote.secondary', c.contact) : null), h('td.nw', fmt.phone(c.number)), h('td.nw', c.lineLabel), h('td.nw', c.by || '—'), h('td.nw', durLabel(c)),
              h('td', h('div.cl-badges', { style: 'margin:0' }, statusBadge(c), open && !['Missed', 'Voicemail'].includes(y) && ui.badge(y, 'var(--orange)'), c.resolved && ui.badge('Resolved', 'var(--gray)'), c.archived && ui.badge('Archived', 'var(--gray)'))),
              h('td.sum', h('div.cl-snip', c.summary)),
              h('td.a', h('div.row-acts', ui.iconBtn('phone.fill', 'Call back', () => C.callBack(c)), edit && !c.resolved && !c.archived ? ui.iconBtn('checkmark', 'Resolve', () => C.resolve(c)) : null))); }))), more); }
      const groups = []; rs.slice(0, limit).forEach(c => { const k = D.key(new Date(c.at)), g = groups[groups.length - 1]; if (g && g.k === k) g.cs.push(c); else groups.push({ k, cs: [c] }); });
      fill(res, head, bulk, h('div.list.cl-inner', groups.map(g => ui.section({ header: dayLabel(g.k), fold: false }, g.cs.map(c => callRow(c, { select: selMode, picked: sel.has(c.id), onTap: () => selMode ? flip(c.id) : page.push(C.detailSpec(c.id)) }))))), more); };
    const draw = () => { drawBar(); drawAct(); drawRes(); };
    draw();
    return h('div.cl-log' + (desk ? '.wide' : ''), C.aiCard(s => page.push(s)), h('div', { style: 'margin-top:4px' }, ui.searchField({ placeholder: 'Name, number or summary', value: F.text, onInput: v => { F.text = v; limit = 60; drawRes(); } })), bar, act, res,
      h('div', { style: 'margin-top:14px' }, ui.note('All calls on ' + (org.lines || []).map(l => l.label + ' ' + fmt.phone(l.number)).join(' and ') + ', received from Quo as each call ends. ' + (desk ? 'Click a column to sort.' : 'Tap Select to resolve or archive several at once.'))));
  } };
};
C.openLog = preset => { WD.nav.switchTab('dialer'); WD.nav.push(C.logSpec(preset)); };

/* ================= AI call review (AI Premium) ================= */
/* What to get back to, written from the transcripts and voicemails of every Quo number, in every business the person works for. */
function aiItems() { const out = [], now = +WD.now(), today = D.today();
  (data.orgs || []).forEach(org => { let d, cs; try { d = dataFor(org.id); cs = list(org.id); } catch (e) { return; } const st = ST(d);
    cs.forEach(c => { if (c.dir !== 'in' || c.archived || c.aiDone || now - c.at > 7 * DAY) return; const open = isOpen(c, st), f = c.follow; if (!open && !(f && !c.resolved && c.status === 'answered')) return;
      const recent = D.diff(today, D.key(new Date(c.at))) <= 1, un = c.status !== 'answered';
      out.push({ call: c, org, d, pri: f ? (f.pri === 'urgent' && !recent ? 'week' : f.pri) : un && recent ? 'urgent' : 'week', verb: (f && f.verb) || (un || open ? 'Call back' : 'Follow up with'), name: nameOf(c, d),
        what: f ? f.text : c.status === 'missed' ? 'missed call, no voicemail' : c.status === 'voicemail' ? 'left a voicemail' : c.flag === 'manual' ? 'flagged for review by ' + first(c.flagBy || 'staff') : 'the call dropped after ' + c.duration + ' s; check they got through',
        kind: c.status === 'voicemail' ? 'voicemail' : c.status === 'missed' ? 'missed call' : 'call' }); }); });
  const rank = { urgent: 0, week: 1, fyi: 2 }; return out.sort((a, b) => rank[a.pri] - rank[b.pri] || b.call.at - a.call.at); }
const aiSentence = it => it.verb + ' ' + it.name + ' — ' + it.what + ', ' + it.kind + ' ' + when(it.call.at) + ', ' + it.call.lineLabel + ' line' + (multi() ? ' (' + it.org.name + ')' : '');
/** A call that belongs to the business that is not in front: offer the switch, then carry on there. */
const inOrg = async (it, fn) => { if (it.org.id === frontId()) return fn(it.call);
  if (!await ui.actionSheet({ title: 'This call is in ' + it.org.name, message: 'Switch to ' + it.org.name + ' to work on it. ' + cur().name + ' stays exactly as you left it.', buttons: [{ label: 'Switch to ' + it.org.name, value: true }] })) return;
  const id = it.call.id; if (!WD.app.switchOrg || WD.app.switchOrg(it.org.id) === false) return; ui.toast('Now in ' + it.org.name, 'building');
  setTimeout(() => { WD.nav.switchTab('dialer'); const c = byId(id); if (c) fn(c); }, 400); };
const mkTask = (c, title) => { if (!canEdit()) return false; if (!c.customerId || !K().addTask) { ui.toast('Follow-ups belong to a customer or lead. Create a lead for this number first.', 'info.circle', 3400); WD.nav.push(C.detailSpec(c.id)); return false; }
  K().addTask(c.customerId, title, 0, { owner: S.me && S.me.id }); c.taskMade = true; WD.changed(); ui.toast('Follow-up added for today', 'checkmark'); return true; };
/** The card at the top of Needs review and of the call log. push: how to open the full review. Nothing without AI Premium. */
C.aiCard = push => WD.aip && WD.aip.block ? WD.aip.block(() => { const its = aiItems(); if (!its.length) return null; const urgent = its.filter(i => i.pri === 'urgent').length, nums = new Set(its.map(i => i.org.id + '|' + i.call.to)).size, orgs = new Set(its.map(i => i.org.id)).size;
  return h('div.cl-aiwrap', WD.aip.card({ title: 'AI call review', text: plural(its.length, 'thing') + ' to get back to from ' + plural(nums, 'phone number') + (orgs > 1 ? ' in ' + orgs + ' businesses' : '') + (urgent ? ' · ' + urgent + ' urgent today' : '') + '.', lines: its.slice(0, 3).map(aiSentence),
    action: ui.button(its.length > 3 ? 'See all ' + its.length : 'Open the review', { kind: 'tinted', small: true, block: false, icon: 'sparkles', onTap: () => (push || WD.nav.push)(C.reviewSpec()) }) })); }) : null;
C.reviewSpec = () => ({ title: 'AI call review', render: page => {
  if (!WD.aip || !WD.aip.on()) return ui.empty({ icon: 'phone', title: 'Nothing here' });
  const its = aiItems(), G = [['urgent', 'Urgent today'], ['week', 'This week'], ['fyi', 'FYI']], lines = (data.orgs || []).flatMap(o => (o.lines || []).map(l => (multi() ? (o.short || o.name) + ' ' : '') + l.label));
  const item = it => { const c = it.call, here = it.org.id === frontId();
    return h('div.cl-ai', h('div.w', { onclick: () => inOrg(it, x => WD.nav.push(C.detailSpec(x.id))) }, h('b', it.verb + ' ' + it.name), ' — ' + it.what,
        h('div.mt', statusBadge(c), when(c.at) + ' · ' + c.lineLabel + ' line', multi() && orgTag(it.org), c.taskMade && ui.badge('Follow-up added', 'var(--green)'))),
      h('div.bt', ui.button('Call back', { small: true, block: false, icon: 'phone.fill', onTap: () => inOrg(it, x => C.callBack(x)) }),
        !c.taskMade && ui.button('Create task', { kind: 'tinted', small: true, block: false, onTap: () => inOrg(it, x => { if (mkTask(x, it.verb + ': ' + it.what)) page.refresh(); }) }),
        ui.button('Mark done', { kind: 'gray', small: true, block: false, onTap: () => { c.aiDone = true; if (isOpen(c, ST(it.d))) stamp(c, 'Marked done in the AI call review'); WD.changed(); page.refresh();
          undo('Done · ' + it.name, () => { c.aiDone = false; if (c.resolvedHow === 'Marked done in the AI call review') { c.resolved = false; c.resolvedAt = c.resolvedBy = c.resolvedHow = null; } }); } })),
      !here && h('div.caption.secondary', { style: 'margin-top:6px' }, 'In ' + it.org.name + '. Calling back or adding a task switches to it first.')); };
  return ui.list(h('div.cl-aiwrap', WD.aip.card({ title: 'AI call review', text: 'What to get back to, written from the transcripts and voicemails of every call Quo received on ' + lines.join(', ') + '. It is rewritten each time a call ends.' })),
    its.length ? G.map(([k, t]) => { const g = its.filter(i => i.pri === k); return g.length ? ui.section({ header: t, fold: false }, g.map(item)) : null; })
      : ui.empty({ icon: 'checkmark.circle', title: 'Nothing to get back to', text: 'No open voicemails, missed calls or promised follow-ups in the last 7 days.' }),
    h('div', { style: 'padding:14px 4px 0' }, ui.note('Urgent today: someone is waiting on a call back. This week: a promise made on a call. FYI: worth knowing, nothing owed. Mark done also resolves the call’s review flag.')));
} });
if (WD.aip && WD.aip.feature) WD.aip.feature('AI call review', 'Dialer → Needs review, and the call log', 'Reads the transcripts and voicemails from every Quo number, in each business you work for, and lists who to get back to and why, most urgent first.');

/* ================= Incoming calls: which business is it for? ================= */
/** Runs fn once the caller card that is about to open has closed again. */
function whenCardCloses(fn) { let seen = false, n = 0; const t = setInterval(() => { const open = !!document.querySelector('.sheet:not(.parked)'); if (open) seen = true; else if (seen || ++n > 24) { clearInterval(t); if (seen) setTimeout(fn, 500); } }, 500); }
/** The caller card for a number nobody knows. Closing it ends the call and logs it. o: {number, to, by, quiet} */
function callerCard(o) {
  const org = cur(), line = (org.lines || []).find(l => dg(l.number) === dg(o.to)) || (org.lines || [])[0] || { label: 'Main', number: o.to || '' }, number = norm(o.number), t0 = Date.now(); let ended = false, timerEl = null, notes = '';
  const tick = setInterval(() => { if (timerEl) timerEl.textContent = 'On call · ' + mmss((Date.now() - t0) / 1000); }, 500), R15 = WD.r15 || {};
  R15.stashForCall && R15.stashForCall(); R15.callBegin && R15.callBegin({ dir: 'in', number, line, customerId: null, contact: null });
  const end = () => { if (ended) return; ended = true; clearInterval(tick); R15.callEnd && R15.callEnd(); const dur = Math.max(1, Math.round((Date.now() - t0) / 1000)), st = ST(), n = notes.trim();
    const c = add({ dir: 'in', number, to: line.number, lineLabel: line.label, duration: dur, status: 'answered', by: me(), summary: n || 'Transcript and summary are processing…', transcript: [], note: n });
    if (!n) setTimeout(() => { c.summary = dur < st.threshold ? 'The call ended after ' + dur + ' s. Nobody spoke after the greeting.' : 'New caller asking what shredding costs for a small office. No record yet: create a lead to follow up.'; WD.changed(); }, 3500);
    WD.changed(); if (dur < st.threshold && !o.quiet) setTimeout(() => ui.banner({ title: 'Short call flagged · ' + dur + ' s', text: fmt.phone(number) + ' is on the Needs review list. Tap to call back.', icon: 'flag', color: 'var(--orange)', onTap: () => C.callBack(c) }), 700); };
  const leave = fn => { sheet.close(); setTimeout(fn, 450); }, edit = WD.can('crm.edit');
  const sheet = ui.sheet({ title: 'Incoming call', live: false, trailing: [{ label: 'End', bold: true, onTap: pg => pg.dismiss() }], onClose: end, render: () => { timerEl = h('span.cl-oncall', 'On call · ' + mmss((Date.now() - t0) / 1000));
    return [h('div.cl-caller', ui.avatar('#', { size: 52 }), h('div', h('div.title3', fmt.phone(number)), h('div.footnote', 'Unknown caller · ' + line.label + ' line' + (multi() ? ' · ' + org.name : '')), timerEl)),
      ui.list(ui.section({ showFooter: true, footer: o.by === 'area' ? 'Nobody in ' + (multi() ? 'either business' : 'the business') + ' has this number. ' + org.name + ' opened because of the ' + dg(number).slice(0, 3) + ' area code.' : 'No customer, contact or lead matches this number. It rang the ' + line.label + ' line of ' + org.name + '.' },
          ui.row({ icon: 'person.badge.plus', iconPlain: true, title: 'Create lead', tint: true, disabled: !edit, onTap: () => leave(() => newLead(number, line.label)) }),
          ui.row({ icon: 'person.2', iconPlain: true, title: 'Add to existing customer', tint: true, disabled: !edit, onTap: () => addNumberTo(number, cu => leave(() => openRecord(cu))) })),
        ui.section(null, ui.inputRow({ label: 'Notes', multiline: true, placeholder: 'What they need', value: notes, onInput: v => { notes = v; } })))]; } }, { detent: 'medium' });
}
/** A Quo call is ringing: {number: the caller, to: the Quo number they dialed}. Opens the business it is for (Settings → Businesses and
    area codes), says why, and shows the caller card. When the card closes, offers the way back to the business the person was in. */
C.incoming = (o = {}) => {
  if (!WD.can('crm.view')) return ui.toast('Caller cards need customer access', 'lock');
  const r = WD.orgs.findCaller(o.number, { to: o.to }), here = cur(), other = !!r.org && r.org.id !== here.id, prefs = S.prefs || {};
  const how = r.by === 'customer' ? 'matched by customer record' : r.by === 'line' ? 'the number dialed' : r.by === 'area' ? 'area code ' + dg(o.number).slice(0, 3) : 'no match';
  const card = prev => { const cs = WD.screens.customers;
    if (r.customer && q.customer(r.customer.id) && cs && cs.simulateCall) cs.simulateCall(r.customer.id); else callerCard({ number: o.number, to: o.to, by: r.by, quiet: !!prev });
    if (prev) whenCardCloses(() => { if (cur().id !== r.org.id) return;
      ui.banner({ title: 'Back to ' + prev.name + '?', text: 'The call is over. ' + prev.name + ' is exactly as you left it. Tap to go back.', icon: 'building', color: prev.color || 'var(--blue)', duration: 0, onTap: () => { if (WD.app.switchOrg(prev.id) !== false) ui.toast('Back in ' + prev.name, 'building'); } }); }); };
  if (!other) return card(null);
  const who = (r.customer ? r.customer.name + ', ' : 'Unknown caller, ') + fmt.phone(o.number);
  const go = () => { if (cur().id !== r.org.id && (!WD.app.switchOrg || WD.app.switchOrg(r.org.id) === false)) return ui.toast('Couldn’t open ' + r.org.name, 'exclamationmark.circle');
    ui.toast('Opened ' + r.org.name + ' for this call · ' + how, 'building', 3600); setTimeout(() => card(here), 450); };
  if (prefs.callSwitch === false) return ui.banner({ title: 'Call for ' + r.org.name, text: who + ' · Opening the caller’s business by itself is off. Tap to switch and answer there.', icon: 'phone.fill', color: 'var(--green)', when: 'Quo', duration: 0, onTap: go });
  if (prefs.callAsk) return ui.banner({ title: 'Call for ' + r.org.name + ' — tap to switch', text: who + ' · ' + how, icon: 'phone.fill', color: 'var(--green)', when: 'Quo', duration: 0, onTap: go });
  go();
};
/** Panel: a call nobody picked up ('missed') or one that lasted 12 seconds ('short'), alternating between a customer and an unknown number. */
let simN = 0;
C.simulateMissed = kind => { if (!WD.can('crm.view')) return ui.toast('Calls need customer access', 'lock');
  const org = cur(), line = (org.lines || [])[0] || { label: 'Main', number: '' }, known = (data.customers || []).filter(c => !c.archived && (c.contacts || []).some(p => p.phone)), k = simN++, cu = k % 2 === 0 && known.length ? known[(k / 2 + 3) % known.length] : null, p = cu && cu.contacts.find(x => x.phone);
  const short = kind === 'short', number = cu ? p.phone : '+1' + ((org.areaCodes || ['512'])[0]) + '55508' + (80 + (k % 15));
  const c = add({ dir: 'in', number, to: line.number, lineLabel: line.label, customerId: cu ? cu.id : null, contact: cu ? p.name : null, duration: short ? 12 : 0, status: short ? 'answered' : 'missed', by: short ? me() : null,
    summary: short ? 'The call ended after 12 s. Nobody spoke after the greeting.' : 'Missed call. No voicemail left.', transcript: short ? [[me(), 'Thanks for calling ' + org.name + '.'], [cu ? p.name : 'Caller', '(the line dropped)']] : [] });
  WD.changed();
  ui.banner({ title: short ? 'Short call · 12 s' : 'Missed call', text: nameOf(c) + (cu ? ' · ' + fmt.phone(number) : '') + ' · ' + line.label + ' line. Flagged for review. Tap to call back.', icon: 'phone.fill', color: 'var(--red)', when: 'Quo', duration: 0, onTap: () => C.callBack(c) });
  return c; };

/* ================= Settings: Phone and calls ================= */
C.settingsSpec = () => ({ title: 'Phone and calls', render: page => {
  const st = ST(), org = cur(), admin = WD.can('settings.manage'), re = () => { WD.changed(); page.refresh(); }, cs = list(), last = f => { const c = cs.find(f); return c ? fmt.rel(c.at) : 'No events yet'; };
  const txt = (data.interactions || []).filter(i => i.type === 'text').reduce((m, i) => Math.max(m, i.at || 0), 0), dot = on => h('span.cl-dot', { style: { background: on ? 'var(--green)' : 'var(--red)' } });
  const hooks = [['call.ringing', 'Shows the incoming-call banner and opens the right business', last(c => c.dir === 'in')], ['call.completed', 'Adds the call to the log and flags it for review', last(() => true)],
    ['call.recording.completed', 'Attaches the recording, transcript and summary', last(c => c.status !== 'missed' && c.duration > 0)], ['message.received', 'Adds texts to the customer’s timeline', txt ? fmt.rel(txt) : 'No events yet']];
  const office = (data.users || []).filter(u => ['owner', 'admin', 'dispatcher', 'office'].includes(u.role) && u.status !== 'invited');
  const ring = [{ value: 'office', label: 'Everyone in the office' }].concat(office.map(u => ({ value: u.id, label: u.name + ' first, then the office' })), [{ value: 'vm', label: 'Straight to voicemail' }]);
  return ui.list(
    ui.section({ header: 'Quo connection', fold: false, footer: 'Quo is the company’s phone service. RouteClerk reads calls, recordings and texts with the API key and hears about new ones through webhooks.' },
      ui.row({ leading: dot(true), title: 'API key', subtitle: 'Workspace ' + org.name + ' · key ending 4f2a', detail: 'Connected' }),
      hooks.map(([name, text, at]) => ui.row({ leading: dot(true), title: name, subtitle: text, detail: at })),
      ui.row({ title: 'Send a test event', tint: true, center: true, disabled: !admin, onTap: () => ui.run('Sending a test event to Quo…', () => {}, { done: 'Quo answered · webhooks are working' }) })),
    ui.section({ header: 'Which number rings whom', fold: false, footer: 'A call nobody picks up goes to voicemail and is flagged for review.' },
      (org.lines || []).map(l => ui.pickerRow({ title: l.label + ' · ' + fmt.phone(l.number), disabled: !admin, value: ring.some(x => x.value === st.ring[l.number]) ? st.ring[l.number] : 'office', options: ring, onChange: v => { st.ring[l.number] = v; re(); } }))),
    ui.section({ header: 'Flag for review', fold: false, showFooter: true, footer: 'Every inbound call that was missed or went to voicemail, and every answered call shorter than ' + st.threshold + ' seconds, is flagged for review and a possible call back until someone resolves it. Calls we placed that nobody picked up are not flagged.' },
      ui.pickerRow({ title: 'A call is short under', disabled: !admin, value: st.threshold, options: [10, 15, 20, 30, 45, 60].map(v => ({ value: v, label: v + ' seconds' })), onChange: v => { st.threshold = v; re(); } }),
      ui.toggleRow({ title: 'Count short calls we placed', subtitle: 'Outbound calls under ' + st.threshold + ' s are flagged too', value: !!st.outShort, disabled: !admin, onChange: v => { st.outShort = v; re(); } }),
      ui.toggleRow({ title: 'Resolve when called back', subtitle: 'Calling a flagged number back and talking for ' + st.threshold + ' s or more clears the flag', value: st.autoResolve !== false, disabled: !admin, onChange: v => { st.autoResolve = v; re(); } }),
      ui.pickerRow({ title: 'A text is waiting after', disabled: !admin, value: st.textWait || 30, options: [10, 15, 30, 60, 120].map(v => ({ value: v, label: v + ' minutes' })), onChange: v => { st.textWait = v; re(); } }),
    ui.row({ title: 'Flagged now', detail: String(C.reviewCount()), chevron: true, onTap: () => page.push(C.logSpec({ flagged: true })) })),
    ui.section({ header: 'More', fold: false },
      ui.row({ icon: 'phone.fill', iconColor: 'var(--green)', title: 'Businesses and area codes', subtitle: 'Which business an incoming call opens', chevron: true, onTap: () => WD.orgs && WD.orgs.areaSpec && page.push(WD.orgs.areaSpec()) }),
      ui.row({ icon: 'list.bullet', iconColor: 'var(--blue)', title: 'Call log', subtitle: plural(cs.length, 'call') + ' on ' + plural((org.lines || []).length, 'number'), chevron: true, onTap: () => page.push(C.logSpec()) })));
} });
if (WD.r14 && WD.r14.addSetting) {
  WD.r14.addSetting('Company', (push, gated) => WD.r14.link(push, gated, 'settings.manage', 'phone.fill', 'var(--green)', 'Phone and calls', 'Quo connection, who each number rings, and which calls are flagged for review', C.settingsSpec, 'Connected'));
  WD.r14.addSetting('AI Premium', (push, gated) => WD.r14.link(push, gated, null, 'phone.fill', 'var(--purple)', 'AI call review', 'Who to get back to, from every Quo number', C.reviewSpec));
}

/* ================= Control panel ================= */
const otherOrg = () => (data.orgs || []).find(o => o.id !== cur().id), one = () => ui.toast('This sign-in has only one business', 'building');
WD.panel.addAction('Quo call for the other business (known customer)', () => { const o = otherOrg(); if (!o) return one(); const d = dataFor(o.id), c = (d.customers || []).find(x => !x.archived && !PIPE.includes(x.lifecycle) && (x.contacts || []).some(p => p.phone)) || (d.customers || []).find(x => (x.contacts || []).some(p => p.phone)); if (!c) return ui.toast('No customer with a phone number', 'phone');
  C.incoming({ number: c.contacts.find(p => p.phone).phone, to: ((o.lines || [])[0] || {}).number }); });
WD.panel.addAction('Quo call: unknown caller, other business’s area code', () => { const o = otherOrg(); if (!o) return one(); C.incoming({ number: '+1' + ((o.areaCodes || ['330'])[0]) + '5550877' }); });
WD.panel.addAction('Quo call: unknown caller on this business’s line', () => { const l = cur().lines || []; C.incoming({ number: '+14155550878', to: (l[1] || l[0] || {}).number }); });
WD.panel.addAction('Missed call', () => C.simulateMissed('missed'));
WD.panel.addAction('Short call (12 s)', () => C.simulateMissed('short'));
WD.panel.addJump('Dialer', () => WD.nav.switchTab('dialer'));
WD.panel.addJump('Call log', () => C.openLog());
WD.panel.addJump('Needs review (calls)', () => { UI.seg = 'review'; WD.nav.switchTab('dialer'); WD.changed(); });
WD.panel.addJump('AI call review', () => { if (!WD.aip || !WD.aip.on()) return ui.toast('Turn AI Premium on in the panel first', 'sparkles'); WD.nav.switchTab('dialer'); WD.nav.push(C.reviewSpec()); });
WD.panel.addJump('Phone and calls settings', () => { WD.nav.switchTab('settings'); WD.nav.push(C.settingsSpec()); });
/* 5.1: view state kept separately for each business (core.js app.uiState). */
if (WD.app.uiState) { WD.app.uiState('dialer', UI); }
})();
