# Changelog

Notable changes to `sh-app`, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The app is not on either store yet; `1.0.0` is the preview build linked from the
README.

## 1.0.0 — 2026-10-15

First preview.

### Added

- A terminal that is a real one: `xterm.js` inside a WebView, wired to the agent
  over a WebSocket, with the ANSI, UTF-8 and resize behaviour of the real thing.
- Two-finger gestures for the keys a phone keyboard hides — arrows, `Ctrl-C`,
  `Ctrl-D`, `Esc`, `Ctrl-Z`, and a sticky modifier — with pinch to resize text.
- Pairing by scanning the agent's QR code, or typing the details by hand when the
  camera is unavailable.
- Reconnect that replays the scrollback over a drop instead of starting over, and
  that keeps retrying a host which is merely asleep rather than giving up.
- Named tmux sessions, so closing the app does not kill a running build.
- A swipe-to-run command palette, editable from the phone.
- A first-run walkthrough covering install, pairing and going remote.

### Fixed

- **iOS could not reach the agent at all.** `NSAppTransportSecurity` now carries
  exceptions for the private and CGNAT ranges rather than only for loopback, and
  `NSAllowsLocalNetworking` covers the local network.
- The iOS launch hung on a dynamic import of `react-native`.
- Long commands in the palette were truncated with no way to read them; they now
  wrap.

### Changed

- A retry against a tailnet address now mentions checking that Tailscale is
  running on the phone, since that address is the one that fails when the tunnel
  is off rather than when the machine is asleep. The hint is limited to
  `100.64.0.0/10` hosts so it never becomes noise on a LAN address.
