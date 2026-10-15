# Privacy policy — sh

Last updated: 15 October 2026.

`sh` is a terminal for your phone that connects to a machine **you** own. It has
no account system, no servers, and no way for its author to see anything you do
with it. That is the whole policy, and the rest of this page is the detail.

This covers the phone app (`sh-app`) and the agent it talks to (`sh-agent`).

## What is collected

**Nothing is sent to the developer.** There is no analytics, no telemetry, no
crash reporting, no advertising, and no user tracking of any kind. The app does
not contain an SDK that reports anything anywhere, and it does not phone home on
launch. There is no account to create and nothing to log into except your own
machine.

## What the app stores on your phone

The app keeps what it needs to reconnect to your agent, in the operating
system's secure storage — iOS Keychain, or Android Keystore-backed encrypted
storage, through Expo's SecureStore:

- the agent's host and port, the access token and, if you set one, the write token
- the terminal font size you chose
- whether you have already seen the walkthrough

Uninstalling the app removes all of it. Clearing the app's data does the same
without uninstalling.

## The camera

The app asks for camera access only to scan the pairing code your agent prints.
Frames are decoded on the device by the scanner, and nothing is stored or
transmitted. The camera is not used for anything else, and if you would rather
not grant it, the pairing details can be typed in by hand instead.

## What the app sends, and to whom

Every network request the app makes goes to the address you configured: either
your machine on your local network, or its Tailscale address. It sends
authentication and, once connected, the bytes of your terminal session —
keystrokes, output, and window size.

Those requests go directly to your machine. They do not pass through any server
belonging to the developer, and there is no such server to pass through.

If you use Tailscale, your traffic is subject to [Tailscale's privacy
policy](https://tailscale.com/privacy-policy) as well as your own network
configuration. Tailscale is a separate product, not part of `sh`.

Tapping "Get Tailscale" on the welcome screen opens `tailscale.com` in your
browser. That is the one link in the app that leaves it, and it happens only if
you tap it.

## Updates

The app does not check for or download updates at runtime. There is no update
mechanism, so there is no update request that could reveal anything about you.
New versions come from wherever you installed the app.

## What the agent stores on your machine

The agent runs on your own computer and keeps its state there:

- `~/.config/sh/agent.env` — the access token, readable only by your user
  account (mode 0600)
- `~/.config/sh/palette.json` — your command palette
- `~/.local/state/sh/audit.log` — a local record of session and authentication
  events, including the connecting device's address and, where Tailscale
  confirms it, the Tailscale login. This file is also kept private to your user
  account and can be deleted at any time.

None of these are uploaded anywhere. To revoke a phone's access, delete the
token file and restart the agent: the app that was paired to it stops working,
and no other data is involved.

If Tailscale is running, the agent asks the local Tailscale daemon who is
connecting, over a unix socket on the same machine. That question never leaves
your computer.

## Children

`sh` is a developer tool and is not directed at children.

## Changes

Any change to this policy will appear in this file, in the repository's history.

## Contact

Questions, or a mistake in this document: open an issue at
[github.com/Faisal-Fayaz/sh-app/issues](https://github.com/Faisal-Fayaz/sh-app/issues)
or email <fai504438@gmail.com>.
