# GridMaster Agent Collaboration Protocol

> **Purpose:** Defines the operating agreement for the user, Codex (reviewer/coordinator), and Antigravity (implementation agent). It applies to every GridMaster v2 plan.

## Main goal

Complete GridMaster v2 in approved plan order. Each plan is implemented test-first, independently reviewed, and accepted only when its documented contract, scope, and verification gates are satisfied.

## Roles and authority

| Role | Responsibilities | Cannot do without user approval |
| --- | --- | --- |
| User | Starts/stops work; may override technical decisions; approves external/destructive actions and commits. | — |
| Codex | Locks scope; makes routine technical and contract decisions; issues handoffs; reviews code; runs independent verification; records acceptance evidence. | Commit, discard user work, or take an external action needing user authority. |
| Antigravity | Implements only the active handoff; writes focused tests; reports evidence and gaps. | Start work while stopped; expand scope; commit; begin another plan; resolve an undocumented contract gap outside a Codex handoff. |

## Shared sources of truth

Read these before every implementation or review cycle, in this order:

1. `docs/superpowers/specs/2026-08-23-gridmaster-v2-design.md`
2. `docs/superpowers/plans/README.md`
3. The active plan in `docs/superpowers/plans/`
4. `docs/superpowers/PROJECT-CONTINUATION.md`
5. `docs/superpowers/agent-handoff.md`

`PROJECT-CONTINUATION.md` is the accepted-plan ledger. `agent-handoff.md` is the current-work inbox. Reports belong in `iterations/`.

## Start and stop protocol

- The user says `START <plan or task>` to Codex.
- Codex changes `agent-handoff.md` to `STARTED` with a task contract, allowed scope, acceptance checks, and required commands.
- Antigravity may make changes only while the handoff says `STARTED`.
- The user says `STOP` to Codex at any time. Codex changes the handoff status to `STOPPED`.
- On `STOPPED`, Antigravity immediately stops making changes, preserves the dirty worktree, and reports its current state without reverting work.

## User command interface

- `READ`: Codex reads the current handoff and latest Antigravity report, reviews the stated task, and records its findings under `iterations/` before replying.
- `START`: Codex assigns the next bounded task by changing `agent-handoff.md` to `STARTED`. Antigravity then works only on that task.
- `STOP`: Codex immediately changes `agent-handoff.md` to `STOPPED`. Both agents preserve the worktree and stop assigning or making implementation changes until a new `START`.

Each command response must name the active task or review artifact so the shared filesystem remains the durable record.

## Implementation rules

- Work only on the active plan and task. Do not begin a later plan.
- Use CodeGraph before direct source searches whenever `.codegraph/` exists.
- Preserve user changes. Never reset, checkout, mass-rewrite, or delete material work.
- Never import `legacy/v1/` into v2.
- Keep `@gridmaster/core` React-, DOM-, and browser-global-free. Keep React and React DOM as peers of `@gridmaster/react`.
- Do not add undocumented public APIs or silently broaden a predecessor's contract. Record the evidence and stop for a user decision.
- Work test-first: focused failing test, minimal implementation, focused passing test, then the full handoff verification suite.
- Do not commit unless the user explicitly requests it.

## Required skills and checks

Antigravity must use:

- `superpowers:using-superpowers` at session start.
- `superpowers:brainstorming` before any design or public-contract change.
- `superpowers:test-driven-development` before feature or bug-fix code.
- `superpowers:systematic-debugging` for a failing test or unexpected behavior.
- `superpowers:verification-before-completion` before reporting success.

Codex must use CodeGraph for codebase understanding and independently rerun the active handoff's verification commands before making an acceptance recommendation.

## Handoff report format

Antigravity's report must include:

1. Initial failing-test command and observed failure.
2. Changed files and why each changed.
3. Public exports added, removed, or deliberately unchanged.
4. Exact verification commands, exit codes, and test counts.
5. Specification gaps, deviations, or unresolved risks.
6. Confirmation that no commit was created and no later plan was started.

## Acceptance flow

1. Antigravity reports `REVIEW READY` in `agent-handoff.md` and writes the detailed report to `iterations/`.
2. Codex inspects the implementation and runs independent verification.
3. Codex writes either `REVISIONS REQUIRED` or `READY FOR USER ACCEPTANCE` in the handoff.
4. Only the user may accept the plan. After acceptance, Codex updates `PROJECT-CONTINUATION.md` with verified results and unlocks no subsequent work until the user starts it.

## Commit handoff rule

- Codex never creates a commit unless the user explicitly asks.
- After every accepted implementation unit or plan, Codex must state whether the verified changes are ready to commit.
- When a commit is appropriate, Codex must provide one exact conventional commit message, scoped to the accepted change. Example: `feat(react): add controlled grid adapter`.
- Codex must identify any unaccepted or unrelated dirty-worktree changes that should stay out of that commit.
- Antigravity must not create commits; its report must say whether it believes the handoff is ready for a Codex-recommended commit message.
