function formatCatalogEntries(items) {
  const metas = items.map(item => formatMetaEntry(item)).filter(Boolean);
  return { metas };
}

function formatMetaEntry(item) {
  if (!item) return null;

  const meta = {
    id: item.id || null,
    type: item.type || null,
    name: item.name || null,
  };

  if (item.year != null) meta.year = item.year;
  if (item.poster) meta.poster = item.poster;
  if (item.fanartPoster) meta.poster = item.fanartPoster;
  if (item.fanartBackground) meta.background = item.fanartBackground;
  if (item.overview) meta.overview = item.overview;
  if (Number.isFinite(item.runtime)) meta.runtime = item.runtime;
  if (Number.isFinite(item.rating)) meta.rating = item.rating;
  if (item.genres && Array.isArray(item.genres) && item.genres.length > 0) {
    meta.genres = item.genres;
  }

  let description = item.overview || '';

  if (item.type === 'series' && Number.isFinite(item.watchedEpisodes) && Number.isFinite(item.totalEpisodes) && item.totalEpisodes > 0) {
    if (description) description += '\n\n';
    description += `${item.watchedEpisodes}/${item.totalEpisodes} episodes`;
  }

  if (description) meta.description = description;

  if (item.type === 'series' && Number.isFinite(item.watchedEpisodes) && item.watchedEpisodes > 0) {
    const videos = [];
    let epCount = 0;
    for (let season = 1; season <= 10 && epCount < item.watchedEpisodes; season++) {
      for (let episode = 1; episode <= 100 && epCount < item.watchedEpisodes; episode++) {
        videos.push({
          id: `${item.id}:S${season}:E${episode}`,
          season,
          episode,
          watched: true
        });
        epCount++;
      }
    }
    if (videos.length > 0) meta.videos = videos;
  }

  const hasData = Object.values(meta).some(v => v != null);
  return hasData ? meta : null;
}

module.exports = { formatCatalogEntries, formatMetaEntry };
