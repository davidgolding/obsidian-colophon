---
description: Receiving a handoff from previous development session on Obsidian Colophon plugin
---

This workflow allows you to resume development on the Obsidian Colophon plugin project by loading the critical context and understanding the project's specific architecture, functions, and parameters.

# Resume Session Routine

ALWAYS perform these steps when starting a new session:

1. **Read Status**: Read `AGENTS.md` to get the latest project status, current objectives, and roadmap.
2. **Read Scope**: Read `README.md` for high-level feature scope and end-user expectations of what the plugin does.
3. **List Source Files**: Examine the file listing of subfolders and files within `/src`, since this is what compiles down to the `main.js` file that Obsidian uses in its plugin runtime. Become familiar with the architecture of scripts.
4. **Analyze main.js and view.js**: Read and analyze `src/main.js` and `src/view.js` as the two pillars of the Colophon plugin. The other `src/` scripts ultimately tie together in the classes defined in these two pillar files.
5. **Confirm Identity**: Recognize that you are working on **Colophon v2.x**, an Obsidian plugin that uses a custom JSON file format (`.colophon`) and Tiptap v3.

# Development Workflows

## The "Dev Loop"

1. **Edit**: Modify `src/*.js` or `styles.css`.
2. **Build**: Run `pnpm build`.
3. **Reload**: The `.hotreload` file is present; Obsidian will auto-reload the plugin. The user can otherwise force reload the Obsidian plugin runtime for testing.

## Styling Strategy

- **Scoped**: All styles must be scoped to `.colophon-workspace` or use `.colophon-` as a namespace to avoid leaking into Obsidian's UI.
- **Modes**: Use `.colophon-type-manuscript` and `.colophon-type-script` to apply mode-specific typography (e.g., Courier for "script" documents).
- **Variables**: Use Obsidian's CSS variables (`--background-primary`, `--text-normal`) for theme compatibility.

# Readiness Output

Signal that you have completed this workflow and are ready for further tasks by summarizing the essential concepts and instructions from this workflow, capturing project goals, agent roles, coding conventions, workflows, and any specific guidelines for LLM collaboration. Present the summary in tightly-focused bullet points (5 or fewer), omitting general or redundant details. Compose the summary so that it can serve as the starting context for upcoming requests.