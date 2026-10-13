import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AgentClient, type AgentFrame, type AgentStatus, normalizeHost } from "@/agent/AgentClient";
import type { SessionTarget } from "@/agent/sessionModel";
import { useSettings } from "@/state/SettingsProvider";

export type { SessionTarget };

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

type FrameListener = (frame: AgentFrame) => void;



interface AgentContextValue {
  status: AgentStatus;
  detail: string | null;
  shell: string | null;
  sessionId: string | null;
  sessionMode: "pty" | "tmux";
  sessionSlug: string | null;
  attachTo: (target: SessionTarget) => void;
  grid: { cols: number; rows: number };
  notice: string | null;
  dismissNotice: () => void;
  setGrid: (grid: { cols: number; rows: number }) => void;
  sendStdin: (base64: string) => void;
  sendText: (text: string) => void;
  sendResize: (cols: number, rows: number) => void;
  subscribe: (listener: FrameListener) => () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);

function encodeUtf8Base64(text: string): string {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += alphabet[b0 >> 2];
    out += alphabet[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : alphabet[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : alphabet[b2 & 0x3f];
  }
  return out;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const clientRef = useRef<AgentClient | null>(null);
  const listenersRef = useRef<Set<FrameListener>>(new Set());

  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [shell, setShell] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<"pty" | "tmux">("pty");
  const [sessionSlug, setSessionSlug] = useState<string | null>(null);
  const [target, setTarget] = useState<SessionTarget>({ mode: "pty" });
  const generation = useRef(0);
  // Last byte offset seen per session, so switching away and back replays the gap
  // instead of dropping whatever the shell printed while we were on another session.
  const resumeOffsets = useRef(new Map<string, number>());
  const activeId = useRef<string | null>(null);
  // Read inside the connect effect, which must not re-run just because the grid moved.
  const gridRef = useRef({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS });
  const [grid, setGridState] = useState({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS });

  // setGrid is called on its own in a few places, so keep the ref in step with the
  // state rather than only tracking it in sendResize.
  const setGrid = useCallback((next: { cols: number; rows: number }) => {
    gridRef.current = next;
    setGridState(next);
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const attachTo = useCallback((next: SessionTarget) => {
    generation.current += 1;
    setNotice(null);
    setTarget(next);
  }, []);

  const subscribe = useCallback((listener: FrameListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!settings.host || !settings.token) return;
    let cancelled = false;
    const client = new AgentClient({
      host: normalizeHost(settings.host),
      port: Number(settings.port) || 8765,
      token: settings.token,
      // The terminal reports its size once, at startup. A client created later -- on a
      // session switch, say -- would otherwise replay the 80x24 default and shrink the
      // shell back to a size nothing asked for.
      cols: gridRef.current.cols,
      rows: gridRef.current.rows,
      onFrame: (frame) => {
        if (frame.type === "stdout" && typeof frame.seq === "number" && activeId.current) {
          resumeOffsets.current.set(activeId.current, frame.seq);
        }
        for (const listener of listenersRef.current) listener(frame);
      },
      onStatus: (next, info) => {
        setStatus(next);
        setDetail(next === "open" ? null : (info ?? null));
      },
      onNotice: (message) => setNotice(message),
    });
    clientRef.current = client;

    (async () => {
      try {
        if (target.sessionId) {
          // Switching to a session that is already open. Reconnect to its id so the
          // agent keeps one session per shell instead of growing a new one per tap.
          client.attachExisting(target.sessionId, resumeOffsets.current.get(target.sessionId) ?? null);
          activeId.current = target.sessionId;
          if (cancelled) return;
          setSessionId(target.sessionId);
          setSessionMode(target.mode);
          setSessionSlug(target.slug ?? null);
          client.connect();
          return;
        }
        const session = await client.createSession(DEFAULT_COLS, DEFAULT_ROWS, target);
        activeId.current = session.id;
        if (cancelled) return;
        setSessionId(session.id);
        setSessionMode(session.mode === "tmux" ? "tmux" : "pty");
        setSessionSlug(session.slug ?? null);
        setShell(session.shell);
        client.connect();
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setDetail(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      client.disconnect();
      clientRef.current = null;
    };
  }, [settings.host, settings.port, settings.token, target]);

  const sendStdin = useCallback((base64: string) => {
    setNotice(null);
    clientRef.current?.sendStdin(base64);
  }, []);

  const sendText = useCallback(
    (text: string) => {
      setNotice(null);
      sendStdin(encodeUtf8Base64(text));
    },
    [sendStdin],
  );

  const sendResize = useCallback((cols: number, rows: number) => {
    gridRef.current = { cols, rows };
    clientRef.current?.sendResize(cols, rows);
  }, []);

  const value = useMemo<AgentContextValue>(
    () => ({
      status,
      detail,
      shell,
      sessionId,
      sessionMode,
      sessionSlug,
      attachTo,
      grid,
      setGrid,
      notice,
      dismissNotice,
      sendStdin,
      sendText,
      sendResize,
      subscribe,
    }),
    [
      status,
      detail,
      shell,
      sessionId,
      sessionMode,
      sessionSlug,
      attachTo,
      grid,
      setGrid,
      notice,
      dismissNotice,
      sendStdin,
      sendText,
      sendResize,
      subscribe,
    ],
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentContextValue {
  const value = useContext(AgentContext);
  if (!value) {
    throw new Error("useAgent must be used inside AgentProvider");
  }
  return value;
}
