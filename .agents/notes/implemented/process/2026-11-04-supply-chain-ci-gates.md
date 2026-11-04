# Agent Note: Pin CI actions and gate dependency advisories

Status: implemented

## Problem
Workflows referenced third-party actions by mutable tags, so a moved tag could change what runs under an unchanged workflow file. No CI job checked the locked dependencies for known advisories, so a vulnerable lockfile could merge without a signal.

## Decision
Every third-party action in `.github/workflows/` is pinned to a full commit SHA, with the release tag as a trailing comment. Local actions and `docker://` references are unchanged.
Dependabot watches each ecosystem in this repository weekly, with minor and patch updates grouped per ecosystem, `open-pull-requests-limit: 5`, a 7-day cooldown, and no auto-merge.
A `pnpm audit --prod --audit-level high` step runs in `build-and-release` before the build. The job keeps `ubuntu-latest`, as public repositories do under the runner policy.

## Alternatives considered
**Move the job to the organization runner** — the runner policy excludes public repositories from the pool.

## Consequences
- The repository has no test job, so the audit runs in the build-and-release job; it gates the release build.

## Verification
- `pnpm audit --prod --audit-level high` on the current lockfile: exit 0, no known vulnerabilities.
- `ruby -ryaml` parsed `build-extension.yml`.
