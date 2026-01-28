---
description: Closes a context window for future agent sessions
---

Update the project's memory bank by editing @AGENTS.md:

flowchart TD
    Start[Update Process]

    subgraph Process
        P1[Review ALL @src/ Files]
        P2[Review @styles.css]
        P3[Review @package.json]
        P4[Document Current State]
        P5[Clarify Next Steps]
        P6[Document Insights & Patterns]

        P1 --> P2 --> P3 --> P4 --> P5 --> P6
    end

    Start --> Process

The AGENTS.md file must include up-to-date information for the following sections:

1. Project Brief
    - Foundational section that defines core requirements and goals
    - Source of truth for project scope
2. Product Context
    - Why this project exists
    - Problems it solves
    - How it should work
    - User experience goals
3. Active Context
    - Current work focus
    - Recent changes
    - Next steps
    - Active decisions and considerations
    - Important patterns and preferences
    - Learnings and project insights
4. System Patterns
    - System architecture
    - Key technical decisions
    - Design patterns in use
    - Component relationships
    - Critical implementation paths
5. Tech Context
    - Technologies used
    - Development setup
    - Technical constraints
    - Dependencies
    - Tool usage patterns
6. Progress
    - What works
    - What's left to build
    - Current status
    - Known issues
    - Evolution of project decisions

Remember--AGENTS.md effectively serves as the memory bank for future work. After every memory reset, you will have begun completely fresh. This, therefore, is your only link to previous work. It must be maintained with precision and clarity, as your future effectiveness depends entirely on its accuracy.