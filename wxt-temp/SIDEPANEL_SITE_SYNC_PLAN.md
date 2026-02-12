# Sidepanel Site Data Refresh Plan

## 中文
- 监听当前激活标签页的 URL 变化（含 SPA 路由切换），计算 `siteKey` / `pageKey`。
- Sidepanel 根据 `siteKey` 拉取 elements / flows / hidden 并刷新列表。
- 内容页新增/更新/删除后，通过消息推送或轻量轮询同步到 sidepanel。
- 没有有效页面或无权限时显示空态，并禁用创建/注入入口。
- 可选提供“手动刷新”入口，避免缓存过期。

## English
- Watch active tab URL changes (including SPA navigation) and derive `siteKey` / `pageKey`.
- Sidepanel fetches elements / flows / hidden by `siteKey` and refreshes lists.
- When content data changes, push updates or use a light poll to keep sidepanel in sync.
- If no valid page or permission, show empty state and disable create/inject actions.
- Optional manual refresh action to avoid stale data.

# Element Injection Plan (Element Page)

## 中文
- 定义 WXT temp 的注入消息契约（create/update/delete/preview/focus/rehydrate），由 sidepanel 发起、background 转发、content 执行。
- Element 页新增动作（Area/Button/Link/Tooltip）完成 picker 后，发送创建请求并在页面内立即注入预览。
- Content 侧实现注入层：维护元素注册表，创建 Shadow DOM host，按 `selector/position/floating/containerId` 插入。
- 类型支持：button/link/tooltip/area 的节点结构与基础样式，button/link 的点击行为与 tooltip 的 hover 展示。
- 失败处理：selector 无法解析/目标不存在时返回错误并提示；不写入持久化。
- 数据回写：注入成功后回传 element 元数据（含 frame/site/page），sidepanel 更新列表与详情。
- 编辑态：新建元素默认进入编辑态（可视轮廓），退出后恢复正常交互；后续再补拖拽/缩放。

## English
- Define WXT temp injection message contract (create/update/delete/preview/focus/rehydrate) with sidepanel -> background -> content flow.
- After picker completes for Area/Button/Link/Tooltip, send a create request and inject a preview immediately on the page.
- Implement a content-side injection layer: registry + Shadow DOM host + DOM insertion by `selector/position/floating/containerId`.
- Support node structures + base styles for button/link/tooltip/area; wire button/link click behavior and tooltip hover.
- Failure handling: if selector is invalid or target not found, return an error and skip persistence.
- Data round-trip: on success, return element metadata (frame/site/page) so the sidepanel list/details refresh.
- Editing state: new elements enter editing mode with a visual outline; later extend with drag/resize.

# Data Structure Update (Elements)

## 中文
- 样式结构统一为 `style.preset / style.inline / style.customCss`，避免 `stylePreset/customCss/style` 三套来源冲突。
- UI 控件只更新 `style.inline`，并同步格式化后的 `style.customCss`。
- 自定义样式文本框输入时解析为对象，覆盖 `style.inline` 并保存原始文本到 `style.customCss`。
- 注入层只消费 `style.inline`（如需覆盖顺序，再合并 `customCss` 解析结果）。

## English
- Normalize styles to `style.preset / style.inline / style.customCss` to avoid multiple sources of truth.
- UI controls update `style.inline` and keep `style.customCss` in sync (formatted).
- Custom styles textarea parses into `style.inline` and stores raw text in `style.customCss`.
- Injection layer should read `style.inline` (optionally merge parsed `customCss` for overrides).

