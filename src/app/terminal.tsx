import { router } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { TerminalScreen } from "@/screens/TerminalScreen";
import { useSettings } from "@/state/SettingsProvider";

export default function TerminalRoute() {
  const { settings, configured } = useSettings();

  if (!configured) {
    return (
      <View style={styles.guard}>
        <Text style={styles.guardText}>No agent configured.</Text>
        <Text style={styles.guardLink} onPress={() => router.replace("/connect")}>
          Open settings
        </Text>
      </View>
    );
  }

  return (
    <TerminalScreen
      settings={settings}
      onOpenSettings={() => router.push("/connect")}
      onOpenPalette={() => router.push("/palette")}
      onOpenSessions={() => router.push("/sessions")}
    />
  );
}

const styles = StyleSheet.create({
  guard: {
    flex: 1,
    backgroundColor: "#0b0e14",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  guardText: { color: "#c8d3e0", fontSize: 15 },
  guardLink: { color: "#6ba8f5", fontSize: 15 },
});
