# WXT Temp Agent Notes

This file defines practical conventions for contributors working inside `wxt-temp/`.

## Scope
- Target app: WXT browser extension (MV3) under `wxt-temp/`.
- Main feature set in this branch: sidepanel-driven element injection (area, button, link), picker flow, edit/drag/resize, i18n.

## Project Structure
- `entrypoints/`
  - `background.ts`: runtime message bridge, active-tab forwarding, page context broadcast.
  - `content.ts`: content script entry, picker lifecycle, injection message routing, rehydrate from storage.
  - `content/injection.ts`: DOM injection registry, placement logic, drag/resize/edit interactions.
  - `content/picker.ts`: element/area picking overlay and placement hints.
- `ui/sidepanel/`
  - `App.tsx`: header/tabs/context and picker orchestration.
  - `sections/ElementsSection.tsx`: element list, editor drawer, create/delete/save flows.
  - `components/`: shared UI controls.
  - `styles/`: Tailwind v4 + theme variables.
- `shared/`
  - `messages.ts`: runtime message types/payloads shared by background/content/sidepanel.
  - `storage.ts`: site-scoped persistence helpers.
- `public/_locales/{en,ja,zh_CN}/messages.json`: sidepanel i18n resources.

## Element Injection Rules
- Placement priority in content injection:
  1. `containerId` (if present) -> append into area container.
  2. `beforeSelector` / `afterSelector`.
  3. `selector + position`.
- For area-contained children:
  - Keep `containerId`.
  - Clear `beforeSelector`/`afterSelector`.
  - Use `position: "append"`.
- Host node marker: `data-ladybird-element`.
- Editing marker: `data-ladybird-editing`.

## Picker Rules
- Picker result may include:
  - `selector`
  - `beforeSelector`
  - `afterSelector`
  - `containerId` (when click target resolves inside an area host)
  - `rect` (area draw mode)
- `Escape` must cancel reliably in picker mode.
- In selector mode:
  - Show insertion marker near target edge (small block).
  - Hide insertion marker when target is inside an area container.

## Editor Behavior Rules
- Clicking a card opens drawer and highlights/focuses the page element.
- Draft preview updates are allowed while editing.
- On drawer cancel for newly created draft elements:
  - Roll back immediately from list and page (no refresh required).
- Resize handles (`e`, `s`, `se`) must stay visible in editing mode.
- Do not destroy resize handles when updating label text; update text nodes without removing child controls.

## Elements Page UI Rules
- Group list by page, then by area:
  - Area card as group header.
  - Children nested under their area.
  - Non-area, non-grouped items in an "Ungrouped" block.
- `selector` and `insert position` fields are hidden in drawer basics.
- Add menu currently hides `tooltip` creation entry (temporary product decision).
- Delete action in list requires confirm dialog.

## I18n Rules
- When adding a new UI text key, update all three locale files:
  - `public/_locales/en/messages.json`
  - `public/_locales/ja/messages.json`
  - `public/_locales/zh_CN/messages.json`
- For dynamic strings, keep placeholders consistent (for example `{name}`).

## Theme (Tailwind v4)
- Tokens are defined in `ui/sidepanel/styles/theme.css`.
- `:root` and `.dark` provide base CSS variables.
- `@theme inline` maps variables to Tailwind utilities (for example `bg-background`).
- `ui/sidepanel/styles/index.css` import order must stay:
  1. `@import "tailwindcss";`
  2. `@import "./theme.css";`

## Development Checklist
- Run type check after UI/content/message edits:
  - `npm run compile` (inside `wxt-temp/`)
- For message contract changes:
  - Update `shared/messages.ts`.
  - Verify background forwarding.
  - Verify sidepanel/content handlers.
