# Privacy Policy for AlphaFox Auth Sync Extension

**Last Updated:** June 27, 2026

## Overview

AlphaFox Auth Sync reads Binance `cookie_csrf` authentication data and sends the selected credential to AlphaFox only after the user chooses create or sync in the popup.

## Data We Collect

- Binance `p20t` Cookie and CSRF request header required by AlphaFox Signal Center.
- AlphaFox web session status from `https://alphafox.app/api/auth/session`.
- Local metadata such as capture time, exchange domain, and credential type.

## How Data Is Used

The data is used only to:

- Detect whether the user is logged in to AlphaFox.
- Create a first Binance credential in AlphaFox.
- Sync a refreshed Binance credential to AlphaFox.
- Display masked local status in the extension popup.

The extension does not read or submit Binance `x_token`, and it does not request OKX, Bitget, Bybit, or Gate.io credential APIs.

## Local Storage

The extension stores the latest detected Binance credential locally with Chrome `storage.local` so the popup can show and submit it. AlphaFox passwords are never stored by this extension.

## Transmission

Credentials are transmitted over HTTPS to AlphaFox Web API endpoints under `https://alphafox.app`. The extension does not send exchange credentials to third-party analytics, advertising services, or any non-AlphaFox service.

## Permissions

- `cookies`: read supported Binance cookies.
- `storage`: store the latest locally captured credential state.
- `activeTab` / `tabs`: detect the current Binance tab when the user refreshes manually.
- `webRequest`: observe supported Binance requests and capture CSRF headers.

## User Control

Users can:

- Delete saved AlphaFox credential records from the popup.
- Remove local extension data by uninstalling the extension.
- Sign out from AlphaFox on the website to stop plugin auto-login.

## Third-Party Services

The extension interacts with:

- AlphaFox (`alphafox.app`) for authentication status and credential sync.
- Binance only to read browser cookies from the user's own logged-in session.

## Changes

This policy may be updated when the extension behavior changes. Continued use after an update means acceptance of the latest policy.