# Sample Data (example.com)
```json
{
  "sites": {
    "example.com": {
      "elements": [
        {
          "id": "element-001",
          "text": "Get Started",
          "scope": "page",
          "context": {
            "siteKey": "example.com",
            "pageKey": "example.com/",
            "frame": null
          },
          "placement": {
            "mode": "dom",
            "selector": "main .hero",
            "position": "append",
            "relativeTo": {
              "before": ".hero-title",
              "after": ".hero-actions"
            }
          },
          "style": {
            "preset": "button-default",
            "inline": {
              "backgroundColor": "#1b84ff",
              "color": "#ffffff",
              "borderRadius": "8px",
              "padding": "8px 16px",
              "fontSize": "12px",
              "fontWeight": "600"
            },
            "customCss": ""
          },
          "behavior": {
            "type": "button",
            "href": "https://example.com/signup",
            "actionSelector": "#signup",
            "actionFlowId": "flow-signup"
          },
          "createdAt": 1700000000000,
          "updatedAt": 1700000002000
        }
      ],
      "flows": [
        {
          "id": "flow-001",
          "name": "Signup CTA",
          "description": "Click primary CTA and wait for form.",
          "scope": "site",
          "siteKey": "example.com",
          "pageKey": null,
          "steps": [
            { "type": "click", "selector": ".cta-primary" },
            { "type": "wait", "selector": "form#signup", "timeoutMs": 5000 }
          ],
          "updatedAt": 1700000003000
        }
      ],
      "hidden": [
        {
          "id": "hidden-001",
          "name": "Hide promo banner",
          "scope": "site",
          "siteKey": "example.com",
          "pageKey": null,
          "selector": ".promo-banner",
          "enabled": true,
          "updatedAt": 1700000004000
        }
      ]
    },
    "note.com": {
      "elements": [
        {
          "id": "element-101",
          "text": "Help",
          "scope": "site",
          "context": {
            "siteKey": "note.com",
            "pageKey": null,
            "frame": null
          },
          "placement": {
            "mode": "dom",
            "selector": "header .help-link",
            "position": "append",
            "relativeTo": {}
          },
          "style": {
            "preset": "link-default",
            "inline": {
              "color": "#2563eb",
              "textDecoration": "underline"
            },
            "customCss": ""
          },
          "behavior": {
            "type": "link",
            "href": "https://note.com/help",
            "target": "new-tab"
          },
          "createdAt": 1700100000000,
          "updatedAt": 1700100002000
        }
      ],
      "flows": [],
      "hidden": []
    }
  }
}
```

# Default Styles (User-first)

## 中文
- Button：保持高对比主色，但体积适中（圆角 8–10px、12–13px 字号、轻微阴影），默认文案清晰易懂。
- Link：蓝色 + 下划线，字号略小，必要时增加轻微字重，避免与原页面链接混淆。
- Tooltip：小气泡、高对比文字，默认 `top`，边距 6–8px，避免遮挡目标。
- Area：浅色高亮（10–15% 透明度）、大圆角、边框轻描；默认可拖拽且不遮挡内容。
- 通用：默认风格应“辅助感”明显，不像广告；编辑态提供边框/手柄提示可调整。

## English
- Button: high-contrast primary color with moderate size (8–10px radius, 12–13px text, soft shadow) and clear default copy.
- Link: blue + underline, slightly smaller text; add subtle weight to avoid blending into native links.
- Tooltip: compact bubble, strong contrast, default `top` placement with 6–8px offset; avoid covering target.
- Area: soft highlight (10–15% opacity), large radius, light border; draggable and non-blocking.
- General: default look should feel assistive, not ad-like; editing state shows outline/handles.

# Picker & Dragging (Plan)

## 中文
- Picker：需要让用户明确选择插入位置（before/after/append/prepend）。可在 picker 结束后弹出定位选项，或在元素编辑里提供“插入位置”下拉。
- 相对插入：支持“选中 A 后选择 after / 选中 B 后选择 before”的交互提示，避免误解。
- 拖动编辑：Area 拖动时更新 `style.inline.left/top`。
- Button/Link 拖动：若拖入 Area，记录 `containerId` 并显示在 Area 中；若拖回页面任意位置，记录 `beforeSelector/afterSelector` 并按相对位置插入显示。

## English
- Picker: expose insert position choice (before/after/append/prepend) either right after picking or in element edit panel.
- Relative placement: clarify that users can pick A+after or B+before to insert between nodes.
- Dragging: Area drag updates `style.inline.left/top`.
- Button/Link drag: if dropped into an Area, persist `containerId` and render inside it; if dropped on the page, persist `beforeSelector/afterSelector` and insert relative to the target.
