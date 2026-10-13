import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { AgentClient, type AgentFrame, type AgentStatus, normalizeHost } from "@/agent/AgentClient";
import { useSettings } from "@/state/SettingsProvider";

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

type FrameListener = (frame: AgentFrame) => void;

export interface SessionTarget {
  mode: "pty" | "tmux";
  slug?: string;
}

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
  const [grid, setGrid] = useState({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS });

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
      onFrame: (frame) => {
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
        const session = await client.createSession(DEFAULT_COLS, DEFAULT_ROWS, target);
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
      notice,
      dismissNotice,
      setGrid,
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
