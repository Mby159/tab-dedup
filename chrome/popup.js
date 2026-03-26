// Tab Dedup popup.js v4 (Chrome Manifest V3)
(function() {
'use strict';

var allTabs = [], tabGroups = [], dupGroups = [];

function nu(u) {
  try { var x = new URL(u); return (x.hostname.replace(/^www\./,'') + x.pathname.replace(/\/$/,'')).toLowerCase(); }
  catch (e) { return u.toLowerCase(); }
}
function gd(u) {
  try { return new URL(u).hostname.replace(/^www\./,''); }
  catch (e) { return u; }
}
function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// 向 background 请求标签页数据
function loadTabsFromBackground() {
  chrome.runtime.sendMessage({ type: 'refresh' }, function(resp) {
    if (chrome.runtime.lastError) {
      document.getElementById('tl').innerHTML = '<div class=empty-state><div class=icon>⚠️</div><div class=msg>连接失败：' + esc(chrome.runtime.lastError.message) + '</div></div>';
      return;
    }
    if (!resp || !resp.tabs) {
      document.getElementById('tl').innerHTML = '<div class=empty-state><div class=icon>⚠️</div><div class=msg>获取失败</div></div>';
      return;
    }
    allTabs = resp.tabs.filter(function(t) {
      return t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:');
    });
    var g = {};
    allTabs.forEach(function(t) {
      var k = nu(t.url);
      if (!g[k]) g[k] = [];
      g[k].push(t);
    });
    dupGroups = Object.values(g).filter(function(x) { return x.length > 1; });
    var sg = Object.values(g).filter(function(x) { return x.length === 1; });
    tabGroups = dupGroups.concat(sg);
    render();
  });
}

// 关闭一组重复（保留第一个）
function closeGroup(gi) {
  var g = tabGroups[gi];
  if (!g || g.length <= 1) return;
  var ids = g.slice(1).map(function(t) { return t.id; });
  chrome.runtime.sendMessage({ type: 'closeTabs', ids: ids }, function() {
    setTimeout(loadTabsFromBackground, 300);
  });
}

// 关闭单个标签页
function closeSingleTab(id) {
  chrome.tabs.remove(id, function() {
    setTimeout(loadTabsFromBackground, 300);
  });
}

// 跳转到标签页
function goToTab(id) {
  chrome.tabs.update(id, { active: true }).catch(function() {});
}

// 截图预览
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

  chrome.runtime.sendMessage({ type: 'captureTab', tabId: tab.id }, function(resp) {
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

// 渲染
function render() {
  var tl = document.getElementById('tl');
  var sb = document.getElementById('sb');
  var ha = document.getElementById('ha');
  var totalDup = dupGroups.reduce ? dupGroups.reduce(function(s, g) { return s + g.length; }, 0) : 0;

  sb.innerHTML = totalDup === 0
    ? '<span class="badge badge-green">✅ 无重复</span><span>共 ' + allTabs.length + ' 个标签页</span>'
    : '<span class="badge badge-red">🔴 ' + dupGroups.length + ' 组重复</span><span>' + totalDup + ' 个重复</span>';

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

// 关闭全部重复
function closeAllDup() {
  var ids = [];
  dupGroups.forEach(function(g) {
    g.slice(1).forEach(function(t) { ids.push(t.id); });
  });
  if (ids.length > 0) {
    chrome.tabs.remove(ids, function() {
      setTimeout(loadTabsFromBackground, 300);
    });
  }
}

// 折叠/展开
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
