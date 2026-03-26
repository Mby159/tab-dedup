# Tab Dedup 🔴

**检测并关闭重复标签页的浏览器插件**

支持 Firefox、Chrome、Edge、Brave 等所有主流浏览器。

## 功能

- 🔴 **图标徽章** — 工具栏显示重复数量，不用打开 popup 就能看到
- 🔍 **智能分组** — 三种分组模式：完整 URL、按域名、按根域名
- 🗑️ **批量关闭重复** — 一键关闭所有重复，保留第一个
- 👁️ **页面预览** — 悬停 0.5 秒显示标签页截图
- 🎯 **快速导航** — 点击跳转到任意标签页
- 📦 **折叠/展开** — 整理标签页列表
- 🌙 **深色主题** — 适配 Firefox/Chrome 原生风格

## 分组模式

| 模式 | 说明 | 示例 |
|------|------|------|
| 完整 URL | 完全相同的页面 | `github.com/user/repo` vs `github.com/user/repo` |
| 按域名 | 同一网站的所有页面 | `github.com/*` 全部算一组 |
| 按根域名 | 同一主域名的所有子页面 | `*.github.com` 全部算一组 |

## 安装

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

## 更新日志

### v4.1.0
- 🆕 添加图标徽章显示重复数量
- 🆕 添加三种智能分组模式（完整 URL / 按域名 / 按根域名）
- 改进分组逻辑，支持用户自定义

### v4.0.0
- 重构通信架构，popup 不再直接调用 tabs API
- 修复 Firefox popup 中 tabs.query() 卡死问题

## 许可证

MIT

## 反馈

有问题或建议？欢迎提 Issue 或 PR！

---

**Made with ❤️ by Leon & OpenClaw AI Assistant**
