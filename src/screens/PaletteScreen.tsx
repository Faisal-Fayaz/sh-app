import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ActivityIndicator as Spinner,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  CommandsApi,
  commandLine,
  filterEntries,
  groupEntries,
  runPayload,
  type PaletteEntry,
} from "@/agent/commandsApi";
import { useAgent } from "@/agent/AgentProvider";
import { useSettings } from "@/state/SettingsProvider";

const RUN_THRESHOLD = 96;
const EDIT_THRESHOLD = -96;

interface Props {
  onClose: () => void;
  onRan: () => void;
}

export function PaletteScreen({ onClose, onRan }: Props) {
  const { settings } = useSettings();
  const { sendText } = useAgent();
  const api = useMemo(
    () =>
      new CommandsApi(
        settings.host,
        Number(settings.port) || 8765,
        settings.token,
        settings.writeToken,
      ),
    [settings.host, settings.port, settings.token, settings.writeToken],
  );

  const [entries, setEntries] = useState<PaletteEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PaletteEntry | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCommand, setDraftCommand] = useState("");
  const [draftGroup, setDraftGroup] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.list();
      setEntries(response.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Fetching on mount is the point of this effect; the rule against setState in an effect
  // body targets derived state, not network reads.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = useCallback(
    (entry: PaletteEntry) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      sendText(runPayload(entry));
      onRan();
    },
    [onRan, sendText],
  );

  const beginEdit = useCallback((entry: PaletteEntry) => {
    void Haptics.selectionAsync();
    setEditing(entry);
    setDraftName(entry.name);
    setDraftCommand(commandLine(entry));
    setDraftGroup(entry.group);
    setSaveError(null);
  }, []);

  const save = useCallback(async () => {
    if (!editing) return;
    setSaveError(null);
    try {
      if (editing.id === "new") {
        await api.create({ name: draftName, command: draftCommand, group: draftGroup || "general" });
      } else {
        await api.update(editing.id, {
          name: draftName,
          command: draftCommand,
          group: draftGroup,
        });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [api, draftCommand, draftGroup, draftName, editing, load]);

  const remove = useCallback(async () => {
    if (!editing || editing.builtin) return;
    setSaveError(null);
    try {
      await api.remove(editing.id);
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [api, editing, load]);

  const filtered = useMemo(() => filterEntries(entries, query), [entries, query]);
  const groups = useMemo(() => groupEntries(filtered), [filtered]);
  const readOnly = !api.canWrite;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Commands</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.headerButton}>
          <Text style={styles.headerLabel}>Close</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="filter by name, group or command"
          placeholderTextColor="#5a6478"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {readOnly ? (
        <View style={styles.readOnly}>
          <Text style={styles.readOnlyText}>
            Read-only. Add a write token in settings to create or edit commands.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#7fd1b9" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryLabel}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {groups.length === 0 && query.trim().length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No commands yet</Text>
              <Text style={styles.emptyBody}>
                {readOnly
                  ? "This agent has none saved. Adding one needs a write token in settings."
                  : "Save the ones you type often and they run in the live shell with a swipe."}
              </Text>
            </View>
          ) : null}
          {groups.length === 0 && query.trim().length > 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing matches “{query.trim()}”</Text>
            </View>
          ) : null}
          {groups.map((group) => (
            <View key={group.name} style={styles.group}>
              <Text style={styles.groupName}>{group.name}</Text>
              {group.entries.map((entry) => (
                <CommandCard
                  key={entry.id}
                  entry={entry}
                  canEdit={!readOnly && !entry.builtin}
                  canCreate={!readOnly}
                  onRun={() => run(entry)}
                  onEdit={() => beginEdit(entry)}
                />
              ))}
            </View>
          ))}
          {!readOnly ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                setEditing({
                  id: "new",
                  name: "",
                  command: [],
                  group: "general",
                  builtin: false,
                  description: null,
                });
                setDraftName("");
                setDraftCommand("");
                setDraftGroup("general");
                setSaveError(null);
              }}
            >
              <Text style={styles.addLabel}>+ New command</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}

      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing?.id === "new" ? "New command" : editing?.builtin ? "Built-in command" : "Edit command"}
            </Text>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="restart agent"
              placeholderTextColor="#5a6478"
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Command</Text>
            <TextInput
              style={styles.modalInput}
              value={draftCommand}
              onChangeText={setDraftCommand}
              placeholder="systemctl --user restart sh-agent"
              placeholderTextColor="#5a6478"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>Group</Text>
            <TextInput
              style={styles.modalInput}
              value={draftGroup}
              onChangeText={setDraftGroup}
              placeholder="ops"
              placeholderTextColor="#5a6478"
              autoCapitalize="none"
            />
            {saveError ? <Text style={styles.modalError}>{saveError}</Text> : null}
            <View style={styles.modalActions}>
              {editing && !editing.builtin && editing.id !== "new" ? (
                <TouchableOpacity onPress={() => void remove()} style={[styles.modalButton, styles.danger]}>
                  <Text style={styles.modalButtonLabel}>Delete</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setEditing(null)} style={styles.modalButton}>
                <Text style={styles.modalButtonLabel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void save()} style={[styles.modalButton, styles.primary]}>
                {loading ? <Spinner color="#0b0e14" /> : <Text style={styles.primaryLabel}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface CardProps {
  entry: PaletteEntry;
  canEdit: boolean;
  canCreate: boolean;
  onRun: () => void;
  onEdit: () => void;
}

function CommandCard({ entry, canEdit, onRun, onEdit }: CardProps) {
  const translateX = useSharedValue(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-24, 24])
        // Reanimated worklets run on the UI thread and mutate the shared value by design;
        // that is the whole point of a shared value, so the immutability rule does not apply.
        .onUpdate((event) => {
          // eslint-disable-next-line react-hooks/immutability
          translateX.value = Math.max(-RUN_THRESHOLD * 1.4, Math.min(RUN_THRESHOLD, event.translationX));
        })
        .onEnd((event) => {
          const projected = translateX.value + event.velocityX * 0.08;
          if (projected > RUN_THRESHOLD) {
            // eslint-disable-next-line react-hooks/immutability
            translateX.value = withTiming(RUN_THRESHOLD, { duration: 120 });
            runOnJS(onRun)();
          } else if (projected < EDIT_THRESHOLD) {
             
            translateX.value = withTiming(-RUN_THRESHOLD, { duration: 120 });
            runOnJS(onEdit)();
          } else {
             
            translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
          }
        }),
    [onEdit, onRun, translateX],
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const runHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, RUN_THRESHOLD], [0, 1], "clamp"),
  }));
  const editHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-RUN_THRESHOLD, 0], [1, 0], "clamp"),
  }));

  return (
    <View style={styles.cardWrap}>
      <View style={styles.cardBackdrop}>
        <Animated.View style={[styles.cardHint, styles.cardHintRun, runHintStyle]}>
          <Text style={styles.cardHintRunText}>Run</Text>
        </Animated.View>
        <Animated.View style={[styles.cardHint, styles.cardHintEdit, editHintStyle]}>
          <Text style={styles.cardHintEditText}>{canEdit ? "Edit" : "Built-in"}</Text>
        </Animated.View>
      </View>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Pressable
            onPress={() => onRun()}
            onLongPress={canEdit ? () => onEdit() : undefined}
            delayLongPress={350}
            style={styles.cardInner}
            accessibilityRole="button"
            accessibilityLabel={`Run ${entry.name}`}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardName}>{entry.name}</Text>
              {entry.builtin ? <Text style={styles.cardBadge}>built-in</Text> : null}
            </View>
            <Text style={styles.cardCommand}>{commandLine(entry)}</Text>
            {entry.description ? <Text style={styles.cardDescription}>{entry.description}</Text> : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
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
  searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 10,
    color: "#eef3fa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  readOnly: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#1a1710",
    borderWidth: 1,
    borderColor: "#3a3320",
  },
  readOnlyText: { color: "#f2c14e", fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: "#ff8787", fontSize: 14, paddingHorizontal: 24, textAlign: "center" },
  retry: { paddingHorizontal: 16, paddingVertical: 8 },
  retryLabel: { color: "#6ba8f5", fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  group: { marginBottom: 18 },
  groupName: {
    color: "#5a6478",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  cardWrap: { marginBottom: 8, borderRadius: 12, overflow: "hidden" },
  cardBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHint: { paddingHorizontal: 14 },
  cardHintRun: { alignSelf: "flex-start", backgroundColor: "#1c3a33", paddingVertical: 6, borderRadius: 6 },
  cardHintEdit: { alignSelf: "flex-end", backgroundColor: "#2b2740", paddingVertical: 6, borderRadius: 6 },
  cardHintRunText: { color: "#7fd1b9", fontWeight: "700" },
  cardHintEditText: { color: "#c792ea", fontWeight: "700" },
  card: {
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 12,
  },
  cardInner: { padding: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardName: { color: "#eef3fa", fontSize: 16, fontWeight: "600" },
  cardBadge: { color: "#5a6478", fontSize: 10, textTransform: "uppercase" },
  cardCommand: { color: "#7fd1b9", fontSize: 12, fontFamily: "monospace", marginTop: 4 },
  cardDescription: { color: "#5a6478", fontSize: 12, marginTop: 4 },
  empty: { paddingHorizontal: 24, paddingVertical: 28, alignItems: "center" },
  emptyTitle: { color: "#c8d3e0", fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptyBody: {
    color: "#5a6478",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: "center",
  },
  addButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2b3245",
    paddingVertical: 14,
    alignItems: "center",
  },
  addLabel: { color: "#6ba8f5", fontSize: 14 },
  modalBackdrop: { flex: 1, backgroundColor: "#000000aa", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#141926",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    gap: 8,
  },
  modalTitle: { color: "#eef3fa", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  fieldLabel: { color: "#5a6478", fontSize: 12, fontWeight: "600" },
  modalInput: {
    backgroundColor: "#0f1420",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 8,
    color: "#eef3fa",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "monospace",
  },
  modalError: { color: "#ff8787", fontSize: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1c2233",
  },
  modalButtonLabel: { color: "#c8d3e0", fontSize: 14 },
  primary: { backgroundColor: "#7fd1b9" },
  primaryLabel: { color: "#0b0e14", fontSize: 14, fontWeight: "700" },
  danger: { backgroundColor: "#3a1f22" },
});
