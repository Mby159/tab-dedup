// background.js - Tab Dedup v4 (Chrome Manifest V3)
// 负责：查询标签页、截图、关闭标签页

var _cachedTabs = [];

function refreshTabs(callback) {
  chrome.tabs.query({}, function(tabs) {
    _cachedTabs = tabs;
    if (callback) callback(tabs);
  });
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'refresh') {
    refreshTabs(function(tabs) {
      sendResponse({ tabs: tabs });
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
      refreshTabs(function(tabs) {
        sendResponse({ ok: true, tabs: tabs });
      });
    });
    return true;
  }
  if (msg.type === 'navigate') {
    chrome.tabs.update(msg.tabId, { active: true }, function() {
      sendResponse({ ok: true });
    });
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

// 工具栏按钮
chrome.action.onClicked.addListener(function() {
  refreshTabs(function(tabs) {
    var g = {};
    tabs.forEach(function(t) {
      if (!t.url || t.url.startsWith('chrome://') || t.url.startsWith('about:')) return;
      try {
        var u = new URL(t.url);
        var k = (u.hostname.replace(/^www\./,'') + u.pathname.replace(/\/$/,'')).toLowerCase();
        if (!g[k]) g[k] = [];
        g[k].push(t);
      } catch(e) {}
    });
    var dups = Object.values(g).filter(function(x) { return x.length > 1; });
    if (dups.length === 0) {
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-48.svg', title: 'Tab Dedup', message: '✅ 没有重复！' });
    } else {
      var total = dups.reduce(function(s, x) { return s + x.length; }, 0);
      chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-48.svg', title: '🔴 发现 ' + dups.length + ' 组重复', message: '共 ' + total + ' 个标签页。' });
    }
  });
});
