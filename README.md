# Tab Dedup 🔴

**检测并关闭重复标签页的浏览器插件**

支持 Firefox、Chrome、Edge、Brave 等所有主流浏览器。

## 功能

- 🔍 **自动检测重复标签页** — 按规范化 URL 分组
- 🗑️ **批量关闭重复** — 一键关闭所有重复，保留第一个
- 👁️ **页面预览** — 悬停显示标签页截图
- 🎯 **快速导航** — 点击跳转到任意标签页
- 📦 **折叠/展开** — 整理标签页列表
- 🌙 **深色主题** — 适配 Firefox/Chrome 原生风格

## 快速开始

### Firefox
1. 克隆或下载本仓库
2. 打开 `about:debugging`
3. 点击 **"加载临时插件"** → 选择 `firefox/manifest.json`

### Chrome / Edge / Brave
1. 克隆或下载本仓库
2. 打开 `chrome://extensions`
3. 启用 **"开发者模式"**（右上角）
4. 点击 **"加载已解压的扩展程序"** → 选择 `chrome/` 文件夹

## 文件结构

```
tab-dedup-multi/
├── firefox/              # Firefox Manifest V2
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   └── icons/
├── chrome/               # Chrome Manifest V3
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   ├── popup.js
│   └── icons/
└── README.md
```

## 技术细节

- **Firefox**: Manifest V2，使用 `browser.tabs.query()` 和 `drawWindow()` 截图
- **Chrome**: Manifest V3，使用 `chrome.tabs.query()` 和 `chrome.tabs.captureVisibleTab()` 截图
- **UI**: 纯 CSS + Vanilla JS，无外部依赖
- **权限**: `tabs`、`notifications`、`activeTab`、`<all_urls>`（用于截图）

## 功能演示

### 检测重复
插件会自动按规范化 URL 分组标签页，显示重复数量。

### 快速操作
- **关闭全部重复** — 一键关闭所有重复，保留每组的第一个
- **关闭单组重复** — 关闭特定组的重复
- **关闭单个标签页** — 点击标签页右侧的 ✕ 按钮
- **跳转标签页** — 点击标签页快速切换

### 页面预览
悬停在标签页上 0.5 秒，会显示该页面的截图预览。

## 许可证

MIT

## 反馈

有问题或建议？欢迎提 Issue 或 PR！

---

**Made with ❤️ by Leon**
