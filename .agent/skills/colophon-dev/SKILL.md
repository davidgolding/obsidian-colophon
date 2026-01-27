---
name: Colophon Developer
description: Expert context for resuming work on the Colophon Obsidian plugin.
---

# Colophon Developer Skill

This skill allows you to instantly resume development on the Colophon project by loading the critical context and understanding the project's unique architecture.

## 1. Resume Session Routine
**ALWAYS** perform these steps when starting a new session with this skill:

1.  **Read Status**: Read `AGENTS.md` to get the latest project status, current objectives, and roadmap. This is the source of truth.
2.  **Read Scope**: Read `README.md` (if needed) for high-level feature scope.
3.  **Confirm Identity**: Recognize that you are working on **Colophon v2.0**, an Obsidian Plugin that uses a custom JSON file format (`.colophon`) and Tiptap v3.

## 2. Architecture Cheat Sheet
Use this reference to understand the codebase without deep scanning:

| component | file | description |
| :--- | :--- | :--- |
| **Entry Point** | `src/main.js` | Plugin lifecycle, view registration, commands, ribbon icons. |
| **View Logic** | `src/view.js` | Implements `TextFileView`. Manages Tiptap instance, file IO, and auto-save. |
| **Styling** | `styles.css` | All styling. Uses scoped classes (`.colophon-workspace`, `.type-manuscript`). |
| **File Format** | `.colophon` | JSON: `{ "type": "manuscript"\|"script", "doc": { ...tiptap_json... } }` |
| **Build** | `package.json` | `pnpm build` (uses esbuild). |

## 3. Development Workflows

### The "Dev Loop"
1.  **Edit**: Modify `src/*.js` or `styles.css`.
2.  **Build**: Run `pnpm build`.
3.  **Reload**: The `.hotreload` file is present; Obsidian should auto-reload the plugin. If not, toggle the plugin in Obsidian settings.

### Styling Strategy
*   **Scoped**: All styles must be scoped to `.colophon-view` or `.colophon-workspace` to avoid leaking into Obsidian's UI.
*   **Modes**: Use `.type-manuscript` and `.type-script` on the container to apply mode-specific typography (e.g., Courier vs Garamond).
*   **Variables**: Use Obsidian's CSS variables (`--background-primary`, `--text-normal`) for theme compatibility.

## 4. Handoff Protocol
**CRITICAL**: Before finishing a session, you MUST:
1.  **Update `AGENTS.md`**: Record what you accomplished, what files changed, and what the immediate next steps are.
2.  Update the "Current Implementation State" section to reflect reality.
