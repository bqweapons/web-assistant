# Page Augmentor

[English](#english) / [日本語](#日本語) / [简体中文](#简体中文)

---

## English

### Overview
Page Augmentor is a Manifest V3 Chrome extension for layering custom buttons, links, tooltips, and rich callouts onto any web page. Manage everything from the side panel across Manage, Overview, and Settings views. Every injected element is scoped to its page URL and stored in `chrome.storage.local`, so your customisations reappear automatically whenever you revisit the site.

### Feature highlights
- **Unified side panel**: Swap between the per-page Manage view, cross-site Overview, and Settings (import/export, language) without leaving Chrome.
- **Frame-aware visual picker**: Highlight DOM nodes in context, including same-origin iframes, auto-generate CSS selectors, and jump straight into the editor bubble.
- **Rich element types**: Configure buttons, links, tooltips, or area callouts with placement (append, prepend, before, after), optional mirrored click selectors, and granular styles.
- **Action flow builder**: Chain multi-step automations (click, wait, input, navigate, log, if/while) that run before fallback link or selector behaviour when injected buttons are clicked.
- **Modular injection runtime**: High-cohesion renderer, flow runner, and tooltip helpers live under `content/injection/`, keeping DOM orchestration composable and easier to extend.
- **Drag-friendly areas**: Drop area elements anywhere on the page canvas and Page Augmentor will persist their coordinates automatically.
- **Simplified styling controls**: Quick presets and a compact basic panel keep common tweaks approachable while advanced CSS fields stay tucked behind a single toggle.
- **Resilient sync and persistence**: Store data in `chrome.storage.local`, restore on load, and reattach after DOM mutations via a `MutationObserver`, broadcasting updates across tabs and the side panel.
- **Shadow DOM isolation**: Rendered controls keep their appearance even when the host page ships heavy CSS.

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
2. In **Manage**, press **Pick target** and select the element you want to augment (same-origin iframes are supported).
3. Use the editor bubble to choose a type (button, link, tooltip, or area), adjust text, placement, styles, and optionally attach a URL, mirrored selector, or action flow before saving. Area elements can also be dragged directly on the page to fine-tune their position.
4. Use the Manage filters to search, focus injected items, reopen the editor, or remove them per page.
5. Switch to **Overview** to inspect every stored entry, open pages in new tabs, or bulk clear by URL.
6. Open **Settings** to import or export JSON backups and switch the interface language.

### Action flows (optional)
Injected buttons can run scripted flows before falling back to an attached link or selector. Provide JSON with a `steps` array; supported step types include `click`, `wait`, `input`, `navigate`, `log`, `if`, and `while`. Flows run up to 200 steps (50 loop iterations) and abort after roughly 10 seconds. Use the special selector `:self` when a step should interact with the injected button itself.

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

See `AGENTS.md` for a deeper reference on agent authoring, available steps, guard rails, and best practices.

### Permissions
- `activeTab`, `tabs`, `scripting`: inject and control page scripts.
- `storage`: keep per-page augmentation metadata.
- `sidePanel`: expose the React management UI inside Chrome's side panel.
- `webNavigation`: enumerate same-origin frames so pickers and reinjection reach nested documents.

### Project structure (excerpt)

```
.
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ app/
│  │  ├─ content.js              # content script entry (orchestrator)
│  │  ├─ context.js              # shared runtime + state
│  │  ├─ page-url.js             # URL normalization
│  │  ├─ hydration.js            # fetch + render elements
│  │  ├─ mutation-watcher.js     # DOM observer + reconcile
│  │  ├─ autosave.js             # drag/placement autosave
│  │  ├─ picker.js               # element picker wiring
│  │  ├─ creation.js             # new element flows
│  │  ├─ editor.js               # inline editor bubble
│  │  ├─ editing-mode.js         # edit-mode toggle behavior
│  │  ├─ frame.js                # frame matching helpers
│  │  └─ highlight.js            # transient target highlight
│  ├─ inject.js                  # injection facade
│  ├─ injection/
│  │  ├─ core/
│  │  │  ├─ constants.js
│  │  │  ├─ registry.js
│  │  │  ├─ flow-runner.js
│  │  │  └─ utils.js
│  │  ├─ host/...
│  │  ├─ interactions/{drag,drop,resize}/...
│  │  ├─ orchestrator/...
│  │  └─ ui/{style,tooltip}.js
│  ├─ bubble/
│  │  ├─ element-bubble.js
│  │  ├─ editor/action-flow-controller.js
│  │  ├─ actionflow/{builder,serializer,parser-bridge}.js
│  │  └─ ...
│  ├─ selector.js                # selector entry
│  ├─ selector/                  # picker, overlay, frame utils
│  └─ dist/content.js            # built content bundle
├─ sidepanel/
│  ├─ sidepanel.html
│  └─ src/...
└─ common/...
```

### Content runtime modules
- `content/app/content.js`: Initializes the runtime, then hydrates, wires messages, observers, and autosave.
- `content/app/hydration.js`: Lists stored elements and syncs them to the DOM.
- `content/app/editor.js`: Opens/closes the inline editor with live preview + autosave.
- `content/app/creation.js`: New element flows (rect draw, tooltip attach) with draft building.
- `content/app/picker.js`: Visual element picker integration and result reporting.
- `content/app/autosave.js`: Persist drag/resize updates outside the editor.
- `content/app/mutation-watcher.js`: Reconciles injected elements after DOM mutations.
- `content/app/frame.js`: Frame-aware filtering/matching helpers.
See `AGENTS.md` for details on action flows and how to extend them.
### Runtime architecture overview
- **Messaging layer (`common/messaging.js`)**: Wraps `chrome.runtime.sendMessage` and port connections so every context exchanges `{ ok, data | error }` payloads. Async handlers are normalised to promises, letting the side panel, background service worker, and content scripts share identical request patterns.
- **Persistent store (`common/storage.js`)**: Keeps all injected element metadata under a single `injectedElements` key. Update helpers clone payloads (including nested style/frame fields) to avoid shared references, while `observePage` fans out `chrome.storage.onChanged` events by URL.
- **URL normalisation (`common/url.js`)**: Produces stable page keys by stripping query strings and hashes, falling back to manual trimming when the URL constructor is unavailable.
- **Injection registry (`content/injection/core/registry.js`)**: Tracks element descriptors alongside live host nodes, reuses existing DOM hosts when possible, toggles editing state via `data-*` attributes, and rebuilds hosts whenever placement metadata changes.
- **Renderer lifecycle**: Newly created hosts hydrate immediately through `applyMetadata` so users see text, hrefs, and tooltip content without waiting for external observers.

### Known limitations
- Strict CSP headers may block script/style injection on some hosts.
- Only same-origin iframe documents can be augmented.
- Highly dynamic pages may briefly override inserted elements before the observer reinstates them.
- Action flows are capped at 200 steps, 50 loop iterations, and roughly 10 seconds of runtime; longer automations will abort early.

---

## 日本語

### 概要
Page Augmentor は Manifest V3 対応の Chrome 拡張機能で、任意の Web ページにカスタムボタン、リンク、ツールチップ、リッチなコールアウトを重ねて表示できます。サイドパネルの Manage / Overview / Settings から一元管理され、挿入した要素はページごとに `chrome.storage.local` へ保存されるため、同じサイトへ再訪すると自動で復元されます。

### 主要機能
- **統合サイドパネル**: Manage、Overview、Settings（インポート/エクスポート、言語切替）を Chrome を離れずに切り替えできます。
- **iframe 対応ピッカー**: DOM ノードをページ上でハイライトし（同一オリジンの iframe を含む）、CSS セレクターを自動生成して編集バブルを即座に開きます。
- **多彩な要素タイプ**: ボタン、リンク、ツールチップ、エリアコールアウトを配置（append、prepend、before、after）でき、ミラークリック用セレクターや詳細なスタイルも設定できます。
- **アクションフロービルダー**: クリック、待機、入力、ナビゲート、ログ、条件・ループなど複数ステップを連結し、ボタンがリンクやセレクターへフォールバックする前に実行させます。
- **モジュール化された注入ランタイム**: content/injection/ 以下にレンダラー、フローランナー、ツールチップヘルパーを分離し、高凝集で拡張しやすい構成にしています。
- **ドラッグしやすいエリア要素**: ページキャンバス上でエリア要素をドラッグ&ドロップすると、その座標が自動で保存されます。
- **直感的なスタイル調整**: よく使う設定はプリセットとコンパクトな基本パネルで素早く調整でき、高度な CSS フィールドはひとつのトグルの裏にまとめています。
- **堅牢な同期と永続化**: データは `chrome.storage.local` に保存され、読み込み時に復元されます。`MutationObserver` が DOM 変化を監視して再挿入し、タブとサイドパネル間で更新をブロードキャストします。
- **Shadow DOM の隔離**: ホストページの重い CSS に左右されず、レンダリングしたコントロールの見た目を保ちます。

### インストール
1. 上記コマンドで依存関係をインストールした後、`chrome://extensions/` を開きます。
2. **デベロッパーモード** をオンにし、**パッケージ化されていない拡張機能を読み込む** をクリックします。
3. プロジェクトルートを選択し、必要に応じてサイドパネルやツールバーにピン留めします。

### 使い方
1. 拡張アイコンをクリックしてアクティブタブのサイドパネルを開きます。
2. **Manage** で **Pick target** を押し、強化したい要素（同一オリジンの iframe 内も可）を選択します。
3. 編集バブルでタイプ、テキスト、配置、スタイル、リンクやミラークリック、任意のアクションフローを設定します。エリア要素はページ上でドラッグして位置調整できます。
4. Manage のフィルターと検索で要素を絞り込み、フォーカス、再編集、削除を行います。
5. **Overview** に切り替えて保存済みエントリを確認し、新規タブで開いたり URL ごとにまとめて削除したりできます。
6. **Settings** では JSON のインポート/エクスポートと UI 言語の切り替えができます。

### アクションフロー（任意）
挿入したボタンは、リンクやミラーセレクターにフォールバックする前にスクリプト化されたフローを実行できます。`steps` 配列を含む JSON を入力し、click、wait、input、navigate、log、if、while などを組み合わせます。最大 200 ステップ（ループ 50 回まで）、およそ 10 秒でタイムアウトします。ボタン自身を操作する場合は `:self` セレクターを使用してください。

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 必要な権限
- ActiveTab, tabs, scripting: アクティブなページにスクリプトを注入・制御するため。
- storage: ページごとの設定を保存するため。
- sidePanel: Chrome のサイドパネル内に React UI を表示するため。
- webNavigation: 同一オリジンのフレームを列挙し、ピッカーと再挿入を iframe まで届けるため。

### ランタイム構成の概要
- **メッセージング層（`common/messaging.js`）**: `chrome.runtime.sendMessage` や Port 接続をラップし、すべてのコンテキストが `{ ok, data | error }` 形式で通信できるよう整えています。非同期ハンドラは Promise として正規化され、サイドパネル・バックグラウンド・コンテンツスクリプト間で同じ呼び出しパターンを共有します。
- **永続ストア（`common/storage.js`）**: 注入要素メタデータを `injectedElements` キーに集約。更新ヘルパーはスタイルや frameSelectors などの入れ子プロパティまで複製して共有参照を避け、`observePage` が `chrome.storage.onChanged` の差分を URL ごとに配信します。
- **URL 正規化（`common/url.js`）**: クエリ文字列とハッシュを除去して安定したページキーを生成し、URL コンストラクタが利用できない環境では手動トリミングでフォールバックします。
- **注入レジストリ（`content/injection/core/registry.js`）**: 要素ディスクリプターと DOM 上のホストノードを同期。既存ホストを優先的に再利用し、`data-*` 属性で編集状態を切り替え、配置メタデータが変わった場合はノードを再構築します。
- **レンダラーのライフサイクル**: 新しく生成したホストには `applyMetadata` を即座に適用し、テキストやリンク、ツールチップ内容が遅延なく表示されるようにしています。

### 既知の制限
- 厳しい CSP を備えたサイトではスクリプトやスタイルの注入が拒否される場合があります。
- 強化できるのは同一オリジンの iframe のみです。
- DOM が激しく変化するページでは、要素が一時的に上書きされることがありますが監視により再挿入されます。
- アクションフローは最大 200 ステップ / 50 ループ・約 10 秒までに制限されており、制限を超えると停止します。

---

## 简体中文

### 概述
Page Augmentor 是一款支持 Manifest V3 的 Chrome 扩展，可在任意网页叠加自定义按钮、链接、提示气泡以及区域标注。所有配置都在侧边栏的 Manage / Overview / Settings 中集中管理，并按页面 URL 存储到 `chrome.storage.local`，再次访问同一站点时会自动恢复。

### 功能亮点
- **统一侧边栏**: 在 Manage、Overview、Settings（导入/导出、语言切换）之间切换，无需离开 Chrome。
- **支持 iframe 的可视化拾取器**: 高亮页面上的 DOM 节点（包含同源 iframe），自动生成 CSS 选择器并立即打开编辑气泡。
- **丰富的元素类型**: 配置按钮、链接、提示气泡或区域标注，可选 append、prepend、before、after 插入位置以及镜像点击选择器，并精细控制样式。
- **动作流程构建器**: 串联点击、等待、输入、跳转、日志、条件、循环等步骤，在按钮回退到链接或选择器前先执行自动化流程。
- **模块化注入运行时**: content/injection/ 下的渲染器、流程执行器、提示气泡辅助工具拆分为高内聚模块，结构清晰且易于扩展。
- **易于拖动的区域元素**: 区域元素可以拖动到页面任意位置，坐标会自动保存。
- **更易上手的样式控制**: 常用设置集中在简洁的基础面板和快捷预设，高级 CSS 字段隐藏在一个开关之后。
- **可靠的同步与持久化**: 数据存储在 `chrome.storage.local` 中，加载时恢复；`MutationObserver` 监听 DOM 变化并重新挂载，同时向所有标签页和侧边栏广播更新。
- **Shadow DOM 隔离**: 即使宿主页面样式复杂，自定义控件仍能保持外观一致。

### 安装
1. 运行上方命令安装依赖后，打开 `chrome://extensions/`。
2. 启用 **开发者模式** 并点击 **加载已解压的扩展程序**。
3. 选择项目根目录，按需将侧边栏固定在工具栏中。

### 使用步骤
1. 点击 Page Augmentor 图标，在当前标签页中打开侧边栏。
2. 在 **Manage** 中点击 **Pick target**，选择需要增强的元素（支持同源 iframe）。
3. 在编辑气泡中选择类型、文本、位置、样式，并可选配置 URL、镜像选择器或动作流程。区域元素可以直接在页面上拖动微调位置。
4. 利用 Manage 的筛选器搜索、聚焦、重新编辑或按页面删除已注入的项目。
5. 切换到 **Overview** 查看所有已保存的条目，可按 URL 在新标签页打开或批量清除。
6. 在 **Settings** 中导入/导出 JSON 备份并切换界面语言。

### 动作流程（可选）
按钮在回退到链接或镜像选择器之前，可以执行脚本化流程。提供包含 `steps` 数组的 JSON，步骤类型支持 click、wait、input、navigate、log、if、while 等。流程最多 200 步（循环 50 次以内），运行约 10 秒后会自动停止。若需要引用按钮自身，请使用 `:self` 选择器。

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 权限说明
- ActiveTab, tabs, scripting: 向当前页面注入并控制脚本。
- storage: 按页面保存自定义配置。
- sidePanel: 在 Chrome 侧边栏中展示 React UI。
- webNavigation: 枚举同源 iframe，使拾取器和重新挂载能够作用到嵌套文档。

### 运行时结构概览
- **消息层（`common/messaging.js`）**：封装 `chrome.runtime.sendMessage` 与长连接端口，统一使用 `{ ok, data | error }` 结构传递结果，让侧边栏、后台 Service Worker 与内容脚本共享同一套异步调用方式。
- **持久化存储（`common/storage.js`）**：把所有注入元素的元数据集中在 `injectedElements` 键下，写入前连同样式和 frameSelectors 等子字段一起复制，避免引用共享；`observePage` 会把 `chrome.storage.onChanged` 的更新按 URL 分发。
- **URL 规范化（`common/url.js`）**：去除查询参数与哈希片段，生成稳定的页面键；当无法使用 URL 构造函数时，会退回到手动裁剪字符串。
- **注入注册表（`content/injection/core/registry.js`）**：同时跟踪元素描述与实际 DOM 宿主，优先复用现有节点，在位置元数据变化时清理并重建宿主，并通过 `data-*` 属性驱动编辑态。
- **渲染生命周期**：新建宿主立即调用 `applyMetadata`，确保文本、链接与提示气泡内容无需等待即可呈现。

### 已知限制
- 严格的 CSP 可能阻止脚本或样式注入。
- 仅支持增强同源 iframe。
- 对于高度动态的页面，元素可能被临时覆盖，但监听器会重新挂载。
- 动作流程限制为最多 200 步、50 次循环，运行约 10 秒后会被终止。
