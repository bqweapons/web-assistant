# Page Augmentor

[English](README.md) / [日本語](README.ja.md) / [简体中文](README.zh-CN.md)

---

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

### What's new (1.0.2)
- Action flow: drag the step number chip to reorder steps; added clearer hints and kept the add menu visible by moving it above the list.
- UI polish: step type now shows as a chip beside the index to reduce accidental changes, while preserving the existing builder layout.

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
