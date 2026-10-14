# sh-app

Android client for [`sh-agent`](https://github.com/Faisal-Fayaz/sh-agent) — a terminal that runs on your machine and is driven
from your phone over your private network.

Expo + React Native, with xterm.js rendered inside a WebView.

## What it does

- **A real terminal** driving a PTY on your machine, so the working directory, environment and
  background jobs are genuinely yours
- **Gesture control keys** — two-finger swipe for arrows, `Ctrl-C` and `Ctrl-D`, because a single
  finger belongs to text selection
- **Command palette** — swipe a card right to run it *in the live shell*, left to edit it
- **Survives network drops** — reconnect replays exactly the bytes you missed

See the agent README for the wire protocol and the resume design.

## Setup

```bash
npm install          # postinstall regenerates the inlined xterm payload
npx expo start       # scan the QR with Expo Go
```

Start the agent first (see its README), then in the app set **Host** to the address it printed,
**Port** `8765`, **Token** to its `SH_TOKEN`.

## Layout

```
src/
  app/            Expo Router routes (file = screen)
    _layout.tsx     root layout: providers + stack
    index.tsx       redirect to /terminal or /connect
    connect.tsx     settings
    terminal.tsx    the shell
  agent/          AgentClient — WebSocket, resume, exponential backoff
  terminal/       bridge.ts (message routing), terminalHtml.ts, generated/assets.ts
  screens/        presentational components behind the routes
  state/          SettingsProvider
  storage/        expo-secure-store access
scripts/
  build-terminal-bundle.mjs   inlines xterm into the WebView payload
  verify-m2.ts                end-to-end harness
```

## How the terminal works

xterm.js cannot run in the React Native layer — it needs a DOM. So the WebView hosts it and the two
sides talk through a small bridge.

```
xterm (in WebView)  --postMessage(JSON)-->  RN  --base64 stdin-->  agent
xterm (in WebView)  <--injectJavaScript---  RN  <--base64 stdout--  agent
```

All PTY bytes cross as **base64**. A UTF-8 character can straddle a WebSocket frame boundary, and
decoding raw text frames corrupts output. `src/terminal/bridge.ts` holds the message contract and is
shared by the app and the verification harness, so both exercise identical routing.

`build-terminal-bundle.mjs` base64s the xterm UMD bundles into `generated/assets.ts`, which the app
inlines into the WebView HTML. The WebView is therefore fully self-contained: no local file server,
no asset-path resolution, identical behaviour in Expo Go and in a release build. The cost is a
651 KiB HTML string.

## Running on an emulator

`scripts/emulatorctl.sh` wraps the Android emulator lifecycle so the loop is one command each.

```bash
./scripts/emulatorctl.sh start          # boot, wait for boot_completed
./scripts/emulatorctl.sh shot mydebug  # screenshot to /tmp/emu-run/shots/
./scripts/emulatorctl.sh stop
```

The emulator reaches the host loopback at **`10.0.2.2`**, so with the agent on `127.0.0.1:8765` you
point the app at `10.0.2.2:8765` — no LAN exposure needed. Metro works the same way
(`exp://10.0.2.2:8081`).

Two things that will bite you otherwise:

- Start Metro **without** `CI=1`. CI mode disables file watching, so edits are never re-served and
  you will debug stale code.
- `expo start --android` spawns its *own* emulator. If one is already running they collide on the adb
  port and the device vanishes from `adb devices`. Start Metro separately and launch Expo Go by hand
  with `am start -a android.intent.action.VIEW -d 'exp://10.0.2.2:8081'`.

## Connectivity

Tailscale is not required for local development — a same-Wi-Fi address works if the agent is started
with `SH_ALLOW_LAN=1`. For a real phone over the tailnet, bind the agent to its Tailscale address
and put the `100.x` address in the app.

## Development

```bash
npm run typecheck           # tsc --noEmit
npm run lint                # expo lint
npm run build:terminal      # regenerate generated/assets.ts after an xterm bump
npx expo export --platform android   # bundle smoke test
```

## Verifying

`scripts/verify-m2.ts` drives the real terminal HTML in headless Chromium against a live agent,
piping bridge messages through the same router the app uses. It proves the shipped artifact works,
not just that the code typechecks.

```bash
# terminal 1
cd ~/projects/sh && SH_TOKEN=dev-token ./scripts/serverctl.sh start

# terminal 2
cd ~/projects/sh-app && SH_TOKEN=dev-token npm run verify:m2
```

It asserts 11 properties, including ANSI colours landing as real xterm styles, multibyte UTF-8
surviving the round trip, and the agent applying the exact grid the app reported.

Chromium is not an Android WebView, so it cannot catch keyboard behaviour. That gap is closed by the
emulator loop above: typing `echo WEBVIEW` on the Android soft keyboard has to produce `WEBVIEW` on
the host shell for M2 to count as done.

### Keyboard-aware sizing

Expo Go does not honour `android.softwareKeyboardLayoutMode` — its native manifest is baked, so an
`app.json` change needs a rebuild. The keyboard *overlays* the terminal instead of resizing the
window, and `onLayout` never fires.

The fix is app-side: the terminal sits in a `KeyboardAvoidingView` (`behavior="height"` on Android),
so the container shrinks explicitly and `onLayout` runs. Verified on device — the grid tracks the
visible area (`51x48` -> `51x30` -> `51x26` as the keyboard opens) instead of leaving rows stranded
behind it. Without this, the bottom half of the terminal is unreachable while typing.

The harness compiles through `tsconfig.verify.json` to CommonJS rather than running via `tsx`. That
is deliberate: `tsx` injects `__name` helpers into function expressions, and puppeteer serialises
those functions into the page, where the helper does not exist — the stub silently fails to install.
Metro does not do this, so the compiled path matches how the app actually runs.

## Command palette

The palette lists the agent's commands, grouped, and runs them **in the live shell** — not as a
separate process. That means a command inherits your current directory, environment, and any
`cd` you have done, which is the whole point of a launcher over a persistent shell.

| Input | Action |
|---|---|
| Swipe a card right | run it, then jump back to the terminal |
| Swipe a card left | edit it |
| Tap a card | run it |
| Long-press a card | edit it |

The palette and the terminal share one session. `AgentProvider` owns the `AgentClient` above the
router, so opening the palette does not tear down the WebSocket or spawn a second shell.

**Writes are opt-in.** The agent only accepts `POST`/`PATCH`/`DELETE` on `/api/commands` when
`SH_WRITE_TOKEN` is set, and the app needs a separate write token saved in settings. With neither,
the palette shows a read-only banner and hides "+ New command" — the common case, because a
shell-serving daemon should not grow a remote-write API by default.

## Worklet capture rules

A Reanimated worklet copies its **entire closure** to the UI thread. Anything in that closure must
be copyable: functions, numbers, strings, shared values. Host objects — `Keyboard`, native modules,
anything holding native internals — are not, and referencing one throws at mount:

```
[Worklets] Cannot copy value of type `KeyboardImpl`.
  at attachHandlers (react-native-gesture-handler/.../GestureDetector)
```

It throws from `GestureDetector`'s layout effect, so the whole screen fails to mount and the error
names a worklet library rather than your code. The rule in practice: **never touch a host object
inside `.onEnd`/`.onUpdate`.** Put the side effects in a `useCallback` and call it with `runOnJS`;
the callback's own closure lives on the JS thread and is never serialised.

```ts
// worklet may only close over functions and plain data
.onEnd((event) => {
  const action = mapGesture({ dx: event.translationX, dy: event.translationY, pointers: 2 });
  if (!action) return;
  runOnJS(sendGestureKey)(action.key);   // not Keyboard.dismiss() inline
})
```

Both gesture call-sites follow this: `TerminalScreen`'s two-finger pan and `PaletteScreen`'s cards.

### If bundling fails with a Worklets version mismatch

```
[Worklets] Mismatch between JavaScript code version and Worklets Babel plugin version (0.10.1 vs. 0.10.4)
```

This is almost always a **stale Metro cache**, not a real dependency conflict. The Babel plugin
stamps `__pluginVersion` onto each worklet at transform time, and the runtime compares it to its own
version. If `expo install` changed the package, cached transforms keep the old stamp and every bundle
fails. Check `npm ls react-native-worklets` — if it shows one deduped version, clear the cache:

```bash
rm -rf /tmp/metro-cache node_modules/.cache && npx expo start --clear
```

## Gestures

| Input | Action |
|---|---|
| Two-finger swipe ← / → | word left / right (history, path editing) |
| Two-finger swipe ↑ | `Ctrl-C` — interrupt |
| Two-finger swipe ↓ | `Ctrl-D` — EOF |
| Single finger | text selection and scrollback, left to the WebView |
| `ctrl` button | sticky modifier: arms, then modifies the next key, then disarms |

A single finger is deliberately left to the WebView — selection and scrollback need it, and
intercepting it would break both. Control keys therefore need a second finger.

`src/gestures/gestureMap.ts` is a pure function from swipe vector to action, with no React or
gesture-handler imports, so the whole mapping is unit-tested in Node:

```bash
npm run test:unit          # gestures (41) + palette logic (18), pure functions in Node
npm run verify:m4          # drives the real CommandsApi client against a live agent (18 checks)
npm run verify:all         # everything
```

`verify:m4` exists because `adb` cannot easily drive a text form. It exercises the exact client the
app uses — auth selection, request shapes, 403/404 handling — against a running agent, which
covers more of the real risk than tapping through a modal would.

`src/gestures/keys.ts` also carries its own base64 rather than using `btoa`/`atob`. Those globals
are not reliably present in React Native, and getting it wrong would have failed silently at the
first keypress.

### Driving the emulator from adb

`input tap` uses real display coordinates, and those move when the soft keyboard opens and closes.
Guessing them wastes time — dump the view hierarchy instead and read the bounds:

```bash
./scripts/emulatorctl.sh shell "uiautomator dump /sdcard/ui.xml; cat /sdcard/ui.xml"
```

Note that `adb shell input text` drops and duplicates characters unpredictably (`sleep` arrives as
`sleeleeppeppep`). That is an adb artifact, not an app bug — use short strings or real taps.

## Pairing

Run the agent and it prints a QR code:

```
sh-agent listening on 0.0.0.0:8765
pairing over the local network (192.168.1.20); run Tailscale to pair from anywhere

Pair your phone by scanning this, or open the link:

█████████████████████████████████████████████
██ ▄▄▄▄▄ █ ▀ ▄▄▄▀▄ ▀█▀▀▄▀ ▀██▀▀▀█ ▄▄▄▄▄ ██
...

sh://connect?host=192.168.1.20&port=8765&token=...
```

Tap **Scan to pair** in the app and point the camera at it. The link also works if you send it to
yourself and tap it, which is handy when the terminal is on a screen you cannot point a phone at.

**Enter details by hand** is always one tap away, because the camera needs a permission prompt,
can be refused, and cannot see a terminal you are not sitting in front of.

The token lives in `~/.config/sh/agent.env` on the host, so restarting the agent does not
unpair a phone. Override it with `SH_TOKEN` if you need to.

## Sessions

A session is either **pty** (default) or **tmux**.

- **pty** — ephemeral. Survives a disconnect for two minutes and replays bytes from a ring buffer.
- **tmux** — named and persistent. Survives indefinitely, and reattaching by name restores real
  scrollback including across an app restart.

Tap **Sessions** in the header to switch. Named sessions are worth it for long-running work: start
`deploy` on the laptop, walk away, and pick it up on the phone later exactly where you were.

Everything sharing a token shares the tmux namespace, so treat slugs as a shared space.

**Opening a session switches to it.** tmux will happily attach several clients to one session, so
tapping a row repeatedly used to stack up duplicate entries. The agent now treats a second attach to
a name it is already serving as a switch: the previous socket is closed, the older tmux client is
detached, and you land in the same session with its scrollback intact. Because the slug namespace is
shared, this also means the phone takes over from the laptop rather than mirroring it — handy for
walking over to pick work up, and worth knowing if you have both open at once.

Live rows show **Detach** (keep the session) or **Kill** (delete it). Detached sessions move to the
persisted list, where **Remove** deletes them, since a detached session no longer has a session id
to kill by.

Switching to an open session reconnects to that session's id rather than creating a new one, so
tapping around in the switcher never multiplies rows. Switch away from a `pty` session and it stays
alive for `SH_DETACH_GRACE`, so coming back within a couple of minutes replays whatever it printed
while you were away. The row you are already on is marked **(here)** and is not tappable, since
switching to it would be a no-op.

## Zooming the text

A phone gives you very few columns, and a TUI like opencode does not degrade gracefully
below its comfortable width. **Pinch** to change the text size, or use the **A- / A+** keys
in the control bar — pinch on its own is easy never to discover, so the buttons are there
too. **Double-tap** the terminal to go back to the default.

This changes the font size rather than zooming the page on purpose. Scaling the WebView
would blur the glyphs and would not change the remote grid at all, so the program would
still be laying itself out for the old width and would clip just the same. Resizing the
font makes xterm re-fit, which produces a new column count, which is sent to the agent,
which resizes the shell, which makes the program lay out again for the width it really
has. The size is remembered per device, and clamped to 8-20px.

Pinch and the two-finger navigation gesture use the same two fingers. They are told apart
by what the fingers do — spreading or closing them changes the distance, sliding them
across the screen does not — and only past a threshold, so starting a scroll-back drag
never changes the text size by accident.

## Terminal size

The terminal measures itself and reports the grid to the agent, which resizes the remote shell to
match. That first measurement lands before the socket exists, so the app records the geometry and
replays it as soon as the connection opens — without that the shell keeps rendering for the default
80x24 inside a phone-sized viewport, and anything below the status line is wasted space. The size in
the header is the grid the terminal actually measured, not what the shell was told.

## Reconnecting

The agent holds each session for `SH_DETACH_GRACE` (2 min) after a disconnect, so `?resume=<seq>`
can replay the exact byte range that was missed. If the client was away longer than that, the
session is gone and the socket closes with `4404`. The client then creates a fresh shell and shows a
dismissible notice saying so — it never silently retries a dead session.

Reconnect backoff is exponential, capped at 8 s, and gives up after 8 attempts rather than spinning
forever. If the replayed range had already been evicted from the ring buffer, the server clamps to
the oldest byte it still holds; the terminal therefore starts from a visible point rather than
pretending it has a contiguous history.

## iOS

The iOS config is in place and needs no further code: `NSLocalNetworkUsageDescription`
for local network access, and an App Transport Security policy that permits plain HTTP to
private ranges and the Tailscale `100.64.0.0/10` block. Unlike Android, iOS supports CIDR
ranges in `NSExceptionDomains`, so iOS is scoped where Android is blanket.

Two ways to run it:

- **Expo Go on an iPhone.** Free, no Apple account, no build. `npx expo start` and scan.
  Enough to confirm the gesture layer behaves on iOS.
- **A standalone build.** Requires the Apple Developer Program ($99/year) for signing. Then
  `eas build --platform ios --profile development`, and Developer Mode enabled on the device.

The iOS Simulator needs a Mac and is not an option from Linux.

## Roadmap

- Signing and distribution (needs an Expo account for EAS, or a local Gradle keystore)

### Not yet verified

- The two-finger swipes and pinch-to-zoom are unit-tested but **not exercised on a device**:
  `adb input` cannot synthesise multi-touch. Three things need a real phone:
  whether a two-finger pan is captured over the WebView rather than consumed by it, whether
  the WebView hands a pinch to the gesture handler at all, and whether a pinch and a
  two-finger drag are reliably told apart. That last one currently rests on both sides
  raising their work through `runOnJS` in order, which is reasoned rather than tested.
  The `A-`/`A+` keys are the fallback and bypass the gesture layer entirely.
- No signed APK has been produced. `expo export --platform android` passes and `expo-doctor` is
  clean (21/21), so the release JS bundle is valid, but installing it on hardware needs either an
  Expo account for `eas build` or a local keystore.
