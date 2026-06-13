try { require('./config.local'); } catch (e) { /* no local config */ }

module.exports = {
  port: +(process.env.PORT || 7000),
  statusFilter: ['plantowatch'],
  trakt: {
    clientId: '2c69f235753d4d79ef5787f5e5a5b6efd8c29faa103495a234801a9cc39cdd27',
    clientSecret: process.env.TRAKT_CLIENT_SECRET || '',
    redirectUri: '/callback/trakt',
  },
  simkl: {
    clientId: '1bcca5a1f5310459f6db951256ccfb6be1ea97bb9923cf2914952aa003e06a37',
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
