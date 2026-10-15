import * as SecureStore from "expo-secure-store";

import { clampFontSize, DEFAULT_FONT_SIZE } from "@/agent/fontSize";
import { resolveSeenFlag } from "@/storage/onboarding";

export interface Settings {
  host: string;
  port: string;
  token: string;
  writeToken: string;
  /** Terminal font size in CSS pixels. Pinned to the device, not the host. */
  fontSize: number;
  /** The install walkthrough has been shown or dismissed. */
  seenWelcome: boolean;
  /** The one-time gesture card has been dismissed. */
  seenGestures: boolean;
}

const HOST_KEY = "sh.host";
const PORT_KEY = "sh.port";
const TOKEN_KEY = "sh.token";
const WRITE_TOKEN_KEY = "sh.writeToken";
const FONT_SIZE_KEY = "sh.fontSize";
const SEEN_WELCOME_KEY = "sh.seenWelcome";
const SEEN_GESTURES_KEY = "sh.seenGestures";

export const DEFAULT_SETTINGS: Settings = {
  host: "",
  port: "8765",
  token: "",
  writeToken: "",
  fontSize: DEFAULT_FONT_SIZE,
  seenWelcome: false,
  seenGestures: false,
};

export async function loadSettings(): Promise<Settings> {
  const [host, port, token, writeToken, fontSize, seenWelcome, seenGestures] = await Promise.all([
    SecureStore.getItemAsync(HOST_KEY),
    SecureStore.getItemAsync(PORT_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(WRITE_TOKEN_KEY),
    SecureStore.getItemAsync(FONT_SIZE_KEY),
    SecureStore.getItemAsync(SEEN_WELCOME_KEY),
    SecureStore.getItemAsync(SEEN_GESTURES_KEY),
  ]);

  // Absent flags belong to an install that predates them. Such a device is
  // already talking to an agent, so showing it the first-run tour would be
  // telling someone how to do the thing they are doing.
  const alreadyPaired = Boolean((host ?? "") && (token ?? ""));

  return {
    host: host ?? DEFAULT_SETTINGS.host,
    port: port ?? DEFAULT_SETTINGS.port,
    token: token ?? DEFAULT_SETTINGS.token,
    writeToken: writeToken ?? DEFAULT_SETTINGS.writeToken,
    fontSize: clampFontSize(Number(fontSize) || DEFAULT_SETTINGS.fontSize),
    seenWelcome: resolveSeenFlag(seenWelcome, alreadyPaired),
    seenGestures: resolveSeenFlag(seenGestures, alreadyPaired),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(HOST_KEY, settings.host),
    SecureStore.setItemAsync(PORT_KEY, settings.port),
    SecureStore.setItemAsync(TOKEN_KEY, settings.token),
    SecureStore.setItemAsync(WRITE_TOKEN_KEY, settings.writeToken),
    SecureStore.setItemAsync(FONT_SIZE_KEY, String(settings.fontSize)),
    SecureStore.setItemAsync(SEEN_WELCOME_KEY, settings.seenWelcome ? "true" : "false"),
    SecureStore.setItemAsync(SEEN_GESTURES_KEY, settings.seenGestures ? "true" : "false"),
  ]);
}

export async function clearSettings(): Promise<void> {
  // Deliberately not clearing the seen flags: disconnecting from an agent is not
  // a factory reset, and replaying the install walkthrough afterwards would read
  // as though the app had forgotten the user.
  await Promise.all([
    SecureStore.deleteItemAsync(HOST_KEY),
    SecureStore.deleteItemAsync(PORT_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(WRITE_TOKEN_KEY),
  ]);
}
