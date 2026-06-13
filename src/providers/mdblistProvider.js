async function fetchMDBListItems(apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`https://mdblist.com/api/lists/${apiKey}/items`, {
      signal: controller.signal
    });

    if (!res.ok) return [];

    const data = await res.json();
    const items = [];

    const rawItems = Array.isArray(data) ? data : (data.items || data.response || []);

    for (const raw of rawItems) {
      if (!raw) continue;
      items.push({
        id: raw.mdblist_id ? `mdblist-${raw.mdblist_id}` : `mdblist-${raw.imdb_id}`,
        type: raw.type === 'tv' || raw.type === 'show' ? 'series' : 'movie',
        name: raw.title || raw.name || '',
        year: raw.year || null,
        imdbId: raw.imdb_id || raw.imdb || null,
        mdblistId: raw.mdblist_id || null,
        poster: raw.poster || null
      });
    }

    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchMDBListItems };
