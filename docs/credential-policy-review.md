# Credential policy review gap

This is a pending maintainer and privacy-owner review record.
It is not a compliance approval, a legal conclusion, a confirmed leak incident, or permission to change `PRIVACY.md` or request behavior.

## Provenance

The archive review lived at `apps/auth-extension/docs/development/discussion/credential-policy-review.md` in `alphafoxai/alphafox-monorepo` at [`b4e9454de2e196dac80a9a89f94a22bf98e03f5f`](https://github.com/alphafoxai/alphafox-monorepo/blob/b4e9454de2e196dac80a9a89f94a22bf98e03f5f/apps/auth-extension/docs/development/discussion/credential-policy-review.md).
That file named owner `monorepo-maintainers`, created `2026-10-07`, and expired `2026-11-06`.
Those dates and that owner name are historical provenance only.

This 2026-10-13 re-review does not inherit the archive deadline and does not keep `monorepo-maintainers`.

## Owners and new deadline

| Role | Who | Duty |
|---|---|---|
| Extension source | Repository maintainers of `alphafoxai/alphafox-auth-extension`. Recent `PRIVACY.md` and credential history is authored by Joe (`joe@ddddao.cc`, `qunhaosong@gmail.com`) | Keep this record aligned with current source. Do not edit legal text from a documentation task |
| Privacy and legal release | The person who can approve a `PRIVACY.md` change. Published contact is `support@alphafox.app` | Decide whether the policy text, the Bitget preflight, or both must change |
| This record | Same source owner | Refresh, promote, or close the record by `2026-11-12` |

`2026-11-12` is a new review deadline set on 2026-10-13.
It is not the archive expiry `2026-11-06`.
Tracking issue: [`alphafox-auth-extension#21`](https://github.com/alphafoxai/alphafox-auth-extension/issues/21).

## Still-valid discrepancy

[`PRIVACY.md`](../PRIVACY.md) Transmission and Sharing says the Extension transmits data over HTTPS only to AlphaFox API endpoints under `https://alphafox.app`, and that it does not send exchange credentials to any non-AlphaFox service.

[`assertBitgetSessionStillValid`](../src/services/bitget-credential-validation.ts) `POST`s to `https://www.bitget.com/v1/trigger/uta/portfolio/getPortfolioOverview` with an explicit `cookie` header that contains `bt_newsessionid` and `bt_rtoken`.
[`saveExchangeAuthMethod`](../src/services/exchange-auth-sync.ts) runs that check for Bitget before `AuthService.createAuthMethod` or `updateAuthMethod`.
The bound-record auto-update path [`syncLinkedBitgetCredential`](../src/services/bitget-cookie-auto-sync.ts) also saves through `saveExchangeAuthMethod`, so it uses the same preflight.

This is a static source-and-policy difference.
It is not a claim that credentials were leaked, that the request is unlawful, or that the policy already permits the request.

## Other assertions checked on 2026-10-13

| Archive assertion | Current reading | Adopted? |
|---|---|---|
| Manifest includes `scripting` | [`public/manifest.json`](../public/manifest.json) lists `scripting` | Yes |
| Fomo capture enumerates tab `localStorage` before extracting Privy fields | [`readFomoLocalStorage`](../src/services/fomo-capture.ts) copies every key, then `extractEssentialFomoAuth` keeps Privy token fields | Yes: a restricted payload does not prove unread keys were never read in the injected script |
| Host-permission list in the policy is incomplete versus the manifest | Manifest also has `fomo.family` and `suitechsui.online`. The policy Host permissions bullet names Binance, OKX, Bitget, Bybit, and Gate.io, and does not name Fomo or `suitechsui` | Yes as a description gap, not as a legal finding |
| Policy contact is an unusable redacted string | Current Contact is `support@alphafox.app` | No. The archive claim is not adopted |
| Policy SHA-256 `1a107886da4329e7cf6538ab2c41a4b9c14a42edd702c0fd85add6bb8a14529c` | `sha256sum PRIVACY.md` on this checkout produced the same digest | Yes as provenance that the published policy bytes have not changed since the archive review |
| Binance detector examines supplied cookies and does not submit raw `x_token` | [`detectExchangeAccount`](../src/config/exchange-account.ts) walks supplied cookies and headers for identifiers. No `x_token` symbol exists in current TypeScript. README and PRIVACY still state the `x_token` exclusion | Partial: identifier examination is confirmed by reading the detector. The `x_token` exclusion was not re-proven by a capture test |
| Limited Use compliance is not provable from static source | Unchanged | Yes as a limit, not as a compliance result |

## Still unverified

- Isolated request tracing of manual and automatic Bitget calls from a loaded extension
- Whether Chrome actually sends the constructed Cookie header on the extension-host `fetch`
- Whether any non-Privy `localStorage` value is stored or transmitted after the injected script returns
- Chrome Web Store Limited Use review
- Any legal interpretation of “non-AlphaFox service”

No browser, network, credential, auth, or API operation ran for this record.

## What this record does not authorize

Do not edit `PRIVACY.md`, reduce permissions, or change Bitget request logic from this documentation change.
A product or legal change needs its own issue and authorization.
