---
status: complete
priority: p3
issue_id: "013"
tags: ["agent-native", "architecture", "performance", "code-review"]
dependencies: []
---

# Snappy Typewriter Scroll

Improve typewriter scroll responsiveness by switching from smooth behavior to snappy 'auto' behavior during active typing.

## Problem Statement

The smooth scrolling behavior in `handleScroll` during typing feels "mushy" and creates a distracting lag between typing and the screen following the cursor.

## Findings

- Typing triggers scrolling with `behavior: 'smooth'`.
- The cumulative effect of multiple smooth scroll animations during typing creates perceived lag.

## Proposed Solutions

### Option 1: Use behavior: 'auto' in handleScroll

**Approach:** Change the scroll behavior from 'smooth' to 'auto' specifically when handling typing-induced scrolling.

**Pros:**
- Snappier response while typing
- Reduces cumulative scroll lag

**Cons:**
- Visual transition is less "soft"

**Effort:** 0.5 hours

**Risk:** Low

## Recommended Action

Change the scroll behavior from `'smooth'` to `'auto'` in the `handleScroll` method of `TiptapAdapter`.

## Technical Details

**Affected files:**
- `src/tiptap-adapter.js`

## Resources

- CSS/JS scroll behavior documentation

## Acceptance Criteria

- [x] Scrolling feels more responsive during typing
- [x] Document correctly follows the cursor without perceived lag

## Work Log

### 2026-03-11 - Initial Entry

**By:** Gemini CLI

**Actions:**
- Created todo from P3 finding.

### 2026-03-11 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status changed from pending → ready
- Ready to be picked up and worked on

**Learnings:**
- Responsiveness is key for editor performance and user satisfaction.

### 2026-03-11 - Completed
**By:** Gemini CLI
**Actions:**
- Changed `behavior: 'smooth'` to `behavior: 'auto'` in `handleScroll` method within `src/tiptap-adapter.js`.
- Verified change and updated todo status to completed.

## Notes
