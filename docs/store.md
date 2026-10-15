# Store submission notes

Everything here is copy and form answers, prepared so a listing can be filled in
without rethinking it. The accounts themselves do not exist yet (Play, $25
one-time; Apple, $99/year), so nothing here has been submitted.

The privacy policy both stores ask for is [PRIVACY.md](../PRIVACY.md), and its
URL is what goes in the listing field.

## Listing copy

**App name:** `sh — phone terminal for your own machine` (Play caps this at 30
characters: use `sh — terminal for your machine`).

**Short description** (Play, 80 characters):

```
A terminal in your pocket that connects straight to your own computer.
```

**Full description:**

```
sh gives your phone a real terminal on a machine you already own. No cloud, no
account, no relay server: the agent runs on your computer, the app connects to
it over your own network or a private Tailscale network, and the bytes go
directly between the two.

It is a real shell, not a simulation. The agent opens a PTY as your user, so the
working directory, environment and background jobs are genuinely yours. A long
build keeps running on the machine when the app is closed, and reattaching
replays what you missed rather than starting over.

WHAT IT DOES

- A real PTY on your machine, with the app as the screen
- Gesture control keys: two-finger swipe for arrows, Ctrl-C and Ctrl-D
- Command palette: run saved commands in the live shell, right where you are
- Reconnects survive network drops and replay the exact bytes you missed
- Pinch to resize, and A- / A+ keys for the TUI that needs a wider screen
- Named tmux sessions that outlive the app
- Pair by scanning a QR code the agent prints; the token never leaves your devices

WHAT IT NEEDS

A computer running the sh-agent (free, open source, `uv tool install
sh-agent`), and a phone on the same network as it. Tailscale is optional and
lets you reach your machine from anywhere without exposing it to the internet.

PRIVACY

The app contains no analytics, no tracking and no advertising, and it does not
talk to any server belonging to the developer -- there isn't one. It connects to
the address you configure and nothing else. Read the privacy policy for the
specifics.

OPEN SOURCE

The agent and the app are both open source (MIT). Source and issues:
https://github.com/Faisal-Fayaz/sh-app and
https://github.com/Faisal-Fayaz/sh-agent
```

**Category:** Tools (Play), Developer Tools (App Store).
**Content rating:** everyone; a terminal can display anything you run in it, but
the app ships no content of its own.
**Tags/keywords:** terminal, ssh alternative, remote shell, developer tool.

## Play data safety answers

The form's questions, answered:

- **Does your app collect or share any of the required user data types?** No.
  There is no analytics SDK, no crash reporter, and no server operated by the
  developer. The listing description and privacy policy both say where data
  goes, which is the disclosure the policy covers.
- **Is all user data encrypted in transit?** Data goes over the connection you
  configure, which may be plain HTTP on a trusted local network or Tailscale's
  WireGuard tunnel when used remotely. Answer honestly: *No*, and point at the
  policy — claiming TLS would be false, because the agent serves plain HTTP.
  This is the one answer worth a careful re-read of the form's current wording.
- **Do you provide a way for users to request data deletion?** Yes — uninstall
  the app, and delete the agent's token file. Nothing is held by the developer,
  so there is nothing for us to delete.

The camera permission is used only to scan the pairing QR code; frames are
decoded on-device and never stored or sent. Say so in the permission
justification if the form asks.

## iOS specifics

- `NSLocalNetworkUsageDescription` and the Tailscale CIDR exception are already
  in `app.json`; the App Store asks what the camera is for, and the same sentence
  as above is the answer.
- Reviewers will not have a machine running the agent. The notes field should
  explain that the app pairs with a self-hosted agent, link the agent README,
  and mention that everything the app does requires only the user's own
  hardware. Expect this to be the part of a submission that takes a reply or
  two.

## What a submission still needs

- Accounts: Play Console ($25), Apple Developer Program ($99/year).
- A production signing key: EAS manages one for preview builds; production
  should be `eas build --profile production` with credentials either managed by
  EAS or generated locally and backed up somewhere durable.
- Screenshots from a real device (the emulator loop in the README produces
  them), a feature graphic for Play, and an app icon at 512x512, which
  `assets/icon.png` already covers at 1024.
