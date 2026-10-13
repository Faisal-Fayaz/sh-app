import { router } from "expo-router";
import React from "react";

import { SessionSwitcher } from "@/screens/SessionSwitcher";
import { useAgent, type SessionTarget } from "@/agent/AgentProvider";

export default function SessionsRoute() {
  const { sessionId, attachTo } = useAgent();

  return (
    <SessionSwitcher
      currentSessionId={sessionId}
      onAttach={(target: SessionTarget) => {
        attachTo(target);
        router.replace("/terminal");
      }}
      onClose={() => router.back()}
    />
  );
}