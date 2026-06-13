const http = require('http');
const config = require('./config');
const settingsStore = require('./settings/settingsStore');
const { SyncService } = require('./sync/syncService');
const { handleRequest } = require('./http/router');
const { bulkEnrich } = require('./enrich/tvdbFanartEnricher');
const { EnrichCache } = require('./enrich/enrichCache');

const enrichCache = new EnrichCache('data/enrich-cache.json');
const enricher = { bulkEnrich };

const syncService = new SyncService({
  ...config,
  enricher,
  enrichCache,
  tvdbApiKey: config.tvdb.apiKey,
  fanartApiKey: config.fanart.apiKey,
  mdblistApiKey: config.mdblist.apiKey,
  onSettingsChanged: startSyncTimer,
});

const enrichedConfig = { ...config, restartSyncTimer: startSyncTimer };

const server = http.createServer((req, res) => {
  handleRequest(req, res, settingsStore, syncService, enrichedConfig);
});

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

syncService.syncAll().catch(err => {
  console.error('Initial sync failed:', err.message);
});

let syncInterval;
function startSyncTimer() {
  const settings = settingsStore.loadSettings();
  const minutes = settings.syncIntervalMinutes || 5;
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    syncService.syncAll().catch(err => {
      console.error('Periodic sync failed:', err.message);
    });
  }, minutes * 60000);
}
startSyncTimer();

function shutdown() {
  if (syncInterval) clearInterval(syncInterval);
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forced shut down');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

/*
 * To expose this addon via Cloudflare Tunnel, run:
 *   cloudflared tunnel --url http://localhost:7000
 * Then use the generated *.trycloudflare.com URL as your addon URL in Stremio.
 */
