import { buildPairingUri, DEFAULT_PORT, parsePairingUri } from "../src/agent/pairing";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(ok: boolean, label: string): void {
  if (ok) passed++;
  else {
    failed++;
    failures.push(label);
  }
}

const scan = (value: string) => {
  const result = parsePairingUri(value);
  if (!result.ok) return result;
  return result;
};

const parsed = (value: string) => {
  const result = parsePairingUri(value);
  if (!result.ok) throw new Error(`expected ${value} to parse`);
  return result.pairing;
};

/** True when the parser refused the input, which is what these assert. */
const rejected = (value: string) => !parsePairingUri(value).ok;

// The exact shape the agent prints.
const uri = buildPairingUri({
  host: "172.20.10.3",
  port: "8765",
  token: "Ghvh1yKmk3RNyHU_EtAC-xqtniNPxCqtIA7IKqUZ_6A",
  writeToken: "",
});

check(parsed(uri).host === "172.20.10.3", "a pairing code yields its host");
check(parsed(uri).port === "8765", "a pairing code yields its port");
check(
  parsed(uri).token === "Ghvh1yKmk3RNyHU_EtAC-xqtniNPxCqtIA7IKqUZ_6A",
  "a token with url-safe punctuation survives the round trip",
);
check(parsed(uri).writeToken === "", "an absent write token comes back empty");

// The agent omits port when it is the default only in theory; be tolerant anyway.
const noPort = "sh://connect?host=100.64.0.9&token=abc";
check(parsed(noPort).port === DEFAULT_PORT, "a missing port falls back to the default");
check(parsed(noPort).host === "100.64.0.9", "a tailnet address parses like any other");

const withWrite = "sh://connect?host=10.0.0.1&port=9000&token=t&wt=w";
check(parsed(withWrite).writeToken === "w", "a write token is picked up");
check(parsed(withWrite).port === "9000", "a non-default port is honoured");

// tokens_urlsafe never yields +, but a hand-edited or older code might.
const encoded = "sh://connect?host=10.0.0.1&token=a%2Bb%2Fc%3D%3D";
check(parsed(encoded).token === "a+b/c==", "percent-encoded characters decode correctly");

check(rejected(""), "an empty scan is rejected");
check(rejected("https://example.com"), "an unrelated web link is rejected");
check(rejected("sh://connect"), "a pairing code with no query is rejected");
check(rejected("sh://connect?token=t"), "a pairing code with no host is rejected");
check(rejected("sh://connect?host=1.2.3.4"), "a pairing code with no token is rejected");
check(rejected("sh://connect?host=1.2.3.4&token=t&port=abc"), "a non-numeric port is rejected");
check(rejected("sh://connect?host=1.2.3.4&token=%E0%A4%A"), "malformed percent-encoding is rejected");

// The QR may be scanned with surrounding whitespace or a stray prefix.
check(parsed(`  ${uri}  `).host === "172.20.10.3", "surrounding whitespace is tolerated");
check(parsed("SH://CONNECT?host=1.2.3.4&token=t").token === "t", "the scheme is case-insensitive");
check(parsed("sh://connect?HOST=1.2.3.4&TOKEN=t").token === "t", "parameter names are case-insensitive");

const roundTrip = buildPairingUri({ host: "h", port: "1", token: "t", writeToken: "w" });
check(
  parsed(roundTrip).writeToken === "w" && parsed(roundTrip).token === "t",
  "build and parse are inverses",
);

// Guard against a silent regression where the parser starts accepting everything.
check(scan(uri).ok === true, "a well-formed code still parses after all the rejections");

for (const label of failures) console.log(`[FAIL] ${label}`);
console.log(`\n${passed}/${passed + failed} assertions passed`);
process.exit(failed === 0 ? 0 : 1);
