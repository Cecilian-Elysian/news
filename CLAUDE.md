# AI Agent 约束文件

## 项目概述

新闻爬取器是一个浏览器扩展脚本（Userscript），用于一键抓取多个新闻源的 RSS/JSON Feed，自动生成 Markdown 格式的日报并导出。

## Git Hooks 约束

### pre-commit Hook
- 自动递增 `news-crawler.user.js` 的版本号（`// @version`）
- 递增规则：PATCH 版本号 +1（major.minor.patch）
- 自动 `git add news-crawler.user.js`

### post-commit Hook
- 每次提交后自动执行 `git push` 推送到远程

## 提交规范

- 提交信息使用中文
- 格式：`type: 简短描述`
- type 类型：`feat`/`fix`/`docs`/`chore`/`refactor`
- 每行不超过 100 字符

## 分支管理

- `main` 为稳定分支
- 功能开发使用独立分支
- 合并前确保测试通过

## 代码规范

- JavaScript 使用 `'use strict'` 模式
- 变量命名使用驼峰式
- 常量使用全大写 + 下划线
- 函数需有清晰命名，参数需注释
- 禁止硬编码配置值

## 文件结构

```
news/
├── news-crawler.user.js  # 主脚本
├── .githooks/            # Git hooks
│   ├── pre-commit       # 自动版本号
│   └── post-commit      # 自动推送
├── .vscode/             # VS Code 配置
├── skills/              # 技能文档
└── README.md            # 项目说明
```

## 版本号规范

- 遵循语义化版本（Semantic Versioning）
- 格式：major.minor.patch
- 初始版本：2.2.0

## 发布流程

1. 在 `main` 分支开发
2. 提交后自动推送（由 post-commit Hook 处理）
3. 创建 GitHub Release 打标签

## 注意事项

- 脚本使用 GM_* API，无需外部依赖
- 部分新闻源需要网络代理
- 确保 @connect 和 @grant 配置正确
