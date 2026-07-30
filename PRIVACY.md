# Privacy Policy for Alphafox Auth Sync Extension

**Last Updated:** July 30, 2026

## Overview

Alphafox Auth Sync (the "Extension") helps an Alphafox user detect an existing
web login session for a supported cryptocurrency exchange and create or update
the corresponding exchange-authentication record in the user's own Alphafox
account.

This policy describes the data handled by the Extension itself. The Alphafox
website and the rest of the Alphafox service are also subject to the general
Alphafox privacy policy.

## Supported Exchanges and Authentication Data

The Extension handles authentication cookies, session tokens, and selected
request headers from these supported exchanges:

- Binance: the `p20t` Cookie and a CSRF request header used to construct a
  `cookie_csrf` credential.
- OKX: the `token` Cookie, with the Authorization request header used only when
  the Cookie credential is unavailable.
- Bitget: the `bt_newsessionid` and `bt_rtoken` Cookies.
- Bybit: the `secure-token` Cookie.
- Gate.io: the `token` Cookie.

Chrome's Cookies API returns cookies available for a supported exchange domain.
The Extension examines those cookies to locate the required authentication
values and, where available, derive an exchange account username or account ID
used to identify the account being synchronized. The Extension does not include
the raw Binance `x_token` value in the constructed credential sent to Alphafox,
but available Binance Cookie values can be examined by the local account-
identifier detector.

## Other Data Handled

The Extension also handles:

- Alphafox session information returned by `https://alphafox.app/api/auth/session`,
  which may include the Alphafox user ID, email address, name, profile image,
  email-verification state, account timestamps, and roles.
- Exchange account identifiers derived from supported exchange cookies or an
  Authorization header, such as a username, nickname, email-form account name,
  user ID, UUID, the source field, and normalized comparison values.
- Browser and synchronization metadata, including the supported exchange
  domain, credential type, capture source, capture time, required Cookie names,
  a randomly generated browser-profile ID and label, linked Alphafox record IDs,
  and Bitget automatic-synchronization status.
- The active or completed tab URL long enough to determine whether the tab is a
  supported exchange. Unsupported URLs are not stored or transmitted by the
  Extension.

The Extension does not read page text, images, form contents, balances, orders,
positions, payment-card data, or the user's Alphafox password.

## How Data Is Collected

The Extension's background service checks supported exchange sessions when it
starts, when the user requests a refresh, when a supported exchange page
finishes loading, and when matching requests on a supported exchange contain a
Cookie, CSRF, or Authorization header that can contribute to credential
detection. These checks can occur before the user chooses to send a credential
to Alphafox.

The first Alphafox credential record is transmitted only after the user chooses
Create or Sync in the Extension popup. After the user manually binds a Bitget
record, changes to either required Bitget Cookie can automatically update that
same bound record. The Extension does not create a new Bitget record in the
background.

## How Data Is Used

The Extension uses this data only to:

- Detect whether the user is signed in to Alphafox and a supported exchange.
- Display masked credential and synchronization status in the popup.
- Help the user avoid synchronizing a credential to the wrong exchange account.
- Create, update, list, select, or delete the user's Alphafox
  exchange-authentication records.
- Associate a browser profile with the intended Alphafox record.
- Automatically update an already bound Bitget record when its required Cookies
  change.

## Local Storage and Retention

The Extension uses Chrome `storage.local`. Depending on the exchange and the
user's actions, locally stored data can include:

- The latest constructed exchange credential and its capture metadata. The
  credential value is not masked before being written to `storage.local`.
- The last successfully synchronized Bitget credential used to detect whether a
  later Cookie value has changed.
- Alphafox session and masked authentication-method data cached for the popup.
- The browser-profile ID and label, linked record IDs, and Bitget
  automatic-synchronization status.

Newly detected values can replace earlier values for the same exchange. Signing
out of Alphafox prevents authenticated synchronization but does not by itself
delete every value in Chrome `storage.local`. Uninstalling the Extension removes
its local extension storage through Chrome.

An exchange-authentication record sent to Alphafox remains in the user's
Alphafox account until the user deletes that record or it is removed under the
Alphafox account and data-retention policies.

## Transmission and Sharing

The Extension transmits data over HTTPS only to Alphafox API endpoints under
`https://alphafox.app`. A synchronization request can include the exchange,
credential type, full credential value, capture metadata, browser-profile
metadata, and a derived exchange account username or account ID. Alphafox
services, including the components responsible for exchange authentication,
process that information to provide the requested synchronization feature.

The Extension does not send exchange credentials to advertising networks, data
brokers, third-party analytics services, or any non-Alphafox service. It does not
sell user data or use it for personalized advertising, creditworthiness, or
lending decisions.

## Security

Data sent from the Extension to Alphafox is transmitted over HTTPS. Chrome
isolates extension storage from ordinary website scripts. No method of
transmission or electronic storage is completely secure, and users should
protect access to their operating-system account and Chrome profile.

## Permissions

- `cookies`: examines cookies on supported exchange domains to locate required
  authentication values and account identifiers.
- `storage`: keeps credential state, popup cache, browser-profile bindings, and
  synchronization status in Chrome local extension storage.
- `activeTab`: identifies the supported exchange in the active tab when the user
  manually refreshes a credential.
- `tabs`: detects completed supported exchange pages and opens the Alphafox login
  page when requested.
- `webRequest`: observes Cookie, CSRF, or Authorization request headers on
  supported exchange domains when they can contribute to credential detection.
  The Extension does not block or modify requests.
- Host permissions: limit the Extension's access to Alphafox and the declared
  Binance, OKX, Bitget, Bybit, and Gate.io domains used by its synchronization
  feature.

## User Choices and Controls

Users can:

- Choose whether to create or manually synchronize an Alphafox record.
- Select or switch the Alphafox record associated with a browser profile.
- Delete an Alphafox exchange-authentication record from the popup.
- Sign out of Alphafox to prevent authenticated synchronization.
- Remove local Extension data by uninstalling the Extension.

Removing an Alphafox server record does not necessarily remove every locally
cached value. Uninstall the Extension to remove its Chrome local extension
storage.

## Chrome Web Store Limited Use

The Extension uses user data only to provide or improve its single purpose of
synchronizing supported exchange web authentication information with the user's
Alphafox account. Its use and transfer of user data complies with the Chrome Web
Store User Data Policy, including the Limited Use requirements.

The use of information received from Google APIs will adhere to the Chrome Web
Store User Data Policy, including the Limited Use requirements.

## Third-Party Services

The Extension interacts with Alphafox and supported exchange websites. Alphafox
Auth Sync is not affiliated with or endorsed by Binance, OKX, Bitget, Bybit,
Gate.io, or any cryptocurrency exchange.

## Children's Privacy

The Extension is not intended for children under 18. Alphafox does not knowingly
collect personal data from children through the Extension.

## Changes to This Policy

Alphafox may update this policy when the Extension's behavior, permissions, or
legal obligations change. The "Last Updated" date identifies the current
version. Material changes will be reflected in the published policy before or
when the corresponding Extension change is released.

## Contact

For privacy questions or requests, contact `support@alphafox.app`.
