async function fetchSimklItems(accessToken, statusFilter) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const res = await fetch('https://api.simkl.com/sync/all-items', { headers, signal: controller.signal });
    if (!res.ok) return [];

    const data = await res.json();
    const items = [];
    const filter = Array.isArray(statusFilter) ? statusFilter : [];

    for (const item of (data.shows || [])) {
      if (filter.length === 0 || filter.includes(item.status)) {
        items.push(normalizeSimklItem(item, 'series'));
      }
    }
    for (const item of (data.movies || [])) {
      if (filter.length === 0 || filter.includes(item.status)) {
        items.push(normalizeSimklItem(item, 'movie'));
      }
    }
    for (const item of (data.anime || [])) {
      if (filter.length === 0 || filter.includes(item.status)) {
        items.push(normalizeSimklItem(item, 'series'));
      }
    }

    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchActivities(accessToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const res = await fetch('https://api.simkl.com/sync/activities', { headers, signal: controller.signal });
    if (!res.ok) return null;

    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSimklItem(item, type) {
  const title = item.title || '';
  const year = item.year || null;
  const poster = item.poster?.url || null;
  const ids = item.ids || {};
  const simklId = ids.simkl_id ?? item._id ?? null;
  const imdbId = ids.imdb || null;
  const tmdbId = ids.tmdb || null;

  let watchedEpisodes = null;
  let totalEpisodes = null;

  if (Number.isFinite(item.watched_episodes)) {
    watchedEpisodes = item.watched_episodes;
  }
  if (Number.isFinite(item.total_episodes)) {
    totalEpisodes = item.total_episodes;
  }

  return {
    id: `simkl-${simklId}`,
    type,
    name: title,
    year,
    poster,
    simklId,
    imdbId,
    tmdbId,
    watchedEpisodes,
    totalEpisodes
  };
}

function extractDeltaItems(phase2Items, cachedItems) {
  if (!Array.isArray(phase2Items)) return null;
  if (!Array.isArray(cachedItems) || cachedItems.length === 0) return phase2Items;

  if (JSON.stringify(phase2Items) === JSON.stringify(cachedItems)) {
    return null;
  }

  const cachedIds = new Set(cachedItems.map(i => i.id));
  return phase2Items.filter(i => !cachedIds.has(i.id));
}

module.exports = { fetchSimklItems, fetchActivities, normalizeSimklItem, extractDeltaItems };
