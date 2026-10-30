# Changelog

User-visible changes per release. Older releases: see git history and `store-listing/*/whats-new.txt` at each tag.

## 2.1.0 — unreleased

### Added
- On-page notice when a flow is started from an injected button: started, finished, stopped, or failed with the reason. Repeat clicks while the run is starting are ignored.
- Element picker shows a hint ("Click an element to select it · Esc to cancel", or the area-drawing variant).
- Saving a flow that still has empty or example values shows the check result first; the button then reads "Save anyway".
- Import asks for confirmation and shows the number of sites, elements and flows, and whether automatic ad blocking will change.
- Visible keyboard focus ring on injected buttons and links.

### Fixed
- Page-scoped elements now update after single-page-app route changes (history changes made by the page itself were not detected).
- Tooltips: placed by their own size so "top" / "left" no longer cover the target, centered on the target, kept inside the viewport, and re-placed on scroll and resize.
- New If/Else, Wait and Assert steps no longer start with the real values `.status` / `Ready`; examples are placeholders only.
- Common runner errors (element not found, invalid selector, timeouts, assert failed, navigate URL problems, tab closed, page needs reload) are translated in the side panel and on the page.
- English step summaries showed literal backslashes (`\"Ready\"`).
- A non-JSON import file shows a plain message instead of the parser error.

### Changed
- Translations: remaining English labels in ja / zh-CN translated; one term per language for the vault (zh-CN 密码保管库) and selectors (ja セレクター).
- Dependencies updated within their current major versions (wxt 0.20.27, React 19.3, Tailwind 4.3, zod 4.6.7). zod 4.6.7 fixes a memory-exhaustion advisory in import validation. The remaining `npm audit` items come from `web-ext-run`, which is only used by the dev runner and is not shipped in the extension.
- Docs: README step list corrected (there are no `log` / `while` steps), stale status lines in `1.4-spec.md`, `AGENTS.md` and the test checklists updated.
