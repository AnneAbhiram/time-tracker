// The data layer. Every list of records (hours, log, attendance, projects) lives in a small
// JSON file in the private data repo. This keeps a copy of each file in the browser, saves
// every change there instantly, and syncs with GitHub in the background.
//
// Merge rule (this is what lets phone and laptop work without overwriting each other):
// every record has an `id` and an `updated` time. When two copies of a file disagree we keep
// every record from both sides, and for a record present in both, the newer `updated` wins.
// A deleted record leaves a tiny { id, del: true } marker so a stale copy on another device
// can't bring it back.
window.TT = window.TT || { views: {} };

TT.makeStore = function (gh, storage, opts = {}) {
  const wait = opts.debounce == null ? 1200 : opts.debounce;
  const PREFIX = 'tt:f:';
  const files = {};
  const timers = {};
  const store = { status: 'idle', message: '', onData() {}, onStatus() {} };

  // Where each kind of record lives.
  store.paths = {
    catalog: 'catalog.json',
    hours: date => `hours/${date.slice(0, 7)}.json`,
    log: iso => `log/${TT.dateStr(new Date(iso)).slice(0, 7)}.json`,
    att: date => `attendance/${date.slice(0, 4)}.json`
  };

  const now = () => new Date().toISOString();
  const setStatus = (state, message = '') => { store.status = state; store.message = message; store.onStatus(state, message); };
  const fail = e => setStatus(e.network ? 'offline' : 'error', e.message);

  function file(path) {
    if (!files[path]) {
      let saved = null;
      try { saved = JSON.parse(storage.getItem(PREFIX + path)); } catch (e) { /* unreadable copy: start fresh */ }
      files[path] = {
        sha: saved ? saved.sha : null,
        items: saved ? saved.items : [],
        dirty: !!(saved && saved.dirty),
        known: !!saved,   // have we ever seen this file on this device?
        rev: 0,           // bumped on every local change, so we notice edits made mid-save
        checked: 0,
        chain: Promise.resolve()
      };
    }
    return files[path];
  }
  function persist(path) {
    const f = files[path];
    try { storage.setItem(PREFIX + path, JSON.stringify({ sha: f.sha, items: f.items, dirty: f.dirty })); } catch (e) { /* storage full or blocked */ }
  }

  function merge(a, b) {
    const byId = new Map();
    for (const item of [...a, ...b]) {
      const cur = byId.get(item.id);
      if (!cur || item.updated > cur.updated) byId.set(item.id, item);
    }
    return [...byId.values()];
  }

  // One record per line keeps GitHub's history readable.
  const serialize = items => '{\n"items": [\n' + items.map(i => JSON.stringify(i)).join(',\n') + '\n]\n}\n';

  async function pull(path) {
    const f = file(path);
    const r = await gh.read(path);
    if (!r || r.sha === f.sha) return;
    f.items = merge(JSON.parse(r.text).items || [], f.items);
    f.sha = r.sha;
    persist(path);
  }

  async function refresh(path) {
    const f = file(path);
    f.checked = Date.now();
    try {
      const before = f.sha;
      await pull(path);
      f.known = true;
      if (f.sha !== before) store.onData();
      if (f.dirty) push(path);
      else setStatus('synced');
    } catch (e) { fail(e); }
  }

  async function doPush(path) {
    const f = file(path);
    if (!f.dirty) return;
    if (!gh.hasToken()) { setStatus('noauth'); return; }
    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const rev = f.rev;
      try {
        f.sha = await gh.write(path, serialize(f.items), f.sha, 'Update ' + path);
        f.dirty = f.rev !== rev;
        f.known = true;
        persist(path);
        saved = true;
      } catch (e) {
        // 409/422: someone else changed the file. Fetch their version, merge, try again.
        if (e.status === 409 || e.status === 422) {
          try { await pull(path); } catch (e2) { return fail(e2); }
        } else return fail(e);
      }
    }
    if (!saved) return setStatus('error', 'Could not save ' + path + '. It will retry.');
    if (f.dirty) return doPush(path);
    setStatus(Object.values(files).some(x => x.dirty) ? 'saving' : 'synced');
  }

  const push = path => {
    const f = file(path);
    f.chain = f.chain.then(() => doPush(path));
    return f.chain;
  };

  function touch(path) {
    const f = file(path);
    f.rev++;
    f.dirty = true;
    persist(path);
    store.onData();
    clearTimeout(timers[path]);
    timers[path] = setTimeout(() => push(path), wait);
    setStatus(gh.hasToken() ? 'saving' : 'noauth');
  }

  // Records that aren't deleted.
  store.items = path => file(path).items.filter(i => !i.del);

  store.put = (path, item) => {
    const f = file(path);
    const next = { ...item, updated: now() };
    const i = f.items.findIndex(x => x.id === item.id);
    if (i >= 0) f.items[i] = next; else f.items.push(next);
    touch(path);
    return next;
  };

  store.remove = (path, id) => {
    const f = file(path);
    const i = f.items.findIndex(x => x.id === id);
    if (i < 0) return;
    f.items[i] = { id, del: true, updated: now() };
    touch(path);
  };

  // Make sure a file is loaded. First time on this device we wait for GitHub; after that we
  // answer from the local copy straight away and check GitHub quietly (at most every 20s).
  store.load = async (path, force) => {
    const f = file(path);
    if (!gh.hasToken()) return f.items;
    if (!f.known) await refresh(path);
    else if (force || Date.now() - f.checked > 20000) refresh(path);
    return f.items;
  };

  // Names of files in a folder (for example every month of the log).
  store.listDir = async dir => {
    const cacheKey = 'tt:d:' + dir;
    let names = [];
    try { names = JSON.parse(storage.getItem(cacheKey)) || []; } catch (e) { /* none cached */ }
    if (gh.hasToken()) {
      try {
        names = await gh.list(dir);
        storage.setItem(cacheKey, JSON.stringify(names));
      } catch (e) { fail(e); }
    }
    const prefix = PREFIX + dir + '/';
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) names.push(k.slice(prefix.length));
    }
    return [...new Set(names)].sort();
  };

  store.refreshAll = () => Promise.all(Object.keys(files).map(refresh));

  // Push anything that was saved on this device but never reached GitHub (for example while offline).
  store.flush = () => {
    const paths = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(PREFIX)) paths.push(k.slice(PREFIX.length));
    }
    paths.filter(p => file(p).dirty).forEach(push);
  };

  // For tests: wait until pending saves have finished.
  store.settle = async () => {
    await new Promise(r => setTimeout(r, wait + 10));
    await Promise.all(Object.values(files).map(f => f.chain));
  };

  return store;
};
