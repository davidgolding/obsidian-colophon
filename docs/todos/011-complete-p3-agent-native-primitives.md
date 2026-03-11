---
status: complete
priority: p3
issue_id: "011"
tags: ["agent-native", "architecture", "performance", "code-review"]
dependencies: []
---

# Agent-Native Primitives

Add core primitives to support agentic operations for link creation and block type management.

## Problem Statement

The current implementation lacks dedicated commands for programmatic interaction by agents. Specifically, there are no streamlined primitives for adding links or setting block types, which limits the ability of agents to manipulate the editor content reliably.

## Findings

- Agents currently have to manually manipulate the DOM or use lower-level Tiptap commands which may not be consistently exposed or validated.
- Missing high-level commands: `colophon:add-link` and `colophon:set-block-type`.

## Proposed Solutions

### Option 1: Implement custom Tiptap commands

**Approach:** Add `colophon:add-link` and `colophon:set-block-type` to the Tiptap adapter as registered commands.

**Pros:**
- Integrated into the editor lifecycle
- Easy for agents to call via the command API

**Cons:**
- Requires modification of the Tiptap adapter

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

Implement primitive commands:
1. `colophon:add-link {target, alias}`: Inserts a fully formed `internalLink` node.
2. `colophon:set-block-type {typeId}`: Sets the block type of the current selection.
3. `colophon:focus-footnote {id}`: Opens sidebar and focuses the specific note.

## Technical Details

**Affected files:**
- `src/tiptap-adapter.js`
- `src/main.js`

## Resources

- Tiptap Command API Documentation

## Acceptance Criteria

- [x] `colophon:add-link` command implemented and verified
- [x] `colophon:set-block-type` command implemented and verified
- [x] Commands are accessible to the agent interface

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

### 2026-03-11 - Completed
**By:** Gemini CLI
**Actions:**
- Added `addLink` and `setBlockType` to `TiptapAdapter`.
- Registered `colophon:add-link`, `colophon:set-block-type`, and `colophon:focus-footnote` in `main.js`.
- Status changed from ready → complete.

**Learnings:**
- Programmatic primitives are essential for agent-native parity.
- Registration in main.js allows agents to execute commands with parameters via the Obsidian API.

## Notes
