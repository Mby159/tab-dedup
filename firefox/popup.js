// Tab Dedup popup.js v4.4
(function() {
'use strict';

alert('[Tab Dedup] popup JS 已启动');

var allTabs = [], tabGroups = [], dupGroups = [], currentGroupBy = 'full';
var GROUPS = [
  { id: 'full', label: '完整 URL', desc: '完全相同的页面' },
  { id: 'domain', label: '按域名', desc: '同一网站的所有页面' },
  { id: 'root', label: '按根域名', desc: '同一主域名的所有子页面' }
];
var SEARCH_PARAMS = ['q', 'query', 'keyword', 'search', 'wd', 'kw', 'k', 's', 'text', 'word'];

function nu(u, groupBy) {
  try {
    var x = new URL(u);
    var host = x.hostname.replace(/^www\./, '').toLowerCase();
    var path = x.pathname.replace(/\/$/, '').toLowerCase();
    if (groupBy === 'domain') return host;
    if (groupBy === 'root') { var parts = host.split('.'); return parts.slice(-2).join('.') + path; }
    var extra = '';
    SEARCH_PARAMS.forEach(function(p) { var v = x.searchParams.get(p); if (v) extra += '|' + p + '=' + v.toLowerCase(); });
    return host + path + extra;
  } catch(e) { return u.toLowerCase(); }
}
function gd(u) {
  try { var x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.port ? ':' + x.port : ''); }
  catch(e) { return u; }
}
function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function loadTabs() {
  console.log('[Tab Dedup] loadTabs 开始');
  document.getElementById('sb').innerHTML = '<span>正在连接 background...</span>';
  
  var timeout = setTimeout(function() {
    console.error('[Tab Dedup] sendMessage 超时');
    document.getElementById('tl').innerHTML = '<div class=empty-state><div class=icon>⚠️</div><div class=msg>连接 background 超时，请重新加载插件</div></div>';
  }, 5000);
  
  browser.runtime.sendMessage({ type: 'refresh' }, function(resp) {
    clearTimeout(timeout);
    console.log('[Tab Dedup] 收到响应:', resp, 'lastError:', browser.runtime.lastError);
    if (browser.runtime.lastError || !resp || !resp.tabs) {
      document.getElementById('tl').innerHTML = '<div class=empty-state><div class=icon>⚠️</div><div class=msg>获取失败: ' + (browser.runtime.lastError ? browser.runtime.lastError.message : '无响应') + '</div></div>';
      return;
    }
    currentGroupBy = resp.groupBy || 'full';
    allTabs = resp.tabs.filter(function(t) { return t.url && !t.url.startsWith('about:') && !t.url.startsWith('moz-extension://'); });
    buildGroups();
    render();
  });
}

function buildGroups() {
  var g = {};
  allTabs.forEach(function(t) {
    var k = nu(t.url, currentGroupBy);
    if (!g[k]) g[k] = [];
    g[k].push(t);
  });
  dupGroups = Object.values(g).filter(function(x) { return x.length > 1; });
  var sg = Object.values(g).filter(function(x) { return x.length === 1; });
  tabGroups = dupGroups.concat(sg);
}

function changeGroupBy(gb) {
  currentGroupBy = gb;
  browser.runtime.sendMessage({ type: 'setGroupBy', groupBy: gb }, function() {});
  buildGroups();
  render();
}

function closeGroup(gi) {
  var g = tabGroups[gi];
  if (!g || g.length <= 1) return;
  var ids = g.slice(1).map(function(t) { return t.id; });
  browser.tabs.remove(ids).then(function() { setTimeout(loadTabs, 300); });
}

function closeSingleTab(id) {
  browser.tabs.remove(id).then(function() { setTimeout(loadTabs, 300); });
}

function goToTab(id) {
  browser.tabs.update(id, { active: true }).catch(function() {});
}

function showPreview(tabId, title, url, rect) {
  var p = document.getElementById('tab-preview');
  var iw = document.getElementById('preview-img-wrap');
  var img = document.getElementById('preview-img');
  var le = document.getElementById('preview-loading');
  var se = document.getElementById('preview-status');
  document.getElementById('preview-title').textContent = title || '';
  document.getElementById('preview-url').textContent = url;
  le.style.display = 'flex'; iw.style.display = 'none'; img.src = '';
  se.textContent = '加载中...';
  var top = rect.bottom + 8, left = rect.left;
  if (left + 300 > window.innerWidth - 8) left = window.innerWidth - 308;
  if (left < 8) left = 8;
  if (top + 220 > window.innerHeight - 8) top = rect.top - 228;
  p.style.cssText = 'display:block;opacity:1;top:' + top + 'px;left:' + left + 'px';
  var done = false;
  var timer = setTimeout(function() { if (!done) { done = true; se.textContent = '预览超时'; } }, 6000);
  browser.runtime.sendMessage({ type: 'captureTab', tabId: tabId }, function(resp) {
    clearTimeout(timer);
    if (done) return;
    done = true;
    if (resp && resp.dataUrl) {
      img.src = resp.dataUrl;
      iw.style.display = 'block';
      le.style.display = 'none';
    } else {
      se.textContent = (resp && resp.error) || '无法预览';
    }
  });
}

function hidePreview() {
  var p = document.getElementById('tab-preview');
  p.style.opacity = '0';
  setTimeout(function() { p.style.display = 'none'; }, 150);
}

function render() {
  var tl = document.getElementById('tl');
  var sb = document.getElementById('sb');
  var ha = document.getElementById('ha');
  var totalDup = dupGroups.reduce(function(s, g) { return s + g.length; }, 0);

  var groupOpts = GROUPS.map(function(g) {
    return '<button class="opt-btn' + (currentGroupBy === g.id ? ' active' : '') + '" data-gb="' + g.id + '" title="' + esc(g.desc) + '">' + g.label + '</button>';
  }).join('');

  sb.innerHTML = '<div class="group-opts">' + groupOpts + '</div>' +
    (totalDup === 0
      ? '<span class="badge badge-green">✅ 无重复</span><span>共 ' + allTabs.length + ' 个标签页</span>'
      : '<span class="badge badge-red">🔴 ' + dupGroups.length + ' 组重复</span><span>' + totalDup + ' 个重复</span>');

  sb.querySelectorAll('.opt-btn').forEach(function(btn) {
    btn.onclick = function() { changeGroupBy(btn.dataset.gb); };
  });

  if (dupGroups.length > 0) {
    ha.innerHTML = '<button class="btn btn-danger" id="closeAllBtn">关闭全部重复</button><button class="btn btn-ghost" id="collapseBtn">折叠</button>';
    document.getElementById('closeAllBtn').onclick = closeAllDup;
    document.getElementById('collapseBtn').onclick = toggleCollapse;
  } else {
    ha.innerHTML = '<button class="btn btn-ghost" id="refreshBtn">刷新</button>';
    document.getElementById('refreshBtn').onclick = loadTabs;
  }

  if (tabGroups.length === 0) {
    tl.innerHTML = '<div class=empty-state><div class=icon>📋</div><div class=msg>没有标签页</div></div>';
    return;
  }

  var h = '';
  for (var gi = 0; gi < tabGroups.length; gi++) {
    var g = tabGroups[gi];
    var isDup = g.length > 1;
    h += '<div class="tab-group' + (isDup ? '' : ' single') + '">';
    h += '<div class="tab-group-header">';
    h += '<span class="tab-group-title">' + esc(gd(g[0].url)) + ' · ' + esc(g[0].title) + '</span>';
    if (isDup) {
      h += '<span class="tab-group-count">×' + g.length + '</span>';
      h += '<button class="btn btn-danger btn-small close-group-btn" data-gi="' + gi + '">关闭重复</button>';
    }
    h += '</div><div class="tab-group-items">';
    for (var ti = 0; ti < g.length; ti++) {
      var t = g[ti];
      h += '<div class="tab-item' + (t.active ? ' active' : '') + '" data-id="' + t.id + '">' +
        '<img class="tab-favicon" src="' + esc(t.favIconUrl || '') + '" onerror="this.style.display=\'none\'">' +
        '<div class="tab-info"><div class="tab-title">' + esc(t.title) + (t.active ? ' <span class="active-tag">当前</span>' : '') + '</div>' +
        '<div class="tab-url">' + esc(gd(t.url)) + '</div></div>' +
        '<div class="tab-actions"><button class="close-btn close-single-btn">✕</button></div></div>';
    }
    h += '</div></div>';
  }
  tl.innerHTML = h;

  tl.querySelectorAll('.close-group-btn').forEach(function(btn) {
    btn.onclick = function(e) { e.stopPropagation(); closeGroup(+btn.dataset.gi); };
  });

  tl.querySelectorAll('.tab-item').forEach(function(item) {
    var id = +item.dataset.id;
    var tabData = null;
    for (var i = 0; i < allTabs.length; i++) { if (allTabs[i].id === id) { tabData = allTabs[i]; break; } }
    item.onclick = function(e) { if (e.target.classList.contains('close-single-btn')) return; goToTab(id); };
    item.querySelector('.close-single-btn').onclick = function(e) { e.stopPropagation(); closeSingleTab(id); };
    var hoverTimer = null;
    item.onmouseenter = function() {
      var rect = item.getBoundingClientRect();
      hoverTimer = setTimeout(function() {
        if (tabData) showPreview(id, tabData.title, tabData.url, rect);
      }, 500);
    };
    item.onmouseleave = function() { clearTimeout(hoverTimer); hidePreview(); };
  });
}

function closeAllDup() {
  var ids = [];
  dupGroups.forEach(function(g) { g.slice(1).forEach(function(t) { ids.push(t.id); }); });
  if (ids.length > 0) browser.tabs.remove(ids).then(function() { setTimeout(loadTabs, 300); });
}

var collapsed = false;
function toggleCollapse() {
  collapsed = !collapsed;
  document.getElementById('tl').querySelectorAll('.tab-group-items').forEach(function(el) {
    el.style.display = collapsed ? 'none' : '';
  });
  var btn = document.getElementById('collapseBtn');
  if (btn) btn.textContent = collapsed ? '展开' : '折叠';
}

loadTabs();

})();
