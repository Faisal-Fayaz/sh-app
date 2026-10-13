import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import * as Haptics from "expo-haptics";

import { useAgent } from "@/agent/AgentProvider";
import type { AgentFrame } from "@/agent/AgentClient";
import { ControlBar } from "@/components/ControlBar";
import {
  clampFontSize,
  DEFAULT_FONT_SIZE,
  fontSizeFromScale,
  isZoomGesture,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
} from "@/agent/fontSize";
import { DEFAULT_GESTURE, mapGesture } from "@/gestures/gestureMap";
import { keyBytes, sendBytes, sendKey, type NamedKey } from "@/gestures/keys";
import { routeBridgeMessage } from "@/terminal/bridge";
import { buildTerminalHtml } from "@/terminal/terminalHtml";
import type { Settings } from "@/storage/settings";
import { useSettings } from "@/state/SettingsProvider";

// Ephemeral gesture bookkeeping for the two-finger surface. Deliberately module scope:
// React's render rules forbid reading a ref from a closure built during render, and this
// state is meaningless between mounts anyway.
let zoomLocked = false;
let pinchStartSize = DEFAULT_FONT_SIZE;
let applyFontSizeNow: (next: number) => void = () => {};

function beginPinchOnJs(current: number): void {
  pinchStartSize = current;
  zoomLocked = false;
}

function pinchEndOnJs(scale: number): void {
  if (!isZoomGesture(scale)) return;
  zoomLocked = true;
  const next = fontSizeFromScale(pinchStartSize, scale);
  if (next === pinchStartSize) return;
  pinchStartSize = next;
  applyFontSizeNow(next);
}

function resetZoomOnJs(): void {
  applyFontSizeNow(DEFAULT_FONT_SIZE);
}

interface Props {
  settings: Settings;
  onOpenSettings: () => void;
  onOpenPalette: () => void;
  onOpenSessions: () => void;
}

