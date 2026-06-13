function deduplicateItems(items) {
  const groups = new Map();
  const keyed = new Map();

  for (const item of items) {
    if (!item) continue;
    const imdbKey = item.imdbId ? `imdb:${item.imdbId}` : null;
    const tmdbKey = item.tmdbId ? `tmdb:${item.tmdbId}` : null;
    const fallbackKey = `${item.type || ''}|${item.name || ''}|${item.year ?? ''}`;

    const existing = imdbKey && keyed.get(imdbKey)
      || tmdbKey && keyed.get(tmdbKey)
      || keyed.get(fallbackKey);

    if (existing) {
      mergeItem(existing, item);
    } else {
      const copy = { ...item };
      const groupKey = imdbKey || tmdbKey || fallbackKey;
      keyed.set(groupKey, copy);
      groups.set(groupKey, copy);
    }
  }

  return [...groups.values()];
}

function mergeItem(target, source) {
  if (!source) return;

  const fields = ['poster', 'fanartPoster', 'fanartBackground', 'overview', 'genres', 'rating', 'runtime', 'name', 'year', 'type', 'id', 'source', 'sourceId'];

  for (const field of fields) {
    if (target[field] == null && source[field] != null) {
      target[field] = source[field];
    }
  }

  if (!target.imdbId && source.imdbId) target.imdbId = source.imdbId;
  if (!target.tmdbId && source.tmdbId) target.tmdbId = source.tmdbId;

  if (Number.isFinite(source.watchedEpisodes)) {
    if (Number.isFinite(target.watchedEpisodes)) {
      target.watchedEpisodes = Math.max(target.watchedEpisodes, source.watchedEpisodes);
    } else {
      target.watchedEpisodes = source.watchedEpisodes;
    }
  }

  if (Number.isFinite(source.totalEpisodes)) {
    if (Number.isFinite(target.totalEpisodes)) {
      target.totalEpisodes = Math.max(target.totalEpisodes, source.totalEpisodes);
    } else {
      target.totalEpisodes = source.totalEpisodes;
    }
  }
}

module.exports = { deduplicateItems };
