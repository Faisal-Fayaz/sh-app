import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";

import { parsePairingUri } from "@/agent/pairing";
import { useSettings } from "@/state/SettingsProvider";

/**
 * Entry point: send the user where they belong, honouring an incoming sh:// link.
 *
 * A pairing link can arrive two ways -- scanned by the camera, or opened from
 * chat or a browser because the phone recognised the scheme. Both land here when
 * the app was closed, so the link is applied before deciding where to navigate,
 * otherwise a cold launch would bounce to the connect screen and drop it.
 */
export default function Index() {
  const router = useRouter();
  const { ready, configured, settings, save } = useSettings();
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (!ready || handled) return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        // getInitialURL covers a cold launch; the listener covers a link that
        // arrives while the app is already open.
        let url: string | null = null;
        try {
          url = await Linking.getInitialURL();
        } catch {
          url = null;
        }
        if (cancelled) return;

        if (url) {
          const result = parsePairingUri(url);
          if (result.ok) {
            await save({
              ...settings,
              host: result.pairing.host,
              port: result.pairing.port,
              token: result.pairing.token,
              writeToken: result.pairing.writeToken || settings.writeToken,
              // A pairing link is proof the agent exists, so the install
              // walkthrough has nothing left to tell this user.
              seenWelcome: true,
            });
            if (cancelled) return;
            setHandled(true);
            router.replace("/terminal");
            return;
          }
        }

        subscription = Linking.addEventListener("url", ({ url: next }) => {
          const parsed = parsePairingUri(next);
          if (!parsed.ok) return;
          void save({
            ...settings,
            host: parsed.pairing.host,
            port: parsed.pairing.port,
            token: parsed.pairing.token,
            writeToken: parsed.pairing.writeToken || settings.writeToken,
            seenWelcome: true,
          }).then(() => router.replace("/terminal"));
        });
      } catch {
        // Probing for a link is a convenience. If it fails for any reason the app
        // still has to start, or the user is left staring at a spinner with no
        // way forward.
      } finally {
        if (!cancelled) setHandled(true);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [handled, ready, router, save, settings]);

  if (!ready || !handled) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#7fd1b9" />
      </View>
    );
  }

  if (!settings.seenWelcome) {
    return <Redirect href="/welcome" />;
  }

  return <Redirect href={configured ? "/terminal" : "/connect"} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#0b0e14", alignItems: "center", justifyContent: "center" },
});