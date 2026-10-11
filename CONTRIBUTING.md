# Contributing to alphafox-auth-extension

## Shared governance

This repository follows the AlphaFox workspace rules pinned in
[`.alphafox/workspace.yaml`](.alphafox/workspace.yaml). Resolve a local workspace
checkout from `$ALPHAFOX_WORKSPACE` when available; otherwise use the exact pinned
workspace commit. The workspace owns rules shared across repositories. This file and
[the local `AGENTS.md`](AGENTS.md) own auth-extension-specific guidance.

`alphafox-infra` remains the source of record for deployment, environment, topology,
resource, and secret facts. Auth Extension owns its extension source, tests, generated
package inputs, and local implementation documents. The published ZIP is an extension
artifact; its release and distribution workflow remains local to this repository.

## Cross-repository changes

A change that reaches another repository, an artifact or event contract, a schema, an
external resource, a required environment value, or Infra requires a Change Set in
`alphafox-workspace/changes/` before it is considered complete. The Change Set names
exact repository refs, observable invariants, required checks, rollout, rollback, and
owner. It does not grant deployment, database, package-publication, or production access.

A change confined to Auth Extension uses the normal issue and pull-request flow. Keep
Auth Extension-specific decisions in this repository's note tree when present;
decisions that bind multiple repositories belong in the workspace note tree.

## Verification reporting

Report only commands actually run. Governance checks do not prove extension build,
test, packaging, release, or deployment acceptance. Those are owned by this
repository's existing product CI and release workflow.

The governance workflow is dependency-free and checks the pinned workspace revision,
registry identity, shared governance metadata, and any Auth Extension Agent Notes. It
does not install product dependencies or run product commands.
