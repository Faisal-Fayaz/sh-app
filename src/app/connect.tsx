import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";

import { ConnectScreen } from "@/screens/ConnectScreen";
import { useSettings } from "@/state/SettingsProvider";
import type { Settings } from "@/storage/settings";

export default function ConnectRoute() {
  const { settings, configured, save } = useSettings();
  const params = useLocalSearchParams<{ manual?: string }>();
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (next: Settings) => {
      setError(null);
      try {
        await save(next);
        router.replace("/terminal");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [save],
  );

  return (
    <ConnectScreen
      initial={settings}
      onSave={handleSave}
      externalError={error}
      initialManual={params.manual === "1"}
      onCancel={configured ? () => router.replace("/terminal") : undefined}
    />
  );
}
