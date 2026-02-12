# wxt-temp Review Fix Log (2026-02-12)

## Scope
- Target: `wxt-temp/` source, config, locale files
- Excluded: `node_modules/`, `.output/`, `.wxt/`

## Fix Checklist
- [x] HIGH: `setSiteData` non-atomic write can lose data under concurrent saves
  - Evidence: `wxt-temp/shared/storage.ts:87`
  - Fix: Added serialized write queue for `setSiteData` / `setAllSitesData` in `wxt-temp/shared/storage.ts`
- [x] HIGH: Flow created from Elements drawer is not persisted immediately
  - Evidence: `wxt-temp/ui/sidepanel/sections/ElementsSection.tsx:876`
  - Fix: Persisted flow list immediately on create in `handleCreateFlow` (`wxt-temp/ui/sidepanel/sections/ElementsSection.tsx`)
- [x] MEDIUM: REHYDRATE signature cache may suppress sync after inactive -> active transition
  - Evidence: `wxt-temp/ui/sidepanel/sections/ElementsSection.tsx:613`
  - Fix: Reset rehydrate signature cache when page/site context becomes unavailable in `syncElementsToContent`
- [x] MEDIUM: `global` scope blocked by site mismatch guard in content injection
  - Evidence: `wxt-temp/entrypoints/content/injection.ts:1666`
  - Decision: Reverted the global-scope exemption per product design (no `global` support needed)
- [x] MEDIUM: Nested button in `FlowStepsBuilder` (invalid DOM / accessibility risk)
  - Evidence: `wxt-temp/ui/sidepanel/components/FlowStepsBuilder.tsx:1326`
  - Fix: Replaced outer interactive wrapper with `div role=\"button\"` + keyboard handling to remove nested button structure
- [x] MEDIUM: Settings Share buttons have no action handlers
  - Evidence: `wxt-temp/ui/sidepanel/sections/SettingsSection.tsx:213`
  - Fix: Added copy/open handlers with feedback in `wxt-temp/ui/sidepanel/sections/SettingsSection.tsx`

## Notes
- This file is updated after each fix is implemented.
