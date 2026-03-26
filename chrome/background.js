// background.js - Tab Dedup v4.1 (Chrome Manifest V3)
// 负责：查询标签页、截图、关闭标签页、图标徽章

var _cachedTabs = [];
var _groupBy = 'full';

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
    chrome.action.setBadgeText({ text: text });
    chrome.action.setBadgeBackgroundColor({ color: '#ff453a' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
  return dups;
}

// 刷新标签页
function refreshTabs(callback) {
  chrome.tabs.query({}, function(tabs) {
    _cachedTabs = tabs;
    var dups = updateBadge(tabs, _groupBy);
    if (callback) callback(tabs, dups);
  });
}

// 获取/设置分组
chrome.storage.local.get(['groupBy'], function(data) {
  _groupBy = data.groupBy || 'full';
  refreshTabs(function() {});
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'refresh') {
    refreshTabs(function(tabs, dups) {
      sendResponse({ tabs: tabs, dups: dups, groupBy: _groupBy });
    });
    return true;
  }
  if (msg.type === 'captureTab') {
    captureTab(msg.tabId, sendResponse);
    return true;
  }
  if (msg.type === 'closeTabs') {
    var ids = msg.ids || [];
    chrome.tabs.remove(ids, function() {
      setTimeout(function() {
        refreshTabs(function(tabs, dups) {
          sendResponse({ ok: true, tabs: tabs, dups: dups });
        });
      }, 300);
    });
    return true;
  }
  if (msg.type === 'navigate') {
    chrome.tabs.update(msg.tabId, { active: true }, function() {
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'setGroupBy') {
    _groupBy = msg.groupBy;
    chrome.storage.local.set({ groupBy: _groupBy }, function() {
      var dups = updateBadge(_cachedTabs, _groupBy);
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
  chrome.tabs.get(tabId, function(tab) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      callback({ error: '内部页面无法预览' });
      return;
    }
    if (tab.status !== 'complete') {
      callback({ error: '页面正在加载' });
      return;
    }
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 }, function(dataUrl) {
      if (chrome.runtime.lastError) {
        callback({ error: chrome.runtime.lastError.message });
      } else {
        callback({ dataUrl: dataUrl });
      }
    });
  });
}

// 标签页变化时更新徽章
chrome.tabs.onCreated.addListener(function() {
  refreshTabs(function() {});
});
chrome.tabs.onRemoved.addListener(function() {
  refreshTabs(function() {});
});
chrome.tabs.onUpdated.addListener(function() {
  refreshTabs(function() {});
});
