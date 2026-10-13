# Agent Note: Record the Bitget policy gap without editing the legal text

Status: implemented

## Problem

Current source sends Bitget session cookies to Bitget before an AlphaFox save.
Current `PRIVACY.md` says credentials go only to AlphaFox.
Editing either side from a documentation recovery would change a legal promise or a live request.
Leaving the gap only in the archived monorepo would hide a still-open review.

## Decision

This repository keeps `PRIVACY.md` and the Bitget preflight unchanged.
The pending review lives in [`docs/credential-policy-review.md`](../../../../docs/credential-policy-review.md).
Joe remains the source and `PRIVACY.md` author to contact; privacy-text changes still need the published contact `support@alphafox.app` and an explicit legal approval.
The new review deadline is `2026-11-12`, independent of the archive dates `2026-10-07` / `2026-11-06`.
Tracking issue: [alphafox-auth-extension#21](https://github.com/alphafoxai/alphafox-auth-extension/issues/21).

## Alternatives considered

**Rewrite `PRIVACY.md` to mention the Bitget preflight.** Rejected because this task has no legal-release authority.

**Remove the Bitget preflight so the policy becomes literally true.** Rejected because that changes product behavior and needs a separate code task.

**Copy the archive review wholesale.** Rejected because the archive “opaque contact” claim is false for the current Contact section, and unverified Fomo or permission claims must not be imported as facts.

**Do nothing.** Rejected because the discrepancy would remain only in an archived repository.

## Consequences

- Readers can find the gap and the named owners without treating the record as “already compliant” or “already fixed”.
- Documentation-only files in this change are Markdown; `build-extension.yml` ignores `**.md` and `docs/**`.
- A later authorized task still has to trace live requests and decide the policy or the code.

## Verification

Read `PRIVACY.md`, `src/services/bitget-credential-validation.ts`, `src/services/exchange-auth-sync.ts`, `src/services/bitget-cookie-auto-sync.ts`, `src/services/fomo-capture.ts`, `src/config/exchange-account.ts`, and `public/manifest.json` on `db0f7fbd0`.
Ran `sha256sum PRIVACY.md` and observed `1a107886da4329e7cf6538ab2c41a4b9c14a42edd702c0fd85add6bb8a14529c`.
Did not load the extension, send a Bitget or AlphaFox request, or read a real credential.
