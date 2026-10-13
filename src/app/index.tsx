import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useSettings } from "@/state/SettingsProvider";

export default function Index() {
  const { ready, configured } = useSettings();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#7fd1b9" />
      </View>
    );
  }

  return <Redirect href={configured ? "/terminal" : "/connect"} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#0b0e14", alignItems: "center", justifyContent: "center" },
});
