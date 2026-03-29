// test.js - Tab Dedup 自动化测试
// 运行方式: node test.js

// ========== 辅助函数（需要与 popup.js 保持一致）==========
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
  } catch (e) {
    return u;
  }
}

function esc(s) {
  if (!s) return '';
  if (typeof document === 'undefined') {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

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

// ========== 测试用例 ==========
var tests = [
  // ========== URL 规范化测试 ==========
  {
    name: 'URL 规范化 - 完整 URL（基本）',
    fn: function() {
      var result = nu('https://github.com/user/repo', 'full');
      return result === 'github.com/user/repo' ? null : '期望 github.com/user/repo，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 完整 URL（带 www）',
    fn: function() {
      var result = nu('https://www.github.com/user/repo', 'full');
      return result === 'github.com/user/repo' ? null : '期望 github.com/user/repo，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 完整 URL（末尾斜杠）',
    fn: function() {
      var result = nu('https://github.com/user/repo/', 'full');
      return result === 'github.com/user/repo' ? null : '期望 github.com/user/repo，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 完整 URL（忽略非搜索参数）',
    fn: function() {
      var result = nu('https://github.com/user/repo?tab=stars', 'full');
      return result === 'github.com/user/repo' ? null : '期望 github.com/user/repo，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 搜索页面（保留关键词）',
    fn: function() {
      var result = nu('https://search.bilibili.com/all?keyword=加速器', 'full');
      return result === 'search.bilibili.com/all|keyword=加速器' ? null : '期望保留keyword，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 不同关键词应分开',
    fn: function() {
      var r1 = nu('https://search.bilibili.com/all?keyword=tabbit抄袭', 'full');
      var r2 = nu('https://search.bilibili.com/all?keyword=加速器', 'full');
      return r1 !== r2 ? null : '不同关键词不应归为一组';
    }
  },
  {
    name: 'URL 规范化 - 相同关键词应归为一组',
    fn: function() {
      var r1 = nu('https://search.bilibili.com/all?vt=01338428&keyword=加速器&from_source=webtop', 'full');
      var r2 = nu('https://search.bilibili.com/all?vt=06812040&keyword=加速器&spm_id_from=333.1007', 'full');
      return r1 === r2 ? null : '相同关键词不同追踪参数应归为一组，得到 ' + r1 + ' vs ' + r2;
    }
  },
  {
    name: 'URL 规范化 - 按域名',
    fn: function() {
      var result = nu('https://www.github.com/user/repo', 'domain');
      return result === 'github.com' ? null : '期望 github.com，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 按根域名',
    fn: function() {
      var result = nu('https://user.github.com/repo', 'root');
      return result === 'github.com/repo' ? null : '期望 github.com/repo，得到 ' + result;
    }
  },
  {
    name: 'URL 规范化 - 按根域名（多级子域名）',
    fn: function() {
      var result = nu('https://a.b.c.github.com/repo', 'root');
      return result === 'github.com/repo' ? null : '期望 github.com/repo，得到 ' + result;
    }
  },

  // ========== 获取域名测试 ==========
  {
    name: '获取域名 - 基本',
    fn: function() {
      var result = gd('https://github.com/user/repo');
      return result === 'github.com' ? null : '期望 github.com，得到 ' + result;
    }
  },
  {
    name: '获取域名 - 去除 www',
    fn: function() {
      var result = gd('https://www.github.com/user/repo');
      return result === 'github.com' ? null : '期望 github.com，得到 ' + result;
    }
  },
  {
    name: '获取域名 - 带端口',
    fn: function() {
      var result = gd('https://localhost:3000/user/repo');
      return result === 'localhost:3000' ? null : '期望 localhost:3000，得到 ' + result;
    }
  },

  // ========== HTML 转义测试 ==========
  {
    name: 'HTML 转义 - 基本文本',
    fn: function() {
      var result = esc('Hello World');
      return result === 'Hello World' ? null : '期望 Hello World，得到 ' + result;
    }
  },
  {
    name: 'HTML 转义 - 特殊字符',
    fn: function() {
      var result = esc('<script>alert("xss")</script>');
      return result === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;' ? null : '转义失败，得到 ' + result;
    }
  },
  {
    name: 'HTML 转义 - 空字符串',
    fn: function() {
      var result = esc('');
      return result === '' ? null : '期望空字符串，得到 ' + result;
    }
  },
  {
    name: 'HTML 转义 - null',
    fn: function() {
      var result = esc(null);
      return result === '' ? null : '期望空字符串，得到 ' + result;
    }
  },

  // ========== 分组逻辑测试 ==========
  {
    name: '分组 - 完整 URL 模式（相同）',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://github.com/user/repo' },
        { id: 2, url: 'https://github.com/user/repo' },
        { id: 3, url: 'https://github.com/user/repo' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 1 && result[0].length === 3 ? null : '期望 1 组 3 个，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '分组 - 完整 URL 模式（不同）',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://github.com/user/repo1' },
        { id: 2, url: 'https://github.com/user/repo2' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 0 ? null : '期望 0 组，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '分组 - 按域名模式',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://github.com/user/repo1' },
        { id: 2, url: 'https://github.com/user/repo2' },
        { id: 3, url: 'https://github.com/org/project' }
      ];
      var result = calcDups(tabs, 'domain');
      return result.length === 1 && result[0].length === 3 ? null : '期望 1 组 3 个，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '分组 - 排除内部页面',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://github.com/user/repo' },
        { id: 2, url: 'chrome://settings' },
        { id: 3, url: 'about:newtab' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 0 ? null : '期望 0 组，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '分组 - B站不同搜索不重复',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://search.bilibili.com/all?vt=01338428&keyword=tabbit抄袭&from_source=webtop' },
        { id: 2, url: 'https://search.bilibili.com/all?vt=06812040&keyword=加速器&from_source=webtop' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 0 ? null : 'B站不同搜索不应重复，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '分组 - B站相同搜索算重复',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://search.bilibili.com/all?vt=01338428&keyword=加速器&from_source=webtop' },
        { id: 2, url: 'https://search.bilibili.com/all?vt=06812040&keyword=加速器&spm_id_from=333.1007' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 1 && result[0].length === 2 ? null : '相同搜索应重复，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '分组 - 混合情况',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://github.com/user/repo' },
        { id: 2, url: 'https://github.com/user/repo' },
        { id: 3, url: 'https://google.com/search' },
        { id: 4, url: 'https://google.com/search' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 2 ? null : '期望 2 组，得到 ' + result.length + ' 组';
    }
  },

  // ========== 边界情况测试 ==========
  {
    name: '边界 - 无效 URL',
    fn: function() {
      var result = nu('not-a-valid-url', 'full');
      return result === 'not-a-valid-url' ? null : '期望原样返回，得到 ' + result;
    }
  },
  {
    name: '边界 - 空数组',
    fn: function() {
      var result = calcDups([], 'full');
      return result.length === 0 ? null : '期望 0 组，得到 ' + result.length + ' 组';
    }
  },
  {
    name: '边界 - 只有重复',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://example.com/page1' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 1 && result[0].length === 2 ? null : '期望 1 组 2 个';
    }
  },
  {
    name: '边界 - 只有唯一',
    fn: function() {
      var tabs = [
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://example.com/page2' },
        { id: 3, url: 'https://example.com/page3' }
      ];
      var result = calcDups(tabs, 'full');
      return result.length === 0 ? null : '期望 0 组，得到 ' + result.length + ' 组';
    }
  }
];

// ========== 运行测试 ==========
console.log('🧪 Tab Dedup 测试开始\n');

var passed = 0;
var failed = 0;

tests.forEach(function(test, i) {
  try {
    var err = test.fn();
    if (err) {
      console.log('❌ [' + (i + 1) + '] ' + test.name);
      console.log('   错误: ' + err);
      failed++;
    } else {
      console.log('✅ [' + (i + 1) + '] ' + test.name);
      passed++;
    }
  } catch (e) {
    console.log('❌ [' + (i + 1) + '] ' + test.name);
    console.log('   异常: ' + e.message);
    failed++;
  }
});

// 摘要
console.log('\n' + '='.repeat(50));
console.log('总计: ' + tests.length + ' | ✅ 通过: ' + passed + ' | ❌ 失败: ' + failed);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('🎉 所有测试通过！');
} else {
  console.log('⚠️  有 ' + failed + ' 个测试失败');
  process.exit(1);
}
