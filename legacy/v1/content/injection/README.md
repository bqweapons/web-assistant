# Injection Layer Structure

This folder contains the runtime that injects, renders and orchestrates elements on the page. It is split by concern to reduce coupling and improve maintainability.

## Layout

- core/
  - constants.js — shared constants (e.g., z-index defaults)
  - utils.js — pure utilities (kebabCase, forwardClick, etc.)
  - flow-runner.js — executes Action Flow definitions
  - registry.js — element registry and DOM host map
- host/
  - create-host.js — creates the Shadow DOM host for an element
  - utils.js — resolveAreaContent/resetHostPosition
- ui/
  - style.js — style application/normalization helpers
  - tooltip.js — tooltip DOM helpers
- interactions/
  - drag/ — core helpers + area/floating strategies + strategy router
  - resize/ — resize behavior + wrapper strategy for parity
  - drop/ — indicator, drop-target resolution, and drop-preview host
- behaviors/
  - button.js — click behavior for button elements (flow, mirrored selector, URL)
- orchestrator/
  - orchestrator.js — composes everything; wires DI ports (getFloatingDragDeps)

## Dependency Injection (ports)

Drag strategies are given a `DragDeps` object (see `common/types.js`) from the orchestrator. This avoids direct imports across layers and makes responsibilities explicit:

- drop targets/indicator/preview are provided by orchestrator
- host utilities are provided by orchestrator
- strategies focus only on pointer math and state updates

## Notes

- New element types typically only need a drag strategy variant and a behavior module, then are wired via the strategy router.
- Keep helpers pure and side-effect free where possible; orchestrator handles side effects and wiring.

