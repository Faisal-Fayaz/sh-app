export const CTRL = 0x03;
export const CTRL_D = 0x04;
export const CTRL_Z = 0x1a;
export const ESC = 0x1b;
export const TAB = 0x09;
export const SPACE = 0x20;
export const BACKSPACE = 0x7f;

export type NamedKey =
  | "escape"
  | "tab"
  | "ctrl-c"
  | "ctrl-d"
  | "ctrl-z"
  | "ctrl-l"
  | "space"
  | "backspace"
  | "enter"
  | "up"
  | "down"
  | "left"
  | "right"
  | "page-up"
  | "page-down"
  | "home"
  | "end";

const CSI = 0x5b;

const NAMED: Record<NamedKey, number[]> = {
  escape: [ESC],
  tab: [TAB],
  "ctrl-c": [CTRL],
  "ctrl-d": [CTRL_D],
  "ctrl-z": [CTRL_Z],
  "ctrl-l": [0x0c],
  space: [SPACE],
  backspace: [BACKSPACE],
  enter: [0x0d],
  up: [ESC, CSI, 0x41],
  down: [ESC, CSI, 0x42],
  right: [ESC, CSI, 0x43],
  left: [ESC, CSI, 0x44],
  "page-up": [ESC, CSI, 0x35, 0x7e],
  "page-down": [ESC, CSI, 0x36, 0x7e],
  home: [ESC, CSI, 0x48],
  end: [ESC, CSI, 0x46],
};

export function keyBytes(key: NamedKey): number[] {
  return [...NAMED[key]];
}

export function isAsciiLetter(byte: number): boolean {
  const upper = byte & ~0x20;
  return upper >= 0x41 && upper <= 0x5a;
}

export function applyCtrl(bytes: number[]): number[] {
  return bytes.map((byte) => {
    const upper = byte & ~0x20;
    if (upper >= 0x41 && upper <= 0x5a) return upper & 0x1f;
    switch (byte) {
      case 0x0d:
        return CTRL_D;
      case 0x09:
        return TAB;
      case ESC:
        return ESC;
      case SPACE:
        return SPACE;
      case BACKSPACE:
        return BACKSPACE;
      default:
        return byte;
    }
  });
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET[i]] = i;

export function bytesToBase64(bytes: number[] | Uint8Array): string {
  const input = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  let out = "";
  for (let i = 0; i < input.length; i += 3) {
    const b0 = input[i];
    const b1 = input[i + 1];
    const b2 = input[i + 2];
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : ALPHABET[b2 & 0x3f];
  }
  return out;
}

export function base64ToBytes(data: string): number[] {
  const clean = data.replace(/[^A-Za-z0-9+/]/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n0 = LOOKUP[clean[i]] ?? 0;
    const n1 = LOOKUP[clean[i + 1]] ?? 0;
    const n2 = LOOKUP[clean[i + 2]];
    const n3 = LOOKUP[clean[i + 3]];
    out.push(((n0 << 2) | (n1 >> 4)) & 0xff);
    if (n2 !== undefined) out.push(((n1 << 4) | (n2 >> 2)) & 0xff);
    if (n3 !== undefined) out.push(((n2 << 6) | n3) & 0xff);
  }
  return out;
}

export function sendKey(
  key: NamedKey,
  send: (base64: string) => void,
  ctrl: boolean = false,
): number[] {
  const bytes = ctrl ? applyCtrl(keyBytes(key)) : keyBytes(key);
  send(bytesToBase64(bytes));
  return bytes;
}

export function sendBytes(
  bytes: number[],
  send: (base64: string) => void,
  ctrl: boolean = false,
): number[] {
  const finalBytes = ctrl ? applyCtrl(bytes) : bytes;
  send(bytesToBase64(finalBytes));
  return finalBytes;
}
