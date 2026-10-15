import { router } from "expo-router";
import React, { useCallback } from "react";

import { HelpScreen } from "@/screens/HelpScreen";

export default function HelpRoute() {
  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/terminal");
  }, []);

  return <HelpScreen onClose={close} />;
}
