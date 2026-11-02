// Talks to GitHub's "contents" API: read a file, write a file, list a folder.
// Nothing here knows about hours or attendance; it only moves text in and out of the data repo.
window.TT = window.TT || { views: {} };

// getConfig() returns { owner, repo, token }. fetchFn is swappable so tests can fake GitHub.
TT.makeGithub = function (getConfig, fetchFn = (...a) => fetch(...a)) {
  const gh = {};

  // Files are sent as base64. TextEncoder keeps accents and emoji intact.
  const encode = text => {
    let bin = '';
    new TextEncoder().encode(text).forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  };
  const decode = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const enc = path => path.split('/').map(encodeURIComponent).join('/');

  gh.hasToken = () => !!getConfig().token;

  // Returns the parsed JSON, or null when GitHub says 404 (file or folder doesn't exist yet).
  async function call(method, path, body) {
    const c = getConfig();
    const headers = {
      Authorization: 'Bearer ' + c.token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (body) headers['Content-Type'] = 'application/json';
    let res;
    try {
      // no-store: otherwise the browser may hand back a minute-old copy of a file we just changed
      res = await fetchFn(`https://api.github.com/repos/${c.owner}/${c.repo}${path}`, {
        method, headers, cache: 'no-store', body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      const err = new Error('No connection to GitHub');
      err.network = true;
      throw err;
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      const info = await res.json().catch(() => ({}));
      const err = new Error(res.status === 401 ? 'GitHub rejected the token. Add a new one in Settings.' : (info.message || res.statusText));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  gh.read = async path => {
    const j = await call('GET', '/contents/' + enc(path));
    if (!j || Array.isArray(j)) return null;
    return { sha: j.sha, text: decode(j.content) };
  };

  // sha is the version we last saw; GitHub refuses the write (409) if someone else changed the file since.
  gh.write = async (path, text, sha, message) => {
    const j = await call('PUT', '/contents/' + enc(path), { message, content: encode(text), sha: sha || undefined });
    return j.content.sha;
  };

  gh.list = async dir => {
    const j = await call('GET', '/contents/' + enc(dir));
    return Array.isArray(j) ? j.filter(f => f.type === 'file').map(f => f.name) : [];
  };

  // Used by Settings to check a token before trusting it.
  gh.ping = async () => {
    const j = await call('GET', '');
    if (!j) throw new Error('Repository not found, or the token has no access to it.');
    return true;
  };

  return gh;
};
