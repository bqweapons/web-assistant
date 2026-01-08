# WXT 迁移临时结构说明

本项目先在 `wxt-temp/` 中搭建 WXT 最小框架，避免影响旧逻辑。这里记录 WXT 的入口含义和各目录用途，方便后续迁移。

## 关键概念
- `entrypoints/`：WXT 入口层，直接对应扩展运行时的入口（background/content/sidepanel 等）。入口文件只做挂载与初始化。
- `ui/`：业务 UI 层（建议结构）。真正的组件、样式和业务逻辑放这里，由 `entrypoints` 引入。
- `shared/`：跨入口复用的消息协议、类型、工具（建议结构）。

## wxt-temp 目录作用
- `wxt-temp/entrypoints/`：扩展入口目录，WXT 自动生成 manifest 对应配置。
- `wxt-temp/entrypoints/background.ts`：service worker 入口。
- `wxt-temp/entrypoints/content.ts`：content script 入口（页面注入逻辑从这里开始）。
- `wxt-temp/entrypoints/sidepanel/`：侧边栏入口页面（HTML/TS/CSS），只负责挂载 UI。
- `wxt-temp/public/`：静态资源输出到扩展根目录。
- `wxt-temp/public/_locales/`：i18n 文案（与 `default_locale` 对应）。
- `wxt-temp/public/icon/`：扩展图标（manifest `icons` 引用）。
- `wxt-temp/assets/`：构建期资源（例如 svg），不会直接作为扩展根目录文件。
- `wxt-temp/components/`：示例组件目录（可后续清理/替换）。
- `wxt-temp/wxt.config.ts`：WXT 配置与 manifest 内容。
- `wxt-temp/postcss.config.cjs` / `wxt-temp/tailwind.config.cjs`：Tailwind/PostCSS 配置。

## Theme (Tailwind v4)
- Theme tokens live in `wxt-temp/ui/sidepanel/styles/theme.css`.
- `:root` and `.dark` define the base CSS variables (e.g. `--background`, `--primary`).
- `@theme inline` maps tokens to Tailwind v4 utilities (e.g. `--color-background: var(--background)`), so `bg-background`, `text-foreground`, `border-border` work.
- `wxt-temp/ui/sidepanel/styles/index.css` must import Tailwind first, then the theme file:
  - `@import "tailwindcss";`
  - `@import "./theme.css";`
- When adding a new theme token, define it in both `:root` / `.dark` and map it in `@theme inline`, otherwise no Tailwind utility is generated.
- Overlays are not defined by default; use `bg-black/40` for scrims, or define `--overlay` + `--color-overlay` if you want a theme token.
- Avoid self-referential mappings (e.g. `--font-sans: var(--font-sans)`); use distinct base tokens if you want font/shadow utilities.
