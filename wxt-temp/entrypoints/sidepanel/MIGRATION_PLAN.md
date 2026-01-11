# Sidepanel Migration Plan / 侧边栏移植计划

This plan focuses on WXT migration with a modern, easy-to-use UI.  
该计划聚焦 WXT 迁移，并在保持逻辑不变的前提下重绘 UI。

## Goals / 目标
- Analyze existing page structure and redesign the UI (not a 1:1 copy).  
  先分析现有页面结构，再进行 UI 重绘（不是直接搬运）。
- Modern, clean visual language with strong hierarchy and clarity.  
  现代、干净的视觉风格与清晰层级。
- Fast, predictable interactions with minimal friction.  
  交互快速、可预期、低摩擦。

## Structure / 结构
1) Entry layer / 入口层  
   - `wxt-temp/entrypoints/sidepanel/` keeps only HTML + mount code.  
   - 入口仅保留 HTML 与挂载代码，避免业务堆在入口里。

2) UI layer / UI 层  
   - New UI lives in `wxt-temp/ui/sidepanel/`.  
   - 新 UI 放在 `wxt-temp/ui/sidepanel/`。
   - Organize by `components/`, `sections/`, `hooks/`, `styles/`, `utils/`.  
   - 按 `components/`、`sections/`、`hooks/`、`styles/`、`utils/` 划分。

3) Shared layer / 共享层  
   - Cross-entry utilities in `wxt-temp/shared/`.  
   - 跨入口工具集中到 `wxt-temp/shared/`。

## Migration Steps / 迁移步骤
1) UI audit / UI 审核  
   - Read current UI structure and flows (navigation, overview, editor, settings).  
   - 梳理现有页面结构与主要流程（导航、概览、编辑、设置）。  
   - Map user tasks and pain points to new layout.  
   - 归纳用户任务与痛点并映射到新布局。

2) UX redesign / 交互重绘  
   - Define new information architecture and section hierarchy.  
   - 设计新的信息架构与内容层级。  
   - Establish modern visual system (spacing, typography, card layout, buttons).  
   - 建立现代化视觉系统（间距、字体、卡片、按钮）。

3) New UI skeleton / 新 UI 骨架  
   - Create `ui/sidepanel` with new sections and empty states.  
   - 创建新 UI 结构与空态占位。  
   - Entry `main` only mounts the new UI.  
   - 入口只负责挂载新 UI。

4) Wire existing logic / 接入现有逻辑  
   - Connect to existing data sources and messaging.  
   - 接入现有数据与消息逻辑。  
   - Keep business logic stable; UI is the variable.  
   - 业务逻辑保持稳定，UI 为可变层。

5) Tailwind alignment / Tailwind 对齐  
   - Update `tailwind.config.cjs` to scan `ui/sidepanel/**`.  
   - 增加 `ui/sidepanel/**` 扫描路径。  
   - Consolidate base styles in `ui/sidepanel/styles/`.  
   - 基础样式统一放 `ui/sidepanel/styles/`。

6) i18n migration / i18n 迁移  
   - Move translation sources to `public/_locales/*/messages.json`.  
   - 所有翻译内容统一放入 `public/_locales`。  
   - Define a stable key format for UI (e.g. `overview.pageSummary` -> `overview_pageSummary`).  
   - 统一键名格式（例如 `overview.pageSummary` -> `overview_pageSummary`）。  
   - Update i18n helper to read from `chrome.i18n.getMessage` (or fetch `/_locales`).  
   - i18n 工具函数改为读取 `chrome.i18n`（或 fetch `/_locales`）。

7) Validation / 验证  
   - Check main flows, empty states, errors, and i18n coverage.  
   - 验证主要流程、空态、错误态与多语言覆盖。

## UI Draft / UI 结构草案
- Header: brand + page context + quick actions.  
  顶部：品牌 + 页面上下文 + 快捷操作。  
- Tabs: Elements / Flows / Overview.  
  主导航：Elements / Flows / Overview。  
- Elements: Create + Hidden rules split into tabs; create includes filters and list.  
  Elements：Create 与 Hidden rules 分 tab；Create 内包含筛选与列表。  
