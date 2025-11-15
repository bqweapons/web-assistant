# Page Augmentor

[English](#english) / [日本語](#日本語) / [简体中文](#简体中文)

---

## English

### Overview
Page Augmentor is a Manifest V3 Chrome extension for layering custom buttons, links, tooltips, and rich callouts onto any web page. You manage everything from the side panel (Manage, Overview, Settings). Every injected element is scoped to its page URL and stored in `chrome.storage.local`, so your customisations reappear automatically whenever you revisit the site.

## Demo Video
[![Demo Video](https://img.youtube.com/vi/-iTlNX4J8FM/maxresdefault.jpg)](https://youtu.be/-iTlNX4J8FM)


### Feature highlights
- **Unified side panel**: Switch between the per-page Manage view, cross-site Overview, and Settings (import/export, language) without leaving Chrome.
- **Frame-aware visual picker**: Highlight DOM nodes in context, including same-origin iframes, auto-generate CSS selectors, and jump straight into the editor bubble.
- **Rich element types**: Configure buttons, links, tooltips, or area callouts with placement (`append`, `prepend`, `before`, `after`), optional mirrored click selectors, and granular styles.
- **Action flow builder**: Chain multi-step automations (`click`, `wait`, `input`, `navigate`, `log`, `if`, `while`) that run before fallback link or selector behaviour when injected buttons are clicked.
- **Drag-friendly areas**: Drop area elements anywhere on the page canvas and Page Augmentor will persist their coordinates automatically; other injected elements can be dropped inside areas as containers.
- **Shadow DOM isolation**: Rendered controls live in a Shadow DOM host so they keep their appearance even when the page ships heavy CSS.
- **Resilient sync and persistence**: Data lives in `chrome.storage.local`; a `MutationObserver` restores hosts after DOM changes and broadcasts updates across tabs and the side panel.

### Installation

```bash
npm install
npm run build
```

1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select the project root.
3. Pin the extension and open the side panel from the toolbar when needed.

To build a distributable zip under `release/`, run:

```bash
npm run package
```

### Usage
1. Click the Page Augmentor icon to open the side panel on the active tab.
2. In **Manage**, press **Pick target** and select the element you want to augment (same-origin iframes are supported).
3. Use the editor bubble to choose a type (button, link, tooltip, or area), adjust text, placement, styles, and optionally attach a URL, mirrored selector, or action flow before saving. Area elements can also be dragged directly on the page to fine-tune their position or act as containers for other injected elements.
4. Use the Manage filters to search, focus injected items, reopen the editor, or remove them per page.
5. Switch to **Overview** to inspect every stored entry, open pages in new tabs, or bulk clear entries by URL.
6. Open **Settings** to import or export JSON backups and switch the interface language.

### Action flows (optional)
Injected buttons can run scripted flows before falling back to an attached link or selector. Flows are defined as JSON with a `steps` array and are validated on save; malformed JSON, invalid selectors, or unsupported step types are rejected instead of being stored. Supported steps include:

- `click`: click a single element or all matches (using `all: true`).
- `wait`: pause for `ms` milliseconds (clamped to a safe limit per step).
- `input`: type into inputs, textareas, or contenteditable elements and dispatch input/change events.
- `navigate`: open a (sanitised) URL in `_blank` or a custom target.
- `log`: print messages to the page console for debugging.
- `if`: evaluate a condition once and run either `thenSteps` or `elseSteps`.
- `while`: repeat `bodySteps` while a condition remains true, up to a capped iteration count.

Conditions can be composed from `exists`, `not`, `textContains`, and `attributeEquals`. Flows execute in the active frame (including same-origin iframes) with limits of 200 steps in total, 50 loop iterations, and roughly 10 seconds of runtime. Use the special selector `:self` when a step should interact with the injected button itself.

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

Example: a login button flow that fills the username and password and then clicks **Sign up**:

![Login button action flow sample](docs/button%20sample.gif)

See `AGENTS.md` for the full action-flow reference, including step fields, condition shapes, runtime limits, and authoring tips.

### Permissions
- `tabs`: Read the active tab, open or focus pages from the side panel, and keep the UI in sync.
- `storage`: Persist per-page augmentation metadata under a single storage key.
- `sidePanel`: Expose the React management UI inside Chrome's side panel (with a tab fallback when the API is unavailable).
- `webNavigation`: Enumerate same-origin frames so pickers and reinjection reach nested documents.
- `host_permissions` (`<all_urls>`): Allow users to inject elements on any site they choose.

### Project structure (excerpt)

```text
.
├─ manifest.json
├─ service_worker.js
├─ content/
│  ├─ app/
│  │  ├─ content.js              # content script entry
│  │  ├─ context.js              # shared runtime + state
│  │  ├─ page-url.js             # URL normalisation for this frame
│  │  ├─ hydration.js            # fetch + render elements per frame
│  │  ├─ mutation-watcher.js     # DOM observer + registry reconcile
│  │  ├─ autosave.js             # drag/placement autosave
│  │  ├─ picker.js               # element picker wiring
│  │  ├─ creation.js             # new element flows & area drops
│  │  ├─ editor.js               # inline editor bubble & preview
│  │  ├─ editing-mode.js         # edit-mode toggle behaviour
│  │  ├─ frame.js                # frame matching helpers
│  │  └─ highlight.js            # transient placement highlight
│  ├─ inject.js                  # injection facade (registry wrappers)
│  ├─ injection/
│  │  ├─ core/
│  │  │  ├─ constants.js         # host attributes, flow limits, z-indices
│  │  │  ├─ registry.js          # in-page registry of elements + hosts
│  │  │  ├─ flow-runner.js       # runtime executor for parsed flows
│  │  │  └─ utils.js             # click forwarding, URL sanitisation
│  │  ├─ host/                   # host node + Shadow DOM creation
│  │  ├─ interactions/
│  │  │  ├─ drag/                # drag behaviour + floating placement
│  │  │  ├─ drop/                # DOM vs. area drop targets & previews
│  │  │  └─ resize/              # resizable areas
│  │  ├─ orchestrator/           # applyMetadata, insertion strategies
│  │  └─ ui/                     # style application & tooltip helpers
│  ├─ bubble/
│  │  ├─ element-bubble.js       # lightweight in-page editor bubble
│  │  ├─ editor/action-flow-controller.js
│  │  ├─ actionflow/{builder,serializer,parser-bridge}.js
│  │  └─ ...
│  ├─ selector.js                # picker entry
│  ├─ selector/                  # overlay + frame utilities
│  └─ dist/content.js            # built content bundle
├─ sidepanel/
│  ├─ sidepanel.html
│  ├─ dist/index.{js,css}        # built React side panel
│  └─ src/                       # React app (App.jsx, hooks, components)
├─ common/
│  ├─ messaging.js               # shared messaging helpers
│  ├─ storage.js                 # storage helpers for injected elements
│  ├─ url.js                     # normalised page keys
│  ├─ flows.js                   # flow parsing + normalisation
│  └─ i18n/*.js                  # shared locale store & messages
└─ docs/PRIVACY-POLICY.md        # standalone privacy policy text
```

### Runtime architecture overview
- **Messaging layer (`common/messaging.js`)**: Wraps `chrome.runtime.sendMessage` and port connections so every context exchanges `{ ok, data | error }` payloads. Async handlers are normalised to promises, letting the side panel, background service worker, and content scripts share identical request patterns.
- **Persistent store (`common/storage.js`)**: Keeps all injected element metadata under a single `injectedElements` key. Update helpers clone payloads (including nested style/frame fields) to avoid shared references, while `observePage` fans out `chrome.storage.onChanged` events by URL.
- **URL normalisation (`common/url.js`)**: Produces stable page keys by stripping query strings and hashes, falling back to manual trimming when the URL constructor is unavailable.
- **Flow parsing (`common/flows.js`)**: Validates action-flow JSON, normalises shorthand fields, enforces limits on steps/iterations/delays, and surfaces human-readable errors back into the editor and service worker.
- **Injection registry (`content/injection/core/registry.js`)**: Tracks element descriptors alongside live host nodes, reuses existing DOM hosts when possible, toggles editing state via `data-*` attributes, and rebuilds hosts whenever placement metadata changes.
- **Host & Shadow DOM (`content/injection/host/create-host.js`)**: Creates the wrapper element and Shadow DOM scaffold, ensures area nodes get resize handles, and applies base appearance to buttons/links/tooltips/areas.
- **Interactions (`content/injection/interactions/*`)**: Provide drag, drop, and resize behaviour for floating hosts and areas, dispatching draft updates back to the autosave layer.
- **Content runtime (`content/app/*.js`)**: Hydrates elements per frame, listens for storage changes, coordinates pickers and editor sessions, and applies autosaved movement/resizing.

### Privacy and store listing
- `docs/PRIVACY-POLICY.md`: Privacy policy text you can host separately and link from the Chrome Web Store “Privacy policy URL” field.

### Known limitations
- Strict CSP headers may block script or style injection on some hosts.
- Only same-origin iframe documents can be augmented.
- Highly dynamic pages may briefly override inserted elements before the observer reinstates them.
- Action flows are capped at 200 steps, 50 loop iterations, and roughly 10 seconds of runtime; longer automations will abort early.

---

## 日本語

### 概要
ボタン追加とアクションフロー設定の短いデモ動画: https://youtu.be/-iTlNX4J8FM
Page Augmentor は Manifest V3 対応の Chrome 拡張機能で、任意の Web ページにカスタムボタン、リンク、ツールチップ、エリアコールアウトを重ねて表示できます。サイドパネルの Manage / Overview / Settings から一元管理され、挿入した要素はページ URL ごとに `chrome.storage.local` に保存されるため、同じサイトへ再訪すると自動で復元されます。

### 主な機能
- **統合サイドパネル**: Manage・Overview・Settings（インポート / エクスポート・言語切り替え）を Chrome を離れずに操作できます。
- **iframe 対応ピッカー**: DOM ノードをページ上でハイライトし（同一オリジンの iframe を含む）、CSS セレクターを自動生成して編集バブルを即座に開きます。
- **多彩な要素タイプ**: ボタン・リンク・ツールチップ・エリアコールアウトを配置でき、`append` / `prepend` / `before` / `after` の挿入位置やミラークリック用セレクター、細かなスタイルを設定できます。
- **アクションフロービルダー**: クリック・待機・入力・ナビゲート・ログ・条件分岐 / ループなど複数ステップを連結し、ボタンがリンクやセレクターへフォールバックする前に自動処理を実行できます。
- **ドラッグしやすいエリア要素**: エリア要素をページ上でドラッグ & ドロップすると座標が自動保存され、他の要素をその中に配置してコンテナとして利用できます。
- **Shadow DOM による隔離**: ホストページ側の重い CSS に影響されず、レンダリングしたコントロールの見た目を保てます。
- **堅牢な同期と永続化**: データは `chrome.storage.local` に保存され、`MutationObserver` が DOM 変化を監視して再挿入し、タブとサイドパネル間で更新をブロードキャストします。

### インストール
```bash
npm install
npm run build
```
1. `chrome://extensions/` を開き、**デベロッパーモード** をオンにします。
2. **パッケージ化されていない拡張機能を読み込む** をクリックし、プロジェクトルートを選択します。
3. 必要に応じてツールバーからサイドパネルをピン留めします。

ZIP としてパッケージ化する場合は、次を実行します。

```bash
npm run package
```

### 使い方
1. 拡張アイコンをクリックしてアクティブタブにサイドパネルを開きます。
2. **Manage** で **Pick target** を押し、強化したい要素（同一オリジンの iframe 内も可）を選択します。
3. 編集バブルでタイプ、テキスト、配置、スタイル、リンクやミラークリック、任意のアクションフローを設定します。エリア要素はドラッグして位置調整でき、他の要素を中に配置できます。
4. Manage のフィルターと検索で要素を絞り込み、フォーカス・再編集・削除を行います。
5. **Overview** で保存済みエントリを一覧し、新規タブで開いたり URL ごとにまとめて削除したりできます。
6. **Settings** では JSON のインポート / エクスポートと UI 言語の切り替えが行えます。

### アクションフロー（任意）
挿入したボタンは、リンクやミラーセレクターにフォールバックする前にスクリプト化されたフローを実行できます。`steps` 配列を含む JSON を入力すると保存時に検証され、構文エラーや不正なセレクター、未対応のステップは保存時に拒否されます。サポートされるステップは `click` / `wait` / `input` / `navigate` / `log` / `if` / `while` で、条件は `exists` / `not` / `textContains` / `attributeEquals` から組み立てます。フローはアクティブなフレーム（同一オリジンの iframe を含む）内でのみ実行され、最大 200 ステップ・ループは 50 回まで・およそ 10 秒でタイムアウトします。ボタン自身を操作する場合は `:self` セレクターを使用してください。

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

より詳しい仕様やベストプラクティスは `AGENTS.md` を参照してください。

### 必要な権限
- `tabs`: アクティブなページの URL を取得し、タブを開いたりフォーカスを切り替えてサイドパネルと同期するため。
- `storage`: ページごとの設定を保存するため。
- `sidePanel`: Chrome のサイドパネル内に React UI を表示するため。
- `webNavigation`: 同一オリジンのフレームを列挙し、ピッカーと再挿入を iframe まで届けるため。

### ランタイム構成の概要
- **メッセージング層（`common/messaging.js`）**: `chrome.runtime.sendMessage` と Port 接続をラップし、すべてのコンテキストが `{ ok, data | error }` 形式で通信できるようにします。
- **永続ストア（`common/storage.js`）**: 注入要素メタデータを `injectedElements` キーに集約し、入れ子プロパティまで複製して共有参照を避けつつ、`observePage` が URL ごとに差分を配信します。
- **URL 正規化（`common/url.js`）**: クエリ文字列とハッシュを除去して安定したページキーを生成し、URL コンストラクタが利用できない環境では手動トリミングにフォールバックします。
- **フロー解析（`common/flows.js`）**: アクションフロー JSON を検証・正規化し、ステップ数やループ回数・待機時間の上限を強制しながらエラーメッセージを返します。
- **注入レジストリ（`content/injection/core/registry.js`）**: 要素ディスクリプターと DOM 上のホストノードを同期し、既存ホストの再利用や編集状態の切り替え、配置変更時の再構築を行います。
- **ホスト & Shadow DOM（`content/injection/host/create-host.js`）**: ラッパー要素と Shadow DOM を構築し、ボタン / リンク / ツールチップ / エリアに適切な初期外観とリサイズハンドルを付与します。
- **インタラクション（`content/injection/interactions/*`）**: ドラッグ・ドロップ・リサイズの挙動を提供し、ドラフト更新を自動保存レイヤーへ反映します。
- **コンテンツランタイム（`content/app/*.js`）**: フレームごとに要素をハイドレートし、ストレージ変更やピッカー / エディタの状態を監視します。

### 既知の制限
- 厳しい CSP を持つサイトではスクリプトやスタイルの注入が拒否される場合があります。
- 強化できるのは同一オリジンの iframe のみです。
- DOM が激しく変化するページでは、要素が一時的に上書きされることがありますが監視によって再挿入されます。
- アクションフローは最大 200 ステップ / 50 ループ・約 10 秒までに制限されており、制限を超えると停止します。

---

## 简体中文

### 概述
按钮与动作流程配置演示视频: https://youtu.be/-iTlNX4J8FM
Page Augmentor 是一款基于 Manifest V3 的 Chrome 扩展，可以在任意网页上叠加自定义按钮、链接、提示气泡和区域标注。所有元素都通过侧边栏的 Manage / Overview / Settings 视图集中管理，并按页面 URL 存储在 `chrome.storage.local` 中，在你再次访问同一站点时会自动恢复。

### 功能亮点
- **统一侧边栏**：在 Manage、Overview、Settings（导入 / 导出、语言切换）之间自由切换，无需离开 Chrome。
- **支持 iframe 的可视化拾取器**：高亮页面上的 DOM 节点（包含同源 iframe），自动生成 CSS 选择器并立即打开编辑气泡。
- **丰富的元素类型**：支持按钮、链接、提示气泡及区域标注，可选择 `append` / `prepend` / `before` / `after` 插入位置，配置镜像点击选择器，并精细控制样式。
- **动作流程构建器**：将点击、等待、输入、跳转、日志、条件和循环等步骤串联起来，在按钮回退到链接或选择器前优先执行自动化流程。
- **拖拽友好的区域元素**：区域元素可以在页面画布上自由拖动，其坐标会自动保存，其他元素也可以放入区域中作为子项。
- **Shadow DOM 隔离**：即使宿主页面样式复杂，自定义控件的外观也能保持稳定。
- **可靠的同步与持久化**：数据存储在 `chrome.storage.local` 中并在加载时恢复；`MutationObserver` 监听 DOM 变化并自动重新挂载，同时向所有相关标签页和侧边栏广播更新。

### 安装
```bash
npm install
npm run build
```
1. 打开 `chrome://extensions/`。
2. 启用 **开发者模式**，点击 **加载已解压的扩展程序**。
3. 选择项目根目录，并按需将扩展固定到工具栏中以便快捷打开侧边栏。

如需打包为 ZIP 文件，可执行：

```bash
npm run package
```

### 使用步骤
1. 点击 Page Augmentor 图标，在当前标签页中打开侧边栏。
2. 在 **Manage** 中点击 **Pick target**，选择需要增强的元素（支持同源 iframe）。
3. 在编辑气泡中设置类型、文本、位置、样式，并可选配置 URL、镜像点击选择器或动作流程。区域元素可以直接在页面上拖动微调位置，也可以作为容器承载其它注入元素。
4. 使用 Manage 中的过滤与搜索功能查找元素，并进行聚焦、重新编辑或按页面删除。
5. 切换到 **Overview** 查看所有已保存的条目，可按 URL 在新标签页打开或批量清理。
6. 在 **Settings** 中导入 / 导出 JSON 备份并切换界面语言。

### 动作流程（可选）
按钮在回退到链接或镜像选择器之前，可以先执行一段脚本化的动作流程。流程使用带有 `steps` 数组的 JSON 定义，保存时会自动校验：解析失败的 JSON、无效选择器或不支持的步骤类型会被拒绝。支持的步骤类型包括 `click`、`wait`、`input`、`navigate`、`log`、`if` 和 `while`，条件由 `exists`、`not`、`textContains`、`attributeEquals` 组合而成。流程只在当前活动帧内运行（包含同源 iframe），最多 200 步，总循环次数不超过 50，整体运行时间约 10 秒；超过限制会被安全中止。若需要在流程中引用按钮自身，请使用特殊选择器 `:self`。

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

更多步骤字段说明、条件表达式示例和最佳实践，请参见 `AGENTS.md`。

### 权限说明
- `tabs`：用于读取当前活动标签页的 URL、打开或切换标签页，并与侧边栏保持同步。
- `storage`：用于按页面存储所有自定义元素的配置。
- `sidePanel`：用于在 Chrome 侧边栏中展示 React 管理界面。
- `webNavigation`：用于枚举同源 iframe，使拾取器和重新挂载逻辑能访问嵌套文档。

### 运行时结构概要
- **消息层（`common/messaging.js`）**：封装 `chrome.runtime.sendMessage` 和 Port 连接，统一使用 `{ ok, data | error }` 结构在各执行环境之间传递结果，侧边栏、后台 Service Worker 与内容脚本共用相同的异步调用模式。
- **持久化存储（`common/storage.js`）**：把所有注入元素元数据集中存放在 `injectedElements` 键下，写入前会复制样式和 `frameSelectors` 等子字段以避免引用共享；`observePage` 会按 URL 将 `chrome.storage.onChanged` 的变更分发出去。
- **URL 规范化（`common/url.js`）**：去除查询参数和哈希片段以生成稳定的页面键，在无法使用 URL 构造函数时退回到手动裁剪字符串。
- **流程解析（`common/flows.js`）**：验证动作流程 JSON，规范化字段名和默认值，并强制执行步骤数 / 循环次数 / 等待时间等上限，同时向编辑界面和 Service Worker 提供可读的错误信息。
- **注入注册表（`content/injection/core/registry.js`）**：同时跟踪元素描述与实际 DOM 宿主节点，优先复用现有宿主，在位置元数据变化时移除并重建宿主，通过 `data-*` 属性控制编辑态。
- **宿主 & Shadow DOM（`content/injection/host/create-host.js`）**：负责创建包装元素和 Shadow DOM 结构，为按钮 / 链接 / 提示气泡 / 区域应用初始外观和尺寸控制。
- **交互层（`content/injection/interactions/*`）**：提供拖拽、放置和尺寸调整行为，并将草稿更新回自动保存层。
- **内容运行时（`content/app/*.js`）**：在各帧中挂载元素、监听存储变化，并协调拾取器与编辑器会话。

### 已知限制
- 严格的 CSP 可能会阻止脚本或样式注入。
- 当前仅支持增强同源 iframe。
- 对于高度动态的页面，自定义元素可能会被临时覆盖，但监视器会自动重新挂载。
- 动作流程限制为最多 200 步、50 次循环，累计运行时间约 10 秒，超出后会被终止。

