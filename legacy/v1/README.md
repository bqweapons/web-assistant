# Legacy v1 (Archived Root Implementation)

This directory contains the pre-WXT implementation that previously lived in the repository root.

## Status
- `legacy/v1` is kept for reference, comparison, and emergency maintenance only.
- The active mainline implementation now lives in the repository root (WXT-based).
- New features should be implemented in the root app, not in `legacy/v1`, unless explicitly requested.

## What is included
- Original MV3 extension files (`manifest.json`, `service_worker.js`)
- Legacy runtime folders (`common/`, `content/`, `sidepanel/`, `src/`)
- Legacy build/package scripts (`scripts/build.mjs`, `scripts/package.mjs`)
- Legacy i18n bundle (`_locales/`)

## Running the legacy version (optional)
Use this only when you need to reproduce or compare older behavior.

1. `cd legacy/v1`
2. `npm install`
3. `npm run build`
4. Package with the legacy script if needed (`npm run package`)

The current recommended development workflow is documented in the root `README.md` and `AGENTS.md`.
