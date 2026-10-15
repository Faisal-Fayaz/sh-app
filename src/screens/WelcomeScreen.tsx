import React, { useCallback, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CommandBlock } from "@/components/CommandBlock";

export type WelcomeDestination = "/pair" | "/connect?manual=1";

interface Props {
  onContinue: (destination: WelcomeDestination) => Promise<void> | void;
}

interface StepAction {
  label: string;
  url: string;
}

interface StepProps {
  index: number;
  title: string;
  body: string;
  command?: string;
  action?: StepAction;
}

function Step({ index, title, body, command, action }: StepProps) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={styles.number}>
          <Text style={styles.numberText}>{index}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      <Text style={styles.stepBody}>{body}</Text>
      {command ? <CommandBlock command={command} /> : null}
      {action ? (
        <TouchableOpacity
          onPress={() => void Linking.openURL(action.url)}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel={action.label}
        >
          <Text style={styles.stepLink}>{action.label} →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * First run.
 *
 * The app is useless without the agent already listening, and nothing used to
 * say so -- a new user reached a form asking for a host, a port and a token
 * before anything had told them those existed. These three steps are the whole
 * install, in the order they have to happen.
 */
export function WelcomeScreen({ onContinue }: Props) {
  const [leaving, setLeaving] = useState<WelcomeDestination | null>(null);

  const go = useCallback(
    (destination: WelcomeDestination) => {
      setLeaving(destination);
      void onContinue(destination);
    },
    [onContinue],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>sh</Text>
        <Text style={styles.subtitle}>A terminal on your own machine, in your pocket.</Text>

        <Step
          index={1}
          title="Install the agent"
          body="On the machine you want to reach. It needs Python 3.11 or newer on macOS or Linux."
          command="uv tool install sh-agent"
        />
        <Step
          index={2}
          title="Start it"
          body="It creates a token, then prints a QR code and the address your phone will dial."
          command="sh-agent"
        />
        <Step
          index={3}
          title="Scan the code"
          body="Keep the agent running, then scan what it printed. You land straight in a shell."
        />
        <Step
          index={4}
          title="Go remote, when you want it"
          body="Optional. With Tailscale on this machine and on your phone, the same code keeps working away from home instead of only on your Wi-Fi."
          action={{ label: "Get Tailscale", url: "https://tailscale.com/download" }}
        />

        <View style={styles.caveat}>
          <Text style={styles.caveatText}>
            No Windows yet — the agent needs a POSIX pty, so macOS and Linux only.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primary, leaving === "/pair" && styles.pressed]}
          onPress={() => go("/pair")}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.primaryLabel}>Scan the code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondary, leaving === "/connect?manual=1" && styles.pressed]}
          onPress={() => go("/connect?manual=1")}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryLabel}>Enter details by hand</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0e14" },
  scroll: { padding: 20, paddingTop: 28, paddingBottom: 40 },
  title: { color: "#eef3fa", fontSize: 34, fontWeight: "700", letterSpacing: 1 },
  subtitle: { color: "#5a6478", fontSize: 15, marginTop: 4, marginBottom: 26, lineHeight: 21 },
  step: { marginBottom: 22 },
  stepHead: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  number: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#141926",
    borderColor: "#2b3a4d",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  numberText: { color: "#7fd1b9", fontSize: 13, fontWeight: "700" },
  stepTitle: { color: "#eef3fa", fontSize: 17, fontWeight: "600" },
  stepBody: { color: "#8aa4c8", fontSize: 13, lineHeight: 19 },
  stepLink: { color: "#6ba8f5", fontSize: 13, fontWeight: "600", marginTop: 10 },
  caveat: {
    borderLeftColor: "#2b3a4d",
    borderLeftWidth: 2,
    paddingLeft: 12,
    marginBottom: 26,
  },
  caveatText: { color: "#5a6478", fontSize: 12, lineHeight: 18 },
  primary: {
    backgroundColor: "#7fd1b9",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  pressed: { opacity: 0.6 },
  primaryLabel: { color: "#0b0e14", fontSize: 16, fontWeight: "700" },
  secondary: { marginTop: 16, alignItems: "center", paddingVertical: 8 },
  secondaryLabel: { color: "#6ba8f5", fontSize: 14 },
});
