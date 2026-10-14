import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { parsePairingUri } from "@/agent/pairing";
import { useSettings } from "@/state/SettingsProvider";

/**
 * Scan the pairing code the agent prints.
 *
 * Manual entry is deliberately kept one tap away. The camera needs a permission
 * prompt, refuses to work if the user declines it, and cannot see a screen that is
 * not in front of it -- which is a real situation for anyone SSHing in from a
 * browser or a locked-down machine.
 */
export function PairingScreen() {
  const router = useRouter();
  const { settings, save } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [torch, setTorch] = useState(false);

  const apply = useCallback(
    async (raw: string) => {
      if (busy) return;
      const result = parsePairingUri(raw);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setBusy(true);
      try {
        await save({
          ...settings,
          host: result.pairing.host,
          port: result.pairing.port,
          token: result.pairing.token,
          writeToken: result.pairing.writeToken || settings.writeToken,
        });
        router.replace("/terminal");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setBusy(false);
      }
    },
    [busy, router, save, settings],
  );

  const onScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (result?.data) void apply(result.data);
    },
    [apply],
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#7fd1b9" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <Text style={styles.title}>Camera access</Text>
          <Text style={styles.body}>
            Scanning reads the pairing code from the terminal the agent runs in. Nothing is uploaded.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => void requestPermission()}>
            <Text style={styles.buttonLabel}>Allow camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => router.back()}>
            <Text style={styles.linkLabel}>Enter details by hand instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerLabel}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan to pair</Text>
        <TouchableOpacity style={styles.headerButton} onPress={() => setTorch((t) => !t)} hitSlop={10}>
          <Text style={styles.headerLabel}>{torch ? "Torch off" : "Torch on"}</Text>
        </TouchableOpacity>
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={busy ? undefined : onScan}
      />

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.hint}>Point the camera at the QR code in the terminal running your agent.</Text>
        <TouchableOpacity style={styles.link} onPress={() => void Linking.openSettings()}>
          <Text style={styles.linkLabel}>Camera settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => router.replace("/connect")}>
          <Text style={styles.linkLabel}>Enter details by hand instead</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerButton: { paddingHorizontal: 6, paddingVertical: 4, minWidth: 70 },
  headerLabel: { color: "#6ba8f5", fontSize: 14 },
  title: { color: "#eef3fa", fontSize: 18, fontWeight: "700" },
  camera: { flex: 1, marginHorizontal: 16, borderRadius: 12, overflow: "hidden" },
  footer: { padding: 20, gap: 10, alignItems: "center" },
  hint: { color: "#5a6478", fontSize: 12, textAlign: "center" },
  error: { color: "#ff8787", fontSize: 13, textAlign: "center" },
  body: { color: "#8aa4c8", fontSize: 14, textAlign: "center", lineHeight: 20 },
  button: { backgroundColor: "#7fd1b9", borderRadius: 10, paddingVertical: 14, paddingHorizontal: 28 },
  buttonLabel: { color: "#0b0e14", fontSize: 16, fontWeight: "700" },
  link: { paddingVertical: 6 },
  linkLabel: { color: "#6ba8f5", fontSize: 14 },
});