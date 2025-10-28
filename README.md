# Page Augmentor

[English](#english) / [日本語](#日本誁E / [简体中文](#简体中斁E

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

## 日本誁E
### 概要EPage Augmentor は Manifest V3 対応�E Chrome 拡張機�Eです。任意�Eペ�Eジにボタン・リンク・チE�Eルチップ�Eエリアコールアウトを追加し、サイドパネル�E�Eanage / Overview / Settings�E�からまとめて管琁E��きます。設定�E容は URL 単位で `chrome.storage.local` に保存され、�E訪時に自動復允E��れます、E
### 特長
- **統合サイドパネル**: Manage・Overview・Settings を�Eり替えながら編雁E���E体確認、インポ�EチEエクスポ�Eト、言語�Eり替えを行えます、E- **フレーム対応ピチE��ー**: 同一オリジンの iframe も含めて DOM をハイライトし、CSS セレクターを�E動生成して即座にエチE��ターバブルへ遷移します、E- **リチE��な要素タイチE*: ボタン / リンク / チE�EルチッチE/ エリアを選び、挿入位置・スタイル・ミラークリチE��先を細かく調整できます、E- **アクションフロー**: ボタンにクリチE��・征E���E入力�E遷移・ログ・条件/ループ�EスチE��プを連結し、クリチE��時に自動操作を実行します、E- **永続化と同期**: chrome.storage.local と MutationObserver で再挿入し、タブとサイドパネル間でリアルタイムに状態を共有します、E- **Shadow DOM による刁E��**: ホスト�Eージの重い CSS があっても見た目が崩れません、E
### 使ぁE��
1. 拡張アイコンをクリチE��してアクチE��ブタブ�Eサイドパネルを開きます、E2. Manage の **Pick target** を押し、強化したい要素�E�同一オリジンの iframe 冁E��可�E�を選択します、E3. エチE��ターバブルでタイプ（�Eタン / リンク / チE�EルチッチE/ エリア�E�、テキスト、E�E置、スタイル、リンクめE��ラークリチE��、忁E��であればアクションフローを設定して保存します、E4. Manage のフィルターと検索で要素を絞り込み、フォーカス、�E編雁E��削除を行います、E5. Overview で保存済みエントリ全体を確認し、新しいタブで開いたり URL ごとに一括削除します、E6. Settings で JSON のインポ�EチEエクスポ�Eトや UI 言語�E刁E��替えを行います、E
### アクションフロー�E�任意！E挿入したボタンは、リンクめE��レクターのフォールバックに入る前に JSON ベ�Eスのフローを実行できます。`steps` 配�Eに `click`・`wait`・`input`・`navigate`・`log`・`if`・`while` を絁E��合わせ、最大 200 スチE��プ（ルーチE50 回）�E紁E10 秒まで動作します。�Eタン自身を指定する場合�E `:self` を使用します、E
```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 忁E��な権陁E- `activeTab`, `tabs`, `scripting`: アクチE��ブなペ�Eジにスクリプトを注入するため、E- `storage`: ペ�Eジごとの設定を保存するため、E- `sidePanel`: Chrome のサイドパネルに React UI を表示するため、E- `webNavigation`: 同一オリジンのフレームを�E挙し、ピチE��ーと再挿入めEiframe まで届かせるため、E
チE��レクトリ構�Eの詳細は英語セクションを参照してください、E
### 既知の制陁E- 厳しい CSP が設定されたサイトではスクリプトめE��タイルの注入が拒否される場合があります、E- 強化できるのは同一オリジンの `iframe` のみです、E- DOM が激しく変化するペ�Eジでは、要素が一時的に上書きされることがありますが監視で再挿入されます、E- アクションフローは最大 200 スチE��チE/ 50 ループ�E紁E10 秒までに制限されてぁE��す、E
---

## 简体中斁E
### 概述
Page Augmentor 是一款支持EManifest V3 皁EChrome 扩展，可在任意网页叠加自定义按钮、E��接、提示气泡以及区域栁E���E�并通迁E��边栏的 Manage / Overview / Settings 见E��统一管琁E��所有�E置持EURL 保存在 `chrome.storage.local` 中�E�重新访问时会�E动恢复、E
### 功�E亮点
- **统一侧边栁E*: 在 Manage、Overview、Settings 之间刁E���E�在同一位置完�E编辑、�E局浏览、导入/导出与语言刁E��、E- **支持Eiframe 皁E��见E��拾取器**: 高亮页面�E�含同溁Eiframe�E�中皁EDOM 节点�E��E动生�E CSS 选择器并直接打开编辑气泡、E- **丰富的允E��类垁E*: 配置按钮 / 链接 / 提示气泡 / 区域卡牁E��设置插�E位置、样式以及可选的镜像点击目栁E��E- **动作流程编辑器**: 为按钮串联点击、等征E��输�E、跳转、日志、条件与循环步骤�E�在点击时先执行�E动化流程、E- **持乁E��与同步**: 利用 `chrome.storage.local` 丁E`MutationObserver` 复原允E���E�并在栁E��页与侧边栏之间实时广播更新、E- **Shadow DOM 隔离**: 即便宿主页面样式复杂�E��E定义�E素也�E保持外观、E
### 使用方況E1. 点击扩展图栁E��在当前栁E��页中打开侧边栏、E2. 在 Manage 中点击 **Pick target**�E�选择需要增强皁E�E素�E�支持同溁Eiframe�E�、E3. 在编辑气泡中选择类型（按钮 / 链接 / 提示气泡 / 区域）、编辑文本、位置、样式，并可选地关聁EURL、E��像选择器或动作流程后保存、E4. 使用 Manage 皁E��选与搜索功�E聚焦、E��新编辑�E删除每个页面皁E�E素、E5. 刁E��到 Overview 查看所有存档条目�E�按 URL 打开页面或批量渁E��、E6. 在 Settings 中导入/导出 JSON 夁E���E�并刁E��界面语言、E
### 动作流程（可选！E插�E皁E��钮可以在执行链接或镜像选择器之前运衁EJSON 描述皁E��程。`steps` 数绁E��持E`click`、`wait`、`input`、`navigate`、`log`、`if`、`while` 等步骤�E�最夁E200 步�E�循环 50 次�E�，执行时间约 10 秒后会�E动停止。若需要引用按钮自身�E�可使用 `:self` 选择器、E
```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 所需杁E��
- `activeTab`, `tabs`, `scripting`: 向当前页面注入并控制脚本、E- `storage`: 按页面保存�E定义�E置、E- `sidePanel`: 在 Chrome 侧边栏中展示 React UI、E- `webNavigation`: 枚举同溁Eiframe�E�以便拾取和重建嵌套文档中皁E�E素、E
目录结构详惁E��参老E��斁E��刁E��E
### 已知限制
- 严格皁ECSP 可能会阻止脚本或样式注入、E- 仁E��持增强同源的 `iframe` 斁E��、E- 对于高度动态的页面�E��E素可能短暂被要E�E�E�随后会通迁E��听重新插�E、E- 动作流程最夁E200 步、循环 50 次�E�运行时间约 10 秒，趁E��E��制会提前终止、E

