# Test Checklist (Docs Test Pages)

## Smoke (5-10 min)

- [ ] Open `docs/test-pages/basic/test-page.html`
- [ ] Create one button element and confirm it renders
- [ ] Run one popup flow and confirm `OK` continues the flow
- [ ] Create one hidden rule and confirm page element is hidden
- [ ] Open Overview and confirm saved site data is visible

## Vault Flows

- [ ] Bind a password field to Password Vault in a flow input step
- [ ] Close sidepanel and run the flow
- [ ] Confirm in-page vault unlock prompt appears
- [ ] Enter wrong vault password and confirm retry prompt appears
- [ ] Enter correct password and confirm flow resumes from current step
- [ ] Cancel unlock prompt and confirm run stops with user-facing error
- [ ] Reset vault and confirm previously bound field shows invalid binding state
- [ ] Rebind invalid vault field and confirm run succeeds

## Data Source A/B

- [ ] Open `docs/test-pages/data-source/datasource-form-a.html`
- [ ] Run flow to fill multiple fields (`text`, `email`, `date`, `number`)
- [ ] Submit to Screen B
- [ ] Confirm values render in result table
- [ ] Use back link to return to Screen A

## Import / Export (optional vault data)

- [ ] Export data without vault passwords (default path)
- [ ] Export data with vault passwords (confirm prompt + vault password entry)
- [ ] Import exported JSON and verify elements/flows restored
- [ ] If vault data included, confirm vault create/unlock path restores vault secrets

## i18n Sanity

- [ ] Switch sidepanel language to `en`, `ja`, `zh_CN`
- [ ] Confirm tabs/header labels update correctly (no stale English fallback)
- [ ] Confirm key runner/vault messages are localized

## Result Recording Template

- Build/Version tested:
- Browser version:
- Tester:
- Date:
- Pass/Fail summary:
- Notes / regressions:
