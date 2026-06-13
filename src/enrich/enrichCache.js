const fs = require('fs');
const path = require('path');

const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000;

const CACHED_FIELDS = ['overview', 'genres', 'rating', 'runtime', 'fanartPoster', 'fanartBackground', 'tvdbId'];

function EnrichCache(filePath) {
  this.filePath = filePath;
  this.data = null;
  this.dirty = false;
  this.saveTimer = null;
}

EnrichCache.prototype.load = function () {
  if (this.data) return this.data;
  try {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    this.data = JSON.parse(raw);
  } catch {
    this.data = {};
  }
  return this.data;
};

EnrichCache.prototype._key = function (item) {
  if (item.imdbId) return 'imdb:' + item.imdbId;
  if (item.tmdbId) return 'tmdb:' + item.tmdbId;
  return null;
};

EnrichCache.prototype.get = function (item) {
  const key = this._key(item);
  if (!key) return null;
  const entry = this.load()[key];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > DEFAULT_TTL) return null;
  const result = {};
  for (const field of CACHED_FIELDS) {
    if (entry[field] != null) result[field] = entry[field];
  }
  return result;
};

EnrichCache.prototype.set = function (item, enriched) {
  const key = this._key(item);
  if (!key) return;
  this.load();
  const entry = { cachedAt: Date.now() };
  for (const field of CACHED_FIELDS) {
    if (enriched[field] != null) entry[field] = enriched[field];
  }
  this.data[key] = entry;
  this.dirty = true;
  this._scheduleSave();
};

EnrichCache.prototype._scheduleSave = function () {
  if (this.saveTimer) return;
  this.saveTimer = setTimeout(function () {
    this.saveTimer = null;
    this.save();
  }.bind(this), 2000);
};

EnrichCache.prototype.flush = function () {
  if (this.saveTimer) {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
  this.save();
};

EnrichCache.prototype.save = function () {
  if (!this.dirty) return;
  const dir = path.dirname(this.filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  this.dirty = false;
};

module.exports = { EnrichCache };
