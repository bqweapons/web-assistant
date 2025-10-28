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
3. Use the editor bubble to choose a type (button, link, tooltip, or area), adjust text, placement, styles, and optionally attach a URL, mirrored selector, or action flow before saving.
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
|-- manifest.json
|-- service_worker.js
|-- content/
|   |-- content.js
|   |-- inject.js
|   |-- injection/
|   |   |-- constants.js
|   |   |-- dom.js
|   |   |-- flow-runner.js
|   |   |-- registry.js
|   |   |-- style.js
|   |   |-- tooltip.js
|   |   `-- utils.js
|   |-- selector.js
|   |-- bubble/
|   |   |-- element-bubble.js
|   |   |-- editor/
|   |   |   `-- action-flow-controller.js
|   |   |-- layout/
|   |   |-- styles/
|   |   `-- ui/
|   |-- selector/
|   |   |-- frame.js
|   |   |-- overlay.js
|   |   `-- picker.js
|   `-- dist/
|       `-- content.js
|-- sidepanel/
|   |-- sidepanel.html
|   `-- src/
|       |-- App.jsx
|       |-- components/
|       |-- hooks/
|       `-- utils/
`-- common/
    |-- compat.js
    |-- flows.js
    |-- i18n.js
    |-- i18n/
    |   |-- locales/
    |   |   |-- en.js
    |   |   |-- ja.js
    |   |   `-- zh-CN.js
    |   `-- utils.js
    |-- messaging.js
    |-- storage.js
    `-- types.js
