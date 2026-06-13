# Goal
- Build and maintain a Stremio catalog addon that merges watchlists from Trakt, Simkl, and MDBList into unified movie/series catalogs with bidirectional cross-sync to MDBList watchlist and TVDB/Fanart.tv metadata enrichment.

## Constraints & Preferences
- Zero npm dependencies (only Node.js built-ins plus fetch)
- Simkl API: Phase 1 via `/sync/all-items`, Phase 2 continuous sync via `/sync/activities` → cached items on no-change, refetch on change
- TVDB v4 API (`api4.thetvdb.com`) + Fanart.tv v3 API for metadata enrichment
- MDBList watchlist endpoints (no API-based list creation — uses user's watchlist directly)
- Cross-sync: diff against existing MDBList watchlist, push only missing items, debounced 60s
- Cloudflare tunnel for public URL (`postage-thehun-chicago-physician.trycloudflare.com`)
- Bundled Node runtime at `%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
- All fetch calls timeout after 30s via AbortController
- Only sync plan-to-watch items from Trakt and Simkl

## Progress
### Done
- OAuth flow wired for Trakt + Simkl (authorize button, callback, token exchange, settings persistence)
- TraktProvider: fetches main watchlist only (no custom lists), 243 items
- SimklProvider: Phase 1 full sync via `/sync/all-items`, Phase 2 continuous sync via `/sync/activities` check, status filter for plan-to-watch only, state persists `lastActivities` + `cachedItems`
- MDBList provider imports FROM MDBList watchlist (`GET /watchlist/items`), simplified (just apiKey)
- MDBList cross-sync pushes new IMDb IDs via `POST /watchlist/items/add` (diff-based, 60s debounce)
- MDBList API key `j9fc409ve4auppt4h2wlu4dnj` — valid, returns 295 items
- TVDB v4 login (field `apikey`), search by remote ID + title-based fallback (`searchByTitle`), extended metadata
- Fanart.tv artwork by TVDB ID (movieposter/tvposter, showbackground/moviebackground)
- Enricher uses 5 concurrent workers, runs async in background (non-blocking), skips disk write if no items changed
- Episode progress: `watchedEpisodes`/`totalEpisodes` flow through extractDeltaItems → normalizeProviderItem → dedupe → catalogMeta (description shows "N/M episodes") → getMeta (videos array with watched flags)
- fetch timeouts: 30s AbortController in `getJson`/`postJson`
- Catalog caching: `getCatalog()` results cached in memory, invalidated on state change
- Deduplicated `loadMainList()` call (removed redundant call from `index.js`)
- `enrichInBackground()` skips disk write if serialized items unchanged
- Config page: Simkl status filter checkboxes (plantowatch/watching/completed/hold/dropped), provider item counts, test API key buttons for TVDB/Fanart.tv/MDBList
- `/api/test-key` route: tests TVDB login, Fanart.tv key, MDBList watchlist
- SimklProvider: `statusFilter` option, `fetchActivities()` for Phase 2, `saveState()`/`loadState()` with new format
- `Number.isFinite` used everywhere instead of global `isFinite` to prevent `null`→`0` coercion in progress fields (fixed in `normalizeProviderItem.js`, `dedupe.js`, `catalogMeta.js`, `syncService.js`)

### In Progress
- (none)

### Blocked
- Trakt POST to watchlist blocked by Cloudflare (IP-range ban); write scope not granted in OAuth (no `scope` param in authorize URL)

## Key Decisions
- Simkl Phase 2: check `/sync/activities` first; if `all` unchanged → return cached items (no API call); if changed → refetch `/sync/all-items`. Saves full normalized items + activities in state file.
- Enrichment runs in background (`enrichInBackground`) so sync completes instantly — TVDB/Fanart.tv metadata populates asynchronously.
- Plan-to-watch filter set via `statusFilter: ['plantowatch']` on SimklProvider, not via the broken `/sync/plantowatch/{type}` endpoints (which return null).
- Trakt custom lists cleared; only main watchlist synced (plan-to-watch by default).
- Search fallback for TVDB: if IMDb remote ID fails, try title-based search (`/v4/search?query=&type=`) to catch Chinese/Korean titles.
- MDBList sync debounced at 60s to prevent hammering API on every sync cycle.

## Next Steps
1. Visit `https://postage-thehun-chicago-physician.trycloudflare.com/configure` to verify all providers and test API keys
2. Check health endpoint for catalog counts: ~26 movies, ~278 series (304 deduped across 3 providers)
3. Monitor auto-sync (60s interval) — Phase 2 should skip Simkl API call on no-change

## Critical Context
- Port 7000 must be killed before restart: `Get-NetTCPConnection -LocalPort 7000 | ForEach-Object { taskkill /F /PID $_.OwningProcess }`
- Start server: `Start-Process -WindowStyle Hidden -FilePath $nodeExe -ArgumentList "src/index.js" -WorkingDirectory $addonDir`
- Delete Simkl state before fresh Phase 1: `Remove-Item -LiteralPath data\simkl-sync-state.json -Force`
- Server currently running
- Tunnel URL: `https://postage-thehun-chicago-physician.trycloudflare.com`
- Trakt: 243 items (main watchlist only, no custom lists)
- Simkl: ~292 items (plantowatch-only, cached, Phase 2 activities check)
- MDBList: ~295 items (key valid, cross-sync pushing new items)
- Catalog: ~26 movies, ~278 series (after dedup)
- TVDB API key: `8af4a32c-8f02-4d24-80ce-e186ba99006d` (valid)
- Fanart.tv API key: `d65dc47ec22a53fe5a19e9d81540d10e` (valid)
- MDBList API key: `j9fc409ve4auppt4h2wlu4dnj` (valid)
- Simkl state file format: `{ lastActivities: {...}, cachedItems: [...] }`
- Episode progress: 292 items have `watchedEpisodes` field, 5 with actual progress > 0, 266 with `totalEpisodes > 0`

## Relevant Files
- `src/index.js`: entry point, non-blocking background sync, wires enricher + mdblistSync
- `src/config.js`: defaults including `statusFilter: ['plantowatch']`, TVDB/Fanart.tv/MDBList/SimklState path
- `src/settings/settingsStore.js`: `updateFromForm` handles `simklStatusFilter` array
- `src/http/router.js`: routes for manifest, catalog, configure, oauth, health, sync-now, `/api/lists/trakt`, `/api/lists/simkl`, `/api/test-key`
- `src/ui/configurePage.js`: HTML form with Simkl status checkboxes, provider counts, test API key buttons
- `src/providers/httpJson.js`: 30s AbortController timeout, getJson/postJson
- `src/providers/simklProvider.js`: `statusFilter` option, Phase 2 via `/sync/activities`, cached items in state file, `extractDeltaItems` with `watchedEpisodes`/`totalEpisodes`
- `src/providers/traktProvider.js`: main watchlist + poster extraction
- `src/providers/mdblistProvider.js`: imports FROM MDBList watchlist
- `src/providers/normalizeProviderItem.js`: passes `watchedEpisodes`/`totalEpisodes`, uses `Number.isFinite`
- `src/providers/index.js`: passes `statusFilter` to SimklProvider
- `src/enrich/tvdbFanartEnricher.js`: TVDB v4 login, remote ID + title-based search, Fanart.tv artwork, 5 workers
- `src/sync/mdblistSync.js`: diff-based push to MDBList, 60s debounce
- `src/sync/syncService.js`: orchestrates providers, background enrichment, catalog cache, dedupe merge
- `src/sync/dedupe.js`: merges `watchedEpisodes`/`totalEpisodes` across providers, uses `Number.isFinite`
- `src/sync/catalogMeta.js`: appends "N/M episodes" to series description, builds `videos` array in getMeta, uses `Number.isFinite`
- `data/simkl-sync-state.json`: stores `{ lastActivities, cachedItems }` for Phase 2
- `data/main-list.json`: merged catalog with episode progress data (304 items, 292 with watchedEpisodes)
- `data/settings.json`: user-configured providers, tokens, status filter, API keys
