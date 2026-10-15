import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Settings } from "@/storage/settings";

interface Props {
  initial: Settings;
  onSave: (settings: Settings) => Promise<void>;
  onCancel?: () => void;
  externalError?: string | null;
  /** Start with the manual form open, for the route that asks for it. */
  initialManual?: boolean;
}

export function ConnectScreen({ initial, onSave, onCancel, externalError, initialManual }: Props) {
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [token, setToken] = useState(initial.token);
  const [writeToken, setWriteToken] = useState(initial.writeToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(Boolean(initialManual));
  const [advanced, setAdvanced] = useState(false);

  const canSubmit = useMemo(() => host.trim().length > 0 && token.trim().length > 0, [host, token]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        ...initial,
        host: host.trim(),
        port: port.trim() || "8765",
        token: token.trim(),
        writeToken: writeToken.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [host, port, token, writeToken, onSave, initial]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>sh</Text>
          <Text style={styles.subtitle}>Connect to your machine</Text>

          <TouchableOpacity style={styles.scanButton} onPress={() => router.replace("/pair")}>
            <Text style={styles.scanLabel}>Scan to pair</Text>
            <Text style={styles.scanHint}>Point your camera at the QR code the agent printed</Text>
          </TouchableOpacity>

          {onCancel ? null : (
            <TouchableOpacity style={styles.helpLink} onPress={() => router.replace("/welcome")}>
              <Text style={styles.helpLabel}>Not set up yet? Install the agent first</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.dividerButton} onPress={() => setManual((open) => !open)}>
            <Text style={styles.divider}>
              {manual ? "hide manual entry" : "or enter details by hand"}
            </Text>
          </TouchableOpacity>

          {manual ? (
            <>
              <Text style={styles.label}>Host</Text>
              <TextInput
                style={styles.input}
                value={host}
                onChangeText={setHost}
                placeholder="100.x.y.z or 192.168.1.10"
                placeholderTextColor="#5a6478"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.hint}>
                Your Tailscale address. The agent prints the address to use when it starts.
              </Text>

              <Text style={styles.label}>Port</Text>
              <TextInput
                style={styles.input}
                value={port}
                onChangeText={setPort}
                placeholder="8765"
                placeholderTextColor="#5a6478"
                keyboardType="number-pad"
              />

              <Text style={styles.label}>Token</Text>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder="the token from your agent"
                placeholderTextColor="#5a6478"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Text style={styles.hint}>Stored in the device keystore, never in plain text.</Text>

              <TouchableOpacity
                style={styles.advancedButton}
                onPress={() => setAdvanced((open) => !open)}
              >
                <Text style={styles.advancedLabel}>
                  {advanced ? "− Advanced" : "+ Advanced"}
                </Text>
              </TouchableOpacity>

              {advanced ? (
                <>
                  <Text style={styles.label}>Write token (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={writeToken}
                    onChangeText={setWriteToken}
                    placeholder="blank for read-only"
                    placeholderTextColor="#5a6478"
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <Text style={styles.hint}>
                    Only needed to create or edit commands from the phone. Leave blank to keep the
                    agent read-only.
                  </Text>
                </>
              ) : null}

              {error ?? externalError ? (
                <Text style={styles.error}>{error ?? externalError}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.button, !canSubmit && styles.buttonDisabled]}
                onPress={submit}
                disabled={!canSubmit || busy}
                activeOpacity={0.8}
              >
                {busy ? (
                  <ActivityIndicator color="#0b0e14" />
                ) : (
                  <Text style={styles.buttonLabel}>Connect</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}

          {onCancel ? (
            <TouchableOpacity style={styles.linkButton} onPress={onCancel}>
              <Text style={styles.linkLabel}>Back to terminal</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.footer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingTop: 32 },
  title: { color: "#eef3fa", fontSize: 34, fontWeight: "700", letterSpacing: 1 },
  subtitle: { color: "#5a6478", fontSize: 15, marginTop: 4, marginBottom: 28 },
  label: { color: "#c8d3e0", fontSize: 13, fontWeight: "600", marginBottom: 6, letterSpacing: 0.4 },
  input: {
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 10,
    color: "#eef3fa",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "monospace",
  },
  hint: { color: "#5a6478", fontSize: 12, marginTop: 6, marginBottom: 18 },
  error: { color: "#ff8787", fontSize: 13, marginBottom: 12 },
  button: {
    backgroundColor: "#7fd1b9",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: "#2b3a4d" },
  buttonLabel: { color: "#0b0e14", fontSize: 16, fontWeight: "700" },
  linkButton: { marginTop: 18, alignItems: "center" },
  linkLabel: { color: "#6ba8f5", fontSize: 14 },
  scanButton: {
    backgroundColor: "#141926",
    borderColor: "#2b3a4d",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  scanLabel: { color: "#7fd1b9", fontSize: 16, fontWeight: "700" },
  scanHint: { color: "#5a6478", fontSize: 11, marginTop: 4, textAlign: "center" },
  helpLink: { marginTop: 14, alignItems: "center" },
  helpLabel: { color: "#6ba8f5", fontSize: 13 },
  dividerButton: { paddingVertical: 4 },
  divider: { color: "#3a4256", fontSize: 11, marginVertical: 18, textAlign: "center" },
  advancedButton: { paddingVertical: 4, marginBottom: 10 },
  advancedLabel: { color: "#6ba8f5", fontSize: 13 },
  footer: { height: 40 },
});
