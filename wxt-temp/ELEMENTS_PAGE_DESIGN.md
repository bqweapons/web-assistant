# Elements Page Design Spec (WXT temp)

## Scope
- Covers the Elements tab only.
- Flow and Hidden screens are out of scope (to be designed later).

## Goals
- Users can add, place, edit, and remove injected elements (button/link/tooltip/area).
- Placement is explicit (before/after/append/prepend, or inside area).
- Injection is immediate, with clear feedback and reversible actions.

## Primary Data Structure
Elements use a unified style shape:
```json
{
  "style": {
    "preset": "button-default",
    "inline": {
      "backgroundColor": "#1b84ff",
      "color": "#ffffff",
      "borderRadius": "8px",
      "padding": "8px 16px",
      "fontSize": "12px",
      "fontWeight": "600"
    },
    "customCss": ""
  }
}
```

### Element (logical shape)
- id: string
- type: "button" | "link" | "tooltip" | "area"
- text: string
- selector: string (DOM anchor)
- position: "append" | "prepend" | "before" | "after"
- beforeSelector?: string
- afterSelector?: string
- containerId?: string (if dropped into an Area)
- floating: boolean
- layout?: "row" | "column" (area)
- href?: string
- linkTarget?: "new-tab" | "same-tab"
- tooltipPosition?: "top" | "right" | "bottom" | "left"
- tooltipPersistent?: boolean
- style: { preset?: string; inline?: Record<string, string>; customCss?: string }
- scope: "page" | "site"
- siteUrl / pageUrl / frameUrl / frameSelectors
- createdAt / updatedAt

## Elements Page: UI Actions

### Add element menu (top)
Button label: "Add element to page"
- Area
  - Action: start area picker (drag a rectangle).
  - Result: create area element with floating placement + left/top/width/height in `style.inline`.
  - UI: new area card appears and is selected.
- Button
  - Action: start picker (disallow input targets).
  - Result: create button element anchored at selection, store selector + before/after selectors.
- Link
  - Action: start picker (disallow input targets).
  - Result: create link element anchored at selection, store selector + before/after selectors.
- Tooltip
  - Action: start picker (allow input targets).
  - Result: create tooltip element anchored at selection, store selector + before/after selectors.

### Search box
- Filters elements by name/type/page/selector.
- Empty search restores full list.

### Type filter
- Filters by element type.
- Default: "All types".

### Clear filter button
- Clears search + type filter.

### Element list card
Click card:
- Opens element detail drawer with the selected element preloaded.

Buttons on card:
- Locate (crosshair icon)
  - Action: send focus request to content script to scroll and highlight the injected element.
- Delete (trash icon)
  - Action: remove from list and request content side removal.

### Detail drawer (right panel)
Actions:
- Save: persists edits and triggers an update message to content.
- Close: discard unsaved edits.
 - Live preview: while editing, send preview updates so page elements reflect changes immediately; closing resets preview.

Fields:
- Name/Text input: updates `text`.
- Selector input (with picker): re-pick anchor selector.
- Scope toggle: updates `scope` (site/page).
- Action flow selector (button only): set `actionFlowId`.
- Link URL + target (link only): `href`, `linkTarget`.
- Tooltip settings (tooltip only): `tooltipPosition`, `tooltipPersistent`.
- Area layout (area only): `layout`.
- Styles:
  - Preset dropdown: updates `style.preset` and writes preset styles to `style.inline`.
  - Style controls (color/size/position): update `style.inline` and regenerate `style.customCss`.
  - Custom Styles textarea: parses text into `style.inline`, writes raw text into `style.customCss`.

### Flow drawer (inside elements page)
Used when associating an action flow with a button:
- Create flow: adds a new flow record and attaches it to the element.
- Flow steps builder: uses picker for selector fields.

## Injection Behavior (content side)

### Creation flow
1. Sidepanel starts picker (or area drag).
2. On success, sidepanel constructs element data and sends create message.
3. Content script injects immediately (preview), then confirms back.
4. Sidepanel updates list and opens element drawer.

### Placement rules
- If `containerId` exists: render inside the Area container.
- If `floating` true: use `style.inline.left/top` and place in document body.
- Otherwise: resolve `selector` and insert by `position` (append/prepend/before/after).
- If `beforeSelector/afterSelector` exist, insertion prefers the relative target when possible.

### Dragging (edit mode)
- Area drag:
  - Update `style.inline.left/top`.
  - Persist on drag end.
- Button/Link drag:
  - If dropped into an Area: set `containerId`, clear relative selectors.
  - If dropped on page: compute `beforeSelector/afterSelector` around drop target.

## Tab Switching Behavior
- Switching tabs cancels active picker and hides sidepanel overlay.
- Elements tab should refresh data for current site (siteKey).
- If no active page, show empty state and disable add actions.

## Import / Export
(Handled in Settings; Elements tab does not expose import/export)
- Import: validate JSON, merge into storage, then rehydrate content scripts.
- Export: serialize elements/flows/hidden into a single JSON payload.

## Notes / Constraints
- Only one picker session at a time.
- All updates should be idempotent; failed injection must not persist.
- Editing UI should not block normal page usage unless edit mode is active.

## Sample Data
```json
{
  "sites": {
    "example.com": {
      "elements": [
        {
          "id": "element-001",
          "text": "Get Started",
          "scope": "page",
          "context": {
            "siteKey": "example.com",
            "pageKey": "example.com/",
            "frame": null
          },
          "placement": {
            "mode": "dom",
            "selector": "main .hero",
            "position": "append",
            "relativeTo": {
              "before": ".hero-title",
              "after": ".hero-actions"
            }
          },
          "style": {
            "preset": "button-default",
            "inline": {
              "backgroundColor": "#1b84ff",
              "color": "#ffffff",
              "borderRadius": "8px",
              "padding": "8px 16px",
              "fontSize": "12px",
              "fontWeight": "600"
            },
            "customCss": ""
          },
          "behavior": {
            "type": "button",
            "href": "https://example.com/signup",
            "actionSelector": "#signup",
            "actionFlowId": "flow-signup"
          },
          "createdAt": 1700000000000,
          "updatedAt": 1700000002000
        }
      ],
      "flows": [
        {
          "id": "flow-001",
          "name": "Signup CTA",
          "description": "Click primary CTA and wait for form.",
          "scope": "site",
          "siteKey": "example.com",
          "pageKey": null,
          "steps": [
            { "type": "click", "selector": ".cta-primary" },
            { "type": "wait", "selector": "form#signup", "timeoutMs": 5000 }
          ],
          "updatedAt": 1700000003000
        }
      ],
      "hidden": [
        {
          "id": "hidden-001",
          "name": "Hide promo banner",
          "scope": "site",
          "siteKey": "example.com",
          "pageKey": null,
          "selector": ".promo-banner",
          "enabled": true,
          "updatedAt": 1700000004000
        }
      ]
    },
    "note.com": {
      "elements": [
        {
          "id": "element-101",
          "text": "Help",
          "scope": "site",
          "context": {
            "siteKey": "note.com",
            "pageKey": null,
            "frame": null
          },
          "placement": {
            "mode": "dom",
            "selector": "header .help-link",
            "position": "append",
            "relativeTo": {}
          },
          "style": {
            "preset": "link-default",
            "inline": {
              "color": "#2563eb",
              "textDecoration": "underline"
            },
            "customCss": ""
          },
          "behavior": {
            "type": "link",
            "href": "https://note.com/help",
            "target": "new-tab"
          },
          "createdAt": 1700100000000,
          "updatedAt": 1700100002000
        }
      ],
      "flows": [],
      "hidden": []
    }
  }
}
```
