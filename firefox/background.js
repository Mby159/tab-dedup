// background.js - Tab Dedup v4.1
// 负责：查询标签页、截图、关闭标签页、图标徽章
// popup 通过 postMessage 通信

var _cachedTabs = [];
var _groupBy = 'full'; // 'full' | 'domain' | 'root'

// 规范化 URL 分组
function nu(u, groupBy) {
  try {
    var x = new URL(u);
    if (groupBy === 'domain') {
      return x.hostname.replace(/^www\./, '').toLowerCase();
    } else if (groupBy === 'root') {
      var parts = x.hostname.replace(/^www\./, '').split('.');
      return parts.slice(-2).join('.') + x.pathname.replace(/\/$/, '').toLowerCase();
    }
    return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).toLowerCase();
  } catch (e) {
    return u.toLowerCase();
  }
}

function gd(u) {
  try {
    var x = new URL(u);
    return x.hostname.replace(/^www\./, '') + (x.port ? ':' + x.port : '');
  } catch (e) {
    return u;
  }
}

// 计算重复
function calcDups(tabs, groupBy) {
  var g = {};
  tabs.forEach(function(t) {
    if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('about:')) return;
    var k = nu(t.url, groupBy);
    if (!g[k]) g[k] = [];
    g[k].push(t);
  });
  return Object.values(g).filter(function(x) { return x.length > 1; });
}

// 更新图标徽章
function updateBadge(tabs, groupBy) {
  var dups = calcDups(tabs, groupBy);
  if (dups.length > 0) {
    var text = dups.length > 99 ? '99+' : String(dups.length);
    browser.action.setBadgeText({ text: text });
    browser.action.setBadgeBackgroundColor({ color: '#ff453a' });
  } else {
    browser.action.setBadgeText({ text: '' });
  }
  return dups;
}

// 刷新标签页
function refreshTabs(callback) {
  browser.tabs.query({}).then(function(tabs) {
    _cachedTabs = tabs;
    var dups = updateBadge(tabs, _groupBy);
    if (callback) callback(tabs, dups);
  }).catch(function(err) {
    if (callback) callback([], []);
  });
}

// 获取分组设置
function getSettings() {
  return browser.storage.local.get(['groupBy']).then(function(data) {
    _groupBy = data.groupBy || 'full';
    return _groupBy;
  });
}

// 保存分组设置
function setSettings(groupBy) {
  _groupBy = groupBy;
  return browser.storage.local.set({ groupBy: groupBy }).then(function() {
    var dups = updateBadge(_cachedTabs, _groupBy);
    return dups;
  });
}

browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'refresh') {
    getSettings().then(function() {
      refreshTabs(function(tabs, dups) {
        sendResponse({ tabs: tabs, dups: dups, groupBy: _groupBy });
      });
    });
    return true;
  }
  if (msg.type === 'captureTab') {
    captureTab(msg.tabId, sendResponse);
    return true;
  }
  if (msg.type === 'closeTabs') {
    var ids = msg.ids || [];
    browser.tabs.remove(ids).then(function() {
      return new Promise(function(r) { setTimeout(r, 300); }).then(function() {
        return refreshTabs(function(tabs, dups) {
          sendResponse({ ok: true, tabs: tabs, dups: dups });
        });
      });
    }).catch(function(err) {
      sendResponse({ error: err.message });
    });
    return true;
  }
  if (msg.type === 'navigate') {
    browser.tabs.update(msg.tabId, { active: true }).then(function() {
      sendResponse({ ok: true });
    }).catch(function(err) {
      sendResponse({ error: err.message });
    });
    return true;
  }
  if (msg.type === 'setGroupBy') {
    setSettings(msg.groupBy).then(function(dups) {
      sendResponse({ ok: true, dups: dups, groupBy: _groupBy });
    });
    return true;
  }
  if (msg.type === 'getGroupBy') {
    sendResponse({ groupBy: _groupBy });
    return true;
  }
});

function captureTab(tabId, callback) {
  browser.tabs.get(tabId).then(function(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('moz-extension://')) {
      callback({ error: '内部页面无法预览' });
      return;
    }
    if (tab.status !== 'complete') {
      callback({ error: '页面正在加载' });
      return;
    }
    return browser.tabs.executeScript(tabId, {
      code: "(function(){try{var c=document.createElement('canvas');c.width=Math.min(window.innerWidth,1280);c.height=Math.min(window.innerHeight,800);c.getContext('2d').drawWindow(window,0,0,c.width,c.height,'rgb(255,255,255)');return c.toDataURL('image/jpeg',0.7);}catch(e){return 'ERR:'+e.message;}})()"
    });
  }).then(function(results) {
    if (!results || results.length === 0) { callback({ error: '脚本无返回' }); return; }
    var r = results[0];
    if (typeof r === 'string' && r.indexOf('ERR:') === 0) { callback({ error: r.substring(4) }); return; }
    callback({ dataUrl: r });
  }).catch(function(err) {
    callback({ error: err.message });
  });
}

// 初始化：启动时更新徽章
getSettings().then(function() {
  refreshTabs(function() {});
});

// 标签页变化时更新徽章
browser.tabs.onCreated.addListener(function() {
  getSettings().then(function() { refreshTabs(function() {}); });
});
browser.tabs.onRemoved.addListener(function() {
  getSettings().then(function() { refreshTabs(function() {}); });
});
browser.tabs.onUpdated.addListener(function() {
  getSettings().then(function() { refreshTabs(function() {}); });
});
