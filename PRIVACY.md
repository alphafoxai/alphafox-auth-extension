# Privacy Policy for AlphaFox Auth Sync Extension

**Last Updated:** July 18, 2026

## Overview

AlphaFox Auth Sync reads authentication cookies or tokens from supported cryptocurrency exchange websites. The first credential binding is sent only after the user chooses create or sync in the popup. After a Bitget record is manually bound, changes to its required cookies automatically update that same AlphaFox record.

## Data We Collect

- Supported exchange cookies or session tokens required by AlphaFox Signal Center.
- AlphaFox web session status from `https://alphafox.app/api/auth/session`.
- Local metadata such as capture time, exchange domain, and credential type.

Supported credential types:

- Binance `cookie_csrf` (`p20t` Cookie + CSRF request header)
- OKX `authorization` (`token` Cookie)
- Bitget `session` (`bt_newsessionid` + `bt_rtoken` Cookies)
- Bybit `secure_token` (`secure-token` Cookie)
- Gate.io `token` (`token` Cookie)

The extension does not read or submit Binance `x_token`.

## How Data Is Used

The data is used only to:

- Detect whether the user is logged in to AlphaFox.
- Create a first exchange credential in AlphaFox.
- Sync a refreshed exchange credential to AlphaFox.
- Automatically update an already bound Bitget record when either required Bitget Cookie changes. The extension never creates a Bitget record in the background.
- Display masked local status in the extension popup.

## Local Storage

The extension stores the latest detected exchange credential, browser-profile binding, last successfully synced Bitget credential, and Bitget automatic-sync status locally with Chrome `storage.local` so the popup and background service can update the intended existing record. AlphaFox passwords are never stored by this extension.

## Transmission

Credentials are transmitted over HTTPS to AlphaFox Web API endpoints under `https://alphafox.app`. The extension does not send exchange credentials to third-party analytics, advertising services, or any non-AlphaFox service.

## Permissions

- `cookies`: read authentication cookies from supported exchanges.
- `storage`: store the latest locally captured credential state.
- `activeTab` / `tabs`: detect the current exchange tab when the user refreshes manually.
- `webRequest`: observe supported exchange requests and capture CSRF headers when required.

## User Control

Users can:

- Delete saved AlphaFox credential records from the popup.
- Remove local extension data by uninstalling the extension.
- Sign out from AlphaFox on the website to stop plugin auto-login.

## Third-Party Services

The extension interacts with:

- AlphaFox (`alphafox.app`) for authentication status and credential sync.
- Supported exchange websites only to read browser cookies from the user's own logged-in session.

## Changes

This policy may be updated when the extension behavior changes. Continued use after an update means acceptance of the latest policy.
