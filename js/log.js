// Log screen: timestamped notes ("Reached Site B", "Outage reported"). The time is filled in
// with now and can be changed with the phone's own date and time picker.
(function () {
  const { h, icon } = TT;
  const S = () => TT.store;
  const PAGE = 3;               // months shown before "Load older"
  let months = [];              // every month that has a log file, newest first
  let shown = PAGE;
  let query = '';
  let editing = null;
  let els = {};

  const monthPath = m => `log/${m}.json`;
  const toInput = iso => { const d = new Date(iso); return TT.dateStr(d) + 'T' + TT.pad(d.getHours()) + ':' + TT.pad(d.getMinutes()); };
  const visible = () => (query ? months : months.slice(0, shown));

  function dayLabel(d) {
    if (d === TT.dateStr()) return 'Today, ' + TT.fmtDay(d);
    if (d === TT.addDays(TT.dateStr(), -1)) return 'Yesterday, ' + TT.fmtDay(d);
    return TT.fmtDay(d) + ' ' + d.slice(0, 4);
  }

  function openForm(entry) {
    editing = entry || null;
    els.time.value = toInput(entry ? entry.at : new Date().toISOString());
    els.title.value = entry ? entry.title : '';
    els.body.value = entry ? entry.body : '';
    els.err.textContent = '';
    els.del.hidden = !entry;
    els.form.hidden = false;
    els.title.focus();
  }
  const closeForm = () => { els.form.hidden = true; editing = null; };

  async function save() {
    const title = els.title.value.trim();
    const when = new Date(els.time.value);
    if (!title) { els.err.textContent = 'Add a title'; return; }
    if (isNaN(when)) { els.err.textContent = 'Pick a date and time'; return; }
    const entry = { id: editing ? editing.id : TT.uid(), at: when.toISOString(), title, body: els.body.value.trim() };
    // Entries are filed by month. If the time moved to another month, retire the old copy.
    if (editing && S().paths.log(editing.at) !== S().paths.log(entry.at)) {
      S().remove(S().paths.log(editing.at), editing.id);
      entry.id = TT.uid();
    }
    S().put(S().paths.log(entry.at), entry);
    closeForm();
    await refresh();
  }

  function remove() {
    if (!editing || !confirm('Delete this entry?')) return;
    S().remove(S().paths.log(editing.at), editing.id);
    closeForm();
  }

  function draw() {
    let items = visible().flatMap(m => S().items(monthPath(m)));
    const q = query.toLowerCase();
    if (q) items = items.filter(e => (e.title + ' ' + e.body + ' ' + TT.fmtDay(TT.dateStr(new Date(e.at)))).toLowerCase().includes(q));
    items.sort((a, b) => b.at.localeCompare(a.at));

    const out = [];
    let day = '';
    for (const e of items) {
      const d = TT.dateStr(new Date(e.at));
      if (d !== day) { day = d; out.push(h('div', { class: 'day-head' }, dayLabel(d))); }
      out.push(h('div', { class: 'entry', onclick: () => openForm(e) },
        h('div', { class: 'time' }, TT.fmtTime(e.at)),
        h('div', { class: 'grow' }, h('div', { class: 'row-title' }, e.title), e.body ? h('div', { class: 'body' }, e.body) : null)));
    }
    if (!out.length) {
      out.push(h('div', { class: 'empty' }, query
        ? h('strong', {}, 'No entries match')
        : [h('strong', {}, 'Nothing logged yet'), h('p', {}, 'Tap New entry when something happens and the time is filled in for you.')]));
    }
    els.list.replaceChildren(...out);
    els.older.hidden = !!query || shown >= months.length;
  }

  async function refresh() {
    months = (await S().listDir('log')).map(n => n.replace('.json', '')).sort().reverse();
    draw();
    await Promise.all(visible().map(m => S().load(monthPath(m))));
    draw();
  }

  TT.views.log = {
    title: 'Log',
    draw,
    mount(root) {
      shown = PAGE;
      query = '';
      editing = null;
      els = {};
      els.time = h('input', { type: 'datetime-local', id: 'log-time' });
      els.title = h('input', { type: 'text', placeholder: 'Outage reported at Site B' });
      els.body = h('textarea', { rows: 3, placeholder: 'Who called, what they said' });
      els.err = h('div', { class: 'err' });
      els.del = h('button', { class: 'ghost', onclick: remove }, icon('trash'), ' Delete');
      els.form = h('div', { class: 'card', hidden: true },
        h('label', { for: 'log-time' }, 'Time'), els.time,
        h('label', {}, 'Title'), els.title,
        h('label', {}, 'Details'), els.body,
        els.err,
        h('div', { class: 'between' },
          els.del,
          h('span', {}, h('button', { class: 'ghost', onclick: closeForm }, 'Cancel'), ' ', h('button', { class: 'primary', onclick: save }, 'Save entry'))));
      els.search = h('input', { type: 'text', placeholder: 'Search entries' });
      els.search.addEventListener('input', () => { query = els.search.value.trim(); refresh(); });
      els.list = h('div');
      els.older = h('button', { class: 'ghost', hidden: true, onclick: () => { shown += PAGE; refresh(); } }, 'Load older');
      root.append(
        h('div', { class: 'between', style: 'margin-bottom:10px' },
          h('span', { class: 'muted' }, 'Notes with the time they happened'),
          h('button', { class: 'primary', onclick: () => openForm() }, icon('plus'), ' New entry')),
        els.form, els.search, els.list, els.older);
      refresh();
    }
  };
})();
