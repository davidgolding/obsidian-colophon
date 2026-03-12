---
module: Colophon
date: 2026-03-11
problem_type: logic_error
component: ColophonView
symptoms:
  - "Changes in the editor were not persisted to the .colophon file on disk"
  - "requestSave() fails to trigger a corresponding getViewData() call in ColophonView"
root_cause: logic_error
resolution_type: code_fix
severity: critical
tags: [obsidian-api, persistence, colophon-view, text-file-view]
---

# Missing Super Calls in TextFileView Prevents Saving

## Problem Statement
`ColophonView` (which extends Obsidian's `TextFileView`) was failing to persist changes to the `.colophon` file on disk. While `requestSave()` was being called correctly in response to editor updates, the expected `getViewData()` callback from Obsidian never fired, leaving the file in a "clean" state according to the workspace despite being "dirty" in the editor.

## Investigation Steps
1. **Direct Save Test**: Bypassed Obsidian's `requestSave()` mechanism by calling `app.vault.modify()` directly. This worked, proving the file was writable and the serialization logic in `getViewData()` was correct.
2. **Dirty Flag Inspection**: Monitored the `view.dirty` property via the console. Found that calling `requestSave()` did not consistently or correctly update Obsidian's internal state for the view.
3. **Inheritance Analysis**: Inspected the prototype chain and `TextFileView` implementation. Identified that `TextFileView` relies on its own `onOpen` and `onClose` methods to initialize the debounced save scheduler and file listeners.

## Root Cause
`ColophonView` overrode the `onOpen` and `onClose` methods but did not call `super.onOpen()` and `super.onClose()`. In the Obsidian API, `TextFileView` (and many other base classes) uses these lifecycle hooks to perform critical setup. Without the `super` calls, the view was never properly "attached" to Obsidian's auto-save machinery.

## Working Solution
The fix required restoring the inheritance chain by adding `await super.onOpen()` and `await super.onClose()` to the respective overrides in `ColophonView`.

### Code Examples

#### ❌ Before (Buggy Implementation)
```javascript
export class ColophonView extends TextFileView {
    async onOpen() {
        // super.onOpen() was missing here
        // ... custom layout initialization ...
    }

    async onClose() {
        // super.onClose() was missing here
        // ... custom cleanup logic ...
    }
}
```

#### ✅ After (Fixed Implementation)
```javascript
export class ColophonView extends TextFileView {
    async onOpen() {
        await super.onOpen(); // CRITICAL: Initializes TextFileView internals
        // ... custom layout initialization ...
    }

    async onClose() {
        await super.onClose(); // CRITICAL: Allows clean teardown by Obsidian
        // ... custom cleanup logic ...
    }
}
```

## Prevention Strategies
1. **Mandatory Supercalls**: Every class extending an Obsidian base class (`Plugin`, `TextFileView`, `Modal`, `View`) MUST call the `super` implementation of lifecycle methods (`onOpen`, `onClose`, `onload`, `onunload`).
2. **Async Consistency**: Always `await` lifecycle supercalls to ensure the platform's internal state is fully initialized before custom logic runs.
3. **Lifecycle Checklist**:
    - [ ] Does the constructor call `super(leaf)` (or appropriate args)?
    - [ ] Does `onOpen` call `await super.onOpen()`?
    - [ ] Does `onClose` call `await super.onClose()`?

## Related Documentation
- [Obsidian Developer Docs - Views](https://docs.obsidian.md/Plugins/User+interface/Views)
- [TextFileView API Reference](https://github.com/obsidianmd/obsidian-api/blob/master/obsidian.d.ts)
