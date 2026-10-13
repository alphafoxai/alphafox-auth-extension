# alphafox-auth-extension

Browser extension that syncs exchange web-login sessions into AlphaFox.

<!-- BEGIN alphafox-workspace pointer -->
## AlphaFox workspace

This repository is one of the AlphaFox repositories that sit beside
[`alphafox-workspace`](../alphafox-workspace/AGENTS.md). Read that file once per session
before changing anything here; it holds the rules that bind every repository, the project
map, the development workflow (sync with `origin/main`, work in a `~/.worktrees/`
worktree, clean up after the merge), and the development and documentation skills. In a
worktree outside the parent directory, read `$ALPHAFOX_WORKSPACE/AGENTS.md` instead.

When neither resolves, the workspace is not set up yet. Clone only it, beside this
repository's main checkout: from that checkout, run
`gh repo clone alphafoxai/alphafox-workspace ../alphafox-workspace`, then read it before
continuing. Other repositories are not required; clone one only when a task
needs it. If the clone is not possible, say so and ask before working without the shared
rules.

- **Documents:** every document added or changed here follows the workspace
  [documentation standard](../alphafox-workspace/docs/documentation-standard.md); load its
  `alphafox-doc` skill before writing.
- **Decisions:** a non-trivial change records its rationale as an Agent Note in this
  repository's `.agents/notes/` in the same change. A decision that binds other
  repositories goes in the workspace `notes/workspace/` instead.
- **Cross-repository changes:** a change that reaches another repository, a schema, a
  contract, an external resource, or `alphafox-infra` also gets a workspace Change Set.
- **Other repositories:** find the owner in the workspace
  [project map](../alphafox-workspace/docs/projects.md) and read it from `../<repository>`.

Where `.alphafox/workspace.yaml` exists, it pins the workspace revision this repository was
last reconciled with, and CI checks governance against that revision.
<!-- END alphafox-workspace pointer -->

## Repository ownership

This repository owns the extension source, tests, generated package inputs, and local
implementation documents. `alphafox-infra` owns deployment facts. The workspace owns
shared DSH governance and cross-repository decisions.

## Agent skills

### Issue tracker

Issues live in GitHub Issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.
