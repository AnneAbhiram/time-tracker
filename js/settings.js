// Settings: connect the data repo with a GitHub token, pick a theme, force a sync.
(function () {
  const { h } = TT;
  let els = {};

  function showStatus() {
    if (els.status) els.status.textContent = TT.gh.hasToken() ? TT.statusText() : 'Not connected to GitHub. Changes stay on this device.';
  }

  async function connect() {
    const old = TT.config.get();
    const owner = els.owner.value.trim() || old.owner;
    const repo = els.repo.value.trim() || old.repo;
    const token = els.token.value.trim() || old.token;
    if (!token) { els.msg.textContent = 'Paste a token first'; return; }
    els.msg.textContent = 'Checking...';
    TT.config.setRepo(owner, repo);
    TT.config.setToken(token);
    try {
      await TT.gh.ping();
    } catch (e) {
      TT.config.setRepo(old.owner, old.repo);
      TT.config.setToken(old.token);
      els.msg.textContent = e.message;
      return;
    }
    els.token.value = '';
    els.msg.textContent = `Connected to ${owner}/${repo}`;
    TT.store.refreshAll();
    TT.store.flush();
    els.forget.hidden = false;
  }

  function forget() {
    if (!confirm('Forget the token on this device? Your data stays here and on GitHub.')) return;
    TT.config.setToken('');
    els.forget.hidden = true;
    els.msg.textContent = 'Token removed from this device';
    showStatus();
  }

  function pickTheme(key) {
    TT.applyTheme(key);
    try { localStorage.setItem('tt:theme', key); } catch (e) { /* theme just won't be remembered */ }
    els.themes.querySelectorAll('button').forEach(b => b.classList.toggle('sel', b.dataset.key === key));
  }

  TT.views.settings = {
    title: 'Settings',
    showStatus,
    draw() {},
    mount(root) {
      const cfg = TT.config.get();
      els = {};
      els.owner = h('input', { type: 'text', value: cfg.owner, autocapitalize: 'off', spellcheck: false });
      els.repo = h('input', { type: 'text', value: cfg.repo, autocapitalize: 'off', spellcheck: false });
      els.token = h('input', { type: 'password', autocomplete: 'off', placeholder: cfg.token ? 'A token is saved on this device' : 'Paste your token' });
      els.msg = h('div', { class: 'muted', style: 'margin-top:8px;min-height:20px' });
      els.status = h('div', { class: 'muted' });
      els.forget = h('button', { class: 'ghost', hidden: !cfg.token, onclick: forget }, 'Forget token');
      els.themes = h('div', { class: 'themes' }, TT.themes.map(t => h('button', { 'data-key': t.key, onclick: () => pickTheme(t.key) },
        h('span', { class: 'swatch' }, [t.bg, t.surface, t.accent].map(c => h('i', { style: 'background:' + c }))),
        h('span', {}, t.name, h('small', {}, t.note)))));

      root.append(
        h('div', { class: 'card' },
          h('strong', {}, 'GitHub sync'),
          els.status,
          h('p', { class: 'muted', style: 'margin-top:8px' }, 'Your data is saved as text files in a private GitHub repo. This token lets this device read and write that one repo, nothing else.'),
          h('ol', { class: 'steps' },
            h('li', {}, h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, 'Create a fine-grained token'), ' on GitHub.'),
            h('li', {}, 'Repository access: Only select repositories, then pick your data repo.'),
            h('li', {}, 'Permissions: Repository permissions, Contents, Read and write.'),
            h('li', {}, 'Generate it and paste it below.')),
          h('label', {}, 'Repository owner'), els.owner,
          h('label', {}, 'Repository name'), els.repo,
          h('label', {}, 'Token'), els.token,
          h('div', { class: 'between', style: 'margin-top:12px' },
            els.forget,
            h('span', {},
              h('button', { onclick: () => { TT.store.refreshAll(); TT.store.flush(); els.msg.textContent = 'Syncing...'; } }, 'Sync now'), ' ',
              h('button', { class: 'primary', onclick: connect }, 'Connect'))),
          els.msg),
        h('div', { class: 'card' },
          h('strong', {}, 'Theme'),
          h('p', { class: 'muted' }, 'Remembered on this device only.'),
          els.themes));
      pickTheme(TT.themes.find(t => t.key === TT.currentTheme()) ? TT.currentTheme() : TT.themes[0].key);
      showStatus();
    }
  };
})();
