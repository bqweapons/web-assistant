# Page Augmentor

> [English](#english) · [日本語](#日本語) · [简体中文](#简体中文)

## English

### Overview
Page Augmentor is a Manifest V3 Chrome extension that lets you inject custom buttons, links, or tooltips into any webpage and manage them from a dedicated side panel. Each item is stored per URL in `chrome.storage.local`, so elements automatically reappear whenever you revisit the page.

### Feature highlights
- **Unified side panel** – Switch between the Manage view for the current page and an Overview that lists every injected element across all pages with running totals.
- **Visual picker** – Highlight DOM nodes directly in the page, auto-generate CSS selectors, and open the editor bubble immediately to configure the element.
- **In-page bubble editor** – Choose between button, link, or tooltip; set text plus optional URL or mirrored click selector; pick the insertion position (append, prepend, before, after); and fine-tune tooltip placement, persistence, colors, typography, spacing, and radius with a live preview before saving.
- **Persistent playback** – Entries live in `chrome.storage.local`, are restored on page load, and reinsert themselves after DOM mutations thanks to an internal `MutationObserver`.
- **Real-time sync & actions** – Updates broadcast to every open tab and the side panel, enabling focus, edit, delete, or clear actions that stay perfectly in sync.
- **Style isolation** – UI nodes render inside Shadow DOM hosts so your custom controls retain their appearance regardless of the host page’s CSS.

### Installation & build

```bash
git clone https://github.com/your-org/web-assistant.git
cd web-assistant
npm install
npm run build
```

1. Open `chrome://extensions/` and enable **Developer mode**.
2. Choose **Load unpacked** and pick the project root directory.
3. Pin the extension and open the side panel from the toolbar for quick access.

### Usage

1. Click the extension icon on any page to launch the side panel.
2. In the **Manage** view, press **Pick target** to activate the visual picker, then click the element to inject.
3. Configure the element in the bubble editor: select type, text, optional URL or click selector, tooltip placement and visibility when applicable, insertion position, and style settings. Confirm to save.
4. Use the list to search or filter by type, focus injected items, reopen the bubble editor, or delete entries for the current page.
5. Switch to the **Overview** view to audit every stored element, review per-page totals, open a page in a new tab, focus or edit an item, or clear all entries for a URL.

### Permissions

- `activeTab`, `tabs`, `scripting` – inject and control scripts in the active page.
- `storage` – persist element metadata per page.
- `sidePanel` – display the React management UI inside Chrome’s side panel.

### Project structure

```
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ content.js           # Bootstraps picker, bubble editor, and DOM sync
│  ├─ inject.js            # Renders, updates, and removes injected nodes
│  └─ selector.js          # Visual picker & in-page editor implementation
├─ sidepanel/
│  ├─ sidepanel.html       # Entry point for the side panel
│  └─ src/                 # React + Tailwind source for the side panel UI
├─ common/
│  ├─ compat.js            # Cross-context helpers (tabs, side panel)
│  ├─ messaging.js         # Message bus & enums shared by all scripts
│  ├─ storage.js           # chrome.storage.local persistence helpers
│  └─ types.js             # Shared type definitions & constants
└─ assets/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

### Known limitations

- Strict Content Security Policy headers on some sites may block script or style injection.
- Elements can also be injected inside same-origin `iframe` documents. Cross-origin frames remain unsupported.
- Host pages that aggressively mutate the DOM may still interfere with injected nodes despite the reconciliation watcher.

---

## 日本語

### 概要
Page Augmentor は Manifest V3 ベースの Chrome 拡張機能で、任意の Web ページにカスタムのボタンやリンク、ツールチップを追加し、専用のサイドパネルから一元管理できます。各アイテムは URL 単位で `chrome.storage.local` に保存され、ページを再訪すると自動的に復元されます。

### 特徴
- **サイドパネルの統合ビュー** – 現在のページを操作する管理ビューと、全ページの要素を一覧できる概要ビューを切り替えられます。
- **ビジュアルピッカー** – ページ上の DOM ノードをハイライトし、CSS セレクターを自動生成して、即座にバブルエディターを開いて設定できます。
- **ページ内バブルエディター** – ボタン／リンク／ツールチップを切り替え、テキストと任意の遷移先 URL やクリック転送先セレクターを設定し、挿入位置（末尾、先頭、直前、直後）を選択。ツールチップの表示位置や常時表示の有無を含め、色・タイポグラフィ・余白・角丸などをライブプレビュー付きで微調整できます。
- **永続化と自動復元** – 追加した要素は `chrome.storage.local` に保存され、ページ読み込み時に復元され、`MutationObserver` によって DOM 変更後も自動で差し戻されます。
- **リアルタイム同期とアクション** – 更新内容は開いているすべてのタブとサイドパネルにブロードキャストされ、フォーカス、編集、削除、ページ単位のクリア操作が常に同期されます。
- **スタイルの分離** – UI ノードは Shadow DOM 内に描画されるため、ホストページの CSS の影響を受けません。

### インストールとビルド

```bash
git clone https://github.com/your-org/web-assistant.git
cd web-assistant
npm install
npm run build
```

1. `chrome://extensions/` を開き、**デベロッパーモード** を有効にします。
2. **パッケージ化されていない拡張機能を読み込む** を選択し、プロジェクトのルートディレクトリを指定します。
3. 拡張機能をピン留めし、ツールバーからサイドパネルをすぐに開けるようにします。

### 使い方

1. 任意のページで拡張機能アイコンをクリックし、サイドパネルを起動します。
2. **管理** ビューで **ターゲットを選択** を押してビジュアルピッカーを有効にし、注入したい要素をクリックします。
3. バブルエディターでタイプ、テキスト、任意の URL やクリック転送先、ツールチップの位置と表示方法（必要に応じて）、挿入位置、スタイルを設定し、保存します。
4. リストから検索やタイプによる絞り込み、フォーカス、バブルエディターの再表示、要素の削除を行えます。
5. **概要** ビューに切り替えると、保存済みのすべての要素とページごとの件数を確認し、新しいタブで開く・フォーカス・編集・ページ単位で削除といった操作ができます。

### 要求される権限

- `activeTab`、`tabs`、`scripting` – アクティブなページにスクリプトを注入・制御するため。
- `storage` – ページごとの要素設定を永続化するため。
- `sidePanel` – Chrome のサイドパネルに管理 UI を表示するため。

### プロジェクト構成

```
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ content.js           # ピッカーとバブル、DOM 同期のエントリ
│  ├─ inject.js            # 注入ノードの描画・更新・削除を担当
│  └─ selector.js          # ビジュアルピッカーとページ内エディター
├─ sidepanel/
│  ├─ sidepanel.html       # サイドパネルのエントリーポイント
│  └─ src/                 # React + Tailwind 製のサイドパネル UI
├─ common/
│  ├─ compat.js            # タブやサイドパネル操作のヘルパー
│  ├─ messaging.js         # 各スクリプト共通のメッセージ機構
│  ├─ storage.js           # chrome.storage.local のユーティリティ
│  └─ types.js             # 共有の型定義と定数
└─ assets/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

### 既知の制限事項

- 一部サイトの厳格な CSP（コンテンツセキュリティポリシー）により、スクリプトやスタイルの注入がブロックされる場合があります。
- 同一オリジンの `iframe` にも要素を注入できます。異なるオリジンのフレームには対応していません。
- ページ側が DOM を頻繁に改変するケースでは、監視による差し戻しを行っても競合が発生することがあります。

---

## 简体中文

### 概述
Page Augmentor 是一款基于 Manifest V3 的 Chrome 扩展，可在任意网页注入自定义按钮、链接或提示气泡，并通过扩展侧边栏集中管理。所有注入元素都会按照页面 URL 保存在 `chrome.storage.local` 中，重新访问时会自动恢复。

### 功能亮点
- **侧边栏一体化视图**：在当前页面的「元素管理」与汇总全部页面的「全局总览」之间自由切换，并实时显示统计信息。
- **可视化拾取器**：直接在页面上高亮 DOM 节点，自动生成 CSS 选择器，并立即弹出编辑气泡完成配置。
- **页面内气泡编辑器**：在保存前即可切换按钮/链接/提示气泡类型，设置文本、可选跳转地址或点击转发选择器，选择插入位置（追加、前置、前插、后插），并实时预览提示气泡的显示方位、常驻显示与颜色、排版、间距、圆角等样式调整。
- **持久化与回放**：利用 `chrome.storage.local` 存储配置，页面加载时自动恢复，并通过 `MutationObserver` 在 DOM 被移除后重新注入。
- **实时同步与快捷操作**：所有更新会广播到已打开的标签页和侧边栏，可随时在任一端执行定位、编辑、删除或整页清理，且状态保持同步。
- **样式隔离**：自定义元素使用 Shadow DOM 挂载，确保在目标页面的 CSS 环境下仍能保持既定外观。

### 安装与构建

```bash
git clone https://github.com/your-org/web-assistant.git
cd web-assistant
npm install
npm run build
```

1. 打开 `chrome://extensions/`，启用 **开发者模式**。
2. 点击 **加载已解压的扩展程序**，选择项目根目录。
3. 将扩展图标固定在浏览器工具栏，便于随时打开侧边栏。

### 使用方法

1. 在目标网页点击扩展图标，打开侧边栏。
2. 在「元素管理」视图中点击「拾取目标」，启用可视化拾取器并选中要注入的节点。
3. 在气泡编辑器中设置类型、文本、可选 URL 或点击转发选择器、提示气泡位置与展示方式（如需）、插入位置与样式，并确认保存。
4. 使用列表进行搜索或类型筛选，可快速定位、重新打开气泡编辑器或删除当前页面的元素。
5. 切换到「全局总览」视图，即可查看所有页面的注入记录与数量，并执行在新标签页打开、定位、编辑或整页清空等操作。

### 所需权限

- `activeTab`、`tabs`、`scripting`：向当前页面注入并控制脚本。
- `storage`：为每个页面持久化元素配置。
- `sidePanel`：在 Chrome 侧边栏展示 React 管理界面。

### 项目结构

```
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ content.js           # 负责启动拾取器、气泡编辑器与 DOM 同步
│  ├─ inject.js            # 渲染、更新、移除已注入的节点
│  └─ selector.js          # 可视化拾取器与页面内编辑器
├─ sidepanel/
│  ├─ sidepanel.html       # 侧边栏入口
│  └─ src/                 # React + Tailwind 侧边栏源码
├─ common/
│  ├─ compat.js            # 标签页与侧边栏的兼容性工具
│  ├─ messaging.js         # 各脚本共享的消息通道与枚举
│  ├─ storage.js           # `chrome.storage.local` 持久化工具函数
│  └─ types.js             # 共享的类型定义与常量
└─ assets/
   ├─ icon16.png
   ├─ icon48.png
   └─ icon128.png
```

### 已知限制

- 某些站点启用严格的 CSP（内容安全策略），可能会阻止脚本或样式注入。
- 现在也可以向同源的 `iframe` 注入元素，跨域框架仍不支持。
- 若目标页面频繁修改 DOM，即使有监听补回机制，仍可能与自定义节点产生冲突。

