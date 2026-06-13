const { getJson, postJson } = require('./json');

async function parseFormBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const params = new URLSearchParams(raw);
      const map = new Map();
      for (const [key, value] of params.entries()) {
        if (map.has(key)) {
          const existing = map.get(key);
          if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            map.set(key, [existing, value]);
          }
        } else {
          map.set(key, value);
        }
      }
      resolve({
        entries() {
          const results = [];
          for (const [key, value] of map.entries()) {
            if (Array.isArray(value)) {
              for (const v of value) results.push([key, v]);
            } else {
              results.push([key, value]);
            }
          }
          return results;
        }
      });
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function getBaseUrl(req, defaultPort) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${defaultPort}`;
  return `${proto}://${host}`;
}

async function handleRequest(req, res, settingsStore, syncService, config) {
  const baseUrl = getBaseUrl(req, config.port || 7000);
  const url = new URL(req.url, baseUrl);
  const path = url.pathname;
  const method = req.method;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (path === '/' && method === 'GET') {
      res.writeHead(301, { Location: '/configure' });
      res.end();
      return;
    }

    if (path === '/manifest.json' && method === 'GET') {
      const manifest = {
        id: 'community.autosynclist',
        version: '1.0.0',
        name: 'autosynclist',
        description: 'Auto-sync your Trakt, Simkl and MDBList watchlists into unified Stremio catalogs.',
        resources: ['catalog', 'meta'],
        types: ['movie', 'series'],
        idPrefixes: ['tt'],
        catalogs: [
          { type: 'movie', id: 'sync-list-movies', name: 'autosynclist Movies' },
          { type: 'series', id: 'sync-list-series', name: 'autosynclist Series' },
          { type: 'movie', id: 'continue-watching-movies', name: 'Continue Watching Movies' },
          { type: 'series', id: 'continue-watching-series', name: 'Continue Watching Series' },
          { type: 'series', id: 'unseen-series', name: 'Unseen Series' }
        ],
        behaviorHints: { configurable: true, configurationRequired: false }
      };
      sendJson(res, 200, manifest);
      return;
    }

    const catalogMatch = path.match(/^\/catalog\/(movie|series)\/(.+)\.json$/);
    if (catalogMatch && method === 'GET') {
      const type = catalogMatch[1];
      const catalog = syncService.getCachedCatalog();
      const filtered = catalog.metas.filter(m => m.type === type);
      sendJson(res, 200, { metas: filtered });
      return;
    }

    const metaMatch = path.match(/^\/meta\/(movie|series)\/(.+)\.json$/);
    if (metaMatch && method === 'GET') {
      const type = metaMatch[1];
      const id = metaMatch[2];
      const items = syncService.getCachedItems();
      const item = items.find(i => i.id === id && i.type === type);
      if (!item) {
        sendJson(res, 404, { error: 'Meta not found' });
        return;
      }
      const { formatMetaEntry } = require('../sync/catalogMeta');
      const meta = formatMetaEntry(item);
      sendJson(res, 200, { meta });
      return;
    }

    if (path === '/configure' && method === 'GET') {
      const settings = settingsStore.loadSettings();
      const items = syncService.getCachedItems();
      const catalog = syncService.getCachedCatalog();
      const bySource = {};
      for (const item of items) {
        const src = item.source || 'unknown';
        if (!bySource[src]) bySource[src] = 0;
        bySource[src]++;
      }
      const stats = {
        total: items.length,
        catalogTotal: catalog.metas.length,
        bySource,
        providers: {
          trakt: !!settings.providers?.trakt?.accessToken,
          simkl: !!settings.providers?.simkl?.accessToken,
          mdblist: !!config.mdblist?.apiKey
        }
      };
      const { renderConfigurePage } = require('../ui/configurePage');
      sendHtml(res, renderConfigurePage(settings, stats, config, baseUrl));
      return;
    }

    if (path === '/configure' && method === 'POST') {
      const formData = await parseFormBody(req);
      settingsStore.updateFromForm(formData);
      if (typeof config.restartSyncTimer === 'function') config.restartSyncTimer();
      await Promise.race([
        syncService.syncAll(),
        new Promise(r => setTimeout(r, 15000))
      ]).catch(() => {});
      res.writeHead(302, { Location: '/configure' });
      res.end();
      return;
    }

    const callbackMatch = path.match(/^\/callback\/(trakt|simkl)$/);
    if (callbackMatch && method === 'GET') {
      const provider = callbackMatch[1];
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(302, { Location: `/configure?error=${provider}_auth_error` });
        res.end();
        return;
      }

      if (!code) {
        res.writeHead(302, { Location: `/configure?error=missing_code` });
        res.end();
        return;
      }

      try {
        if (provider === 'trakt') {
          const redirectUri = `${baseUrl}/callback/trakt`;
          const tokenData = await postJson('https://api.trakt.tv/oauth/token', {
            code,
            client_id: config.trakt.clientId,
            client_secret: config.trakt.clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          });
          const settings = settingsStore.loadSettings();
          if (!settings.providers) settings.providers = {};
          if (!settings.providers.trakt) settings.providers.trakt = {};
          settings.providers.trakt.accessToken = tokenData.access_token;
          settings.providers.trakt.refreshToken = tokenData.refresh_token;
          settings.providers.trakt.clientId = config.trakt.clientId;
          settingsStore.saveSettings(settings);
        } else if (provider === 'simkl') {
          const redirectUri = `${baseUrl}/callback/simkl`;
          const tokenData = await postJson('https://api.simkl.com/oauth/token', {
            code,
            client_id: config.simkl.clientId,
            client_secret: config.simkl.clientSecret || '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          });
          const settings = settingsStore.loadSettings();
          if (!settings.providers) settings.providers = {};
          if (!settings.providers.simkl) settings.providers.simkl = {};
          settings.providers.simkl.accessToken = tokenData.access_token;
          settings.providers.simkl.refreshToken = tokenData.refresh_token;
          settingsStore.saveSettings(settings);
        }

        await Promise.race([
          syncService.syncAll(),
          new Promise(r => setTimeout(r, 15000))
        ]).catch(() => {});
        res.writeHead(302, { Location: '/configure?authorized=' + provider });
        res.end();
      } catch (err) {
        res.writeHead(302, { Location: `/configure?error=${provider}_token_exchange_failed` });
        res.end();
      }
      return;
    }

    if (path === '/api/health' && method === 'GET') {
      const items = syncService.getCachedItems();
      const catalog = syncService.getCachedCatalog();
      const settings = settingsStore.loadSettings();
      const bySource = {};
      for (const item of items) {
        const src = item.source || 'unknown';
        if (!bySource[src]) bySource[src] = 0;
        bySource[src]++;
      }
      sendJson(res, 200, {
        catalog: {
          total: catalog.metas.length,
          movies: catalog.metas.filter(m => m.type === 'movie').length,
          series: catalog.metas.filter(m => m.type === 'series').length
        },
        items: {
          total: items.length,
          bySource
        },
        providers: {
          trakt: !!settings.providers?.trakt?.accessToken,
          simkl: !!settings.providers?.simkl?.accessToken,
          mdblist: !!config.mdblist?.apiKey
        },
        sync: {
          lastSync: new Date().toISOString()
        }
      });
      return;
    }

    if (path === '/api/sync-now' && method === 'GET') {
      const result = await syncService.syncAll();
      sendJson(res, 200, result.stats);
      return;
    }

    if (path === '/api/lists/trakt' && method === 'GET') {
      const settings = settingsStore.loadSettings();
      const trakt = settings.providers?.trakt;
      if (!trakt?.accessToken || !trakt?.clientId) {
        sendJson(res, 401, { error: 'Trakt not authorized' });
        return;
      }
      try {
        const { fetchTraktLists } = require('../providers/traktProvider');
        const lists = await fetchTraktLists(trakt.accessToken, trakt.clientId);
        const allLists = [{ id: 'watchlist', name: 'Main Watchlist', itemCount: 0 }, ...lists];
        settings.providers.trakt.availableLists = allLists;
        settingsStore.saveSettings(settings);
        sendJson(res, 200, { lists: allLists, selected: trakt.selectedLists || ['watchlist'] });
      } catch (err) {
        sendJson(res, 500, { error: err.message });
      }
      return;
    }

    if (path === '/api/lists/simkl' && method === 'GET') {
      const simklStatuses = [
        { id: 'plantowatch', name: 'Plan to Watch' },
        { id: 'watching', name: 'Watching' },
        { id: 'completed', name: 'Completed' },
        { id: 'hold', name: 'On Hold' },
        { id: 'dropped', name: 'Dropped' }
      ];
      const settings = settingsStore.loadSettings();
      sendJson(res, 200, {
        lists: simklStatuses,
        selected: settings.simklStatusFilter || ['plantowatch']
      });
      return;
    }

    if (path === '/api/test-key' && method === 'GET') {
      const results = { tvdb: null, fanart: null, mdblist: null };

      if (config.tvdb?.apiKey) {
        try {
          const data = await postJson('https://api4.thetvdb.com/v4/login', { apikey: config.tvdb.apiKey });
          results.tvdb = { ok: true, token: !!data.data?.token };
        } catch (err) {
          results.tvdb = { ok: false, error: err.message };
        }
      } else {
        results.tvdb = { ok: false, error: 'No API key configured' };
      }

      if (config.fanart?.apiKey) {
        try {
          const data = await getJson(`https://webservice.fanart.tv/v3/movies/tt0111161?api_key=${config.fanart.apiKey}`);
          results.fanart = { ok: true, valid: !!data };
        } catch (err) {
          results.fanart = { ok: false, error: err.message };
        }
      } else {
        results.fanart = { ok: false, error: 'No API key configured' };
      }

      if (config.mdblist?.apiKey) {
        try {
          const data = await getJson(`https://mdblist.com/api/lists/${config.mdblist.apiKey}/items`);
          results.mdblist = { ok: true, itemCount: Array.isArray(data) ? data.length : (data.items || []).length };
        } catch (err) {
          results.mdblist = { ok: false, error: err.message };
        }
      } else {
        results.mdblist = { ok: false, error: 'No API key configured' };
      }

      sendJson(res, 200, results);
      return;
    }

    sendJson(res, 404, { error: 'Not found', path });
  } catch (err) {
    sendJson(res, 500, { error: 'Internal server error', message: err.message });
  }
}

module.exports = { handleRequest };
