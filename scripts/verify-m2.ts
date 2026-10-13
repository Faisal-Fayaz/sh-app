import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AgentClient } from "../src/agent/AgentClient";
import { routeBridgeMessage } from "../src/terminal/bridge";
import { buildTerminalHtml } from "../src/terminal/terminalHtml";

const HOST = process.env.SH_VERIFY_HOST ?? "127.0.0.1";
const PORT = Number(process.env.SH_VERIFY_PORT ?? 8765);
const TOKEN = process.env.SH_TOKEN ?? "";

const results: Array<{ ok: boolean; label: string; detail?: string }> = [];

function check(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` -- ${detail}` : ""}`);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  if (!TOKEN) {
    console.error("SH_TOKEN is required");
    process.exit(2);
  }

  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });

  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(msg.text());
  });

  const inbound: string[] = [];
  const client = new AgentClient({
    host: HOST,
    port: PORT,
    token: TOKEN,
    onFrame: (frame) => {
      if (frame.type === "stdout" && frame.data) {
        inbound.push(frame.data);
      }
    },
    onStatus: () => {},
  });
  await client.createSession(80, 24);
  client.connect();

  const writeToTerminal = (chunk: string) =>
    page.evaluate((data: string) => (window as any).__sh.writeBase64(data), chunk);

  const html = buildTerminalHtml();
  check(html.length > 100_000, "generated html is non-trivial", `${Math.round(html.length / 1024)} KiB`);

  const htmlPath = join(tmpdir(), "sh-terminal-verify.html");
  writeFileSync(htmlPath, html, "utf8");

  await page.evaluateOnNewDocument(() => {
    const w = window as unknown as {
      ReactNativeWebView: { postMessage: (data: string) => void };
      __posted: string[];
    };
    w.__posted = [];
    w.ReactNativeWebView = {
      postMessage: (data: string) => {
        w.__posted.push(data);
      },
    };
  });

  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  check(pageErrors.length === 0, "no page errors on load", pageErrors.slice(0, 2).join(" | "));

  const bridgeReady = await page.evaluate(() => typeof (window as any).__sh?.writeBase64 === "function");
  check(bridgeReady, "window.__sh bridge exposes writeBase64");

  const seen: string[] = [];
  const pump = async (): Promise<void> => {
    while (inbound.length > 0) {
      await writeToTerminal(inbound.shift() as string);
    }
    const posted = await page.evaluate(() => {
      const all = (window as any).__posted as string[];
      (window as any).__posted = [];
      return all;
    });
    for (const raw of posted) {
      routeBridgeMessage(raw, {
        onReady: () => {},
        onInput: (data) => client.sendStdin(data),
        onResize: (cols, rows) => client.sendResize(cols, rows),
      });
    }
    seen.push(...posted);
  };

  const terminalText = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".xterm-rows > div"))
        .map((r) => r.textContent ?? "")
        .join("\n"),
    );

  const terminalHtml = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".xterm-rows > div"))
        .map((r) => (r as HTMLElement).innerHTML)
        .join("\n"),
    );

  const lastFrame = (type: string) => {
    for (let i = seen.length - 1; i >= 0; i--) {
      const parsed = JSON.parse(seen[i]) as { type: string; cols?: number; rows?: number };
      if (parsed.type === type) return parsed;
    }
    return undefined;
  };

  const waitUntil = async (predicate: () => boolean, timeoutMs: number): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await pump();
      if (predicate()) return true;
      await delay(100);
    }
    return predicate();
  };

  const typeAndWait = async (keys: string, predicate: (text: string) => boolean, timeoutMs = 15000) => {
    await page.keyboard.type(keys, { delay: 10 });
    let ok = false;
    await waitUntil(() => false, 0);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await pump();
      const text = await terminalText();
      if (predicate(text)) {
        ok = true;
        break;
      }
      await delay(120);
    }
    return ok;
  };

  await waitUntil(() => seen.length > 0, 5000);

  const ready = lastFrame("ready");
  check(
    ready !== undefined && ready.cols! > 0 && ready.rows! > 0,
    "bridge posts a ready frame with a computed grid",
    ready ? `${ready.cols}x${ready.rows}` : "missing",
  );

  const resize = lastFrame("resize");
  check(
    resize !== undefined && resize.cols! > 0 && resize.rows! > 0,
    "fit addon reports a non-zero grid",
    resize ? `${resize.cols}x${resize.rows}` : "missing",
  );

  const grid = resize ?? ready ?? { cols: 80, rows: 24 };

  await page.evaluate(() => {
    const el = document.querySelector(".xterm-helper-textarea") as HTMLTextAreaElement | null;
    if (!el) throw new Error("xterm helper textarea not found");
    el.focus();
  });
  await delay(400);

  check(
    await typeAndWait("echo m2-bridge-$((13*7))\n", (t) => t.includes("m2-bridge-91")),
    "typed keystrokes reach the agent and stdout renders in xterm",
  );

  check(
    await typeAndWait("printf '\\x1b[32mGREENOK\\x1b[0m\\n'\n", (t) => t.includes("GREENOK")),
    "ANSI colour command round-trips",
  );

  const dump = await terminalHtml();
  check(/xterm-fg-\d+/.test(dump), "ANSI colours applied as real xterm styles, not raw escape bytes");

  const unicodeOk = await typeAndWait(
    "printf 'UTF8-\\xe4\\xb8\\x96\\xe7\\x95\\x8c\\n'\n",
    (t) => t.includes("UTF8-世界"),
  );
  const unicodeText = await terminalText();
  check(unicodeOk && unicodeText.includes("UTF8-世界"), "multibyte UTF-8 survives the base64 round trip");

  await typeAndWait("stty size\n", () => false, 6000);
  await pump();
  const sizeText = await terminalText();
  check(
    new RegExp(`\\b${grid.rows} ${grid.cols}\\b`).test(sizeText),
    "agent applied the grid reported by the app",
    `expected "${grid.rows} ${grid.cols}"`,
  );

  check(pageErrors.length === 0, "no page errors during the session", pageErrors.slice(0, 3).join(" | "));

  client.disconnect();
  await browser.close();

  console.log("");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`failed: ${failed.map((f) => f.label).join(", ")}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
