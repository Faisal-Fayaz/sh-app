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
}

export function ConnectScreen({ initial, onSave, onCancel, externalError }: Props) {
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(initial.port);
  const [token, setToken] = useState(initial.token);
  const [writeToken, setWriteToken] = useState(initial.writeToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => host.trim().length > 0 && token.trim().length > 0, [host, token]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave({
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
  }, [host, port, token, writeToken, onSave]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>sh</Text>
          <Text style={styles.subtitle}>Connect to your machine</Text>

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
          <Text style={styles.hint}>Your Tailscale address. Same Wi-Fi LAN address works in development.</Text>

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
            placeholder="SH_TOKEN from your agent"
            placeholderTextColor="#5a6478"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>Stored in the device keystore, never in plain text.</Text>

          <Text style={styles.label}>Write token (optional)</Text>
          <TextInput
            style={styles.input}
            value={writeToken}
            onChangeText={setWriteToken}
            placeholder="SH_WRITE_TOKEN, blank for read-only"
            placeholderTextColor="#5a6478"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.hint}>
            Only needed to create or edit commands from the phone. Leave blank to keep the agent
            read-only.
          </Text>

          {error ?? externalError ? <Text style={styles.error}>{error ?? externalError}</Text> : null}

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={submit}
            disabled={!canSubmit || busy}
            activeOpacity={0.8}
          >
            {busy ? <ActivityIndicator color="#0b0e14" /> : <Text style={styles.buttonLabel}>Connect</Text>}
          </TouchableOpacity>

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
  footer: { height: 40 },
});
