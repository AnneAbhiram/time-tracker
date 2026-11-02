// Hours screen: one row per project (or task), a + that adds 30 minutes and a - that takes
// the latest 30 minutes back. A "manage" panel adds and archives projects and tasks.
(function () {
  const { h, icon } = TT;
  const S = () => TT.store;
  const CATALOG = 'catalog.json';
  let date = TT.dateStr();
  let mode = 'list';
  let showArchived = false;
  let last = null;
  let els = {};

  const catalog = () => S().items(CATALOG);
  const projects = () => catalog().filter(i => i.type === 'project');
  const tasksOf = pid => catalog().filter(i => i.type === 'task' && i.projectId === pid);
  const path = () => S().paths.hours(date);
  const dayEntries = () => S().items(path()).filter(e => e.date === date);
  const forTarget = (list, pid, tid) => list.filter(e => e.projectId === pid && (e.taskId || null) === tid);
  const minutes = list => list.reduce((n, e) => n + e.minutes, 0);
  const label = (p, t) => p.name + (t ? ' / ' + t.name : '');

  function add(p, t) {
    const e = S().put(path(), { id: TT.uid(), date, projectId: p.id, taskId: t ? t.id : null, minutes: 30, note: '' });
    last = { id: e.id, path: path(), text: 'Added 0.5 h to ' + label(p, t), noting: false };
    drawBar();
  }

  function take(p, t) {
    const mine = forTarget(dayEntries(), p.id, t ? t.id : null).sort((a, b) => b.updated.localeCompare(a.updated));
    if (!mine.length) return;
    S().remove(path(), mine[0].id);
    last = { text: 'Removed 0.5 h from ' + label(p, t) };
    drawBar();
  }

  // The line under the list ("Added 0.5 h to ...") with an optional note box. It is redrawn
  // only by your own taps, so a background sync never wipes a note you are typing.
  function drawBar() {
    els.bar.replaceChildren();
    if (!last) return;
    els.bar.append(h('span', {}, last.text));
    if (last.id && !last.noting) els.bar.append(h('button', { class: 'link', onclick: () => { last.noting = true; drawBar(); } }, 'Add note'));
    if (last.noting) {
      const input = h('input', { type: 'text', placeholder: 'What was it?' });
      const save = () => {
        const e = S().items(last.path).find(x => x.id === last.id);
        if (e && input.value.trim()) S().put(last.path, { ...e, note: input.value.trim() });
        last = { text: 'Note saved' };
        drawBar();
      };
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') save(); });
      els.bar.append(input, h('button', { onclick: save }, 'Save'));
      input.focus();
    }
  }

  function targetRow(p, t, m) {
    return h('div', { class: 'row' },
      h('div', { class: 'grow' }, h('div', { class: 'row-title' }, p.name), h('div', { class: 'row-sub' }, t ? t.name : 'No task')),
      h('button', { class: 'round', 'aria-label': 'Remove 30 minutes from ' + label(p, t), onclick: () => take(p, t) }, icon('minus')),
      h('span', { class: 'row-hrs' }, TT.hrs(m)),
      h('button', { class: 'round', 'aria-label': 'Add 30 minutes to ' + label(p, t), onclick: () => add(p, t) }, icon('plus')));
  }

  function draw() {
    els.main.hidden = mode !== 'list';
    els.manage.hidden = mode !== 'manage';
    if (mode === 'manage') return drawManage();

    const list = dayEntries();
    els.day.textContent = TT.fmtDay(date);
    els.sub.textContent = date === TT.dateStr() ? 'Today' : '';
    els.total.textContent = TT.hrs(minutes(list)) + ' h';

    // Archived projects and tasks stay out of the list unless they already have hours that day.
    const show = (p, t, m) => m > 0 || (!p.archived && !(t && t.archived));
    const rows = [];
    for (const p of projects()) {
      const tasks = tasksOf(p.id);
      const plain = minutes(forTarget(list, p.id, null));
      if ((!tasks.some(t => !t.archived) || plain) && show(p, null, plain)) rows.push(targetRow(p, null, plain));
      for (const t of tasks) {
        const m = minutes(forTarget(list, p.id, t.id));
        if (show(p, t, m)) rows.push(targetRow(p, t, m));
      }
    }
    if (!projects().some(p => !p.archived) && !rows.length) {
      els.rows.replaceChildren(h('div', { class: 'empty' },
        h('strong', {}, 'Start with a project'),
        h('p', {}, 'Add the projects you spend hours on, then tap + each time you work 30 minutes.'),
        h('button', { class: 'primary', onclick: () => { mode = 'manage'; draw(); } }, 'Add project')));
    } else els.rows.replaceChildren(...rows);

    const names = new Map(catalog().map(i => [i.id, i.name]));
    const noted = list.filter(e => e.note);
    els.notes.replaceChildren(...(noted.length ? [h('div', { class: 'section-head' }, 'Notes')] : []),
      ...noted.map(e => h('div', { class: 'noteline' }, h('b', {}, (names.get(e.projectId) || 'Project') + ': '), e.note)));
  }

  function refresh() {
    draw();
    Promise.all([S().load(CATALOG), S().load(path())]).then(draw);
  }

  const go = n => { date = TT.addDays(date, n); last = null; drawBar(); refresh(); };

  // ---- manage projects and tasks ----
  function rename(item) {
    const name = prompt('New name', item.name);
    if (name && name.trim()) S().put(CATALOG, { ...item, name: name.trim() });
  }
  const archive = item => S().put(CATALOG, { ...item, archived: !item.archived });
  const itemButtons = item => h('span', {},
    h('button', { class: 'ghost', onclick: () => rename(item) }, 'Rename'),
    h('button', { class: 'ghost', onclick: () => archive(item) }, item.archived ? 'Restore' : 'Archive'));

  function projectCard(p) {
    const input = h('input', { type: 'text', placeholder: 'New task' });
    const tasks = tasksOf(p.id).filter(t => showArchived || !t.archived);
    return h('div', { class: 'card' + (p.archived ? ' dim' : '') },
      h('div', { class: 'between' }, h('strong', {}, p.name + (p.archived ? ' (archived)' : '')), itemButtons(p)),
      tasks.map(t => h('div', { class: 'between task' + (t.archived ? ' dim' : '') }, h('span', {}, t.name), itemButtons(t))),
      h('form', {
        class: 'inline',
        onsubmit: ev => {
          ev.preventDefault();
          const name = input.value.trim();
          if (name) S().put(CATALOG, { id: TT.uid(), type: 'task', projectId: p.id, name, archived: false });
        }
      }, input, h('button', { type: 'submit' }, 'Add task')));
  }

  function drawManage() {
    const list = projects().filter(p => showArchived || !p.archived);
    els.projects.replaceChildren(...(list.length ? list.map(projectCard) : [h('p', { class: 'muted' }, 'No projects yet. Add one above.')]));
  }

  TT.views.hours = {
    title: 'Hours',
    draw,
    mount(root) {
      mode = 'list';
      last = null;
      els = {};
      els.day = h('div', { class: 'day' });
      els.sub = h('div', { class: 'sub' });
      els.total = h('b', {});
      els.rows = h('div', { class: 'rows' });
      els.bar = h('div', { class: 'lastbar' });
      els.notes = h('div');
      els.main = h('div', {},
        h('div', { class: 'datenav' },
          h('button', { class: 'ghost', 'aria-label': 'Previous day', onclick: () => go(-1) }, icon('chevron-left')),
          h('div', { class: 'mid' }, els.day, els.sub),
          h('button', { class: 'ghost', 'aria-label': 'Next day', onclick: () => go(1) }, icon('chevron-right')),
          h('button', { class: 'ghost', 'aria-label': 'Manage projects', onclick: () => { mode = 'manage'; draw(); } }, icon('folder'))),
        h('div', { class: 'metric' }, h('span', { class: 'muted' }, 'Total'), els.total),
        els.rows, els.bar, els.notes);

      const nameInput = h('input', { type: 'text', placeholder: 'New project' });
      els.projects = h('div');
      els.manage = h('div', {},
        h('div', { class: 'between' },
          h('button', { class: 'ghost', onclick: () => { mode = 'list'; draw(); } }, icon('chevron-left'), ' Back'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: showArchived, onchange: ev => { showArchived = ev.target.checked; drawManage(); } }), 'Show archived')),
        h('form', {
          class: 'inline',
          onsubmit: ev => {
            ev.preventDefault();
            const name = nameInput.value.trim();
            if (!name) return;
            S().put(CATALOG, { id: TT.uid(), type: 'project', name, archived: false });
            nameInput.value = '';
          }
        }, nameInput, h('button', { class: 'primary', type: 'submit' }, 'Add project')),
        els.projects);
      root.append(els.main, els.manage);
      refresh();
    }
  };
})();
