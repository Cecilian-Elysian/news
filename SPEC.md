# 新闻爬取器 - 新闻 RSS 爬取与导出工具

## 项目概述

基于 ScriptCat 的新闻爬取用户脚本，爬取多个新闻网站的 RSS 订阅源，支持导出为 Markdown 格式。

## 功能特性

- RSS 订阅源解析（支持 XML 和 JSON 格式）
- 新闻数据本地存储
- Markdown 格式导出
- 轻量级浅色浮窗展示
- 脚本猫菜单快速入口
- 用户可配置新闻源

## 文件结构

```
news/
├── news-crawler.user.js    # 主脚本文件
├── SPEC.md                 # 项目规格文档
└── README.md               # 使用说明
```

## 开发日志

### Commit History

- [ ] Commit 1: 项目初始化 - 基础脚本框架创建
- [ ] Commit 2: RSS 获取与解析
- [ ] Commit 3: 数据存储
- [ ] Commit 4: Markdown 导出
- [ ] Commit 5: 浮窗 UI
- [ ] Commit 6: 菜单入口
- [ ] Commit 7: 用户配置
- [ ] Commit 8: README 文档

## 使用前提

- 安装 [ScriptCat](https://docs.scriptcat.org/) 浏览器扩展
- 启用脚本猫的脚本引擎

## 安装使用

1. 复制 `news-crawler.user.js` 内容到脚本猫编辑器
2. 保存并启用脚本
3. 点击浏览器工具栏的脚本猫图标使用

## 技术实现

- 跨域请求: `GM_xmlhttpRequest`
- 数据存储: `GM_setValue` / `GM_getValue`
- 文件导出: `GM_download`
- UI 构建: `GM_addElement` / `GM_addStyle`

## License

MIT
