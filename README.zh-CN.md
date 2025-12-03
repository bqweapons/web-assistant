# Ladybird（懒鸟）
[English](README.md) / [日本語](README.ja.md) / [简体中文](README.zh-CN.md)

---

### 概述
Ladybird（懒鸟） 是一款基于 Manifest V3 的 Chrome 扩展，可以在任意网页上叠加自定义按钮、链接、提示气泡和富文本标注。你可以在侧边栏（Manage / Overview / Settings）中集中管理这些元素。每个注入元素都会按页面 URL 存储在 `chrome.storage.local` 中，当你再次访问同一站点时会自动恢复。

## 演示视频
[![Demo Video](https://img.youtube.com/vi/-iTlNX4J8FM/maxresdefault.jpg)](https://youtu.be/-iTlNX4J8FM)

### 功能亮点
- **统一侧边栏**：在不离开 Chrome 的前提下，在同一个侧边栏中切换每页的 Manage 视图、跨站点 Overview 视图，以及 Settings（导入 / 导出、语言切换）。
- **支持 iframe 的可视化拾取器**：在当前页面（包括同源 iframe）中高亮 DOM 节点，自动生成 CSS 选择器，并直接跳转到编辑气泡。
- **丰富的元素类型**：支持按钮、链接、提示气泡和区域标注，可配置 `append` / `prepend` / `before` / `after` 插入位置、可选的镜像点击选择器，以及细粒度样式。
- **动作流程构建器**：将 `click` / `wait` / `input` / `navigate` / `log` / `if` / `while` 等步骤串联起来，在按钮回退到链接或选择器之前先执行自动化流程。
- **拖拽友好的区域元素**：可以把区域元素像面板一样拖拽到页面任意位置，位置会自动保存；其他注入元素也可以放到区域内部作为子项。
- **Shadow DOM 隔离**：控件渲染在 Shadow DOM 中，即使宿主页面的 CSS 很重，也能保持外观一致。
- **可靠的同步与持久化**：数据存储在 `chrome.storage.local` 中并在加载时恢复；`MutationObserver` 监听 DOM 变化并重新挂载宿主，同时在所有相关标签页和侧边栏之间广播更新。

### 1.0.2 更新
- 动作流程：支持拖动步骤序号调整顺序；将“新增步骤”移到列表上方并增加提示，避免长列表时下拉菜单溢出。
- UI 优化：步骤类型以标签形式展示在序号旁，减少误触更改，同时保留现有构建器布局。

### Chrome Webstore
Chrome 应用商店: https://chromewebstore.google.com/detail/ladybird-no-code-buttons/nefpepdpcjejamkgpndlfehkffkfgbpe



### 使用方法
1. 点击 Ladybird（懒鸟） 图标，在当前标签页中打开侧边栏。
2. 在 **Manage** 中点击 **Pick target**，选择需要增强的元素（支持同源 iframe）。
3. 在编辑气泡中选择类型（按钮 / 链接 / 提示 / 区域），调整文本、位置和样式，并可以选择性地配置 URL、镜像点击选择器或动作流程。区域元素可以直接在页面上拖拽微调位置，也可以作为容器承载其它注入元素。
4. 使用 Manage 中的过滤和搜索功能查找元素，并进行聚焦、重新编辑或按页面删除。
5. 切换到 **Overview** 查看所有已保存的条目，可以在新标签页中打开页面或按 URL 批量清理。
6. 在 **Settings** 中导入 / 导出 JSON 备份，并切换界面语言。

### 动作流程（可选）
按钮在回退到链接或镜像选择器之前，可以先执行一段脚本化的动作流程。流程使用包含 `steps` 数组的 JSON 定义，保存时会自动校验：解析失败的 JSON、无效的选择器或不支持的步骤类型都会被拒绝。

支持的步骤类型包括:
- `click`：点击单个元素，或在设置 `all: true` 时点击所有匹配元素。
- `wait`：等待指定的毫秒数（每个步骤都有安全上限）。
- `input`：向输入框、textarea 或 contenteditable 元素写入文本，并触发 `input` / `change` 事件。
- `navigate`：在 `_blank` 或指定 target 中打开经过安全过滤的 URL。
- `log`：向页面控制台输出调试信息。
- `if`：对条件求值一次，执行 `thenSteps` 或 `elseSteps`。
- `while`：在条件为真时重复执行 `bodySteps`（循环次数有上限）。

条件由 `exists`、`not`、`textContains`、`attributeEquals` 组合而成。流程仅在当前活动 frame（包括同源 iframe）中执行，总步骤数上限为 200，循环次数上限为 50，整体运行时间约 10 秒；超过限制的流程会被安全地中止。如果需要在流程中引用按钮自身，请使用特殊选择器 `:self`。

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

例如，上面的流程会点击登录按钮，填写一次性验证码，然后继续后续操作：

![Login button action flow sample](docs/button%20sample.gif)

更多步骤字段说明、条件表达式示例和运行时限制，请参见仓库根目录下的 `AGENTS.md`。

### 所需权限
- `tabs`：读取当前活动标签页、从侧边栏打开或切换标签页，并保持 UI 同步。
- `storage`：在单一存储键下持久化每个页面的增强元素元数据。
- `sidePanel`：在 Chrome 侧边栏中展示基于 React 的管理界面（若 API 不可用则退回到标签页界面）。
- `webNavigation`：枚举同源 iframe，使拾取器和重新挂载逻辑可以访问嵌套文档。
- `host_permissions`（`<all_urls>`）：允许用户在任意站点上注入元素。

### 运行时架构概览
- **消息层（`common/messaging.js`）**：包装 `chrome.runtime.sendMessage` 和端口连接，让所有上下文都通过 `{ ok, data | error }` 结构交换数据。所有异步处理都被标准化为 Promise，方便侧边栏、后台 Service Worker 与内容脚本复用同一套请求模式。
- **持久化存储（`common/storage.js`）**：将所有注入元素的元数据集中保存在一个 `injectedElements` 键下。更新辅助方法会复制包含样式和 frame 信息的负载，`observePage` 则按 URL 扩散 `chrome.storage.onChanged` 事件。
- **URL 规范化（`common/url.js`）**：去掉查询参数和哈希片段以生成稳定的页面键，在 URL 构造函数不可用时回退到手动裁剪。
- **流程解析（`common/flows.js`）**：验证动作流 JSON、规范化简写字段、强制执行步骤数 / 循环次数 / 等待时间等上限，并向编辑器和 Service Worker 返回可读的错误信息。
- **注入注册表（`content/injection/core/registry.js`）**：同时跟踪元素描述和实际宿主节点，优先复用已有宿主，在位置元数据变化时重建宿主，并通过 `data-*` 属性切换编辑状态。
- **宿主与 Shadow DOM（`content/injection/host/create-host.js`）**：创建包裹元素和 Shadow DOM 结构，为按钮 / 链接 / 提示气泡 / 区域设置基础外观，并为区域元素添加尺寸控制。
- **交互层（`content/injection/interactions/*`）**：负责拖拽、放置和尺寸调整，将草稿更新回写到自动保存层。
- **内容运行时（`content/app/*.js`）**：在各个 frame 中挂载元素、监听存储变化、协调拾取器与编辑器会话，并应用自动保存的移动 / 调整结果。

### 隐私与商店页面
- `docs/PRIVACY-POLICY.md`：可以单独托管并在 Chrome 网上应用店的 “Privacy policy URL” 字段中引用的隐私政策正文。

### 已知限制
- 严格的 CSP 可能会阻止脚本或样式注入。
- 目前只支持增强同源 iframe。
- 对于高度动态的页面，注入元素可能会被临时覆盖，但观察器会重新挂载。
- 动作流限制为最多 200 步、50 次循环，总运行时间约 10 秒；超出限制的流程会被中止。