export function TerminalScreen({
  settings,
  onOpenSettings,
  onOpenPalette,
  onOpenSessions,
}: Props) {
  const webviewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const queuedRef = useRef<string[]>([]);

  const {
    status,
    detail,
    notice,
    dismissNotice,
    sessionId,
    sessionSlug,
    sessionMode,
    grid,
    setGrid,
    sendStdin,
    sendResize,
    subscribe,
  } = useAgent();
  const [loading, setLoading] = useState(true);
  const [ctrlArmed, setCtrlArmed] = useState(false);
  const { save } = useSettings();
  const [fontSize, setFontSize] = useState(settings.fontSize || DEFAULT_FONT_SIZE);
  const [zoomHint, setZoomHint] = useState<number | null>(null);

  const html = useMemo(() => buildTerminalHtml(), []);

  const inject = useCallback((script: string) => {
    webviewRef.current?.injectJavaScript(`${script};true;`);
  }, []);

  const flushQueue = useCallback(() => {
    if (!readyRef.current) return;
    const queued = queuedRef.current;
    queuedRef.current = [];
    for (const chunk of queued) {
      inject(`window.__sh.writeBase64(${JSON.stringify(chunk)})`);
    }
  }, [inject]);

  const applyFontSize = useCallback(
    (next: number) => {
      const clamped = clampFontSize(next);
      setFontSize(clamped);
      setZoomHint(clamped);
      // xterm re-fits when the font changes, which fires onResize, and the bridge
      // handler above pushes the new grid to the agent.
      inject(`window.__sh.setFontSize(${clamped})`);
      void save({ ...settings, fontSize: clamped });
    },
    [inject, save, settings],
  );

  useEffect(() => {
    const listener = (frame: AgentFrame) => {
      if (frame.type === "stdout" && frame.data) {
        if (readyRef.current) {
          inject(`window.__sh.writeBase64(${JSON.stringify(frame.data)})`);
        } else {
          queuedRef.current.push(frame.data);
        }
      } else if (frame.type === "exit") {
        readyRef.current = false;
      }
    };
    return subscribe(listener);
  }, [inject, subscribe]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      routeBridgeMessage(event.nativeEvent.data, {
        onReady: (cols, rows) => {
          readyRef.current = true;
          setLoading(false);
          flushQueue();
          setGrid({ cols, rows });
          // The terminal fits itself before the socket is open, so that resize is
          // dropped. Push it again here or the shell renders for 80x24 in a 48x48
          // viewport and everything below the status line is wasted space.
          sendResize(cols, rows);
          inject("window.__sh.focus()");
        },
        onInput: (data) => {
          setCtrlArmed(false);
          sendStdin(data);
        },
        onResize: (cols, rows) => {
          setGrid({ cols, rows });
          sendResize(cols, rows);
        },
      });
    },
    [flushQueue, inject, sendStdin, sendResize, setGrid],
  );

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    inject("window.__sh.fit()");
  }, [inject]);

  // Switching sessions must not leave the previous shell's output on screen. The
  // WebView terminal stays initialised across a switch, so only the drawn screen and
  // any queued bytes reset -- readyRef deliberately stays true, since onReady fires
  // once per WebView rather than once per session.
  useEffect(() => {
    queuedRef.current = [];
    inject("window.__sh.clear()");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCtrlArmed(false);
  }, [inject, sessionId]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setTimeout(() => inject("window.__sh.fit()"), 250);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setTimeout(() => inject("window.__sh.fit()"), 250);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [inject]);

  const sendScrolled = useCallback(
    (lines: number) => {
      const repeat = Math.min(20, Math.max(1, Math.abs(lines)));
      const key = lines > 0 ? "page-up" : "page-down";
      const bytes: number[] = [];
      for (let i = 0; i < repeat; i++) bytes.push(...keyBytes(key));
      sendBytes(bytes, sendStdin);
      void Haptics.selectionAsync();
    },
    [sendStdin],
  );

  // Published for the module-level gesture helpers, which must not close over inject
  // (and through it the webview ref) from render scope.
  useEffect(() => {
    applyFontSizeNow = applyFontSize;
  }, [applyFontSize]);

  // Every side effect lives here, on the JS thread, and is invoked from the worklet via
  // runOnJS. A worklet copies its entire closure to the UI thread, and host objects like
  // KeyboardImpl and the haptics module cannot be copied — referencing them directly
  // inside .onEnd throws "Cannot copy value of type `KeyboardImpl`" on mount.
  const sendGestureKey = useCallback(
    (key: NamedKey) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sendKey(key, sendStdin, ctrlArmed);
      setCtrlArmed(false);
      Keyboard.dismiss();
    },
    [sendStdin, ctrlArmed],
  );

  const scrollFromGesture = useCallback(
    (lines: number) => {
      sendScrolled(lines);
    },
    [sendScrolled],
  );

  // The worklet below may only close over functions and plain data.
  // Two fingers move together to navigate, and apart or together in depth to zoom. The
  // two overlap completely, so whichever commits first claims the gesture: the pinch
  // raises a flag and the pan checks it before sending anything. Both hops onto the JS
  // thread, so they land in the order they were raised.
  const handlePanEnd = useCallback(
    (dx: number, dy: number) => {
      if (zoomLocked) return;
      const action = mapGesture({ dx, dy, pointers: 2 }, DEFAULT_GESTURE);
      if (!action) return;
      if (action.kind === "scroll") {
        scrollFromGesture(action.lines);
        return;
      }
      sendGestureKey(action.key);
    },
    [sendGestureKey, scrollFromGesture],
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          runOnJS(beginPinchOnJs)(fontSize);
        })
        .onEnd((event) => {
          runOnJS(pinchEndOnJs)(event.scale);
        }),
    [fontSize],
  );

  const twoFingerGesture = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(2)
        .maxPointers(2)
        .averageTouches(true)
        .onEnd((event) => {
          runOnJS(handlePanEnd)(event.translationX, event.translationY);
        }),
    [handlePanEnd],
  );

  // Pinch is invisible until you stumble into it, so a double-tap puts the text back.
  const resetZoomGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(300)
        .onEnd((_event, success) => {
          if (success) runOnJS(resetZoomOnJs)();
        }),
    [],
  );

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(Gesture.Simultaneous(pinchGesture, twoFingerGesture), resetZoomGesture),
    [pinchGesture, twoFingerGesture, resetZoomGesture],
  );

  useEffect(() => {
    if (zoomHint === null) return;
    const timer = setTimeout(() => setZoomHint(null), 1200);
    return () => clearTimeout(timer);
  }, [zoomHint]);

  const bannerText = notice ?? detail;

  const statusColor = useMemo(() => {
    switch (status) {
      case "open":
        return "#7fd1b9";
      case "connecting":
      case "reconnecting":
        return "#f2c14e";
      case "error":
        return "#ff8787";
      default:
        return "#5a6478";
    }
  }, [status]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={styles.host} numberOfLines={1}>
            {settings.host}:{settings.port}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.grid} numberOfLines={1}>
            {sessionMode === "tmux" ? `${sessionSlug ?? "tmux"} · ` : ""}
            {grid.cols}x{grid.rows}
          </Text>
          <TouchableOpacity onPress={onOpenSessions} hitSlop={10} style={styles.headerButton}>
            <Text style={styles.headerLabel}>Sessions</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenPalette} hitSlop={10} style={styles.headerButton}>
            <Text style={styles.headerLabel}>Commands</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenSettings} hitSlop={10} style={styles.headerButton}>
            <Text style={styles.headerLabel}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {notice ? (
        <TouchableOpacity style={styles.notice} onPress={dismissNotice}>
          <Text style={styles.noticeText} numberOfLines={3}>
            {notice}
          </Text>
          <Text style={styles.noticeDismiss}>tap to dismiss</Text>
        </TouchableOpacity>
      ) : bannerText ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText} numberOfLines={2}>
            {bannerText}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <GestureDetector gesture={composedGesture}>
          <View style={styles.terminal} onLayout={handleLayout} collapsable={false}>
            <WebView
              ref={webviewRef}
              source={{ html }}
              originWhitelist={["*"]}
              onMessage={handleMessage}
              style={styles.webview}
              containerStyle={styles.webview}
              javaScriptEnabled
              scrollEnabled
              bounces={false}
              overScrollMode="never"
              textZoom={100}
              setSupportMultipleWindows={false}
              keyboardDisplayRequiresUserAction={false}
            />
            {loading ? (
              <View style={styles.overlay} pointerEvents="none">
                <ActivityIndicator color="#7fd1b9" />
              </View>
            ) : null}
          </View>
        </GestureDetector>

        <ControlBar
          send={sendStdin}
          ctrlArmed={ctrlArmed}
          onToggleCtrl={() => setCtrlArmed((p) => !p)}
          fontSize={fontSize}
          fontMin={MIN_FONT_SIZE}
          fontMax={MAX_FONT_SIZE}
          onFontSize={applyFontSize}
        />

        <Text style={styles.footnote}>
          {ctrlArmed
            ? "ctrl armed — next key is modified"
            : "pinch or A-/A+ resizes · two-finger swipe: ← → ^C ^D"}
        </Text>
        {zoomHint !== null && (
          <View style={styles.zoomHud} pointerEvents="none">
            <Text style={styles.zoomText}>{zoomHint}px</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  body: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomColor: "#1b2130",
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  host: { color: "#c8d3e0", fontSize: 13, fontFamily: "monospace" },
  grid: { color: "#5a6478", fontSize: 11, fontFamily: "monospace" },
  headerButton: { paddingHorizontal: 6, paddingVertical: 4 },
  headerLabel: { color: "#6ba8f5", fontSize: 13 },
  banner: { backgroundColor: "#241a1a", paddingHorizontal: 14, paddingVertical: 6 },
  notice: {
    backgroundColor: "#1c2436",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderLeftColor: "#f2c14e",
    borderLeftWidth: 3,
  },
  noticeText: { color: "#f2c14e", fontSize: 12 },
  noticeDismiss: { color: "#5a6478", fontSize: 10, marginTop: 2 },
  bannerText: { color: "#ff8787", fontSize: 12 },
  terminal: { flex: 1 },
  webview: { flex: 1, backgroundColor: "#0b0e14" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: { color: "#3a4256", fontSize: 11, paddingBottom: 6, textAlign: "center" },
  zoomHud: {
    position: "absolute",
    alignSelf: "center",
    bottom: 96,
    backgroundColor: "#141a24",
    borderColor: "#2b3a4d",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  zoomText: { color: "#7fd1b9", fontSize: 13, fontFamily: "monospace" },
});
