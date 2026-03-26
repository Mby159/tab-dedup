// background.js - Tab Dedup v4
// 负责：查询标签页、截图、关闭标签页
// popup 通过 postMessage 通信

var _cachedTabs = [];

function refreshTabs(callback) {
  browser.tabs.query({}).then(function(tabs) {
    _cachedTabs = tabs;
    if (callback) callback(tabs);
  }).catch(function(err) {
    if (callback) callback([]);
  });
}

browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
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
    browser.tabs.remove(ids).then(function() {
      return refreshTabs(function(tabs) {
        sendResponse({ ok: true, tabs: tabs });
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

// 工具栏按钮
browser.browserAction.onClicked.addListener(function() {
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
      browser.notifications.create({ type: 'basic', iconUrl: 'icons/icon-48.svg', title: 'Tab Dedup', message: '✅ 没有重复！' });
    } else {
      var total = dups.reduce(function(s, x) { return s + x.length; }, 0);
      browser.notifications.create({ type: 'basic', iconUrl: 'icons/icon-48.svg', title: '🔴 发现 ' + dups.length + ' 组重复', message: '共 ' + total + ' 个标签页。' });
    }
  });
});
