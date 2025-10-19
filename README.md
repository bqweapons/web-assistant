# Page Augmentor

Page Augmentor 是一款基于 Manifest V3 的 Chrome 扩展，能够在任意网页插入自定义按钮或链接，并通过侧边栏集中管理。所有元素按照页面 URL 存储在 `chrome.storage.local` 中，重新访问时会自动恢复。

## 功能亮点

- 侧边栏提供创建、编辑、删除全流程，集中管理当前页面的全部自定义元素。
- 内置拾取器可在页面中直接选择目标节点并生成唯一 CSS 选择器，支持 append / prepend / before / after 四种插入方式。
- 列表支持搜索、筛选、定位高亮；按钮可选配置跳转 URL，点击后自动在新标签页打开。
- 自动持久化数据并在刷新后恢复；`MutationObserver` 监视 DOM 变更并重新注入被移除的元素。
- 使用 Shadow DOM 隔离样式，避免与原页面冲突。
- 提供“一览页面”汇总视图，可跨页面查看并批量清理元素；若浏览器不支持 Side Panel API，会自动降级为新标签页。

## 安装步骤

1. 克隆或下载本仓库。
2. 打开 `chrome://extensions/` 并启用 **开发者模式**。
3. 点击 **加载已解压的扩展程序**，选择项目根目录。
4. 扩展图标出现在工具栏后可固定，方便快速访问。

## 使用方法

1. 打开任意网页并点击扩展图标，在侧边栏中启动 Page Augmentor。
2. 在“添加新元素”区域点击 **拾取目标**，在网页上选择插入位置。
3. 填写文本、插入位置及样式；链接类型必须提供 URL，按钮可选填 URL 以实现跳转。
4. 点击 **保存元素** 完成注入。列表会实时显示所有元素，可进行搜索、定位、编辑或删除。
5. 侧边栏右上角的 **一览页面** 可打开汇总视图，查看所有网页的元素并执行批量操作。

## 所需权限

- `activeTab`、`tabs`、`scripting`：注入并执行内容脚本。
- `storage`：持久化每个页面的元素配置。
- `sidePanel`：在支持的浏览器中打开侧边栏。

## 项目结构

```
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ content.js
│  ├─ inject.js
│  └─ selector.js
├─ sidepanel/
│  ├─ sidepanel.html
│  ├─ sidepanel.js
│  └─ sidepanel.css
├─ overview/
│  ├─ overview.html
│  ├─ overview.js
│  └─ overview.css
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

- 某些站点的 CSP（内容安全策略）可能阻止脚本或样式注入。
- 目前不支持向 iframe 中注入元素。
- 个别页面脚本可能频繁移除自定义节点，尽管有观察器兜底，仍可能出现冲突。

## 开发说明

- 使用原生 ES 模块编写，无需额外构建工具。
- 关键函数带有 JSDoc 注释，便于快速理解代码。
- 内容脚本通过 `web_accessible_resources` 动态加载共享模块，请保持文件路径一致。
