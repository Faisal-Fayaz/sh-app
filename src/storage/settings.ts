import * as SecureStore from "expo-secure-store";

import { clampFontSize, DEFAULT_FONT_SIZE } from "@/agent/fontSize";

export interface Settings {
  host: string;
  port: string;
  token: string;
  writeToken: string;
  /** Terminal font size in CSS pixels. Pinned to the device, not the host. */
  fontSize: number;
}

const HOST_KEY = "sh.host";
const PORT_KEY = "sh.port";
const TOKEN_KEY = "sh.token";
const WRITE_TOKEN_KEY = "sh.writeToken";
const FONT_SIZE_KEY = "sh.fontSize";

export const DEFAULT_SETTINGS: Settings = {
  host: "",
  port: "8765",
  token: "",
  writeToken: "",
  fontSize: DEFAULT_FONT_SIZE,
};

export async function loadSettings(): Promise<Settings> {
  const [host, port, token, writeToken, fontSize] = await Promise.all([
    SecureStore.getItemAsync(HOST_KEY),
    SecureStore.getItemAsync(PORT_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(WRITE_TOKEN_KEY),
    SecureStore.getItemAsync(FONT_SIZE_KEY),
  ]);
  return {
    host: host ?? DEFAULT_SETTINGS.host,
    port: port ?? DEFAULT_SETTINGS.port,
    token: token ?? DEFAULT_SETTINGS.token,
    writeToken: writeToken ?? DEFAULT_SETTINGS.writeToken,
    fontSize: clampFontSize(Number(fontSize) || DEFAULT_SETTINGS.fontSize),
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(HOST_KEY, settings.host),
    SecureStore.setItemAsync(PORT_KEY, settings.port),
    SecureStore.setItemAsync(TOKEN_KEY, settings.token),
    SecureStore.setItemAsync(WRITE_TOKEN_KEY, settings.writeToken),
    SecureStore.setItemAsync(FONT_SIZE_KEY, String(settings.fontSize)),
  ]);
}

export async function clearSettings(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(HOST_KEY),
    SecureStore.deleteItemAsync(PORT_KEY),
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(WRITE_TOKEN_KEY),
  ]);
}
