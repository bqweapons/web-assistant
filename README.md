# Page Augmentor

[English](#english) / [譌･譛ｬ隱枉(#譌･譛ｬ隱・ / [邂菴謎ｸｭ譁Ⅹ(#邂菴謎ｸｭ譁・

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

## 譌･譛ｬ隱・
### 讎りｦ・Page Augmentor 縺ｯ Manifest V3 蟇ｾ蠢懊・ Chrome 諡｡蠑ｵ讖溯・縺ｧ縺吶ゆｻｻ諢上・繝壹・繧ｸ縺ｫ繝懊ち繝ｳ繝ｻ繝ｪ繝ｳ繧ｯ繝ｻ繝・・繝ｫ繝√ャ繝励・繧ｨ繝ｪ繧｢繧ｳ繝ｼ繝ｫ繧｢繧ｦ繝医ｒ霑ｽ蜉縺励√し繧､繝峨ヱ繝阪Ν・・anage / Overview / Settings・峨°繧峨∪縺ｨ繧√※邂｡逅・〒縺阪∪縺吶りｨｭ螳壼・螳ｹ縺ｯ URL 蜊倅ｽ阪〒 `chrome.storage.local` 縺ｫ菫晏ｭ倥＆繧後∝・險ｪ譎ゅ↓閾ｪ蜍募ｾｩ蜈・＆繧後∪縺吶・
### 迚ｹ髟ｷ
- **邨ｱ蜷医し繧､繝峨ヱ繝阪Ν**: Manage繝ｻOverview繝ｻSettings 繧貞・繧頑崛縺医↑縺後ｉ邱ｨ髮・∝・菴鍋｢ｺ隱阪√う繝ｳ繝昴・繝・繧ｨ繧ｯ繧ｹ繝昴・繝医∬ｨ隱槫・繧頑崛縺医ｒ陦後∴縺ｾ縺吶・- **繝輔Ξ繝ｼ繝蟇ｾ蠢懊ヴ繝・き繝ｼ**: 蜷御ｸ繧ｪ繝ｪ繧ｸ繝ｳ縺ｮ iframe 繧ょ性繧√※ DOM 繧偵ワ繧､繝ｩ繧､繝医＠縲，SS 繧ｻ繝ｬ繧ｯ繧ｿ繝ｼ繧定・蜍慕函謌舌＠縺ｦ蜊ｳ蠎ｧ縺ｫ繧ｨ繝・ぅ繧ｿ繝ｼ繝舌ヶ繝ｫ縺ｸ驕ｷ遘ｻ縺励∪縺吶・- **繝ｪ繝・メ縺ｪ隕∫ｴ繧ｿ繧､繝・*: 繝懊ち繝ｳ / 繝ｪ繝ｳ繧ｯ / 繝・・繝ｫ繝√ャ繝・/ 繧ｨ繝ｪ繧｢繧帝∈縺ｳ縲∵諺蜈･菴咲ｽｮ繝ｻ繧ｹ繧ｿ繧､繝ｫ繝ｻ繝溘Λ繝ｼ繧ｯ繝ｪ繝・け蜈医ｒ邏ｰ縺九￥隱ｿ謨ｴ縺ｧ縺阪∪縺吶・- **繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝輔Ο繝ｼ**: 繝懊ち繝ｳ縺ｫ繧ｯ繝ｪ繝・け繝ｻ蠕・ｩ溘・蜈･蜉帙・驕ｷ遘ｻ繝ｻ繝ｭ繧ｰ繝ｻ譚｡莉ｶ/繝ｫ繝ｼ繝励・繧ｹ繝・ャ繝励ｒ騾｣邨舌＠縲√け繝ｪ繝・け譎ゅ↓閾ｪ蜍墓桃菴懊ｒ螳溯｡後＠縺ｾ縺吶・- **豌ｸ邯壼喧縺ｨ蜷梧悄**: chrome.storage.local 縺ｨ MutationObserver 縺ｧ蜀肴諺蜈･縺励√ち繝悶→繧ｵ繧､繝峨ヱ繝阪Ν髢薙〒繝ｪ繧｢繝ｫ繧ｿ繧､繝縺ｫ迥ｶ諷九ｒ蜈ｱ譛峨＠縺ｾ縺吶・- **Shadow DOM 縺ｫ繧医ｋ蛻・屬**: 繝帙せ繝医・繝ｼ繧ｸ縺ｮ驥阪＞ CSS 縺後≠縺｣縺ｦ繧りｦ九◆逶ｮ縺悟ｴｩ繧後∪縺帙ｓ縲・
### 菴ｿ縺・婿
1. 諡｡蠑ｵ繧｢繧､繧ｳ繝ｳ繧偵け繝ｪ繝・け縺励※繧｢繧ｯ繝・ぅ繝悶ち繝悶・繧ｵ繧､繝峨ヱ繝阪Ν繧帝幕縺阪∪縺吶・2. Manage 縺ｮ **Pick target** 繧呈款縺励∝ｼｷ蛹悶＠縺溘＞隕∫ｴ・亥酔荳繧ｪ繝ｪ繧ｸ繝ｳ縺ｮ iframe 蜀・ｂ蜿ｯ・峨ｒ驕ｸ謚槭＠縺ｾ縺吶・3. 繧ｨ繝・ぅ繧ｿ繝ｼ繝舌ヶ繝ｫ縺ｧ繧ｿ繧､繝暦ｼ医・繧ｿ繝ｳ / 繝ｪ繝ｳ繧ｯ / 繝・・繝ｫ繝√ャ繝・/ 繧ｨ繝ｪ繧｢・峨√ユ繧ｭ繧ｹ繝医・・鄂ｮ縲√せ繧ｿ繧､繝ｫ縲√Μ繝ｳ繧ｯ繧・Α繝ｩ繝ｼ繧ｯ繝ｪ繝・け縲∝ｿ・ｦ√〒縺ゅｌ縺ｰ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝輔Ο繝ｼ繧定ｨｭ螳壹＠縺ｦ菫晏ｭ倥＠縺ｾ縺吶・4. Manage 縺ｮ繝輔ぅ繝ｫ繧ｿ繝ｼ縺ｨ讀懃ｴ｢縺ｧ隕∫ｴ繧堤ｵ槭ｊ霎ｼ縺ｿ縲√ヵ繧ｩ繝ｼ繧ｫ繧ｹ縲∝・邱ｨ髮・∝炎髯､繧定｡後＞縺ｾ縺吶・5. Overview 縺ｧ菫晏ｭ俶ｸ医∩繧ｨ繝ｳ繝医Μ蜈ｨ菴薙ｒ遒ｺ隱阪＠縲∵眠縺励＞繧ｿ繝悶〒髢九＞縺溘ｊ URL 縺斐→縺ｫ荳諡ｬ蜑企勁縺励∪縺吶・6. Settings 縺ｧ JSON 縺ｮ繧､繝ｳ繝昴・繝・繧ｨ繧ｯ繧ｹ繝昴・繝医ｄ UI 險隱槭・蛻・ｊ譖ｿ縺医ｒ陦後＞縺ｾ縺吶・
### 繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝輔Ο繝ｼ・井ｻｻ諢擾ｼ・謖ｿ蜈･縺励◆繝懊ち繝ｳ縺ｯ縲√Μ繝ｳ繧ｯ繧・そ繝ｬ繧ｯ繧ｿ繝ｼ縺ｮ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ縺ｫ蜈･繧句燕縺ｫ JSON 繝吶・繧ｹ縺ｮ繝輔Ο繝ｼ繧貞ｮ溯｡後〒縺阪∪縺吶Ａsteps` 驟榊・縺ｫ `click`繝ｻ`wait`繝ｻ`input`繝ｻ`navigate`繝ｻ`log`繝ｻ`if`繝ｻ`while` 繧堤ｵ・∩蜷医ｏ縺帙∵怙螟ｧ 200 繧ｹ繝・ャ繝暦ｼ医Ν繝ｼ繝・50 蝗橸ｼ峨・邏・10 遘偵∪縺ｧ蜍穂ｽ懊＠縺ｾ縺吶ゅ・繧ｿ繝ｳ閾ｪ霄ｫ繧呈欠螳壹☆繧句ｴ蜷医・ `:self` 繧剃ｽｿ逕ｨ縺励∪縺吶・
```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 蠢・ｦ√↑讓ｩ髯・- `activeTab`, `tabs`, `scripting`: 繧｢繧ｯ繝・ぅ繝悶↑繝壹・繧ｸ縺ｫ繧ｹ繧ｯ繝ｪ繝励ヨ繧呈ｳｨ蜈･縺吶ｋ縺溘ａ縲・- `storage`: 繝壹・繧ｸ縺斐→縺ｮ險ｭ螳壹ｒ菫晏ｭ倥☆繧九◆繧√・- `sidePanel`: Chrome 縺ｮ繧ｵ繧､繝峨ヱ繝阪Ν縺ｫ React UI 繧定｡ｨ遉ｺ縺吶ｋ縺溘ａ縲・- `webNavigation`: 蜷御ｸ繧ｪ繝ｪ繧ｸ繝ｳ縺ｮ繝輔Ξ繝ｼ繝繧貞・謖吶＠縲√ヴ繝・き繝ｼ縺ｨ蜀肴諺蜈･繧・iframe 縺ｾ縺ｧ螻翫°縺帙ｋ縺溘ａ縲・
繝・ぅ繝ｬ繧ｯ繝医Μ讒区・縺ｮ隧ｳ邏ｰ縺ｯ闍ｱ隱槭そ繧ｯ繧ｷ繝ｧ繝ｳ繧貞盾辣ｧ縺励※縺上□縺輔＞縲・
### 譌｢遏･縺ｮ蛻ｶ髯・- 蜴ｳ縺励＞ CSP 縺瑚ｨｭ螳壹＆繧後◆繧ｵ繧､繝医〒縺ｯ繧ｹ繧ｯ繝ｪ繝励ヨ繧・せ繧ｿ繧､繝ｫ縺ｮ豕ｨ蜈･縺梧拠蜷ｦ縺輔ｌ繧句ｴ蜷医′縺ゅｊ縺ｾ縺吶・- 蠑ｷ蛹悶〒縺阪ｋ縺ｮ縺ｯ蜷御ｸ繧ｪ繝ｪ繧ｸ繝ｳ縺ｮ `iframe` 縺ｮ縺ｿ縺ｧ縺吶・- DOM 縺梧ｿ縺励￥螟牙喧縺吶ｋ繝壹・繧ｸ縺ｧ縺ｯ縲∬ｦ∫ｴ縺御ｸ譎ら噪縺ｫ荳頑嶌縺阪＆繧後ｋ縺薙→縺後≠繧翫∪縺吶′逶｣隕悶〒蜀肴諺蜈･縺輔ｌ縺ｾ縺吶・- 繧｢繧ｯ繧ｷ繝ｧ繝ｳ繝輔Ο繝ｼ縺ｯ譛螟ｧ 200 繧ｹ繝・ャ繝・/ 50 繝ｫ繝ｼ繝励・邏・10 遘偵∪縺ｧ縺ｫ蛻ｶ髯舌＆繧後※縺・∪縺吶・
---

## 邂菴謎ｸｭ譁・
### 讎りｿｰ
Page Augmentor 譏ｯ荳谺ｾ謾ｯ謖・Manifest V3 逧・Chrome 謇ｩ螻包ｼ悟庄蝨ｨ莉ｻ諢冗ｽ鷹｡ｵ蜿蜉閾ｪ螳壻ｹ画潔髓ｮ縲・得謗･縲∵署遉ｺ豌疲ｳ｡莉･蜿雁玄蝓滓・ｳｨ・悟ｹｶ騾夊ｿ・ｾｧ霎ｹ譬冗噪 Manage / Overview / Settings 隗・崟扈滉ｸ邂｡逅・よ園譛蛾・鄂ｮ謖・URL 菫晏ｭ伜惠 `chrome.storage.local` 荳ｭ・碁㍾譁ｰ隶ｿ髣ｮ譌ｶ莨夊・蜉ｨ諱｢螟阪・
### 蜉溯・莠ｮ轤ｹ
- **扈滉ｸ萓ｧ霎ｹ譬・*: 蝨ｨ Manage縲＾verview縲ヾettings 荵矩龍蛻・困・悟惠蜷御ｸ菴咲ｽｮ螳梧・郛冶ｾ代∝・螻豬剰ｧ医∝ｯｼ蜈･/蟇ｼ蜃ｺ荳手ｯｭ險蛻・困縲・- **謾ｯ謖・iframe 逧・庄隗・喧諡ｾ蜿門勣**: 鬮倅ｺｮ鬘ｵ髱｢・亥性蜷梧ｺ・iframe・我ｸｭ逧・DOM 闃らせ・瑚・蜉ｨ逕滓・ CSS 騾画叫蝎ｨ蟷ｶ逶ｴ謗･謇灘ｼ郛冶ｾ第ｰ疲ｳ｡縲・- **荳ｰ蟇檎噪蜈・ｴ邀ｻ蝙・*: 驟咲ｽｮ謖蛾聴 / 體ｾ謗･ / 謠千､ｺ豌疲ｳ｡ / 蛹ｺ蝓溷今迚・ｼ瑚ｮｾ鄂ｮ謠貞・菴咲ｽｮ縲∵ｷ蠑丈ｻ･蜿雁庄騾臥噪髟懷ワ轤ｹ蜃ｻ逶ｮ譬・・- **蜉ｨ菴懈ｵ∫ｨ狗ｼ冶ｾ大勣**: 荳ｺ謖蛾聴荳ｲ閨皮せ蜃ｻ縲∫ｭ牙ｾ・∬ｾ灘・縲∬ｷｳ霓ｬ縲∵律蠢励∵擅莉ｶ荳主ｾｪ邇ｯ豁･鬪､・悟惠轤ｹ蜃ｻ譌ｶ蜈域鴬陦瑚・蜉ｨ蛹匁ｵ∫ｨ九・- **謖∽ｹ・喧荳主酔豁･**: 蛻ｩ逕ｨ `chrome.storage.local` 荳・`MutationObserver` 螟榊次蜈・ｴ・悟ｹｶ蝨ｨ譬・ｭｾ鬘ｵ荳惹ｾｧ霎ｹ譬丈ｹ矩龍螳樊慮蟷ｿ謦ｭ譖ｴ譁ｰ縲・- **Shadow DOM 髫皮ｦｻ**: 蜊ｳ萓ｿ螳ｿ荳ｻ鬘ｵ髱｢譬ｷ蠑丞､肴揩・瑚・螳壻ｹ牙・邏荵溯・菫晄戟螟冶ｧゅ・
### 菴ｿ逕ｨ譁ｹ豕・1. 轤ｹ蜃ｻ謇ｩ螻募崟譬・ｼ悟惠蠖灘燕譬・ｭｾ鬘ｵ荳ｭ謇灘ｼ萓ｧ霎ｹ譬上・2. 蝨ｨ Manage 荳ｭ轤ｹ蜃ｻ **Pick target**・碁画叫髴隕∝｢槫ｼｺ逧・・邏・域髪謖∝酔貅・iframe・峨・3. 蝨ｨ郛冶ｾ第ｰ疲ｳ｡荳ｭ騾画叫邀ｻ蝙具ｼ域潔髓ｮ / 體ｾ謗･ / 謠千､ｺ豌疲ｳ｡ / 蛹ｺ蝓滂ｼ峨∫ｼ冶ｾ第枚譛ｬ縲∽ｽ咲ｽｮ縲∵ｷ蠑擾ｼ悟ｹｶ蜿ｯ騾牙慍蜈ｳ閨・URL縲・復蜒城画叫蝎ｨ謌門勘菴懈ｵ∫ｨ句錘菫晏ｭ倥・4. 菴ｿ逕ｨ Manage 逧・ｭ幃我ｸ取頗邏｢蜉溯・閨夂┬縲・㍾譁ｰ郛冶ｾ第・蛻髯､豈丈ｸｪ鬘ｵ髱｢逧・・邏縲・5. 蛻・困蛻ｰ Overview 譟･逵区園譛牙ｭ俶｡｣譚｡逶ｮ・梧潔 URL 謇灘ｼ鬘ｵ髱｢謌匁音驥乗ｸ・炊縲・6. 蝨ｨ Settings 荳ｭ蟇ｼ蜈･/蟇ｼ蜃ｺ JSON 螟・ｻｽ・悟ｹｶ蛻・困逡碁擇隸ｭ險縲・
### 蜉ｨ菴懈ｵ∫ｨ具ｼ亥庄騾会ｼ・謠貞・逧・潔髓ｮ蜿ｯ莉･蝨ｨ謇ｧ陦碁得謗･謌夜復蜒城画叫蝎ｨ荵句燕霑占｡・JSON 謠剰ｿｰ逧・ｵ∫ｨ九Ａsteps` 謨ｰ扈・髪謖・`click`縲～wait`縲～input`縲～navigate`縲～log`縲～if`縲～while` 遲画ｭ･鬪､・梧怙螟・200 豁･・亥ｾｪ邇ｯ 50 谺｡・会ｼ梧鴬陦梧慮髣ｴ郤ｦ 10 遘貞錘莨夊・蜉ｨ蛛懈ｭ｢縲り凶髴隕∝ｼ慕畑謖蛾聴閾ｪ霄ｫ・悟庄菴ｿ逕ｨ `:self` 騾画叫蝎ｨ縲・
```json
{
  "steps": [
    { "type": "click", "selector": "#login" },
    { "type": "wait", "ms": 500 },
    { "type": "input", "selector": "#otp", "value": "123456" }
  ]
}
```

### 謇髴譚・剞
- `activeTab`, `tabs`, `scripting`: 蜷大ｽ灘燕鬘ｵ髱｢豕ｨ蜈･蟷ｶ謗ｧ蛻ｶ閼壽悽縲・- `storage`: 謖蛾｡ｵ髱｢菫晏ｭ倩・螳壻ｹ蛾・鄂ｮ縲・- `sidePanel`: 蝨ｨ Chrome 萓ｧ霎ｹ譬丈ｸｭ螻慕､ｺ React UI縲・- `webNavigation`: 譫壻ｸｾ蜷梧ｺ・iframe・御ｻ･萓ｿ諡ｾ蜿門柱驥榊ｻｺ蠏悟･玲枚譯｣荳ｭ逧・・邏縲・
逶ｮ蠖慕ｻ捺桷隸ｦ諠・ｯｷ蜿り・恭譁・Κ蛻・・
### 蟾ｲ遏･髯仙宛
- 荳･譬ｼ逧・CSP 蜿ｯ閭ｽ莨夐仆豁｢閼壽悽謌匁ｷ蠑乗ｳｨ蜈･縲・- 莉・髪謖∝｢槫ｼｺ蜷梧ｺ千噪 `iframe` 譁・｡｣縲・- 蟇ｹ莠朱ｫ伜ｺｦ蜉ｨ諤∫噪鬘ｵ髱｢・悟・邏蜿ｯ閭ｽ遏ｭ證り｢ｫ隕・・・碁囂蜷惹ｼ夐夊ｿ・尅蜷ｬ驥肴眠謠貞・縲・- 蜉ｨ菴懈ｵ∫ｨ区怙螟・200 豁･縲∝ｾｪ邇ｯ 50 谺｡・瑚ｿ占｡梧慮髣ｴ郤ｦ 10 遘抵ｼ瑚ｶ・ｿ・剞蛻ｶ莨壽署蜑咲ｻ域ｭ｢縲・

