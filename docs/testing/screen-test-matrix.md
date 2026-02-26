# Screen Test Matrix (Docs Test Pages)

## Purpose / Scope

This document defines the manual test screen matrix for `docs/test-pages/**`.
It focuses on extension behavior validation using static local pages.

## Test Environment

- Browser: Chrome (latest stable recommended)
- Extension: Ladybird mainline build (root repo)
- Recommended checks before test:
  - Sidepanel opens
  - Current page domain is supported by extension permissions

## Screen Matrix Summary

| Group | Page path | Purpose | Covered features | Priority |
|---|---|---|---|---|
| Basic Playground | `docs/test-pages/basic/test-page.html` | Base interaction page | elements, hidden, popup, input, navigate | P0 |
| Basic Playground | `docs/test-pages/basic/test-page2.html` | Cross-page return page | navigation, site/page scope behavior | P0 |
| Data Source Flow | `docs/test-pages/data-source/datasource-form-a.html` | Form input page | text/email/date/number input, submit | P0 |
| Data Source Flow | `docs/test-pages/data-source/datasource-form-b.html` | Result page | result verification, link back | P0 |

## Detailed Coverage

### Basic Playground (`test-page.html`, `test-page2.html`)
- Create and edit button/link/tooltip/area elements
- Validate hidden rule creation and page element hiding
- Validate simple flow execution (`click`, `input`, `popup`, `navigate`)
- Validate navigation between the two pages and re-appearance of saved elements

### Data Source Flow (`datasource-form-a.html`, `datasource-form-b.html`)
- Fill multiple field types using flows (`text`, `email`, `date`, `number`)
- Submit form and verify data shown on Screen B
- Validate return navigation from Screen B back to Screen A
- Use CSV file (`docs/assets/data/datasource-form-data.csv`) as sample data input source (manual/reference)

## Release Smoke Set (Minimum)

Run before release:
1. Basic page: create one button, run one popup flow
2. Basic page: create one hidden rule and verify effect
3. Data Source A -> B: fill and submit form
4. Vault-related flow on any page: unlock/retry success path

## Known Gaps / Future Test Pages (P2)

Current `docs` test pages do not cover:
- iframe / multi-frame targeting scenarios
- highly dynamic DOM stress page
- strict CSP simulation page
- complex business-like table/form mock page (previous Kintai mock was removed)

Consider adding dedicated pages for these scenarios in a future iteration.
