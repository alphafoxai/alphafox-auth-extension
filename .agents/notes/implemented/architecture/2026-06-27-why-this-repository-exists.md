# Agent Note: Capture exchange web-login sessions in a dedicated browser extension

Status: implemented

## Problem

Signal auth methods need the cookies and tokens a user already has in a
browser session on an exchange site. A website cannot read those cookies. A
server cannot complete that capture without asking the user to paste secrets.

## Decision

`alphafox-auth-extension` is the Chrome MV3 extension that reads the necessary
exchange cookies and tokens after the user logs in on the exchange site, then
saves them through the AlphaFox Web API as signal auth methods. This repository
is public and releases a zip on GitHub Releases. It does not store the AlphaFox
password, does not execute trades, and does not own Signal Center observation.
`alphafox-web` owns the API that persists the auth method.

## Alternatives considered

The alternatives weighed when this repository was created are not recorded.

## Consequences

- The published artifact is `alphafox-auth-extension.zip`. Documentation-only
  pushes must not republish it.
- Exchange session capture stays in the extension; Web and Signal Center consume
  the saved auth method.
