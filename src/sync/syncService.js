const { fetchAllProviders } = require('../providers/index');
const { deduplicateItems } = require('./dedupe');
const { formatCatalogEntries } = require('./catalogMeta');
const { createMDBListSyncer } = require('./mdblistSync');
const settingsStore = require('../settings/settingsStore');

function SyncService(config) {
  this.config = config;
  this.cache = new Map();
  this.enricher = config.enricher || null;
  this.mdblistSyncer = config.mdblistApiKey
    ? createMDBListSyncer(config.mdblistApiKey, 60000)
    : null;
  this._generation = 0;
}

SyncService.prototype.syncAll = async function () {
  this.cache.clear();
  const gen = ++this._generation;

  const diskSettings = settingsStore.loadSettings();
  const mergedConfig = {
    ...this.config,
    providers: diskSettings.providers || {},
    simklStatusFilter: diskSettings.simklStatusFilter || this.config.simklStatusFilter || [],
  };
  const rawItems = await fetchAllProviders(mergedConfig);
  const bySource = {};
  for (const item of rawItems) {
    const src = item.source || 'unknown';
    if (!bySource[src]) bySource[src] = 0;
    bySource[src]++;
  }

  const deduped = deduplicateItems(rawItems);

  for (const item of deduped) {
    this.cache.set(item.id, item);
  }

  if (this.enricher) {
    this.enricher.bulkEnrich(deduped, this.config.tvdbApiKey, this.config.fanartApiKey, 5, this.config.enrichCache).then(enriched => {
      if (this._generation !== gen) return;
      for (const item of enriched) {
        if (item) this.cache.set(item.id, item);
      }
    }).catch(() => {});
  }

  if (this.mdblistSyncer) {
    this.mdblistSyncer.pushItems(deduped).catch(() => {});
  }

  const catalog = formatCatalogEntries(deduped);

  return {
    items: deduped,
    catalog,
    stats: {
      total: rawItems.length,
      bySource,
      deduped: deduped.length
    }
  };
};

SyncService.prototype.getCachedItems = function () {
  return [...this.cache.values()];
};

SyncService.prototype.getCachedCatalog = function () {
  return formatCatalogEntries(this.getCachedItems());
};

module.exports = { SyncService };
