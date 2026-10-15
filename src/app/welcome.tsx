import { router } from "expo-router";
import React, { useCallback } from "react";

import { WelcomeScreen, type WelcomeDestination } from "@/screens/WelcomeScreen";
import { useSettings } from "@/state/SettingsProvider";

export default function WelcomeRoute() {
  const { settings, save } = useSettings();

  const handleContinue = useCallback(
    async (destination: WelcomeDestination) => {
      try {
        await save({ ...settings, seenWelcome: true });
      } catch {
        // Failing to record the flag only means the walkthrough shows again.
        // Refusing to navigate would strand the user on a screen they just
        // finished reading.
      }
      router.replace(destination);
    },
    [save, settings],
  );

  return <WelcomeScreen onContinue={handleContinue} />;
}
