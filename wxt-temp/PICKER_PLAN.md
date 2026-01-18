# Picker Plan (Discussion Summary)

## Scope
- Implement an element picker used by Hidden rules and Flow steps where selector input is required.
- No code changes yet; this file captures the agreed behavior and requirements.

## Actions that need picker
- Hidden: "Hide page element" entry and the selector input in the hidden rule drawer.
- Flow steps: any step field that uses a CSS selector (click, input, wait/condition, assert, if-else, etc.).

## Picker actions (by screen)
### Hidden rules screen
- "Hide page element": start picker in select mode for hidden-rule creation.

### Hidden rule drawer
- Selector input crosshair: start picker for this selector field and apply selection on success.

### Flow builder (steps)
- Selector field crosshair: start picker for the active selector field (respect input-only rules for input steps).

### Sidepanel overlay (picker active)
- Esc key: cancel picker and close overlay (no value changes).
- Optional cancel button: same behavior as Esc.

## Sidepanel overlay when picker is active
- Show a full-panel overlay that blocks interaction.
- Display a clear hint: "Select an element on the page. Press Esc to cancel."
- Optional: provide a visible "Cancel" button that behaves like Esc.

## Cancel behavior
- Esc always cancels the picker.
- On cancel, close overlay and keep the previous selector value unchanged.
- Provide a lightweight cancel feedback message in the sidepanel (optional).

## Input step: allowed targets only
- Allow `contenteditable=true`.
- Allow `<input>` with type: text (default), password, email, number, search.
- Allow `<textarea>`, `<select>`.
- Allow readonly/disabled fields.
- If target is invalid, keep picker active and show a warning: "Please select an input field."

## Additional UX constraints
- Only one picker can be active at a time.
- If selection is successful, close overlay and apply selector to the active target.

## Implementation outline (files and structure)
### High-level flow
- Sidepanel starts/cancels picker and shows an overlay.
- Background forwards picker start/cancel to content script.
- Content script runs picker (overlay + highlight + Esc cancel) and returns selector.
- Sidepanel applies selector to the active target (Hidden rule or Flow step field).

### Files to update or add (WXT temp)
- `wxt-temp/ui/sidepanel/App.tsx`: global picker state + overlay control.
- `wxt-temp/ui/sidepanel/sections/HiddenRulesSection.tsx`: picker triggers for hidden actions.
- `wxt-temp/ui/sidepanel/components/FlowStepsBuilder.tsx`: picker triggers for selector fields + input-only filter.
- `wxt-temp/ui/sidepanel/components/SelectorInput.tsx`: keep picker trigger; optional disabled state.
- `wxt-temp/ui/sidepanel/components/PickerOverlay.tsx` (new): overlay UI with Esc hint.
- `wxt-temp/entrypoints/background.ts`: forward START/CANCEL to content script.
- `wxt-temp/entrypoints/content.ts`: handle START/CANCEL and invoke picker.
- `wxt-temp/entrypoints/content/picker.ts` (new): picker logic + input-only filter.
- `wxt-temp/public/_locales/*/messages.json`: overlay and validation messages.

### WXT temp structure (summary)
- `wxt-temp/entrypoints/`: extension entrypoints (background/content/sidepanel).
- `wxt-temp/ui/sidepanel/`: sidepanel UI (components/sections/utils/styles).
- `wxt-temp/public/_locales/`: i18n resources.
- `wxt-temp/types/`: shared type declarations.
