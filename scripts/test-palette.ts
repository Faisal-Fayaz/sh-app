import {
  commandLine,
  filterEntries,
  groupEntries,
  runPayload,
  type PaletteEntry,
} from "../src/agent/commandsApi";

let passed = 0;
let failed = 0;
const failures: string[] = [];

let counter = 0;
function assertEqual(actual: unknown, expected: unknown, label: string): void {
  counter++;
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else {
    failed++;
    failures.push(`#${counter} ${label}\n     expected ${e}\n     actual   ${a}`);
  }
}

function entry(partial: Partial<PaletteEntry> & { name: string }): PaletteEntry {
  return {
    id: partial.id ?? partial.name,
    name: partial.name,
    command: partial.command ?? ["echo"],
    group: partial.group ?? "general",
    builtin: partial.builtin ?? false,
    description: partial.description ?? null,
  };
}

// --- command line rendering -------------------------------------------------

assertEqual(commandLine(entry({ name: "a", command: ["uptime"] })), "uptime", "simple command is unquoted");
assertEqual(
  commandLine(entry({ name: "b", command: ["df", "-h"] })),
  "df -h",
  "flags and paths stay unquoted",
);
assertEqual(
  commandLine(entry({ name: "c", command: ["echo", "hello world"] })),
  "echo 'hello world'",
  "arguments with spaces are quoted",
);
assertEqual(
  commandLine(entry({ name: "d", command: ["sh", "-c", "echo it's here"] })),
  "sh -c 'echo it'\\''s here'",
  "embedded single quotes are escaped",
);
assertEqual(commandLine(entry({ name: "e", command: ["echo", ""] })), "echo ''", "empty argument is quoted");

// --- run payload ------------------------------------------------------------

assertEqual(runPayload(entry({ name: "f", command: ["uptime"] })), "uptime\n", "run payload appends a newline");
assertEqual(
  runPayload(entry({ name: "g", command: ["echo", "hi there"] })),
  "echo 'hi there'\n",
  "run payload quotes before the newline",
);

// --- grouping ---------------------------------------------------------------

const grouped = groupEntries([
  entry({ name: "uptime", group: "system" }),
  entry({ name: "ps", group: "docker" }),
  entry({ name: "zsh", group: "zzz" }),
  entry({ name: "alphabet", group: "aaa" }),
]);
assertEqual(
  grouped.map((g) => g.name),
  ["system", "docker", "aaa", "zzz"],
  "known groups sort first, unknown groups alphabetically after",
);
assertEqual(grouped[0].entries[0].name, "uptime", "grouped entries are preserved");

assertEqual(
  groupEntries([entry({ name: "x", group: "" })]).map((g) => g.name),
  ["general"],
  "empty group falls back to general",
);

// --- filtering --------------------------------------------------------------

const all = [
  entry({ name: "restart agent", command: ["systemctl", "restart"], group: "ops", description: "bounce the daemon" }),
  entry({ name: "logs", command: ["journalctl", "-u", "sh-agent"], group: "ops" }),
  entry({ name: "ps", command: ["docker", "ps"], group: "docker" }),
];

assertEqual(filterEntries(all, "").length, 3, "empty query returns everything");
assertEqual(filterEntries(all, "   ").length, 3, "whitespace query returns everything");
assertEqual(filterEntries(all, "restart").map((e) => e.name), ["restart agent"], "matches by name");
assertEqual(filterEntries(all, "OPS").map((e) => e.name), ["restart agent", "logs"], "group match is case-insensitive");
assertEqual(filterEntries(all, "daemon").map((e) => e.name), ["restart agent"], "matches by description");
assertEqual(filterEntries(all, "journalctl").map((e) => e.name), ["logs"], "matches by command");
assertEqual(filterEntries(all, "nothing-here").length, 0, "no matches returns empty");
assertEqual(filterEntries(all, "o").length, 3, "partial substrings match");

failures.forEach((detail, index) => {
  console.log(`[FAIL ${index}] ${detail}`);
});
console.log(`\n${passed}/${passed + failed} assertions passed`);
process.exit(failed === 0 ? 0 : 1);
