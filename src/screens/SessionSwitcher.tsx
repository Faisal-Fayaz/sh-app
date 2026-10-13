import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  describeSession,
  isTmuxUsable,
  mergeSessions,
  nextSessionAction,
  targetForLiveSession,
  SessionsApi,
  type LiveSession,
  type PersistedSession,
  type SessionsResponse,
} from "@/agent/sessionsApi";
import { CommandsApi } from "@/agent/commandsApi";
import type { SessionTarget } from "@/agent/AgentProvider";
import { useSettings } from "@/state/SettingsProvider";

interface Props {
  currentSessionId: string | null;
  onAttach: (session: SessionTarget) => void;
  onClose: () => void;
}

export function SessionSwitcher({ currentSessionId, onAttach, onClose }: Props) {
  const { settings } = useSettings();
  const api = useMemo(
    () => new SessionsApi(new CommandsApi(settings.host, Number(settings.port) || 8765, settings.token)),
    [settings.host, settings.port, settings.token],
  );

  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (sessionId: string, action: "detach" | "kill", slug?: string) => {
      try {
        if (action === "detach") await api.detach(sessionId);
        else if (slug) await api.killPersisted(slug);
        else await api.kill(sessionId);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, refresh],
  );

  const tmuxReady = data ? isTmuxUsable(data) : false;
  const activeSlug = slug.trim();

  // Belt and braces: the agent already hides live slugs from `persisted`, and the
  // merge helper keeps older agents from showing one session twice.
  const rows = data ? mergeSessions(data) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerButton}>
          <Text style={styles.headerLabel}>Close</Text>
        </TouchableOpacity>
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7fd1b9" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={() => void refresh()} style={styles.retry}>
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.section}>Attach</Text>
          <TouchableOpacity
            style={styles.attachRow}
            onPress={() => onAttach({ mode: "pty" })}
            accessibilityRole="button"
          >
            <View style={styles.attachText}>
              <Text style={styles.attachName}>New shell</Text>
              <Text style={styles.attachHint}>Ephemeral. Gone when you disconnect for long.</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.attachRow, !tmuxReady && styles.disabled]}>
            <TextInput
              style={styles.attachInput}
              value={slug}
              onChangeText={setSlug}
              placeholder={tmuxReady ? "named session, e.g. deploy" : "tmux unavailable on host"}
              placeholderTextColor="#5a6478"
              autoCapitalize="none"
              autoCorrect={false}
              editable={tmuxReady}
            />
            <TouchableOpacity
              style={[styles.attachButton, (!tmuxReady || !activeSlug) && styles.disabled]}
              disabled={!tmuxReady || !activeSlug}
              onPress={() => onAttach({ mode: "tmux", slug: activeSlug })}
              accessibilityRole="button"
            >
              <Text style={styles.attachButtonLabel}>Attach</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            {tmuxReady
              ? "Attaching to a name that already exists reopens it with its scrollback intact."
              : "This host has no tmux, so named sessions are unavailable."}
          </Text>

          <Text style={styles.section}>Live</Text>
          {data?.live.length === 0 ? (
            <Text style={styles.empty}>No live sessions.</Text>
          ) : (
            rows?.live.map((session) => (
              <LiveRow
                key={session.id}
                session={session}
                current={session.id === currentSessionId}
                onAttach={() => onAttach(targetForLiveSession(session))}
                onAction={() => void act(session.id, nextSessionAction(session))}
              />
            ))
          )}

          <Text style={styles.section}>Persisted (tmux)</Text>
          {rows?.persisted.length === 0 ? (
            <Text style={styles.empty}>No detached sessions.</Text>
          ) : (
            rows?.persisted.map((session) => (
              <PersistedRow
                key={session.name}
                session={session}
                onAttach={() => onAttach({ mode: "tmux", slug: session.slug })}
                onKill={() => void act("", "kill", session.slug)}
              />
            ))
          )}
          <View style={styles.footer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LiveRow({
  session,
  current,
  onAttach,
  onAction,
}: {
  session: LiveSession;
  current: boolean;
  onAttach: () => void;
  onAction: () => void;
}) {
  const action = nextSessionAction(session);
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={onAttach}
        accessibilityRole="button"
        disabled={current}
      >
        <Text style={styles.rowName}>
          {session.slug ?? `shell ${session.id.slice(0, 8)}`}
          {current ? "  (here)" : ""}
        </Text>
        <Text style={styles.rowHint}>
          {describeSession(session)} · {session.cols}x{session.rows}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={onAction} accessibilityRole="button">
        <Text style={styles.actionLabel}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PersistedRow({
  session,
  onAttach,
  onKill,
}: {
  session: PersistedSession;
  onAttach: () => void;
  onKill: () => void;
}) {
  // A detached session has no session id any more, so it can only be removed by slug.
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.rowMain} onPress={onAttach} accessibilityRole="button">
        <Text style={styles.rowName}>{session.slug}</Text>
        <Text style={styles.rowHint}>
          {session.attached > 0
            ? "attached elsewhere · opening it here takes over"
            : "detached · survives reconnects"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.action}
        onPress={onKill}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${session.slug}`}
      >
        <Text style={styles.actionLabel}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  title: { color: "#eef3fa", fontSize: 22, fontWeight: "700" },
  headerButton: { paddingHorizontal: 8, paddingVertical: 4 },
  headerLabel: { color: "#6ba8f5", fontSize: 15 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  error: { color: "#ff8787", fontSize: 14, paddingHorizontal: 24, textAlign: "center" },
  retry: { paddingHorizontal: 16, paddingVertical: 8 },
  retryLabel: { color: "#6ba8f5", fontSize: 14 },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  section: {
    color: "#5a6478",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  disabled: { opacity: 0.45 },
  attachText: { flex: 1 },
  attachName: { color: "#eef3fa", fontSize: 16, fontWeight: "600" },
  attachHint: { color: "#5a6478", fontSize: 12, marginTop: 2 },
  attachInput: {
    flex: 1,
    color: "#eef3fa",
    fontFamily: "monospace",
    fontSize: 14,
    paddingVertical: 4,
  },
  attachButton: {
    backgroundColor: "#7fd1b9",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  attachButtonLabel: { color: "#0b0e14", fontWeight: "700", fontSize: 13 },
  hint: { color: "#5a6478", fontSize: 11, marginBottom: 4 },
  empty: { color: "#5a6478", fontSize: 13, marginBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowMain: { flex: 1 },
  rowName: { color: "#eef3fa", fontSize: 15, fontWeight: "600" },
  rowHint: { color: "#5a6478", fontSize: 12, marginTop: 2 },
  action: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#2b2740",
  },
  actionLabel: { color: "#c792ea", fontSize: 12, fontWeight: "700" },
  footer: { height: 20 },
});
