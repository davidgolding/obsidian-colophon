---
status: ready
priority: p1
issue_id: "001"
tags: [ui, editor, settings]
dependencies: []
---

# Implement Word Counter

## Problem Statement
The word count indicator styled in CSS is missing its functional implementation. Writers rely on word counts for goals.

## Findings
- CSS class `.colophon-word-count-indicator` already exists.
- `src/tiptap-adapter.js` needs to calculate the word count.
- `src/view.js` needs to display the indicator and handle toggling.
- `src/settings-data.js` needs to store the visibility state.

## Proposed Solutions

### Option 1: Floating UI in View
**Approach:** 
- Add `getWordCount()` to `TiptapAdapter`.
- Create a floating div in `ColophonView` using the existing CSS class.
- Update the count on editor changes.
- Add a toggle in the pane menu.
- Persist toggle state in settings.

**Pros:**
- Real-time feedback.
- Accessible but non-intrusive.
- User-controlled visibility.

**Cons:**
- Minor performance overhead for counting large documents.

**Effort:** 2-3 hours
**Risk:** Low

## Recommended Action
Implement Option 1. Add `getWordCount()` using `this.editor.state.doc.textContent.split(/\s+/).filter(x => x).length`.

## Technical Details
- `src/tiptap-adapter.js`: Add `getWordCount()` method.
- `src/view.js`: Create element, hook `adapter.onUpdate`, implement `onPaneMenu` toggle.
- `src/settings-data.js`: Add `showWordCount: boolean`.

## Acceptance Criteria
- [ ] A floating word count indicator appears at the bottom of the editor.
- [ ] Indicator updates as I type.
- [ ] The word count indicator can be toggled on/off via the view's pane menu.
- [ ] Toggle state is persisted between sessions.

## Work Log
### 2026-03-24 - Task Creation
**By:** Gemini CLI
**Actions:** Created todo based on plan.
