# LifeOS

本地优先的个人生活管理桌面应用(macOS):任务与习惯、财务、健康、笔记与日记,共用一份本地 SQLite 数据。

## 技术栈

Tauri 2 · React 19 + TypeScript + Vite · Tailwind CSS 4 · TanStack Query · SQLite(tauri-plugin-sql)

## 开发

```sh
npm install
npm run tauri dev
```

需要 Rust 工具链(rustup)和 Xcode Command Line Tools。

数据库位于 `~/Library/Application Support/com.lifeos.app/lifeos.db`,迁移在 `src-tauri/migrations/`,于 `src-tauri/src/lib.rs` 注册。

## 目录

- `src/data/` — 数据访问层(所有 SQL 都在这里)
- `src/features/` — 各模块页面
- `src/components/` — 共用组件(侧边栏、卡片)
