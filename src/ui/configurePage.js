function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderConfigurePage(settings, stats, config, baseUrl) {
  const traktRedirect = baseUrl + '/callback/trakt';
  const simklRedirect = baseUrl + '/callback/simkl';
  const traktCfg = settings.providers?.trakt || {};
  const simklCfg = settings.providers?.simkl || {};
  const traktAuthorized = !!(traktCfg.accessToken);
  const simklAuthorized = !!(simklCfg.accessToken);
  const simklFilter = settings.simklStatusFilter || [];
  const traktLists = traktCfg.availableLists || [];
  const traktSelected = traktCfg.selectedLists || ['watchlist'];

  const statuses = ['plantowatch', 'watching', 'completed', 'hold', 'dropped'];
  const statusLabels = {
    plantowatch: 'Plan to Watch',
    watching: 'Watching',
    completed: 'Completed',
    hold: 'On Hold',
    dropped: 'Dropped'
  };

  const bySource = stats.bySource || {};

  return '<!DOCTYPE html>' +
'<html lang="en"><head>' +
'<meta charset="UTF-8">' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
'<title>autosynclist</title>' +
'<style>' +
'*{box-sizing:border-box;margin:0;padding:0}' +
'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,sans-serif;background:#0d1117;color:#c9d1d9;padding:2rem}' +
'.container{max-width:720px;margin:0 auto}' +
'h1{font-size:1.6rem;margin-bottom:0.5rem;color:#f0f6fc}' +
'h2{font-size:1.2rem;margin:1.5rem 0 1rem;color:#f0f6fc;border-bottom:1px solid #30363d;padding-bottom:0.5rem}' +
'.subtitle{color:#8b949e;margin-bottom:1rem;font-size:0.9rem}' +
'.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.25rem;margin-bottom:1.5rem}' +
'.badge{display:inline-block;padding:0.2rem 0.6rem;border-radius:12px;font-size:0.75rem;font-weight:600}' +
'.badge-ok{background:#1b4a2e;color:#3fb950;border:1px solid #2ea043}' +
'.badge-missing{background:#3d1f1f;color:#f85149;border:1px solid #da3633}' +
'.btn{display:inline-block;padding:0.5rem 1.2rem;border-radius:6px;font-size:0.9rem;font-weight:600;text-decoration:none;cursor:pointer;border:1px solid transparent;background:#21262d;color:#c9d1d9;border-color:#30363d;margin-right:0.5rem;margin-bottom:0.5rem}' +
'.btn:hover{background:#30363d}' +
'.btn-primary{background:#238636;color:#fff;border-color:#2ea043}' +
'.btn-primary:hover{background:#2ea043}' +
'.btn:disabled{opacity:0.5;cursor:not-allowed}' +
'label{display:block;margin-bottom:0.5rem;font-size:0.9rem}' +
'.checkbox-group{display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:1rem}' +
'.checkbox-group label{display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.9rem}' +
'.stat-row{display:flex;justify-content:space-between;padding:0.4rem 0;font-size:0.9rem;border-bottom:1px solid #21262d}' +
'.stat-row:last-child{border-bottom:none}' +
'.stat-label{color:#8b949e}' +
'.stat-value{color:#f0f6fc;font-weight:600}' +
'.list-section{margin-top:0.75rem;padding:0.75rem;background:#0d1117;border-radius:6px}' +
'.list-section label{font-weight:400;padding:0.25rem 0}' +
'.list-section input{margin-right:0.4rem}' +
'.test-results{font-size:0.85rem;margin-top:0.75rem}' +
'.test-results div{padding:0.3rem 0}' +
'.test-ok{color:#3fb950}' +
'.test-fail{color:#f85149}' +
'inline-code{font-family:"SF Mono",monospace;font-size:0.8rem;background:#21262d;padding:0.15rem 0.4rem;border-radius:4px}' +
'code{font-family:"SF Mono",monospace;font-size:0.8rem;background:#21262d;padding:0.15rem 0.4rem;border-radius:4px}' +
'</style></head><body>' +
'<div class="container">' +
'<h1>autosynclist</h1>' +
'<p class="subtitle">Merged watchlist from Trakt, Simkl, and MDBList</p>' +
'<p>Manifest: <code>' + baseUrl + '/manifest.json</code></p>' +

'<form method="POST" action="/configure">' +

'<div class="card">' +
'<h2>Trakt</h2>' +
(traktAuthorized
  ? '<span class="badge badge-ok">Authorized</span> <span class="stat-value">' + (bySource.trakt || 0) + ' items</span>'
  : '<a class="btn btn-primary" href="https://trakt.tv/oauth/authorize?response_type=code&client_id=' + config.trakt.clientId + '&redirect_uri=' + encodeURIComponent(traktRedirect) + '">Authorize Trakt</a>'
) +
'<p class="subtitle">Callback: <code>' + traktRedirect + '</code></p>' +

(traktAuthorized ? (
'<div class="list-section" id="trakt-lists">' +
'<button type="button" class="btn" onclick="loadLists(\'trakt\')">Load my Trakt lists</button>' +
'<div id="trakt-lists-container">' +
  (traktLists.length > 0
    ? traktLists.map(function (list) {
        var checked = traktSelected.includes(list.id) ? 'checked' : '';
        return '<label><input type="checkbox" name="traktSelectedLists" value="' + escapeHtml(list.id) + '" ' + checked + '> ' + escapeHtml(list.name) + '</label>';
      }).join('')
    : '<span class="subtitle">Click "Load my Trakt lists" to discover your lists</span>'
  ) +
'</div></div>'
) : '') +

'</div>' +

'<div class="card">' +
'<h2>Simkl <span class="stat-value">' + (bySource.simkl || 0) + ' items</span></h2>' +
(simklAuthorized
  ? '<span class="badge badge-ok">Authorized</span>'
  : '<a class="btn btn-primary" href="https://simkl.com/oauth/authorize?response_type=code&client_id=' + config.simkl.clientId + '&redirect_uri=' + encodeURIComponent(simklRedirect) + '">Authorize Simkl</a>'
) +
'<p class="subtitle">Callback: <code>' + simklRedirect + '</code></p>' +

'<label style="margin-top:0.75rem;font-weight:600">Status Filter</label>' +
'<div class="checkbox-group">' +
  statuses.map(function (s) {
    return '<label><input type="checkbox" name="simklStatusFilter" value="' + s + '"' + (simklFilter.includes(s) ? ' checked' : '') + '> ' + statusLabels[s] + '</label>';
  }).join('') +
'</div>' +
'</div>' +

'<div class="card">' +
'<h2>Provider Status</h2>' +
'<div class="stat-row"><span class="stat-label">Trakt items</span><span class="stat-value">' + (bySource.trakt || 0) + '</span></div>' +
'<div class="stat-row"><span class="stat-label">Simkl items</span><span class="stat-value">' + (bySource.simkl || 0) + '</span></div>' +
'<div class="stat-row"><span class="stat-label">MDBList items</span><span class="stat-value">' + (bySource.mdblist || 0) + '</span></div>' +
'<div class="stat-row"><span class="stat-label">Total (deduplicated)</span><span class="stat-value">' + (stats.total || 0) + '</span></div>' +
'<div class="stat-row"><span class="stat-label">Catalog entries</span><span class="stat-value">' + (stats.catalogTotal || 0) + '</span></div>' +
'</div>' +

'<div class="card">' +
'<h2>Actions</h2>' +
'<button type="submit" class="btn btn-primary">Save & Sync</button>' +
'<a class="btn" href="/api/health">Health</a>' +
'<a class="btn" href="' + baseUrl + '/manifest.json">Install in Stremio</a>' +
'</div>' +

'</form>' +
'</div>' +

'<script>' +
'async function loadLists(provider){' +
'var container=document.getElementById(provider+"-lists-container");' +
'container.innerHTML="<span class=\"subtitle\">Loading...</span>";' +
'try{' +
'var res=await fetch("/api/lists/"+provider);' +
'var data=await res.json();' +
'var html="";' +
'for(var i=0;i<data.lists.length;i++){' +
'var list=data.lists[i];' +
'var checked=(data.selected||[]).includes(list.id)?"checked":"";' +
'html+="<label><input type=\\"checkbox\\" name=\\""+provider+"SelectedLists\\" value=\\""+list.id+"\\" "+checked+"> "+list.name+"</label>";' +
'}' +
'container.innerHTML=html;' +
'}catch(err){container.innerHTML="<span class=\\"subtitle\\">Failed: "+err.message+"</span>"}' +
'}' +
'</script>' +

'</body></html>';
}

module.exports = { renderConfigurePage };
