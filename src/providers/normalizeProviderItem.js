function normalizeProviderItem(item, source) {
  const sourceId = item[`${source}Id`] ?? item.id;
  const id = `${source}-${sourceId}`;

  let watchedEpisodes = null;
  let totalEpisodes = null;

  if (Number.isFinite(item.watchedEpisodes)) {
    watchedEpisodes = item.watchedEpisodes;
  }
  if (Number.isFinite(item.totalEpisodes)) {
    totalEpisodes = item.totalEpisodes;
  }

  return {
    id,
    type: item.type,
    name: item.name,
    year: item.year,
    poster: item.poster || null,
    source,
    sourceId: String(sourceId),
    imdbId: item.imdbId || null,
    tmdbId: item.tmdbId || null,
    watchedEpisodes,
    totalEpisodes
  };
}

module.exports = { normalizeProviderItem };
