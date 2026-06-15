# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# My global preferences

- I am a beginner so explain things simply
- I prefer concise answers
- Always use dark mode colour examples
- I am building for Australian users
- My main project is Litrespy - a fuel price app

# How to work on every task

Before writing ANY code, follow these steps every time:

1. **PLAN first** — Read the relevant files, understand the problem, then write out a clear plan. Ask me to approve the plan before writing code.
2. **WRITE the code** — Implement the plan step by step.
3. **TEST it** — Check that it works. Open in browser if it's a UI change. Fix any errors before moving on.
4. **COMMIT** — Once it works, create a git commit with a clear message describing what changed and why.

Do not skip steps. Do not write code before I approve the plan.

# Token efficiency rules

- Keep all responses SHORT and direct — no padding, no repeating what was just said
- Do NOT re-read files you have already read in this session unless the content has changed
- Do NOT summarise what you just did at the end of a response
- Only read the specific lines needed, not entire large files
- When the task is done, say so in one sentence and stop
- Remind me to run /compact if the conversation has been going for a long time or the context feels large
