const { fetchTraktWatchlist } = require('./traktProvider');
const { fetchSimklItems } = require('./simklProvider');
const { fetchMDBListItems } = require('./mdblistProvider');
const { normalizeProviderItem } = require('./normalizeProviderItem');

async function fetchAllProviders(settings) {
  const { providers = {}, mdblistApiKey, simklStatusFilter } = settings;
  const trakt = providers.trakt || {};
  const simkl = providers.simkl || {};

  const tasks = [];

  if (trakt.accessToken && trakt.clientId) {
    tasks.push(
      fetchTraktWatchlist(trakt.accessToken, trakt.clientId, trakt.selectedLists)
        .then(items => items.map(item => normalizeProviderItem(item, 'trakt')))
    );
  }

  if (simkl.accessToken) {
    tasks.push(
      fetchSimklItems(simkl.accessToken, simklStatusFilter)
        .then(items => items.map(item => normalizeProviderItem(item, 'simkl')))
    );
  }

  if (mdblistApiKey) {
    tasks.push(
      fetchMDBListItems(mdblistApiKey)
        .then(items => items.map(item => normalizeProviderItem(item, 'mdblist')))
    );
  }

  const results = await Promise.allSettled(tasks);
  const merged = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      merged.push(...result.value);
    }
  }

  return merged;
}

module.exports = { fetchAllProviders };
