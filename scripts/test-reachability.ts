import { isTailnetAddress } from "../src/agent/AgentClient";

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

// Tailscale hands out 100.64.0.0/10, so the boundaries are the whole point: a
// check that merely looks at the first octet would also claim 100.0.0.1.
check(isTailnetAddress("100.64.89.48"), "an ordinary tailnet address is recognised");
check(isTailnetAddress("100.64.0.0"), "the bottom of the range is inside it");
check(isTailnetAddress("100.127.255.255"), "the top of the range is inside it");

check(!isTailnetAddress("100.63.255.255"), "just below the range is not");
check(!isTailnetAddress("100.128.0.0"), "just above the range is not");
check(!isTailnetAddress("100.0.0.1"), "a non-tailnet 100.x address is not");
check(!isTailnetAddress("192.168.1.50"), "a LAN address is not");
check(!isTailnetAddress("127.0.0.1"), "loopback is not");
check(!isTailnetAddress("faisal.tailf06003.ts.net"), "a MagicDNS name is not");
check(!isTailnetAddress("100.64"), "a truncated address is not");
check(!isTailnetAddress("100.64.1.2.3"), "a five-part address is not");
check(!isTailnetAddress(""), "an empty host is not");
check(!isTailnetAddress("100.x.1.2"), "a non-numeric octet is not");
check(isTailnetAddress("  100.70.1.2  "), "surrounding whitespace is tolerated");

for (const label of failures) console.log(`[FAIL] ${label}`);
console.log(`\n${passed}/${passed + failed} assertions passed`);
process.exit(failed === 0 ? 0 : 1);
