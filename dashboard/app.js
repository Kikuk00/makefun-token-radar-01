// Token Radar dashboard: renders window.RADAR (written by main.ts from the
// sealed snapshot) as a sortable, filterable board with a detail view per
// protocol. No network, no fetch: the data is already in data.js.
//
// Two views: the pre-token radar (default) and the already-trading view.
// Initial state can come from the URL hash, so each view has a link:
//   #detail=<slug>  opens a protocol's detail view
//   #view=live      opens the already-trading view
//   #watchlist=1    shows the watchlist only
//   #category=<name> #chain=<name> #q=<text> #sort=<key>
(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'Token Radar: no data loaded.'; return; }

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) { return v === null || v === undefined ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
  function ageText(days) {
    if (days === null || days === undefined) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function chainsOf(r) { return (r.chains || []).slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : ''); }
  function statusLabel(r) {
    if (r.token_status === 'live') return 'ALREADY TRADING';
    if (r.token_status === 'live-no-mcap') return 'TRADES · NO MCAP';
    return r.launch_candidate ? 'PRE-TOKEN' : 'PRE-TOKEN · NOT A LAUNCH';
  }

  // ---- header, KPI strip, fit line -------------------------------------------
  $('asOf').textContent = '· ' + D.as_of;
  var pre = D.rows.filter(function (r) { return r.token_status === 'pre-token'; });
  var topPre = pre[0];
  var V = D.validation, F = D.fitted;
  $('fitLine').innerHTML = 'Fitted on ' + V.anchors + ' live-token anchors: log(mcap/TVL) = ' + F.intercept.toFixed(2) +
    ' − ' + Math.abs(F.slope).toFixed(2) + '·log(TVL). Leave-one-out R² ' + V.fitted_loo.r2.toFixed(2) +
    ', walk-forward R² ' + V.fitted_walkforward.r2.toFixed(2) + ', median error ' + Math.round(V.fitted_loo.med_ape * 100) +
    '% — the market is noisy, so the board ranks by the fitted central estimate and shows each row\'s live comps.';
  $('kpis').innerHTML =
    '<div><dt>Protocols covered</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Pre-token ranked</dt><dd>' + D.pre_token_size + '</dd></div>' +
    '<div><dt>Watchlist covered</dt><dd>' + D.watchlist_size + ' / ' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Top pre-token value</dt><dd>' + money(topPre.implied_value_usd) + '</dd></div>' +
    '<div><dt>Median pre-token value</dt><dd>' + money(D.median_implied_pre_usd) + '</dd></div>' +
    '<div><dt>Top category</dt><dd class="cat">' + esc(D.top_category) + '</dd></div>' +
    '<div><dt>Leave-one-out R²</dt><dd>' + V.fitted_loo.r2.toFixed(2) + '</dd></div>' +
    '<div><dt>Walk-forward R²</dt><dd>' + V.fitted_walkforward.r2.toFixed(2) + '</dd></div>';
  $('tabNote').textContent = D.pre_token_size + ' pre-token · ' + D.live_size + ' already trading · every one of the ' + D.board_size + ' snapshot protocols is on this board.';
  $('formula').innerHTML = 'Model <b>' + esc(D.model_version) + '</b>: implied value = TVL × fitted ratio × growth × maturity × breadth, where fitted ratio = exp(' +
    F.intercept.toFixed(2) + ' − ' + Math.abs(F.slope).toFixed(2) + '·log TVL), fitted on ' + V.anchors +
    ' anchors. Growth is the 7-day TVL change × ' + D.model.growth_weight + ', maturity rises from ' + D.model.maturity_floor +
    ' to 1.0 over ' + (D.model.maturity_days / 365) + ' years, breadth adds ' + (D.model.breadth_per_chain * 100) +
    '% per extra chain. Rank 1 pre-token is ' + esc(topPre.name) + ' at ' + moneyFull(topPre.implied_value_usd) + '.';
  $('validRows').innerHTML =
    '<tr><td><b>Fitted log-TVL model (used)</b></td><td>' + V.fitted_loo.r2.toFixed(2) + '</td><td>' + V.fitted_walkforward.r2.toFixed(2) + '</td><td>' + Math.round(V.fitted_loo.med_ape * 100) + '%</td></tr>' +
    '<tr><td>Category dummies (rejected)</td><td>' + V.dummy_loo.r2.toFixed(2) + '</td><td>' + V.dummy_walkforward.r2.toFixed(2) + '</td><td>' + Math.round(V.dummy_loo.med_ape * 100) + '%</td></tr>' +
    '<tr><td>Shrunk category medians (rejected)</td><td>' + V.baseline_loo.r2.toFixed(2) + '</td><td>' + V.baseline_walkforward.r2.toFixed(2) + '</td><td>' + Math.round(V.baseline_loo.med_ape * 100) + '%</td></tr>';
  $('validNote').textContent = 'Leave-one-out refits the model on all anchors but one and predicts the held-out anchor (' + V.anchors +
    ' anchors). Walk-forward fits on the ' + V.walkforward_train + ' oldest-listed anchors and tests on the ' + V.walkforward_test +
    ' newest-listed ones. The richer fits look better in sample and lose out of sample, so the board keeps the one-variable fit. Median error is the median absolute percentage error on held-out anchors.';
  $('peers').innerHTML = D.peers.map(function (p) {
    return '<li>' + esc(p.category) + ': <b>' + p.median_ratio.toFixed(2) + '×</b> from ' + p.peer_count + ' live peers</li>';
  }).join('');
  $('sourceLine').textContent = 'Source: ' + D.source + '. Floor: ' + moneyFull(D.floor_usd) + '. The watchlist is the floor, never the ceiling: ' + D.early_size + ' ranked pre-token rows sit below it or outside its rule.';

  // ---- live-token table ------------------------------------------------------
  $('liveRows').innerHTML = D.live.map(function (p) {
    return '<tr><td class="name">' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + (p.mcap_usd === null ? '—' : money(p.mcap_usd)) + '</td>' +
      '<td class="num">' + (p.mcap_tvl_ratio === null ? '—' : p.mcap_tvl_ratio.toFixed(2) + '×') + '</td></tr>';
  }).join('');

  // ---- filter controls -------------------------------------------------------
  var cats = [], chains = [];
  D.rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  $('cat').innerHTML += cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('chain').innerHTML += chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  // The radar's working view is the launch candidates: the CEXes, bridges
  // and wrapped products that record no token are still on the board (and
  // in board.json), but they are not launches, so they sit behind the
  // "Launch candidates only" filter, on by default. #candidates=0 opens all.
  var state = { q: '', cat: '', chain: '', watchOnly: false, candOnly: true, sort: 'value', view: 'pre', open: null, openFromHash: false };
  var hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('detail')) { state.open = hash.get('detail'); state.openFromHash = true; document.body.classList.add('detail-first'); }
  if (hash.get('view') === 'live') state.view = 'live';
  if (hash.get('watchlist') === '1') state.watchOnly = true;
  if (hash.get('candidates') === '0') state.candOnly = false;
  if (hash.get('category')) state.cat = hash.get('category');
  if (hash.get('chain')) state.chain = hash.get('chain');
  if (hash.get('q')) state.q = hash.get('q');
  if (hash.get('sort')) state.sort = hash.get('sort');

  // The # column shows the rank inside the view the reader is looking at:
  // the launch-candidate rank when that filter is on, else the view rank.
  function shownRank(r) { return state.candOnly && state.view === 'pre' && r.cand_rank !== null ? r.cand_rank : r.view_rank; }
  var SORTS = {
    value: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
    age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    name: function (a, b) { return a.name < b.name ? -1 : 1; },
    rank: function (a, b) { return shownRank(a) - shownRank(b); },
  };

  function inView(r) {
    return state.view === 'pre' ? r.token_status === 'pre-token' : r.token_status !== 'pre-token';
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (!inView(r)) return false;
      if (state.watchOnly && !r.on_watchlist) return false;
      if (state.candOnly && state.view === 'pre' && !r.launch_candidate) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return rows.sort(SORTS[state.sort] || SORTS.value);
  }

  function render() {
    var rows = filtered();
    var total = state.view === 'pre' ? D.pre_token_size : D.live_size;
    $('count').textContent = rows.length + ' of ' + total + (state.view === 'pre' ? ' pre-token' : ' already trading');
    $('tabPre').classList.toggle('active', state.view === 'pre');
    $('tabLive').classList.toggle('active', state.view === 'live');
    $('rows').innerHTML = rows.length ? rows.map(function (r) {
      var g = r.change_7d;
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.open === r.slug ? ' class="open"' : '') + '>' +
        '<td class="rank">' + shownRank(r) + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' + (r.on_watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
        (r.token_status !== 'pre-token' ? '<span class="badge live-badge">' + statusLabel(r) + '</span>' : '') +
        (r.token_status === 'pre-token' && !r.launch_candidate ? '<span class="badge dim">NOT A LAUNCH</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="chains">' + esc(chainsOf(r)) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num ' + (g === null ? '' : g >= 0 ? 'up' : 'down') + '">' + pct(g) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td><button class="plan-btn" data-slug="' + esc(r.slug) + '">Farm plan</button></td></tr>';
    }).join('') : '<tr><td colspan="9" class="empty">No protocol matches these filters.</td></tr>';
    renderDetail();
  }

  // ---- detail view -----------------------------------------------------------
  function bySlug(slug) { for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) return D.rows[i]; return null; }
  var lastScrolled = null;
  function renderDetail() {
    var box = $('detail');
    var r = state.open ? bySlug(state.open) : null;
    if (!r) { box.hidden = true; box.innerHTML = ''; lastScrolled = null; return; }
    var base = Math.round(r.tvl_usd * r.fitted_ratio);
    var g = r.change_7d;
    var basis = r.value_basis === 'market-cap' ? 'Actual market cap — the market\'s own value, not a model guess.' :
      r.value_basis === 'fitted-no-mcap' ? 'Fitted value: this protocol records a token but the snapshot carries no market cap for it.' :
      'Fitted value: log(mcap/TVL) = ' + F.intercept.toFixed(2) + ' − ' + Math.abs(F.slope).toFixed(2) + '·log(TVL), fitted on ' + V.anchors + ' live-token anchors.';
    box.hidden = false;
    var rankLine = r.cand_rank !== null ? '#' + r.cand_rank + ' launch candidate · #' + r.view_rank + ' pre-token · board #' + r.rank :
      '#' + r.view_rank + ' ' + (r.token_status === 'pre-token' ? 'pre-token' : 'trading') + ' · board #' + r.rank;
    box.innerHTML =
      '<h2>' + esc(r.name) + ' <span class="rank">' + rankLine + '</span></h2>' +
      '<p class="basis">' + basis + '</p>' +
      '<div class="meta"><span>Category: <b>' + esc(r.category || '—') + '</b></span>' +
      '<span>Chains: <b>' + esc((r.chains || []).join(', ') || '—') + '</b></span>' +
      '<span>TVL: <b>' + moneyFull(r.tvl_usd) + '</b></span>' +
      '<span>7-day change: <b class="' + (g === null ? '' : g >= 0 ? 'up' : 'down') + '">' + pct(g) + '</b></span>' +
      '<span>Listed: <b>' + esc(r.listed_at || 'unknown') + '</b></span>' +
      '<span>' + (r.on_watchlist ? 'On the watchlist' : 'Below the watchlist floor') + '</span></div>' +
      '<dl class="model-grid">' +
      '<div><dt>' + (r.value_basis === 'market-cap' ? 'Market cap' : 'Implied value') + '</dt><dd>' + moneyFull(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>Base · TVL × fitted ratio</dt><dd>' + money(base) + ' · ' + r.fitted_ratio.toFixed(3) + '×</dd></div>' +
      '<div><dt>Category peer median</dt><dd>' + (r.cat_median_ratio === null ? 'global ' + D.global_ratio.toFixed(2) + '×' : r.cat_median_ratio.toFixed(2) + '× · ' + r.peer_count + ' peers') + '</dd></div>' +
      '<div><dt>Growth multiplier</dt><dd>' + r.growth_multiplier.toFixed(2) + '×</dd></div>' +
      '<div><dt>Maturity multiplier</dt><dd>' + r.maturity_multiplier.toFixed(2) + '×</dd></div>' +
      '<div><dt>Breadth multiplier</dt><dd>' + r.breadth_multiplier.toFixed(2) + '×</dd></div></dl>' +
      '<h3>Why this value — nearest live comps, same category first</h3>' +
      '<table class="comps"><thead><tr><th>Live comp</th><th>Category</th><th>TVL</th><th>Mcap / TVL</th></tr></thead><tbody>' +
      (r.comps || []).map(function (c) { return '<tr><td class="name">' + esc(c.name) + '</td><td>' + esc(c.category || '—') + '</td><td class="num">' + money(c.tvl_usd) + '</td><td class="num">' + c.ratio.toFixed(2) + '×</td></tr>'; }).join('') +
      '</tbody></table>' +
      '<h3>How to farm it — ' + (r.farm_steps || []).length + ' steps</h3>' +
      '<ol class="steps">' + (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    if (lastScrolled !== r.slug) { lastScrolled = r.slug; if (!state.openFromHash) box.scrollIntoView({ block: 'start' }); }
  }

  // ---- wiring ----------------------------------------------------------------
  $('q').value = state.q; $('cat').value = state.cat; $('chain').value = state.chain;
  $('sort').value = state.sort; $('watchOnly').checked = state.watchOnly; $('candOnly').checked = state.candOnly;
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('watchOnly').addEventListener('change', function (e) { state.watchOnly = e.target.checked; render(); });
  $('candOnly').addEventListener('change', function (e) { state.candOnly = e.target.checked; render(); });
  $('tabPre').addEventListener('click', function () { state.view = 'pre'; state.open = null; render(); });
  $('tabLive').addEventListener('click', function () { state.view = 'live'; state.open = null; render(); });
  document.querySelectorAll('#board thead th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var key = th.getAttribute('data-sort');
      state.sort = key === 'value' ? 'value' : key === 'growth' ? 'growth' : key === 'age' ? 'age' : key === 'tvl' ? 'tvl' : key === 'name' ? 'name' : 'rank';
      $('sort').value = state.sort; render();
    });
  });
  $('rows').addEventListener('click', function (e) {
    var t = e.target.closest('[data-slug]');
    if (!t) return;
    state.openFromHash = false; document.body.classList.remove('detail-first');
    state.open = state.open === t.getAttribute('data-slug') ? null : t.getAttribute('data-slug');
    render();
  });

  render();
})();
