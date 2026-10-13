import * as SecureStore from "expo-secure-store";

export interface Settings {
  host: string;
  port: string;
  token: string;
  writeToken: string;
}

const HOST_KEY = "sh.host";
const PORT_KEY = "sh.port";
const TOKEN_KEY = "sh.token";
const WRITE_TOKEN_KEY = "sh.writeToken";

export const DEFAULT_SETTINGS: Settings = {
  host: "",
  port: "8765",
  token: "",
  writeToken: "",
};

export async function loadSettings(): Promise<Settings> {
  const [host, port, token, writeToken] = await Promise.all([
    SecureStore.getItemAsync(HOST_KEY),
    SecureStore.getItemAsync(PORT_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(WRITE_TOKEN_KEY),
  ]);
  return {
    host: host ?? DEFAULT_SETTINGS.host,
    port: port ?? DEFAULT_SETTINGS.port,
    token: token ?? DEFAULT_SETTINGS.token,
    writeToken: writeToken ?? DEFAULT_SETTINGS.writeToken,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(HOST_KEY, settings.host),
    SecureStore.setItemAsync(PORT_KEY, settings.port),
    SecureStore.setItemAsync(TOKEN_KEY, settings.token),
    SecureStore.setItemAsync(WRITE_TOKEN_KEY, settings.writeToken),
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
