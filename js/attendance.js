// Attendance screen: one code per day (O, L, S, E, WFH, NT, OD, W). Today is selected when
// you open it. Tap any day in the month to fill in or fix it later.
(function () {
  const { h, icon } = TT;
  const S = () => TT.store;
  let picked = TT.dateStr();
  let month = picked.slice(0, 7);
  const pending = {};   // notes typed for days that have no code yet
  let els = {};

  const path = () => S().paths.att(month + '-01');
  const records = () => new Map(S().items(S().paths.att(picked)).concat(S().items(path())).map(r => [r.id, r]));

  function choose(code) {
    S().put(S().paths.att(picked), { id: picked, date: picked, code, note: els.note.value.trim() });
    delete pending[picked];
  }

  function select(date) {
    picked = date;
    month = date.slice(0, 7);
    refresh();
  }

  function draw() {
    const map = records();
    const rec = map.get(picked);
    const today = TT.dateStr();

    els.date.textContent = TT.fmtDay(picked) + (picked === today ? ' (today)' : '');
    els.state.textContent = rec ? 'Saved: ' + TT.codeInfo(rec.code).long : 'Not marked yet';
    els.clear.hidden = !rec;
    els.codes.querySelectorAll('button').forEach(b => b.classList.toggle('sel', !!rec && b.dataset.code === rec.code));
    if (document.activeElement !== els.note) els.note.value = rec ? (rec.note || '') : (pending[picked] || '');

    // calendar
    els.month.textContent = TT.fmtMonth(month);
    const lead = (TT.parseDate(month + '-01').getDay() + 6) % 7;   // weeks start on Monday
    const dates = [...map.keys()].filter(d => d.startsWith(month.slice(0, 4))).sort();
    const first = dates[0];                                         // days before you started tracking aren't "missing"
    const cells = Array.from({ length: lead }, () => h('div'));
    const counts = {};
    const missing = [];
    for (let d = 1; d <= TT.daysIn(month); d++) {
      const ds = `${month}-${TT.pad(d)}`;
      const r = map.get(ds);
      const cls = ['cell'];
      let body;
      if (r) {
        counts[r.code] = (counts[r.code] || 0) + 1;
        cls.push('marked');
        body = h('b', {}, r.code);
      } else {
        const gap = first && ds >= first && ds < today;
        if (gap) { cls.push('missing'); missing.push(ds); }
        body = h('b', {}, gap ? '-' : ' ');
      }
      if (ds === today) cls.push('today');
      if (ds === picked) cls.push('picked');
      cells.push(h('button', { class: cls.join(' '), style: r ? '--hue:' + TT.codeInfo(r.code).hue : '', 'aria-label': TT.fmtDay(ds) + (r ? ', ' + TT.codeInfo(r.code).long : ', not marked'), onclick: () => select(ds) }, h('small', {}, d), body));
    }
    els.cal.replaceChildren(...cells);
    els.chips.replaceChildren(...TT.CODES.filter(c => counts[c.code]).map(c => TT.chip(c.code, c.code + ' ' + counts[c.code])));
    els.missing.textContent = missing.length ? `${missing.length} day${missing.length === 1 ? '' : 's'} not marked. Tap a dashed day to fill it in.` : '';
  }

  function refresh() {
    draw();
    Promise.all([S().load(S().paths.att(picked)), S().load(path())]).then(draw);
  }

  TT.views.attendance = {
    title: 'Attendance',
    draw,
    mount(root) {
      picked = TT.dateStr();
      month = picked.slice(0, 7);
      els = {};
      els.date = h('div', { class: 'day' });
      els.state = h('div', { class: 'muted' });
      els.codes = h('div', { class: 'codes' }, TT.CODES.map(c =>
        h('button', { 'data-code': c.code, onclick: () => choose(c.code) }, h('b', {}, c.code), h('small', {}, c.short))));
      els.note = h('input', { type: 'text', placeholder: 'Note, like which site (optional)' });
      els.note.addEventListener('input', () => { pending[picked] = els.note.value; });
      els.note.addEventListener('change', () => {
        const rec = records().get(picked);
        if (rec) S().put(S().paths.att(picked), { ...rec, note: els.note.value.trim() });
      });
      els.clear = h('button', { class: 'link', hidden: true, onclick: () => S().remove(S().paths.att(picked), picked) }, 'Clear this day');
      els.month = h('div', { class: 'day' });
      els.cal = h('div', { class: 'cal' });
      els.chips = h('div', { class: 'chips' });
      els.missing = h('div', { class: 'muted', style: 'margin-top:8px' });
      const shift = n => { month = TT.addMonths(month, n); refresh(); };

      root.append(
        h('div', { class: 'card' },
          h('div', { class: 'between' }, els.date, els.state),
          els.codes, els.note,
          h('div', { style: 'margin-top:8px' }, els.clear)),
        h('div', { class: 'card' },
          h('div', { class: 'datenav' },
            h('button', { class: 'ghost', 'aria-label': 'Previous month', onclick: () => shift(-1) }, icon('chevron-left')),
            els.month,
            h('button', { class: 'ghost', 'aria-label': 'Next month', onclick: () => shift(1) }, icon('chevron-right'))),
          h('div', { class: 'dow' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => h('div', {}, d))),
          els.cal, els.chips, els.missing));
      refresh();
    }
  };
})();
