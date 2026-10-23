@AGENTS.md

# Code exploration: codebase-memory first

This repo is indexed by the `codebase-memory-mcp` server (project `D-AL-FITRA-GITHUB-Nunnn-Stock-Analyzer`, full mode, auto-refreshed). For every task, explore code through it before reading files or running grep:

- Find symbols with `search_graph`, callers/callees with `trace_path`, a function's source with `get_code_snippet`, a file's declarations with `get_file_outline`, text or patterns with `search_code`.
- Read only the exact lines you will edit (Read with offset/limit). Do not read whole large files to locate code.
- `get_code_snippet` and `search_code` show source with 2 extra leading spaces per line; take exact edit strings from Read, not from these results.
- Fall back to Grep/Bash only for literals the graph misses, for files listed as not indexed or partially parsed in `index_status` (SQL migrations, `.semgrep`, `.env.local`), or when the index is not ready.
- If a tool reports the index as stale or missing, run `index_repository` (mode `full`) for this repo before continuing.
