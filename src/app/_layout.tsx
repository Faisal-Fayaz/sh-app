import React from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";

import { AgentProvider } from "@/agent/AgentProvider";
import { SettingsProvider } from "@/state/SettingsProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AgentProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#0b0e14" },
                animation: "fade",
              }}
            />
          </AgentProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
