try { require('./config.local'); } catch (e) { /* no local config */ }

module.exports = {
  port: +(process.env.PORT || 7000),
  statusFilter: ['plantowatch'],
  trakt: {
    clientId: process.env.TRAKT_CLIENT_ID || '',
    clientSecret: process.env.TRAKT_CLIENT_SECRET || '',
    redirectUri: '/callback/trakt',
  },
  simkl: {
    clientId: process.env.SIMKL_CLIENT_ID || '',
    redirectUri: '/callback/simkl',
  },
  tvdb: {
    apiKey: process.env.TVDB_API_KEY || '',
  },
  fanart: {
    apiKey: process.env.FANART_API_KEY || '',
  },
  mdblist: {
    apiKey: process.env.MDBLIST_API_KEY || '',
  },
  simklStatePath: 'data/simkl-sync-state.json',
  settingsPath: 'data/settings.json',
  catalogPath: 'data/main-list.json',
};
