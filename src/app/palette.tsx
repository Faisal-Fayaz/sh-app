import { router } from "expo-router";
import React from "react";

import { PaletteScreen } from "@/screens/PaletteScreen";

export default function PaletteRoute() {
  return <PaletteScreen onClose={() => router.back()} onRan={() => router.replace("/terminal")} />;
}