- Flows: list + create/edit/run actions.  
  Flows：列表 + 创建/编辑/运行操作。  
- Overview: summary cards only (Elements / Flows / Hidden counts).  
  Overview：仅显示统计卡片（Elements / Flows / Hidden 数量），不显示分组列表。  
- Settings: gear icon opens a popover panel (data, language, share).  
  Settings：右上角齿轮打开弹出面板（数据管理、语言、分享）。  

## Icon Plan (lucide-react) / 图标清单（lucide-react）
- Global/Nav: `LayoutDashboard`, `Layers`, `Workflow`, `Settings`, `PanelRightOpen` (optional).  
  全局/导航：`LayoutDashboard`, `Layers`, `Workflow`, `Settings`, `PanelRightOpen`（可选）。
- Common actions: `Plus`, `Search`, `Filter`, `RefreshCw`, `X`, `Check`, `CheckCircle2`.  
  通用操作：`Plus`, `Search`, `Filter`, `RefreshCw`, `X`, `Check`, `CheckCircle2`。
- Elements: `MousePointer2`, `Crosshair`, `Pencil`, `Trash2`, `ExternalLink`, `Eye`, `EyeOff`.  
  Elements：`MousePointer2`, `Crosshair`, `Pencil`, `Trash2`, `ExternalLink`, `Eye`, `EyeOff`。
- Edit mode/Status: `Wand2`, `Scan` (optional), `AlertTriangle`.  
  编辑/状态：`Wand2`, `Scan`（可选）, `AlertTriangle`。
- Flows: `Play`, `Pause`, `Square`, `ListChecks`, `Timer`, `CheckCircle`.  
  Flows：`Play`, `Pause`, `Square`, `ListChecks`, `Timer`, `CheckCircle`。
- Settings/Share: `Download`, `Upload`, `Languages`, `Share2`, `Copy`, `Globe`.  
  设置/分享：`Download`, `Upload`, `Languages`, `Share2`, `Copy`, `Globe`。
- Disclosure: `ChevronDown`, `ChevronRight`, `ChevronLeft`.  
  折叠/导航：`ChevronDown`, `ChevronRight`, `ChevronLeft`。

## Modern UI Direction / 现代 UI 方向
- Typography: clear headers, compact body, consistent scale.  
- 排版：标题清晰、正文紧凑、统一字号比例。  
- Color: neutral base with a single action accent.  
- 色彩：中性色为主，关键操作统一强调色。  
- Layout: card-based sections, strong spacing rhythm.  
- 布局：卡片化分区，节奏感明确。  
- Feedback: explicit loading/empty/confirm states.  
- 反馈：明确的加载/空态/确认反馈。

## UX Principles / 体验原则
- Primary actions always visible. / 主要操作始终可见。  
- Short forms, sensible defaults. / 表单短、默认值合理。  
- Progressive disclosure for advanced settings. / 高级设置渐进展开。

## Deliverables / 交付物
- New sidepanel UI structure in `ui/sidepanel/`.  
- WXT sidepanel entry that mounts the new UI.  
- Updated Tailwind scan paths.  
- All translations managed in `public/_locales`.

## Risks / 风险
- Some shared modules may need path aliasing or relocation.  
- 某些共享模块可能需要 alias 或迁移到 `shared/`。

## Current Implementation Notes (wxt-temp)
- Tailwind v4 pipeline: `@import "tailwindcss";` in `ui/sidepanel/styles/index.css`, theme tokens in `ui/sidepanel/styles/theme.css` via `@theme inline`.
- Settings popover + drawers use an overlay and lock body scroll while open (no background scroll).
- Tabs show tooltips (via `title`), and Flows/Hidden top actions are direct buttons (no dropdown).
- Overview: summary cards + site list; each site entry links to the site URL; grouping is by site totals.
- Elements: grouped by page, page row has link, search + type filter; cards show type badge + detail line + timestamp.
- Flows/Hidden/Elements drawers now expose editable fields (simple form inputs) with Save/Cancel for mock data.
