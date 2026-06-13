function createMDBListSyncer(apiKey, debounceMs = 60000) {
  let pendingItems = [];
  let debounceTimer = null;

  async function pushItems(items) {
    pendingItems.push(...items);
    return new Promise((resolve) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const batch = pendingItems.splice(0, pendingItems.length);
        const result = await doPush(batch);
        resolve(result);
      }, debounceMs);
    });
  }

  async function doPush(items) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let existingIds;
      try {
        const res = await fetch(`https://mdblist.com/api/lists/${apiKey}/items`, {
          signal: controller.signal
        });
        if (!res.ok) {
          clearTimeout(timeout);
          return { pushed: 0, skipped: items.length, error: `GET list items failed: ${res.status}` };
        }
        const data = await res.json();
        const rawItems = Array.isArray(data) ? data : (data.items || data.response || []);
        existingIds = new Set(rawItems.map(i => i.imdb_id || i.imdb).filter(Boolean));
      } catch (err) {
        clearTimeout(timeout);
        return { pushed: 0, skipped: items.length, error: err.message };
      }

      const newImdbIds = items
        .map(i => i.imdbId)
        .filter(id => id && !existingIds.has(id));

      if (newImdbIds.length === 0) {
        clearTimeout(timeout);
        return { pushed: 0, skipped: items.length, error: null };
      }

      try {
        const res = await fetch(`https://mdblist.com/api/lists/${apiKey}/items/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imdb_ids: newImdbIds }),
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) {
          return { pushed: 0, skipped: items.length, error: `POST add items failed: ${res.status}` };
        }
        return { pushed: newImdbIds.length, skipped: items.length - newImdbIds.length, error: null };
      } catch (err) {
        clearTimeout(timeout);
        return { pushed: 0, skipped: items.length, error: err.message };
      }
    } catch (err) {
      return { pushed: 0, skipped: items.length, error: err.message };
    }
  }

  return { pushItems };
}

module.exports = { createMDBListSyncer };
