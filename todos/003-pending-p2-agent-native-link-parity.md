---
status: pending
priority: p2
issue_id: "003"
tags: [agent-native, code-review]
dependencies: []
---

# Agent-Native Link Parity

## Problem Statement
New link features (Suggester, Navigation) are heavily dependent on UI interaction (typing, clicking). Agents cannot easily create or follow links without specific tool support.

## Findings
- `TiptapLinkSuggest` is purely UI-driven.
- Navigation happens in a `NodeView` click handler.

## Proposed Solutions
1. **Expose Commands**: Ensure `insertInternalLink` is a standard Obsidian command that agents can call.
2. **Agent Tool**: Add a `follow_link` tool to the plugin that agents can use to navigate the Z-axis.

## Acceptance Criteria
- [ ] An agent can create an internal link via a tool call.
- [ ] An agent can "click" a link via a tool call to open the target.
