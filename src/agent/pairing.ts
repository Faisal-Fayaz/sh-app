/**
 * Parsing the pairing link the agent prints.
 *
 * Kept free of React and camera APIs so it can be tested directly: a scanner that
 * silently mis-parses a token is far worse than one that visibly fails, and the
 * failure would otherwise only show up on a real device pointed at a real screen.
 */

export interface Pairing {
  host: string;
  port: string;
  token: string;
  writeToken: string;
}

export const DEFAULT_PORT = "8765";

/**
 * Decode a sh://connect?... link into settings.
 *
 * Returns a reason rather than throwing, because the input comes from a camera:
 * whatever the user pointed it at could be a QR code for something else entirely,
 * and "that is not a pairing code" is a useful thing to say.
 */
export function parsePairingUri(input: string): { ok: true; pairing: Pairing } | { ok: false; reason: string } {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "Nothing scanned." };

  const withoutScheme = raw.replace(/^sh:\/\//i, "");
  if (withoutScheme === raw) {
    return { ok: false, reason: "That is not an sh pairing code." };
  }

  const queryStart = withoutScheme.indexOf("?");
  if (queryStart === -1) {
    return { ok: false, reason: "The pairing code is missing its details." };
  }

  const params = new Map<string, string>();
  for (const pair of withoutScheme.slice(queryStart + 1).split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = eq === -1 ? pair : pair.slice(0, eq);
    const value = eq === -1 ? "" : pair.slice(eq + 1);
    // URLSearchParams would decode for us, but it also swallows malformed input
    // silently and turns "+" into a space, which a token_urlsafe never contains.
    try {
      params.set(decodeURIComponent(key).toLowerCase(), decodeURIComponent(value));
    } catch {
      return { ok: false, reason: "The pairing code is malformed." };
    }
  }

  const host = (params.get("host") ?? "").trim();
  const token = (params.get("token") ?? "").trim();

  if (!host) return { ok: false, reason: "The pairing code has no host." };
  if (!token) return { ok: false, reason: "The pairing code has no token." };

  const portParam = (params.get("port") ?? "").trim();
  if (portParam && !/^\d+$/.test(portParam)) {
    return { ok: false, reason: "The pairing code has an invalid port." };
  }

  return {
    ok: true,
    pairing: {
      host,
      port: portParam || DEFAULT_PORT,
      token,
      writeToken: (params.get("wt") ?? "").trim(),
    },
  };
}

/** Build the same link, used when the app shares its own pairing code. */
export function buildPairingUri(pairing: Pairing): string {
  const params = [`host=${encodeURIComponent(pairing.host)}`, `port=${encodeURIComponent(pairing.port)}`];
  if (pairing.token) params.push(`token=${encodeURIComponent(pairing.token)}`);
  if (pairing.writeToken) params.push(`wt=${encodeURIComponent(pairing.writeToken)}`);
  return `sh://connect?${params.join("&")}`;
}