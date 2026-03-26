// test.js - Tab Dedup 自动化测试
// 运行方式: node test.js

console.log('🧪 Tab Dedup 测试开始\n');

// 测试用例
const tests = [
  // ========== URL 规范化测试 ==========
  {
    name: 'URL 规范化 - 完整 URL（基本）',
    fn: () => {
      const url = 'https://github.com/user/repo';
      const result = nu(url, 'full');
      const expected = 'github.com/user/repo';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'URL 规范化 - 完整 URL（带 www）',
    fn: () => {
      const url = 'https://www.github.com/user/repo';
      const result = nu(url, 'full');
      const expected = 'github.com/user/repo';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'URL 规范化 - 完整 URL（末尾斜杠）',
    fn: () => {
      const url = 'https://github.com/user/repo/';
      const result = nu(url, 'full');
      const expected = 'github.com/user/repo';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'URL 规范化 - 完整 URL（带查询参数）',
    fn: () => {
      const url = 'https://github.com/user/repo?tab=stars';
      const result = nu(url, 'full');
      const expected = 'github.com/user/repo';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'URL 规范化 - 按域名',
    fn: () => {
      const url = 'https://www.github.com/user/repo';
      const result = nu(url, 'domain');
      const expected = 'github.com';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'URL 规范化 - 按根域名',
    fn: () => {
      const url = 'https://user.github.com/repo';
      const result = nu(url, 'root');
      const expected = 'github.com/repo';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'URL 规范化 - 按根域名（多级子域名）',
    fn: () => {
      const url = 'https://a.b.c.github.com/repo';
      const result = nu(url, 'root');
      const expected = 'github.com/repo';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },

  // ========== 获取域名测试 ==========
  {
    name: '获取域名 - 基本',
    fn: () => {
      const url = 'https://github.com/user/repo';
      const result = gd(url);
      const expected = 'github.com';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: '获取域名 - 去除 www',
    fn: () => {
      const url = 'https://www.github.com/user/repo';
      const result = gd(url);
      const expected = 'github.com';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: '获取域名 - 带端口',
    fn: () => {
      const url = 'https://localhost:3000/user/repo';
      const result = gd(url);
      const expected = 'localhost:3000';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },

  // ========== HTML 转义测试 ==========
  {
    name: 'HTML 转义 - 基本文本',
    fn: () => {
      const result = esc('Hello World');
      const expected = 'Hello World';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'HTML 转义 - 特殊字符',
    fn: () => {
      const result = esc('<script>alert("xss")</script>');
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      return result === expected ? null : `期望 ${expected}，得到 ${result}`;
    }
  },
  {
    name: 'HTML 转义 - 空字符串',
    fn: () => {
      const result = esc('');
      return result === '' ? null : `期望空字符串，得到 ${result}`;
    }
  },
  {
    name: 'HTML 转义 - null',
    fn: () => {
      const result = esc(null);
      return result === '' ? null : `期望空字符串，得到 ${result}`;
    }
  },

  // ========== 分组逻辑测试 ==========
  {
    name: '分组 - 完整 URL 模式（相同）',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user/repo' },
        { id: 2, url: 'https://github.com/user/repo' },
        { id: 3, url: 'https://github.com/user/repo' }
      ];
      const result = calcDups(tabs, 'full');
      return result.length === 1 && result[0].length === 3 ? null : `期望 1 组 3 个，得到 ${result.length} 组`;
    }
  },
  {
    name: '分组 - 完整 URL 模式（不同）',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user/repo1' },
        { id: 2, url: 'https://github.com/user/repo2' }
      ];
      const result = calcDups(tabs, 'full');
      return result.length === 0 ? null : `期望 0 组，得到 ${result.length} 组`;
    }
  },
  {
    name: '分组 - 按域名模式',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user/repo1' },
        { id: 2, url: 'https://github.com/user/repo2' },
        { id: 3, url: 'https://github.com/org/project' }
      ];
      const result = calcDups(tabs, 'domain');
      return result.length === 1 && result[0].length === 3 ? null : `期望 1 组 3 个，得到 ${result.length} 组`;
    }
  },
  {
    name: '分组 - 排除内部页面',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user/repo' },
        { id: 2, url: 'chrome://settings' },
        { id: 3, url: 'about:newtab' }
      ];
      const result = calcDups(tabs, 'full');
      return result.length === 0 ? null : `期望 0 组，得到 ${result.length} 组`;
    }
  },
  {
    name: '分组 - 混合情况',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://github.com/user/repo' },
        { id: 2, url: 'https://github.com/user/repo' },
        { id: 3, url: 'https://google.com/search' },
        { id: 4, url: 'https://google.com/search' }
      ];
      const result = calcDups(tabs, 'full');
      return result.length === 2 ? null : `期望 2 组，得到 ${result.length} 组`;
    }
  },

  // ========== 边界情况测试 ==========
  {
    name: '边界 - 无效 URL',
    fn: () => {
      const url = 'not-a-valid-url';
      const result = nu(url, 'full');
      return result === 'not-a-valid-url' ? null : `期望原样返回，得到 ${result}`;
    }
  },
  {
    name: '边界 - 空数组',
    fn: () => {
      const tabs = [];
      const result = calcDups(tabs, 'full');
      return result.length === 0 ? null : `期望 0 组，得到 ${result.length} 组`;
    }
  },
  {
    name: '边界 - 只有重复',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://example.com/page1' }
      ];
      const result = calcDups(tabs, 'full');
      return result.length === 1 && result[0].length === 2 ? null : `期望 1 组 2 个`;
    }
  },
  {
    name: '边界 - 只有唯一',
    fn: () => {
      const tabs = [
        { id: 1, url: 'https://example.com/page1' },
        { id: 2, url: 'https://example.com/page2' },
        { id: 3, url: 'https://example.com/page3' }
      ];
      const result = calcDups(tabs, 'full');
      return result.length === 0 ? null : `期望 0 组，得到 ${result.length} 组`;
    }
  }
];

// 运行测试
let passed = 0;
let failed = 0;

tests.forEach((test, i) => {
  try {
    const err = test.fn();
    if (err) {
      console.log(`❌ [${i + 1}] ${test.name}`);
      console.log(`   错误: ${err}`);
      failed++;
    } else {
      console.log(`✅ [${i + 1}] ${test.name}`);
      passed++;
    }
  } catch (e) {
    console.log(`❌ [${i + 1}] ${test.name}`);
    console.log(`   异常: ${e.message}`);
    failed++;
  }
});

// 摘要
console.log('\n' + '='.repeat(50));
console.log(`总计: ${tests.length} | ✅ 通过: ${passed} | ❌ 失败: ${failed}`);
console.log('='.repeat(50));

if (failed === 0) {
  console.log('🎉 所有测试通过！');
} else {
  console.log(`⚠️  有 ${failed} 个测试失败`);
  process.exit(1);
}

// ========== 辅助函数（需要与 popup.js 保持一致）==========
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

function esc(s) {
  if (!s) return '';
  // Node.js 环境
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
