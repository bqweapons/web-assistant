# Page Augmentor

[English](#english) · [日本語](#日本語) · [简体中文](#简体中文)

---

## English

### Overview
Page Augmentor is a Manifest V3 Chrome extension that lets you inject custom buttons, links, or tooltips into any web page and manage them from a dedicated side panel. Every injected element is scoped to its page URL and stored in `chrome.storage.local`, so your customisations reappear automatically whenever you revisit the site.

### Feature highlights
- **Unified side panel** – Swap between the per-page Manage view and the cross-site Overview with live statistics.
- **Visual picker** – Highlight DOM nodes in context, auto-generate CSS selectors, and jump straight into the editor bubble.
- **In-page editor bubble** – Configure type (button, link, tooltip), text, optional URL or mirrored click selector, placement (append, prepend, before, after), tooltip position/persistence, and fine-grained styling with live previewing.
- **Resilient persistence** – Stored in `chrome.storage.local`, restored on page load, and reattached after DOM mutations via a `MutationObserver`.
- **Real-time sync** – Broadcasts updates across tabs and the side panel so focus, edit, delete, and clear actions stay aligned everywhere.
- **Shadow DOM isolation** – Rendered controls keep their appearance even when the host page ships heavy CSS.

### Installation

```bash
git clone https://github.com/your-org/web-assistant.git
cd web-assistant
npm install
npm run build
```

1. Open `chrome://extensions/`, toggle **Developer mode** on.
2. Click **Load unpacked** and select the project root.
3. Pin the extension and open the side panel from the toolbar when needed.

### Usage
1. Click the Page Augmentor icon to launch the side panel on the active tab.
2. In **Manage**, press **Pick target** and select the element you want to augment.
3. Use the editor bubble to adjust type, text, optional URL or selector, placement, tooltip behaviour, and styles. Save to persist.
4. Filter or search the list, focus injected items, reopen the editor, or remove them per page.
5. Switch to **Overview** to inspect every stored entry, open pages in new tabs, or bulk clear by URL.

### Permissions
- `activeTab`, `tabs`, `scripting` – inject and control page scripts.
- `storage` – keep per-page augmentation metadata.
- `sidePanel` – expose the React management UI inside Chrome’s side panel.

### Project structure (excerpt)

```
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ content.js             # Mounts picker + bubble into the page
│  ├─ inject.js              # Lifecycle for injected DOM nodes
│  ├─ selector.js            # Entry for selector-related modules
│  ├─ bubble/
│  │  ├─ index.js            # Public API (getElementBubble/openElementEditor)
│  │  ├─ element-bubble.js   # Main bubble assembly (WIP refactor target)
│  │  ├─ actionflow/         # Builder, parser bridge, picker, serializer
│  │  ├─ layout/placement.js # Attach/detach/position helpers
│  │  ├─ preview.js          # Preview element management
│  │  ├─ state.js            # Editor state container
│  │  ├─ styles/             # Style configs + normalisation helpers
│  │  └─ ui/                 # Field, tab group, tooltip style helpers
│  └─ selector/
│     ├─ frame.js
│     ├─ overlay.js
│     ├─ picker.js
│     └─ utils.js
├─ sidepanel/
│  ├─ sidepanel.html
│  └─ src/                   # React side panel app
└─ common/
   ├─ flows.js
   ├─ i18n.js
   ├─ messaging.js
   └─ types.js
```

### Known limitations
- Strict CSP headers may block script/style injection on some hosts.
- Only same-origin `iframe` documents can be augmented.
- Highly dynamic pages may briefly override inserted elements before the observer reinstates them.

---

## 日本語

### 概要
Page Augmentor は Manifest V3 対応の Chrome 拡張機能です。任意のウェブページにボタン、リンク、ツールチップを追加し、サイドパネルから一括管理できます。設定は URL 単位で `chrome.storage.local` に保存され、ページ再訪時に自動復元されます。

### 特長
- **統合サイドパネル** – ページ別管理ビューと全ページ概要ビューをワンクリックで切り替え。
- **ビジュアルピッカー** – ページ上の DOM をハイライトし、CSS セレクターを自動生成、即座に編集バブルを起動。
- **ページ内バブル編集** – ボタン/リンク/ツールチップのタイプ、テキスト、URL やクリック転送セレクター、挿入位置、ツールチップの位置・常駐設定、色・タイポグラフィ・余白・角丸をライブプレビュー付きで調整。
- **堅牢な永続化** – `chrome.storage.local` に保存し、ロード時に復元。`MutationObserver` で DOM 変更後も再挿入。
- **リアルタイム同期** – すべてのタブとサイドパネルで編集・削除・フォーカス操作が即時反映。
- **Shadow DOM によるスタイル分離** – ホストページの CSS から独立した見た目を維持。

### インストール
上記コマンドで依存関係を整えた後、`chrome://extensions/` で **デベロッパーモード** を有効にし、プロジェクトルートを **パッケージ化されていない拡張機能** として読み込んでください。

### 使い方
1. 拡張アイコンをクリックしてサイドパネルを開く。
2. **Manage** で **Pick target** を押し、挿入対象を選択。
3. 編集バブルでタイプ、テキスト、URL/セレクター、挿入位置、ツールチップ挙動、スタイルを調整して保存。
4. リストから検索やフィルタ、フォーカス、再編集、削除を実行。
5. **Overview** で全ページ分の要素を確認し、新規タブで開く・フォーカス・全削除を行う。

### 付与権限
- `activeTab`, `tabs`, `scripting` – アクティブページへのスクリプト注入。
- `storage` – ページごとの設定保存。
- `sidePanel` – サイドパネル UI の表示。

### 主なディレクトリ
英語セクションのプロジェクト構成を参照してください。`content/bubble/` 以下で段階的なモジュール化を進めています。

---

## 简体中文

### 概述
Page Augmentor 是一款 Manifest V3 Chrome 扩展，可在任意网页注入按钮、链接或提示气泡，并在侧边栏集中管理。配置按 URL 存储于 `chrome.storage.local` 中，再次访问会自动恢复。

### 功能亮点
- **统一侧边栏** – 在当前页管理视图与全站概览之间流畅切换。
- **可视化拾取器** – 高亮 DOM 节点，自动生成 CSS 选择器并立即进入编辑气泡。
- **页面内编辑** – 配置类型、文本、可选 URL 或点击选择器、插入位置、提示气泡方向/常驻状态以及细粒度样式，并实时预览。
- **稳健持久化** – 数据写入 `chrome.storage.local`，`MutationObserver` 保证 DOM 变动后自动补回。
- **实时同步** – 所有标签页与侧边栏保持一致，聚焦、编辑、删除、清空操作立即生效。
- **Shadow DOM 隔离** – 自定义控件不受宿主页面 CSS 污染。

### 安装
执行顶部的克隆与构建命令后，在 `chrome://extensions/` 启用 **开发者模式**，点击 **加载已解压的扩展程序**，选择项目根目录即可。

### 使用步骤
1. 点击扩展图标打开侧边栏。
2. 在 **Manage** 中选择 **Pick target**，点击需要增强的 DOM 元素。
3. 在编辑气泡中设置类型、文本、URL/选择器、插入位置、提示气泡行为及样式，保存即同步到页面。
4. 通过列表筛选或搜索，执行聚焦、重新编辑或按页删除。
5. 切换至 **Overview** 可查看所有配置并执行批量操作。

### 权限说明
- `activeTab`, `tabs`, `scripting` – 控制当前标签页脚本。
- `storage` – 按页面持久化自定义项。
- `sidePanel` – 在侧边栏渲染 React UI。

更多目录说明请参阅英文部分。`content/bubble/` 目录正在逐步拆分为独立模块，以提升可维护性。
