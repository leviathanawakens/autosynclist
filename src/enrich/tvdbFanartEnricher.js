const { getJson, postJson } = require('../http/json');

const TVDB_BASE = 'https://api4.thetvdb.com/v4';
const FANART_BASE = 'https://webservice.fanart.tv/v3';

async function tvdbLogin(apiKey, tokenCache) {
  if (tokenCache.token) return tokenCache.token;
  const data = await postJson(`${TVDB_BASE}/login`, { apikey: apiKey });
  tokenCache.token = data.data.token;
  return tokenCache.token;
}

async function tvdbFetch(url, apiKey, tokenCache, opts = {}) {
  await tvdbLogin(apiKey, tokenCache);
  const headers = { Authorization: `Bearer ${tokenCache.token}`, ...opts.headers };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    if (res.status === 401) {
      delete tokenCache.token;
      await tvdbLogin(apiKey, tokenCache);
      const retryHeaders = { Authorization: `Bearer ${tokenCache.token}`, ...opts.headers };
      const retryRes = await fetch(url, { ...opts, headers: retryHeaders, signal: controller.signal });
      if (!retryRes.ok) throw new Error(`TVDB retry failed: ${retryRes.status}`);
      return await retryRes.json();
    }
    if (!res.ok) throw new Error(`TVDB ${url} failed: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchByRemoteId(tvdbId, type, tokenCache, apiKey) {
  const mediaType = type === 'series' ? 'series' : 'movie';
  const url = `${TVDB_BASE}/${mediaType}/${tvdbId}`;
  try {
    return await tvdbFetch(url, apiKey, tokenCache);
  } catch {
    return null;
  }
}

async function searchByTitle(name, type, year, tokenCache, apiKey) {
  const mediaType = type === 'series' ? 'series' : 'movie';
  const params = new URLSearchParams({ query: name, type: mediaType });
  if (year) params.set('year', String(year));
  const url = `${TVDB_BASE}/search?${params}`;
  try {
    const data = await tvdbFetch(url, apiKey, tokenCache);
    const results = data.data || [];
    if (results.length === 0) return null;
    return { data: results[0] };
  } catch {
    return null;
  }
}

async function fetchExtended(tvdbId, type, tokenCache, apiKey) {
  const mediaType = type === 'series' ? 'series' : 'movie';
  const url = `${TVDB_BASE}/${mediaType}/${tvdbId}/extended`;
  try {
    return await tvdbFetch(url, apiKey, tokenCache);
  } catch {
    return null;
  }
}

async function fetchFanart(tvdbId, type, fanartApiKey) {
  const mediaType = type === 'series' ? 'tv' : 'movies';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${FANART_BASE}/${mediaType}/${tvdbId}?api_key=${fanartApiKey}`, {
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractPoster(fanartData, type) {
  if (!fanartData) return null;
  const key = type === 'series' ? 'tvposter' : 'movieposter';
  const posters = fanartData[key];
  if (Array.isArray(posters) && posters.length > 0) {
    return posters[0].url || null;
  }
  const altKey = type === 'series' ? 'tvposter' : 'movieposter';
  const altPosters = fanartData[altKey];
  if (Array.isArray(altPosters) && altPosters.length > 0) {
    return altPosters[0].url || null;
  }
  return null;
}

function extractBackground(fanartData, type) {
  if (!fanartData) return null;
  const key = type === 'series' ? 'showbackground' : 'moviebackground';
  const backgrounds = fanartData[key];
  if (Array.isArray(backgrounds) && backgrounds.length > 0) {
    return backgrounds[0].url || null;
  }
  return null;
}

async function enrichItem(item, tvdbApiKey, fanartApiKey, tokenCache) {
  if (!item) return item;
  const type = item.type === 'movie' ? 'movie' : 'series';
  const result = { ...item };
  let tvdbId = null;
  let tvdbData = null;

  if (item.imdbId) {
    const searchResult = await searchByRemoteId(item.imdbId, type, tokenCache, tvdbApiKey);
    if (searchResult) {
      tvdbId = searchResult.data?.id || searchResult.data?.tvdbId || null;
      tvdbData = searchResult;
    }
  }

  if (!tvdbId && item.tmdbId) {
    const searchResult = await searchByRemoteId(item.tmdbId, type, tokenCache, tvdbApiKey);
    if (searchResult) {
      tvdbId = searchResult.data?.id || searchResult.data?.tvdbId || null;
      tvdbData = searchResult;
    }
  }

  if (!tvdbId) {
    const searchResult = await searchByTitle(item.name, type, item.year, tokenCache, tvdbApiKey);
    if (searchResult) {
      const first = Array.isArray(searchResult.data) ? searchResult.data[0] : searchResult.data;
      tvdbId = first?.id || first?.tvdbId || null;
      tvdbData = searchResult;
    }
  }

  if (!tvdbId) return result;

  result.tvdbId = tvdbId;

  const [extendedData, fanartData] = await Promise.all([
    fetchExtended(tvdbId, type, tokenCache, tvdbApiKey),
    fetchFanart(tvdbId, type, fanartApiKey)
  ]);

  if (extendedData) {
    const d = extendedData.data || extendedData;
    if (d.overview) result.overview = d.overview;
    if (d.genres && Array.isArray(d.genres)) {
      result.genres = d.genres.map(g => (typeof g === 'string' ? g : g.name || g)).filter(Boolean);
    }
    if (Number.isFinite(d.rating) || Number.isFinite(d.score)) {
      result.rating = Number.isFinite(d.rating) ? d.rating : d.score;
    }
    if (Number.isFinite(d.runtime)) {
      result.runtime = d.runtime;
    }
  }

  if (fanartData) {
    const poster = extractPoster(fanartData, type);
    if (poster) result.fanartPoster = poster;
    const background = extractBackground(fanartData, type);
    if (background) result.fanartBackground = background;
  }

  return result;
}

async function bulkEnrich(items, tvdbApiKey, fanartApiKey, concurrency = 5, enrichCache) {
  if (enrichCache) enrichCache.load();
  const tokenCache = {};
  const results = [];
  const workers = Array.from({ length: concurrency }, (_, workerIndex) => {
    return (async function work() {
      while (true) {
        const idx = workers.nextIndex++;
        if (idx >= items.length) break;
        const item = items[idx];
        if (enrichCache) {
          const cached = enrichCache.get(item);
          if (cached) {
            results[idx] = { ...item, ...cached };
            continue;
          }
        }
        const enriched = await enrichItem(item, tvdbApiKey, fanartApiKey, tokenCache);
        results[idx] = enriched;
        if (enrichCache) enrichCache.set(item, enriched);
      }
    })();
  });
  workers.nextIndex = 0;
  await Promise.allSettled(workers);
  if (enrichCache) enrichCache.flush();
  return results;
}

module.exports = { enrichItem, bulkEnrich };
