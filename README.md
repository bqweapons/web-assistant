# Page Augmentor

Page Augmentor 是一款基于 Manifest V3 的 Chrome 扩展，可在任意网页注入自定义按钮或链接，并通过扩展侧边栏集中管理。所有注入元素都会按页面 URL 保存在 `chrome.storage.local` 中，二次访问自动恢复。

## 功能亮点

- **侧边栏一体化**：在同一个侧边栏入口内完成添加、搜索、筛选、编辑、删除，并可随时切换到全局一览查看所有页面的注入记录。
- **可视化拾取器**：点击“拾取目标”即可在页面上直接选择节点，自动生成 CSS 选择器，支持 append / prepend / before / after 四种插入方式。
- **样式自定义**：为每个按钮/链接配置颜色、背景、字号、padding、圆角以及定位信息。
- **持久化与回放**：利用 `chrome.storage.local` 和 `MutationObserver`，数据可持久保存并在 DOM 变动时自动补回。
- **样式隔离**：通过 Shadow DOM 注入 UI，避免与目标页面样式冲突。

## 安装与构建

```bash
git clone https://github.com/your-org/web-assistant.git
cd web-assistant
npm install
npm run build
```

1. 打开 `chrome://extensions/`，启动 **开发者模式**；
2. 选择 **加载已解压的扩展程序**，指向项目根目录；
3. 将扩展图标固定在浏览器工具栏，便于快速打开侧边栏。

## 使用方法

1. 在目标网页点击扩展图标，打开侧边栏；
2. 在“元素管理”视图中点击「拾取目标」，选择页面上的节点；
3. 填写文本、可选的跳转 URL、插入方式和样式设置，点击「保存元素」；
4. 已注入元素会出现在列表，可进行搜索、定位、编辑和删除；
5. 切换到「全局一览」视图，可跨页面查看所有注入记录，执行刷新、定位、清理等操作。

## 所需权限

- `activeTab`、`tabs`、`scripting`：向当前页面注入脚本；
- `storage`：保存各页面的元素配置；
- `sidePanel`：在支持的浏览器中显示扩展侧边栏。

## 项目结构

```
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ content.js
│  ├─ inject.js
│  └─ selector.js
├─ sidepanel/
│  ├─ sidepanel.html        # React 挂载入口
│  ├─ src/                  # React + Tailwind 源码
│  └─ dist/                 # 构建输出（由 npm run build 生成）
├─ common/
│  ├─ compat.js
│  ├─ messaging.js
│  ├─ storage.js
│  └─ types.js
└─ assets/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

## 已知限制

- 某些站点启用严格的 CSP（内容安全策略），可能阻止脚本或样式注入；
- 目前不支持向嵌套 `iframe` 注入元素；
- 个别页面脚本可能频繁移除自定义节点，即便有观察器兜底仍可能产生冲突。

欢迎提交 Issue / PR 反馈与改进建议。祝使用愉快！
