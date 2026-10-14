import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

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

    (async () => {
      // getInitialURL covers a cold launch; the subscription covers a link that
      // arrives while the app is already open.
      const { Linking } = await import("react-native");
      let url: string | null = null;
      try {
        url = await Linking.getInitialURL();
      } catch {
        url = null;
      }
      if (url && !cancelled) {
        const result = parsePairingUri(url);
        if (result.ok) {
          await save({
            ...settings,
            host: result.pairing.host,
            port: result.pairing.port,
            token: result.pairing.token,
            writeToken: result.pairing.writeToken || settings.writeToken,
          });
          if (cancelled) return;
          setHandled(true);
          router.replace("/terminal");
          return;
        }
      }

      const subscription = Linking.addEventListener("url", ({ url: next }) => {
        const parsed = parsePairingUri(next);
        if (!parsed.ok) return;
        void save({
          ...settings,
          host: parsed.pairing.host,
          port: parsed.pairing.port,
          token: parsed.pairing.token,
          writeToken: parsed.pairing.writeToken || settings.writeToken,
        }).then(() => router.replace("/terminal"));
      });
      if (cancelled) {
        subscription.remove();
        return;
      }
      setHandled(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [handled, ready, router, save, settings]);

  if (!ready || !handled) {
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