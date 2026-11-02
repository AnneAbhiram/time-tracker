// Small helpers used everywhere: ids, dates, a tiny DOM builder, and the attendance codes.
window.TT = window.TT || { views: {} };

TT.pad = n => String(n).padStart(2, '0');
TT.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Dates are plain "2026-11-02" strings in the device's local time, so they sort as text.
TT.dateStr = (d = new Date()) => `${d.getFullYear()}-${TT.pad(d.getMonth() + 1)}-${TT.pad(d.getDate())}`;
TT.parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
TT.addDays = (s, n) => { const d = TT.parseDate(s); d.setDate(d.getDate() + n); return TT.dateStr(d); };
TT.addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${TT.pad(d.getMonth() + 1)}`; };
TT.daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };

TT.fmtDay = s => TT.parseDate(s).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
TT.fmtMonth = ym => TT.parseDate(ym + '-01').toLocaleDateString([], { month: 'long', year: 'numeric' });
TT.fmtTime = iso => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
TT.hrs = minutes => (minutes / 60).toFixed(1);

// h('div', { class: 'x', onclick: fn }, child, 'text', [more children]) builds a DOM element.
// Text is always added as text, never as HTML, so nothing you type can break the page.
TT.h = (tag, attrs, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  const add = kid => {
    if (Array.isArray(kid)) kid.forEach(add);
    else if (kid != null && kid !== false) el.append(kid);
  };
  kids.forEach(add);
  return el;
};
TT.icon = name => TT.h('i', { class: 'ti ti-' + name, 'aria-hidden': 'true' });

// The attendance codes. "hue" tints each code; the theme decides how strong the tint looks.
TT.CODES = [
  { code: 'O', short: 'Office', long: 'Office', hue: '#6E9B5A' },
  { code: 'L', short: 'Leave', long: 'Leave', hue: '#6A8FC4' },
  { code: 'S', short: 'Sick', long: 'Sick', hue: '#D2836B' },
  { code: 'E', short: 'Emergency', long: 'Emergency', hue: '#C95F62' },
  { code: 'WFH', short: 'Home', long: 'Work from home', hue: '#9A82C4' },
  { code: 'NT', short: 'No scan', long: 'Went to office, no ID scan', hue: '#CFA24F' },
  { code: 'OD', short: 'On duty', long: 'On duty (other office or site)', hue: '#4FA3A0' },
  { code: 'W', short: 'Week off', long: 'Week off', hue: '#9AA0A6' }
];
TT.codeInfo = code => TT.CODES.find(c => c.code === code);
TT.chip = (code, text) => TT.h('span', { class: 'chip', style: '--hue:' + TT.codeInfo(code).hue }, text || code);
