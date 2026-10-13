export interface BridgeMessage {
  type: "ready" | "input" | "resize" | "title" | string;
  data?: string;
  cols?: number;
  rows?: number;
  title?: string;
}

export interface BridgeHandlers {
  onReady: (cols: number, rows: number) => void;
  onInput: (base64: string) => void;
  onResize: (cols: number, rows: number) => void;
  onTitle?: (title: string) => void;
}

export function parseBridgeMessage(raw: string): BridgeMessage | null {
  try {
    const parsed = JSON.parse(raw) as BridgeMessage;
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function routeBridgeMessage(raw: string, handlers: BridgeHandlers): boolean {
  const message = parseBridgeMessage(raw);
  if (!message) return false;

  switch (message.type) {
    case "ready":
      if (message.cols && message.rows) {
        handlers.onReady(message.cols, message.rows);
      }
      return true;
    case "input":
      if (message.data) {
        handlers.onInput(message.data);
      }
      return true;
    case "resize":
      if (message.cols && message.rows) {
        handlers.onResize(message.cols, message.rows);
      }
      return true;
    case "title":
      if (message.title) {
        handlers.onTitle?.(message.title);
      }
      return true;
    default:
      return false;
  }
}
