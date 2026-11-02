// Starts the app: sets up GitHub + the data store, draws the tab bar, and switches screens.
(function () {
  const { h, icon } = TT;

  // Settings live in this browser only. The token never goes into the code or the repo.
  const safe = fn => { try { return fn(); } catch (e) { return null; } };
  const DEFAULTS = { owner: 'AnneAbhiram', repo: 'time-tracker-data' };
  TT.config = {
    get: () => ({
      ...DEFAULTS,
      ...(safe(() => JSON.parse(localStorage.getItem('tt:cfg'))) || {}),
      token: safe(() => localStorage.getItem('tt:token')) || ''
    }),
    setRepo: (owner, repo) => safe(() => localStorage.setItem('tt:cfg', JSON.stringify({ owner, repo }))),
    setToken: token => safe(() => (token ? localStorage.setItem('tt:token', token) : localStorage.removeItem('tt:token')))
  };
  TT.gh = TT.makeGithub(TT.config.get);
  TT.store = TT.makeStore(TT.gh, localStorage);

  const TABS = [['hours', 'Hours', 'clock'], ['log', 'Log', 'notebook'], ['attendance', 'Attendance', 'calendar-check'], ['report', 'Report', 'chart-bar']];
  const STATUS = {
    idle: '',
    synced: 'All changes saved to GitHub',
    saving: 'Saving...',
    offline: 'Offline. Changes are kept here and will save when you are back online.',
    noauth: 'Not connected to GitHub. Changes stay on this device.'
  };
  const main = document.getElementById('main');
  const tabsEl = document.getElementById('tabs');
  const dot = document.getElementById('status');
  let current = 'hours';

  TABS.forEach(([key, name, ic]) => tabsEl.append(h('a', { href: '#' + key, 'data-tab': key }, icon(ic), name)));
  document.getElementById('gear').addEventListener('click', () => { location.hash = '#settings'; });

  function route() {
    const name = location.hash.slice(1);
    current = TT.views[name] ? name : 'hours';
    const view = TT.views[current];
    document.getElementById('title').textContent = view.title;
    tabsEl.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.tab === current));
    main.replaceChildren();
    view.mount(main);
    if (!TT.gh.hasToken() && current !== 'settings') {
      main.prepend(h('div', { class: 'banner' }, 'Saving on this device only. ', h('a', { href: '#settings' }, 'Connect GitHub'), ' to back up your data and use it on other devices.'));
    }
    window.scrollTo(0, 0);
  }

  // A red dot on the Attendance tab until today is marked.
  function markDot() {
    const today = TT.dateStr();
    const marked = TT.store.items(TT.store.paths.att(today)).some(r => r.id === today);
    tabsEl.querySelector('[data-tab=attendance]').classList.toggle('dot', !marked);
  }

  TT.store.onData = () => {
    const view = TT.views[current];
    if (view && view.draw) view.draw();
    markDot();
  };
  TT.store.onStatus = (state, message) => {
    dot.className = 'status ' + state;
    document.getElementById('gear').title = message || STATUS[state] || '';
    if (TT.views.settings && TT.views.settings.showStatus) TT.views.settings.showStatus();
  };
  TT.statusText = () => TT.store.message || STATUS[TT.store.status] || '';

  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => TT.store.flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { TT.store.refreshAll(); TT.store.flush(); }
  });

  TT.store.flush();
  route();
  TT.store.load(TT.store.paths.att(TT.dateStr())).then(markDot);
  markDot();

  // Offline support is a bonus; if it can't start, the app works the same while online.
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
