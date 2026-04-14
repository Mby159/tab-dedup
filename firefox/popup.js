// Tab Dedup popup.js v4.1 - 分组选项 + 徽章
(function() {
'use strict';

var allTabs = [], tabGroups = [], dupGroups = [], currentGroupBy = 'full';
var GROUPS = [
  { id: 'full', label: '完整 URL', desc: '完全相同的页面' },
  { id: 'domain', label: '按域名', desc: '同一网站的所有页面' },
  { id: 'root', label: '按根域名', desc: '同一主域名的所有子页面' }
];

// 对搜索类页面有意义的查询参数
var SEARCH_PARAMS = ['q', 'query', 'keyword', 'search', 'wd', 'kw', 'k', 's', 'text', 'word'];

function nu(u, groupBy) {
  try {
    var x = new URL(u);
    var host = x.hostname.replace(/^www\./, '').toLowerCase();
    var path = x.pathname.replace(/\/$/, '').toLowerCase();
    if (groupBy === 'domain') {
      return host;
    } else if (groupBy === 'root') {
      var parts = host.split('.');
      return parts.slice(-2).join('.') + path;
    }
    // full 模式：额外附加搜索类关键参数
    var extra = '';
    SEARCH_PARAMS.forEach(function(p) {
      var v = x.searchParams.get(p);
      if (v) extra += '|' + p + '=' + v.toLowerCase();
    });
    return host + path + extra;
  } catch (e) {
    return u.toLowerCase();
  }
}
function gd(u) {
  try {
    var x = new URL(u);
    return x.hostname.replace(/^www\./, '') + (x.port ? ':' + x.port : '');
  } catch (e) { return u; }
}
function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function loadTabsFromBackground() {
  browser.runtime.sendMessage({ type: 'refresh' }, function(resp) {
    if (browser.runtime.lastError) {
      document.getElementById('tl').innerHTML = '<div class=empty-state><div class=icon>⚠️</div><div class=msg>连接失败：' + esc(browser.runtime.lastError.message) + '</div></div>';
      return;
    }
    if (!resp || !resp.tabs) {
      document.getElementById('tl').innerHTML = '<div class=empty-state><div class=icon>⚠️</div><div class=msg>获取失败</div></div>';
      return;
    }
    currentGroupBy = resp.groupBy || 'full';
    allTabs = resp.tabs.filter(function(t) {
      return t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:');
    });

    // 分组
    var g = {};
    allTabs.forEach(function(t) {
      var k = nu(t.url, currentGroupBy);
      if (!g[k]) g[k] = [];
      g[k].push(t);
    });
    dupGroups = Object.values(g).filter(function(x) { return x.length > 1; });
    var sg = Object.values(g).filter(function(x) { return x.length === 1; });
    tabGroups = dupGroups.concat(sg);
    render();
  });
}

function changeGroupBy(newGroupBy) {
  browser.runtime.sendMessage({ type: 'setGroupBy', groupBy: newGroupBy }, function(resp) {
    if (resp && resp.dups) {
      currentGroupBy = resp.groupBy || newGroupBy;
      // 重新计算分组
      var grp = {};
      allTabs.forEach(function(t) {
        var k = nu(t.url, currentGroupBy);
        if (!grp[k]) grp[k] = [];
        grp[k].push(t);
      });
      dupGroups = Object.values(grp).filter(function(x) { return x.length > 1; });
      var sg = Object.values(grp).filter(function(x) { return x.length === 1; });
      tabGroups = dupGroups.concat(sg);
      render();
    }
  });
}

function closeGroup(gi) {
  var g = tabGroups[gi];
  if (!g || g.length <= 1) return;
  var ids = g.slice(1).map(function(t) { return t.id; });
  browser.runtime.sendMessage({ type: 'closeTabs', ids: ids }, function() {
    setTimeout(loadTabsFromBackground, 300);
  });
}

function closeSingleTab(id) {
  browser.runtime.sendMessage({ type: 'closeTab', id: id }, function() {
    setTimeout(loadTabsFromBackground, 300);
  });
}

function goToTab(id) {
  browser.runtime.sendMessage({ type: 'navigate', tabId: id }, function() {});
}

function showPreview(tab, rect) {
  var p = document.getElementById('tab-preview');
  var iw = document.getElementById('preview-img-wrap');
  var img = document.getElementById('preview-img');
  var le = document.getElementById('preview-loading');
  var se = document.getElementById('preview-status');
  document.getElementById('preview-title').textContent = tab.title || '';
  document.getElementById('preview-url').textContent = tab.url;
  le.style.display = 'flex';
  iw.style.display = 'none';
  img.src = '';

  var top = rect.bottom + 8, left = rect.left;
  if (left + 300 > window.innerWidth - 8) left = window.innerWidth - 300 - 8;
  if (left < 8) left = 8;
  if (top + 220 > window.innerHeight - 8) top = rect.top - 220 - 8;
  p.style.top = top + 'px';
  p.style.left = left + 'px';
  p.style.display = 'block';
  p.style.opacity = '1';

  var timedOut = false;
  var timer = setTimeout(function() {
    timedOut = true;
    se.textContent = '超时（8秒）';
    le.style.display = 'flex';
  }, 8000);

  browser.runtime.sendMessage({ type: 'captureTab', tabId: tab.id }, function(resp) {
    clearTimeout(timer);
    if (timedOut || !resp) return;
    if (resp.dataUrl) {
      img.src = resp.dataUrl;
      iw.style.display = 'block';
      le.style.display = 'none';
    } else {
      se.textContent = resp.error || '无法预览';
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
  var totalDup = dupGroups.reduce ? dupGroups.reduce(function(s, g) { return s + g.length; }, 0) : 0;

  // 分组选项 UI
  var groupOpts = '';
  GROUPS.forEach(function(g) {
    groupOpts += '<button class="opt-btn' + (currentGroupBy === g.id ? ' active' : '') + '" data-gb="' + g.id + '" title="' + esc(g.desc) + '">' + g.label + '</button>';
  });

  sb.innerHTML = '<div class="group-opts">' + groupOpts + '</div>' + (totalDup === 0
    ? '<span class="badge badge-green">✅ 无重复</span><span>共 ' + allTabs.length + ' 个标签页</span>'
    : '<span class="badge badge-red">🔴 ' + dupGroups.length + ' 组重复</span><span>' + totalDup + ' 个重复</span>');

  // 分组按钮事件
  var optBtns = sb.querySelectorAll('.opt-btn');
  for (var oi = 0; oi < optBtns.length; oi++) {
    (function(btn) {
      btn.onclick = function() {
        var gb = btn.dataset.gb;
        // 更新样式
        optBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        changeGroupBy(gb);
      };
    })(optBtns[oi]);
  }

  if (dupGroups.length > 0) {
    ha.innerHTML = '<button class="btn btn-danger" id="closeAllBtn">关闭全部重复</button><button class="btn btn-ghost" id="collapseBtn">折叠</button>';
    document.getElementById('closeAllBtn').onclick = closeAllDup;
    document.getElementById('collapseBtn').onclick = toggleCollapse;
  } else {
    ha.innerHTML = '<button class="btn btn-ghost" id="refreshBtn">刷新</button>';
    document.getElementById('refreshBtn').onclick = loadTabsFromBackground;
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
    if (isDup) {
      h += '<span class="tab-group-title">' + esc(gd(g[0].url)) + ' · ' + esc(g[0].title) + '</span>';
      h += '<span class="tab-group-count">×' + g.length + '</span>';
      h += '<button class="btn btn-danger btn-small close-group-btn" data-gi="' + gi + '">关闭重复</button>';
    } else {
      h += '<span class="tab-group-title">' + esc(gd(g[0].url)) + ' · ' + esc(g[0].title) + '</span>';
    }
    h += '</div><div class="tab-group-items">';
    for (var ti = 0; ti < g.length; ti++) {
      var t = g[ti];
      var isActive = t.active;
      h += '<div class="tab-item' + (isActive ? ' active' : '') + '" data-id="' + t.id + '" data-wa="' + isActive + '">' +
        '<img class="tab-favicon" src="' + (t.favIconUrl || '') + '" onerror="this.style.display=\'none\'">' +
        '<div class="tab-info"><div class="tab-title">' + esc(t.title) + (isActive ? ' <span class="active-tag">当前</span>' : '') + '</div>' +
        '<div class="tab-url">' + esc(gd(t.url)) + '</div></div>' +
        '<div class="tab-actions"><button class="close-btn close-single-btn">✕</button></div></div>';
    }
    h += '</div></div>';
  }
  tl.innerHTML = h;

  // 关闭组按钮
  var btns = tl.querySelectorAll('.close-group-btn');
  for (var i = 0; i < btns.length; i++) {
    (function(btn) {
      btn.onclick = function(e) { e.stopPropagation(); closeGroup(+btn.dataset.gi); };
    })(btns[i]);
  }

  // 每行事件
  var items = tl.querySelectorAll('.tab-item');
  for (var j = 0; j < items.length; j++) {
    (function(item) {
      var id = +item.dataset.id;
      item.onclick = function(e) {
        if (e.target.classList.contains('close-single-btn')) return;
        goToTab(id);
      };
      var closeBtn = item.querySelector('.close-single-btn');
      if (closeBtn) {
        closeBtn.onclick = function(e) { e.stopPropagation(); closeSingleTab(id); };
      }
      var timer = null;
      item.onmouseenter = function() {
        var rect = item.getBoundingClientRect();
        timer = setTimeout(function() {
          showPreview({ id: id, url: item.querySelector('.tab-url').textContent, title: item.querySelector('.tab-title').textContent }, rect);
        }, 500);
      };
      item.onmouseleave = function() { clearTimeout(timer); hidePreview(); };
    })(items[j]);
  }
}

function closeAllDup() {
  var ids = [];
  dupGroups.forEach(function(g) {
    g.slice(1).forEach(function(t) { ids.push(t.id); });
  });
  if (ids.length > 0) {
    browser.runtime.sendMessage({ type: 'closeTabs', ids: ids }, function() {
      setTimeout(loadTabsFromBackground, 300);
    });
  }
}

var collapsed = false;
function toggleCollapse() {
  var items = document.getElementById('tl').querySelectorAll('.tab-group-items');
  collapsed = !collapsed;
  for (var i = 0; i < items.length; i++) {
    items[i].style.display = collapsed ? 'none' : '';
  }
  var btn = document.getElementById('collapseBtn');
  if (btn) btn.textContent = collapsed ? '展开' : '折叠';
}

// 启动
loadTabsFromBackground();

})();
