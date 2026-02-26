# Ladybird

[English](README.md) / [日本語](README.ja.md) / [简体中文](README.zh-CN.md)

---

## 概览

Ladybird 是一个 Manifest V3 浏览器扩展，用于在网页中添加无代码按钮、链接、工具提示、区域以及自动化流程。

当前仓库已将 **WXT 实现作为主线版本**（此前在 `wxt-temp/` 下开发）。旧的根目录实现已归档到 `legacy/v1/`。

核心能力：
- 侧边栏管理（`Elements` / `Flows` / `Hidden` / `Overview` / `Settings`）
- 动作流编辑器（`click`, `wait`, `input`, `navigate`, `log`, `if`, `while`, `popup`）
- 用于流程复用输入的密码保管库（Password Vault）
- 导入 / 导出（可选包含保管库数据）
- 多语言界面（`en`, `ja`, `zh_CN`）

## Chrome Web Store

https://chromewebstore.google.com/detail/ladybird-no-code-buttons/nefpepdpcjejamkgpndlfehkffkfgbpe


## 快速开始（WXT 主线）

请在仓库根目录执行。

### 安装依赖
```bash
npm install
```

### 开发
```bash
npm run dev
```

### 校验与构建
```bash
npm run i18n:check
npm run compile
npm run build
```

### 打包 zip（分发用）
```bash
npm run zip
```

### 在 Chrome 中加载（开发）
从以下目录加载未打包扩展：
- `.output/chrome-mv3/`

## 使用方式

1. 在当前标签页打开 Ladybird 侧边栏。
2. 在 **Elements** 中创建或编辑元素（按钮 / 链接 / 工具提示 / 区域）。
3. 在 **Flows** 中绑定自动化流程。
4. 在 **Hidden** 中隐藏网页元素。
5. 在 **Overview** 中查看并删除站点保存数据。
6. 在 **Settings** 中进行导入导出、语言切换和密码保管库查看。

### 密码保管库（Flows）
- 在流程步骤中绑定密码输入时，请使用 Password Vault UI。
- 密码字段不允许以明文形式保存在流程中。
- 运行时如果保管库处于锁定状态，Ladybird 可在网页内弹出解锁提示，并从当前步骤继续执行。
- 如果忘记保管库密码，**无法找回**，只能重置（已保存密码会被删除）。

## 动作流（概览）

当注入按钮被点击时，流程会执行，并在链接跳转或选择器回退动作之前自动操作页面。

支持的步骤类型包括：
- `click`
- `wait`
- `input`
- `navigate`
- `log`
- `if` / `while`
- `popup`

详细的步骤字段、条件、运行限制、frame 行为、保管库使用说明请参见 `AGENTS.md` 的 Action Flow Reference。

## 从旧版迁移（重要）

旧的根目录实现已迁移至：
- `legacy/v1/`

### 同一条目下的现有用户升级

由于新版继续使用 **同一个 Chrome Web Store 条目 / 扩展 ID**，浏览器本地存储仍在同一个扩展作用域内。

Ladybird 内置了兼容迁移逻辑，可在升级后将旧格式保存数据（例如 `injectedElements`）迁移到新的结构化存储。

发布前/支持时建议：
1. 使用真实旧数据进行升级验证后再发布。
2. 保留导入/导出作为手动恢复路径。
3. 如需处理 Password Vault 数据：
   - 导出时可选择是否包含保管库密码（需要输入保管库密码确认）
   - 导入时可能需要先创建/解锁保管库再恢复保管库数据

说明：
- 忘记保管库密码时，已保存的保管库密码无法恢复。
- 重置保管库会删除已保存密码；流程中的绑定 token 仍会保留，但需要重新绑定。

## 仓库结构

### WXT版本
- `entrypoints/` 后台与内容脚本入口
- `ui/` 侧边栏 UI
- `shared/` 共享协议、存储、导入导出、Secrets
- `public/_locales/` i18n 文案
- `scripts/` 开发与校验脚本

### 旧版归档
- `legacy/v1/` 旧根目录实现（仅供参考 / 维护）

### 辅助材料
- `docs/` 文档与策略内容
- `release/` 历史产物、评审记录与商店素材

## 开发与贡献说明

请查看 `AGENTS.md` 获取：
- 仓库约定
- 构建 / 发布流程
- i18n 规则
- 动作流参考

## 隐私与限制

- 除非你主动导出，数据默认存储在 `chrome.storage.local`。
- Password Vault 的秘密值仅在本地加密存储，使用时需要保管库密码解锁。
- 不支持跨域 iframe 自动化。
- 对 CSP 严格或 DOM 高频变化的网站，注入稳定性可能受影响。
