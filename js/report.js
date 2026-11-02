// Report screen: where did the hours go this week or month, and how many days of each
// attendance code. Everything is added up from the same files the other screens use.
(function () {
  const { h, icon } = TT;
  const S = () => TT.store;
  let span = 'week';
  let anchor = TT.dateStr();
  let els = {};

  function range() {
    if (span === 'month') {
      const ym = anchor.slice(0, 7);
      return { from: ym + '-01', to: `${ym}-${TT.pad(TT.daysIn(ym))}` };
    }
    const from = TT.addDays(anchor, -((TT.parseDate(anchor).getDay() + 6) % 7));   // Monday
    return { from, to: TT.addDays(from, 6) };
  }
  const title = ({ from, to }) => span === 'month' ? TT.fmtMonth(anchor.slice(0, 7)) : TT.fmtDay(from) + ' to ' + TT.fmtDay(to);
  const within = (d, r) => d >= r.from && d <= r.to;
  const uniq = list => [...new Set(list)];

  function collect() {
    const r = range();
    const months = uniq([r.from.slice(0, 7), r.to.slice(0, 7)]);
    const hours = months.flatMap(m => S().items(S().paths.hours(m + '-01'))).filter(e => within(e.date, r));
    const att = uniq([r.from.slice(0, 4), r.to.slice(0, 4)]).flatMap(y => S().items(S().paths.att(y + '-01-01'))).filter(a => within(a.id, r));
    return { r, hours, att };
  }

  function csv(r, hours, names) {
    const rows = new Map();
    for (const e of hours) {
      const key = [e.date, e.projectId, e.taskId || ''].join('|');
      const row = rows.get(key) || { date: e.date, project: names.get(e.projectId) || 'Unknown project', task: e.taskId ? (names.get(e.taskId) || 'Unknown task') : '', minutes: 0, notes: [] };
      row.minutes += e.minutes;
      if (e.note) row.notes.push(e.note);
      rows.set(key, row);
    }
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [...rows.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map(x => [x.date, x.project, x.task, TT.hrs(x.minutes), x.notes.join('; ')].map(q).join(','));
    return ['date,project,task,hours,notes', ...lines].join('\n');
  }

  function download(r, hours, names) {
    const url = URL.createObjectURL(new Blob([csv(r, hours, names)], { type: 'text/csv' }));
    const a = h('a', { href: url, download: `hours-${r.from}-to-${r.to}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function draw() {
    const { r, hours, att } = collect();
    const names = new Map(S().items(S().paths.catalog).map(i => [i.id, i.name]));
    const total = hours.reduce((n, e) => n + e.minutes, 0);
    els.range.textContent = title(r);
    els.total.textContent = TT.hrs(total) + ' h';
    els.days.textContent = uniq(hours.map(e => e.date)).length;
    els.csv.onclick = () => download(r, hours, names);

    // per project, biggest first, with its tasks underneath
    const byProject = new Map();
    for (const e of hours) {
      const p = byProject.get(e.projectId) || { total: 0, tasks: new Map() };
      p.total += e.minutes;
      const tk = e.taskId || '';
      p.tasks.set(tk, (p.tasks.get(tk) || 0) + e.minutes);
      byProject.set(e.projectId, p);
    }
    const sorted = [...byProject.entries()].sort((a, b) => b[1].total - a[1].total);
    const max = sorted.length ? sorted[0][1].total : 1;
    els.projects.replaceChildren(...(sorted.length ? sorted.map(([pid, p]) => h('div', {},
      h('div', { class: 'barline' }, h('span', {}, names.get(pid) || 'Unknown project'), h('span', {}, TT.hrs(p.total) + ' h')),
      h('div', { class: 'track' }, h('span', { style: `width:${Math.round(p.total / max * 100)}%` })),
      p.tasks.size > 1 || (p.tasks.size === 1 && !p.tasks.has(''))
        ? h('div', { class: 'tasks' }, [...p.tasks.entries()].sort((a, b) => b[1] - a[1]).map(([tid, m]) => (tid ? (names.get(tid) || 'Unknown task') : 'No task') + ' ' + TT.hrs(m) + ' h').join('  ·  '))
        : null))
      : [h('div', { class: 'empty' }, 'No hours in this period.')]));

    const counts = {};
    att.forEach(a => { counts[a.code] = (counts[a.code] || 0) + 1; });
    els.att.replaceChildren(...(att.length
      ? [h('div', { class: 'chips' }, TT.CODES.filter(c => counts[c.code]).map(c => TT.chip(c.code, c.code + ' ' + counts[c.code])))]
      : [h('div', { class: 'muted' }, 'No attendance marked in this period.')]));
  }

  function refresh() {
    draw();
    const r = range();
    const loads = uniq([r.from.slice(0, 7), r.to.slice(0, 7)]).map(m => S().load(S().paths.hours(m + '-01')))
      .concat(uniq([r.from.slice(0, 4), r.to.slice(0, 4)]).map(y => S().load(S().paths.att(y + '-01-01'))), S().load(S().paths.catalog));
    Promise.all(loads).then(draw);
  }

  const move = n => {
    anchor = span === 'month' ? TT.addMonths(anchor.slice(0, 7), n) + '-01' : TT.addDays(anchor, 7 * n);
    refresh();
  };

  TT.views.report = {
    title: 'Report',
    draw,
    mount(root) {
      span = 'week';
      anchor = TT.dateStr();
      els = {};
      els.range = h('div', { class: 'day' });
      els.total = h('b', {});
      els.days = h('b', {});
      els.projects = h('div');
      els.att = h('div');
      els.csv = h('button', {}, icon('download'), ' Download hours as CSV');
      const seg = ['week', 'month'].map(s => h('button', {
        class: s === span ? 'sel' : '',
        onclick: ev => {
          span = s;
          seg.forEach(b => b.classList.toggle('sel', b === ev.currentTarget));
          refresh();
        }
      }, s === 'week' ? 'Week' : 'Month'));
      root.append(
        h('div', { class: 'between', style: 'margin-bottom:10px' },
          h('div', { class: 'seg' }, seg),
          h('div', { class: 'between' },
            h('button', { class: 'ghost', 'aria-label': 'Previous', onclick: () => move(-1) }, icon('chevron-left')),
            els.range,
            h('button', { class: 'ghost', 'aria-label': 'Next', onclick: () => move(1) }, icon('chevron-right')))),
        h('div', { class: 'metrics' },
          h('div', { class: 'metric' }, h('small', {}, 'Total hours'), els.total),
          h('div', { class: 'metric' }, h('small', {}, 'Days with hours'), els.days)),
        h('div', { class: 'card' }, h('div', { class: 'section-head', style: 'margin-top:0' }, 'Hours by project'), els.projects),
        h('div', { class: 'card' }, h('div', { class: 'section-head', style: 'margin-top:0' }, 'Attendance'), els.att),
        els.csv);
      refresh();
    }
  };
})();
