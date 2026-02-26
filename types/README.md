# types Directory

This directory is reserved for ambient/global type declarations.

## What belongs here

- Global runtime declarations (for example, `chrome.d.ts`)
- `declare global` extensions for browser/runtime objects
- Third-party module declaration shims (`declare module '...'`)

## What does not belong here

- Domain/business models used by runtime code
- Feature-local UI types

## Type placement rules

- Shared business types: `wxt-temp/shared/`
- Feature-local types: colocated under each feature directory
- Ambient declarations only: `wxt-temp/types/`
