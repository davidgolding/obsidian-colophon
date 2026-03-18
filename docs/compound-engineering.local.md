---
review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer, security-sentinel, performance-oracle, architecture-strategist]
plan_review_agents: [kieran-typescript-reviewer, code-simplicity-reviewer]
---

# Review Context

This project is an Obsidian plugin for focused prose writing.

- **Obsidian API**: Use official APIs where possible and ensure proper cleanup of all event listeners in `onunload`.
- **Performance**: High performance is critical for a smooth typing experience. Check for editor state synchronization issues and layout-triggering calls.
- **Security**: Data integrity is paramount. No data should leave the vault without explicit user action.
- **UI/UX**: Maintain high visual fidelity and layout parity during export processes.
- **Compatibility**: Ensure stability on Desktop (primary target).
