async function fetchPage(url, headers, signal) {
  const res = await fetch(url, { headers, signal });
  if (!res.ok) return { items: [], totalPages: 0 };
  const items = await res.json();
  const totalPages = parseInt(res.headers.get('x-pagination-page-count') || '1', 10);
  return { items, totalPages };
}

async function fetchAllPages(baseUrl, headers, signal) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const { items: pageItems, totalPages: tp } = await fetchPage(
      `${baseUrl}${sep}page=${page}&limit=100`,
      headers, signal
    );
    totalPages = tp;
    items.push(...pageItems);
    page++;
  }
  return items;
}

function entryToItem(entry, sourceList) {
  const show = entry.show;
  const movie = entry.movie;
  if (show) {
    let watchedEpisodes = 0;
    let totalEpisodes = 0;
    if (entry.seasons) {
      for (const season of entry.seasons) {
        if (season.episodes) {
          for (const ep of season.episodes) {
            totalEpisodes++;
            if (ep.completed) watchedEpisodes++;
          }
        }
      }
    }
    return {
      id: 'trakt-' + show.ids.trakt,
      type: 'series',
      name: show.title,
      year: show.year,
      poster: show.images?.poster?.thumb || show.images?.poster?.full || null,
      traktId: show.ids.trakt,
      imdbId: show.ids.imdb || null,
      tmdbId: show.ids.tmdb || null,
      watchedEpisodes,
      totalEpisodes,
      sourceList
    };
  }
  if (movie) {
    return {
      id: 'trakt-' + movie.ids.trakt,
      type: 'movie',
      name: movie.title,
      year: movie.year,
      poster: movie.images?.poster?.thumb || movie.images?.poster?.full || null,
      traktId: movie.ids.trakt,
      imdbId: movie.ids.imdb || null,
      tmdbId: movie.ids.tmdb || null,
      watchedEpisodes: null,
      totalEpisodes: null,
      sourceList
    };
  }
  return null;
}

async function fetchTraktWatchlist(accessToken, clientId, selectedLists) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      'Authorization': 'Bearer ' + accessToken
    };

    const items = [];
    const lists = Array.isArray(selectedLists) && selectedLists.length > 0
      ? selectedLists : ['watchlist'];

    for (const listId of lists) {
      if (listId === 'watchlist') {
        const [shows, movies] = await Promise.all([
          fetchAllPages('https://api.trakt.tv/sync/watchlist/shows?extended=full', headers, controller.signal),
          fetchAllPages('https://api.trakt.tv/sync/watchlist/movies', headers, controller.signal)
        ]);
        for (const s of shows) { const i = entryToItem(s, 'watchlist'); if (i) items.push(i); }
        for (const m of movies) { const i = entryToItem(m, 'watchlist'); if (i) items.push(i); }
      } else {
        const [shows, movies] = await Promise.all([
          fetchAllPages('https://api.trakt.tv/users/me/lists/' + listId + '/items/shows?extended=full', headers, controller.signal),
          fetchAllPages('https://api.trakt.tv/users/me/lists/' + listId + '/items/movies', headers, controller.signal)
        ]);
        for (const s of shows) { const i = entryToItem(s, 'list-' + listId); if (i) items.push(i); }
        for (const m of movies) { const i = entryToItem(m, 'list-' + listId); if (i) items.push(i); }
      }
    }

    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTraktLists(accessToken, clientId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': clientId,
      'Authorization': 'Bearer ' + accessToken
    };
    const res = await fetch('https://api.trakt.tv/users/me/lists', { headers, signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(function (list) {
      return { id: String(list.ids.trakt), name: list.name, itemCount: list.counts?.items || 0 };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchTraktWatchlist, fetchTraktLists };
