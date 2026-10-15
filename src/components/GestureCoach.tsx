import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { GESTURE_REFERENCE } from "@/gestures/gestureMap";

interface Props {
  onDismiss: () => void;
  onOpenHelp: () => void;
}

/**
 * The one-time gesture card.
 *
 * The control bar makes the app usable without ever learning a gesture, which
 * is also why the gestures go unnoticed -- there is no missing button to send
 * anyone looking. This appears once, over a live terminal, and stays out of the
 * way afterwards.
 */
export function GestureCoach({ onDismiss, onOpenHelp }: Props) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>Two fingers, not one</Text>
        <Text style={styles.body}>
          One finger has to stay free for selecting text and scrolling. The control keys live under
          two.
        </Text>

        {GESTURE_REFERENCE.slice(0, 4).map((entry) => (
          <View key={entry.id} style={styles.row}>
            <Text style={styles.label}>{entry.label}</Text>
            <Text style={styles.outcome}>{entry.outcome}</Text>
          </View>
        ))}

        <Text style={styles.more}>Pinch to resize, and the whole list is on the ? screen.</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.helpButton}
            onPress={onOpenHelp}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.helpLabel}>All gestures</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onDismiss}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.doneLabel}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 8, 12, 0.86)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#121722",
    borderColor: "#2b3a4d",
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
  },
  title: { color: "#eef3fa", fontSize: 17, fontWeight: "700" },
  body: { color: "#8aa4c8", fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  row: {
    backgroundColor: "#141926",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 6,
  },
  label: { color: "#eef3fa", fontSize: 13, fontWeight: "600" },
  outcome: { color: "#5a6478", fontSize: 11, marginTop: 1 },
  more: { color: "#5a6478", fontSize: 11, marginTop: 6 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 16 },
  helpButton: { paddingHorizontal: 12, paddingVertical: 10, marginRight: 8 },
  helpLabel: { color: "#6ba8f5", fontSize: 14 },
  doneButton: {
    backgroundColor: "#7fd1b9",
    borderRadius: 9,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  doneLabel: { color: "#0b0e14", fontSize: 14, fontWeight: "700" },
});
