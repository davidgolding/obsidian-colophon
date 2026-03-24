---
status: ready
priority: p1
issue_id: "002"
tags: [editor, bug]
dependencies: []
---

# Fix Enter Key Logic (Paragraph Split)

## Problem Statement
Splitting a paragraph with Enter often fails or moves the cursor unexpectedly. Writers expect a standard behavior where a paragraph is split at the cursor.

## Findings
- `src/extensions/universal-block.js` has a custom `Enter` keybinding.
- It likely overrides the default `splitBlock` behavior in a way that causes issues.

## Proposed Solutions

### Option 1: Use Default splitBlock
**Approach:** 
- Modify the `Enter` shortcut in `universal-block.js`.
- Use the standard Tiptap/ProseMirror `splitBlock` command unless a special case (like block transition) is detected at the end of the block.

**Pros:**
- Reliable, standard behavior.
- Minimal custom code.

**Cons:**
- Needs care to preserve custom block-to-block transitions if they were intentional.

**Effort:** 1 hour
**Risk:** Low

## Recommended Action
Refine the `Enter` logic to prioritize `splitBlock` for mid-paragraph breaks.

## Technical Details
- `src/extensions/universal-block.js`: Modify `Enter` shortcut function.

## Acceptance Criteria
- [ ] Pressing `Enter` in the middle of a paragraph correctly splits it into two blocks.
- [ ] Cursor stays at the beginning of the new paragraph.
- [ ] No "jumping" of the cursor or content disappearance.

## Work Log
### 2026-03-24 - Task Creation
**By:** Gemini CLI
**Actions:** Created todo based on plan.
