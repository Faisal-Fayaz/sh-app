import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { sendKey, type NamedKey } from "@/gestures/keys";

interface KeySpec {
  label: string;
  key: NamedKey;
  tint?: string;
}

const KEYS: KeySpec[] = [
  { label: "Esc", key: "escape" },
  { label: "Tab", key: "tab" },
  { label: "^C", key: "ctrl-c", tint: "#ff8787" },
  { label: "^D", key: "ctrl-d" },
  { label: "^Z", key: "ctrl-z" },
  { label: "←", key: "left" },
  { label: "↑", key: "up" },
  { label: "↓", key: "down" },
  { label: "→", key: "right" },
];

interface Props {
  send: (base64: string) => void;
  ctrlArmed: boolean;
  onToggleCtrl: () => void;
}

export function ControlBar({ send, ctrlArmed, onToggleCtrl }: Props) {
  const press = (key: NamedKey) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendKey(key, send, ctrlArmed);
    if (ctrlArmed) {
      onToggleCtrl();
    }
  };

  return (
    <View style={styles.bar}>
      {KEYS.map((spec) => (
        <TouchableOpacity
          key={spec.key}
          style={styles.key}
          onPress={() => press(spec.key)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={spec.label}
        >
          <Text style={[styles.keyLabel, spec.tint ? { color: spec.tint } : null]}>{spec.label}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.key, styles.ctrl, ctrlArmed && styles.ctrlActive]}
        onPress={() => {
          void Haptics.selectionAsync();
          onToggleCtrl();
        }}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="Control modifier"
      >
        <Text style={[styles.keyLabel, ctrlArmed && styles.ctrlLabelActive]}>
          {ctrlArmed ? "CTRL" : "ctrl"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    borderTopColor: "#1b2130",
    borderTopWidth: 1,
    backgroundColor: "#0e131c",
  },
  key: {
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#141926",
  },
  keyLabel: { color: "#c8d3e0", fontSize: 13, fontFamily: "monospace" },
  ctrl: { backgroundColor: "#141926", borderWidth: 1, borderColor: "#232b3b" },
  ctrlActive: { backgroundColor: "#7fd1b9", borderColor: "#7fd1b9" },
  ctrlLabelActive: { color: "#0b0e14", fontWeight: "700" },
});
