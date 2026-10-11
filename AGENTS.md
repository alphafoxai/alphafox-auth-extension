# alphafox-auth-extension

Browser extension that syncs exchange web-login sessions into AlphaFox.

## AlphaFox workspace governance

This repository is governed by the pinned AlphaFox workspace revision in
[`.alphafox/workspace.yaml`](.alphafox/workspace.yaml). Before applying a rule that
binds more than one repository:

1. Resolve `$ALPHAFOX_WORKSPACE/AGENTS.md` when that checkout is available; otherwise
   read the workspace revision named by `.alphafox/workspace.yaml`.
2. Read the relevant workspace document before changing cross-repository behavior.
3. Create or update a workspace Change Set when a change reaches another repository,
   an artifact or event contract, a schema, an external resource, a required
    environment value, or `alphafox-infra`.

This repository owns the extension source, tests, generated package inputs, and local
implementation documents. `alphafox-infra` owns deployment facts. The workspace owns
shared DSH governance and cross-repository decisions.

The committed workspace revision is the governance dependency for this component. A
local `$ALPHAFOX_WORKSPACE` checkout is navigation convenience, not a replacement for
the committed pin; do not silently read workspace `main` when the pinned revision is
unavailable.

## Agent skills

### Issue tracker

Issues live in GitHub Issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.
