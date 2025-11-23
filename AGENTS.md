# Agents

## Overview
Agents represent the automation flows that Page Augmentor can execute when a user-defined button is pressed. Each agent runs inside the target page, can interact with DOM elements, and falls back to any configured mirrored selector or URL when the flow finishes without handling the action. Definitions are stored in `chrome.storage.local` alongside the element that owns them, so they are restored whenever you revisit the page.

## Creating an agent
1. Open the side panel and switch to **Manage**.
2. Pick the target element and choose the **Button** type.
3. Expand **Behaviour > Action flow** in the editor bubble.
4. Use the builder to add steps, or paste JSON into the advanced editor.
5. Save the element. The agent will run before any mirrored selector or URL fallback.

### Quick tips
- Use the special selector `:self` to reference the injected button itself.
- Same-origin iframe contexts are supported when the element was created from within that frame.
- Toggle between the builder and JSON modes at any time; both share the same underlying schema.

## Action step reference
- `click` requires `selector`; optionally set `all: true` to click every match. Dispatches pointer and mouse events, then calls `element.click()`.
- `wait` requires `ms` (milliseconds). Useful for basic sequencing.
- `input` requires `selector` and `value`; writes to inputs, textareas, or contenteditable regions and fires `input` and `change` events.
- `navigate` requires `url`; optional `target` (defaults to `_blank`). Opens via `window.open` after sanitisation.
- `log` requires `message`; writes to the page console for debugging.
- `if` requires `condition`, `thenSteps`, and optionally `elseSteps`; evaluates the condition once and runs the matching branch.
- `while` requires `condition` and `bodySteps`; repeats until the condition fails or the iteration cap is reached.

### Conditions
- `exists` requires `selector`; succeeds when at least one element matches.
- `not` requires `operand`; negates the nested condition.
- `textContains` requires `selector` and `value`; matches on `textContent` (case-insensitive).
- `attributeEquals` requires `selector`, `name`, and `value`; compares raw attribute values.

## Example flow
```json
{
  "steps": [
    { "type": "click", "selector": "#open-dialog" },
    { "type": "wait", "ms": 400 },
    {
      "type": "if",
      "condition": { "kind": "exists", "selector": ".dialog.is-open" },
      "thenSteps": [
        { "type": "input", "selector": ".dialog input[name=email]", "value": "user@example.com" },
        { "type": "click", "selector": ".dialog button[type=submit]" }
      ],
      "elseSteps": [
        { "type": "log", "message": "Dialog did not appear in time." }
      ]
    }
  ]
}
```

## Runtime limits and safeguards
- Maximum 200 steps per agent and 50 iterations per loop.
- Maximum nesting depth of 8 (`if` and `while` blocks).
- Approximately 10 seconds of total runtime before the flow aborts.
- Invalid selectors, unsupported step types, or malformed JSON are rejected at save time.
- Flows execute in the active frame only; cross-origin iframes cannot be reached.

## Best practices
- Prefer specific selectors and avoid brittle index-based queries.
- Keep waits short; combine `wait` with `exists`/`textContains` checks for robustness.
- Use `log` steps during development and remove or demote them once the agent is stable.
- Pair agents with mirrored selectors or URLs so the button remains useful if the flow exits early.
- Reorder flow steps by dragging the `#` badge in the builder instead of deleting and re-adding.

## Developer Notes
- Code locations
  - Flow runtime: `content/injection/core/flow-runner.js`
  - Flow parser and limits: `common/flows.js`
  - Editor controller: `content/bubble/editor/action-flow-controller.js`
  - Builder UI and I/O: `content/bubble/actionflow/{builder,serializer,parser-bridge}.js`
  - Types: `content/common/types.js`
- Adding a new step type
  - Extend the executor in `content/injection/core/flow-runner.js` to handle the new `type`.
  - Update the builder palette and serializers under `content/bubble/actionflow/` to expose and persist the step.
  - Document required fields and validation rules in this file and `README.md`.
- Debugging tips
  - Use the `log` step to print progress to the page console.
  - Temporarily reduce flows to a minimal repro and re‑add steps incrementally.

