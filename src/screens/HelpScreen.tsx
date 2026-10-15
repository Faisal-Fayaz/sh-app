import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GESTURE_REFERENCE } from "@/gestures/gestureMap";

interface Props {
  onClose: () => void;
}

interface RowProps {
  label: string;
  outcome: string;
}

function Row({ label, outcome }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowOutcome}>{outcome}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Everything the app responds to, in one place.
 *
 * The gesture rows come from GESTURE_REFERENCE rather than being written out
 * by hand, because a guide that describes gestures the code no longer performs
 * is worse than no guide.
 */
export function HelpScreen({ onClose }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>How to use this</Text>
        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button">
          <Text style={styles.headerLabel}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title="Gestures">
          <Text style={styles.sectionBody}>
            Two fingers for control keys, one finger for the rest. A single finger has to stay free
            to select text and scroll.
          </Text>
          {GESTURE_REFERENCE.map((entry) => (
            <Row key={entry.id} label={entry.label} outcome={entry.outcome} />
          ))}
          <Row label="Pinch" outcome="Resizes the text" />
        </Section>

        <Section title="Control bar">
          <Text style={styles.sectionBody}>
            The keys a phone keyboard hides, along the bottom of the terminal.
          </Text>
          <Row label="Esc, Tab" outcome="Sent to the shell" />
          <Row label="^C, ^D, ^Z" outcome="Interrupt, end input, suspend" />
          <Row label="ctrl" outcome="Sticky — pair it with a letter key" />
          <Row label="A−, A+" outcome="Text size, same as pinching" />
        </Section>

        <Section title="Sessions">
          <Text style={styles.sectionBody}>
            Sessions keep running on your machine when the app closes. Open Sessions to attach to one
            that is still alive, or to start another. Reconnecting replays what you missed rather
            than starting over.
          </Text>
        </Section>

        <Section title="Commands">
          <Text style={styles.sectionBody}>
            Save the commands you type often and swipe a card to run it in the live shell. Editing
            them from the phone needs a write token; without one the list stays read-only.
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomColor: "#1b2130",
    borderBottomWidth: 1,
  },
  title: { color: "#eef3fa", fontSize: 20, fontWeight: "700" },
  headerLabel: { color: "#6ba8f5", fontSize: 15 },
  scroll: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: "#7fd1b9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sectionBody: { color: "#8aa4c8", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  row: {
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 7,
  },
  rowLabel: { color: "#eef3fa", fontSize: 14, fontWeight: "600" },
  rowOutcome: { color: "#5a6478", fontSize: 12, marginTop: 2 },
});