```

### Known limitations
- Strict CSP headers may block script/style injection on some hosts.
- Only same-origin `iframe` documents can be augmented.
- Highly dynamic pages may briefly override inserted elements before the observer reinstates them.
- Action flows are capped at 200 steps, 50 loop iterations, and roughly 10 seconds of runtime; longer automations will abort early.

---

## 日本語

### 概要
Page Augmentor は Manifest V3 対応の Chrome 拡張機能です。任意のページにボタン・リンク・ツールチップ・エリアコールアウトを追加し、サイドパネル（Manage / Overview / Settings）からまとめて管理できます。設定内容は URL 単位で `chrome.storage.local` に保存され、再訪時に自動復元されます。

### 特長
- **統合サイドパネル**: Manage・Overview・Settings を切り替えながら編集、全体確認、インポート/エクスポート、言語切り替えを行えます。
- **フレーム対応ピッカー**: 同一オリジンの iframe も含めて DOM をハイライトし、CSS セレクターを自動生成して即座にエディターバブルへ遷移します。
- **リッチな要素タイプ**: ボタン / リンク / ツールチップ / エリアを選び、挿入位置・スタイル・ミラークリック先を細かく調整できます。
- **アクションフロー**: ボタンにクリック・待機・入力・遷移・ログ・条件/ループのステップを連結し、クリック時に自動操作を実行します。
- **永続化と同期**: chrome.storage.local と MutationObserver で再挿入し、タブとサイドパネル間でリアルタイムに状態を共有します。
- **Shadow DOM による分離**: ホストページの重い CSS があっても見た目が崩れません。

### 使い方
1. 拡張アイコンをクリックしてアクティブタブのサイドパネルを開きます。
2. Manage の **Pick target** を押し、強化したい要素（同一オリジンの iframe 内も可）を選択します。
3. エディターバブルでタイプ（ボタン / リンク / ツールチップ / エリア）、テキスト、配置、スタイル、リンクやミラークリック、必要であればアクションフローを設定して保存します。
4. Manage のフィルターと検索で要素を絞り込み、フォーカス、再編集、削除を行います。
5. Overview で保存済みエントリ全体を確認し、新しいタブで開いたり URL ごとに一括削除します。
6. Settings で JSON のインポート/エクスポートや UI 言語の切り替えを行います。

### アクションフロー（任意）
挿入したボタンは、リンクやセレクターのフォールバックに入る前に JSON ベースのフローを実行できます。`steps` 配列に `click`・`wait`・`input`・`navigate`・`log`・`if`・`while` を組み合わせ、最大 200 ステップ（ループ 50 回）・約 10 秒まで動作します。ボタン自身を指定する場合は `:self` を使用します。

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
- `activeTab`, `tabs`, `scripting`: アクティブなページにスクリプトを注入するため。
- `storage`: ページごとの設定を保存するため。
- `sidePanel`: Chrome のサイドパネルに React UI を表示するため。
- `webNavigation`: 同一オリジンのフレームを列挙し、ピッカーと再挿入を iframe まで届かせるため。

ディレクトリ構成の詳細は英語セクションを参照してください。

### 既知の制限
- 厳しい CSP が設定されたサイトではスクリプトやスタイルの注入が拒否される場合があります。
- 強化できるのは同一オリジンの `iframe` のみです。
- DOM が激しく変化するページでは、要素が一時的に上書きされることがありますが監視で再挿入されます。
- アクションフローは最大 200 ステップ / 50 ループ・約 10 秒までに制限されています。

---

## 简体中文

### 概述
Page Augmentor 是一款支持 Manifest V3 的 Chrome 扩展，可在任意网页叠加自定义按钮、链接、提示气泡以及区域标注，并通过侧边栏的 Manage / Overview / Settings 视图统一管理。所有配置按 URL 保存在 `chrome.storage.local` 中，重新访问时会自动恢复。

### 功能亮点
- **统一侧边栏**: 在 Manage、Overview、Settings 之间切换，在同一位置完成编辑、全局浏览、导入/导出与语言切换。
- **支持 iframe 的可视化拾取器**: 高亮页面（含同源 iframe）中的 DOM 节点，自动生成 CSS 选择器并直接打开编辑气泡。
- **丰富的元素类型**: 配置按钮 / 链接 / 提示气泡 / 区域卡片，设置插入位置、样式以及可选的镜像点击目标。
- **动作流程编辑器**: 为按钮串联点击、等待、输入、跳转、日志、条件与循环步骤，在点击时先执行自动化流程。
- **持久化与同步**: 利用 `chrome.storage.local` 与 `MutationObserver` 复原元素，并在标签页与侧边栏之间实时广播更新。
- **Shadow DOM 隔离**: 即便宿主页面样式复杂，自定义元素也能保持外观。

### 使用方法
1. 点击扩展图标，在当前标签页中打开侧边栏。
2. 在 Manage 中点击 **Pick target**，选择需要增强的元素（支持同源 iframe）。
3. 在编辑气泡中选择类型（按钮 / 链接 / 提示气泡 / 区域）、编辑文本、位置、样式，并可选地关联 URL、镜像选择器或动作流程后保存。
4. 使用 Manage 的筛选与搜索功能聚焦、重新编辑或删除每个页面的元素。
5. 切换到 Overview 查看所有存档条目，按 URL 打开页面或批量清理。
6. 在 Settings 中导入/导出 JSON 备份，并切换界面语言。

### 动作流程（可选）
插入的按钮可以在执行链接或镜像选择器之前运行 JSON 描述的流程。`steps` 数组支持 `click`、`wait`、`input`、`navigate`、`log`、`if`、`while` 等步骤，最多 200 步（循环 50 次），执行时间约 10 秒后会自动停止。若需要引用按钮自身，可使用 `:self` 选择器。

```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 所需权限
- `activeTab`, `tabs`, `scripting`: 向当前页面注入并控制脚本。
- `storage`: 按页面保存自定义配置。
- `sidePanel`: 在 Chrome 侧边栏中展示 React UI。
- `webNavigation`: 枚举同源 iframe，以便拾取和重建嵌套文档中的元素。

目录结构详情请参考英文部分。

### 已知限制
- 严格的 CSP 可能会阻止脚本或样式注入。
- 仅支持增强同源的 `iframe` 文档。
- 对于高度动态的页面，元素可能短暂被覆写，随后会通过监听重新插入。
- 动作流程最多 200 步、循环 50 次，运行时间约 10 秒，超过限制会提前终止。
