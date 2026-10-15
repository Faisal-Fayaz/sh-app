import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  command: string;
}

/**
 * A shell command with a copy button.
 *
 * The commands on the welcome screen are the entire install, and retyping
 * `uv tool install sh-agent` on a phone is the kind of friction that ends a
 * first run. The confirmation is the button label itself rather than a toast,
 * because the copy happens while the user is looking at the thing they copied.
 */
export function CommandBlock({ command }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(command);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can fail on a locked device. The command stays on
      // screen and selectable, so the fallback is reading it.
    }
  }, [command]);

  return (
    <View style={styles.row}>
      <Text style={styles.command} selectable>
        {command}
      </Text>
      <TouchableOpacity
        style={[styles.copy, copied && styles.copyDone]}
        onPress={copy}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={copied ? "Copied" : `Copy command: ${command}`}
      >
        <Text style={[styles.copyLabel, copied && styles.copyLabelDone]}>
          {copied ? "Copied" : "Copy"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141926",
    borderColor: "#232b3b",
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: 10,
  },
  command: { flex: 1, color: "#7fd1b9", fontSize: 13, fontFamily: "monospace" },
  copy: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7 },
  copyDone: { backgroundColor: "#1c2b26" },
  copyLabel: { color: "#6ba8f5", fontSize: 13, fontWeight: "600" },
  copyLabelDone: { color: "#7fd1b9" },
});
