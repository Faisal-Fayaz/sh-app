import { ADDON_FIT_JS_B64, XTERM_CSS_B64, XTERM_JS_B64 } from "./generated/assets";

const STYLES = `
  html, body, #root {
    margin: 0;
    padding: 0;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: #0b0e14;
  }
  .xterm .xterm-viewport {
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .xterm .xterm-viewport::-webkit-scrollbar { display: none; }
`;

const BRIDGE = String.raw`
(function () {
  var Terminal = window.Terminal;
  var FitAddon = window.FitAddon.FitAddon;

  function fromB64(b64) {
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function toB64(bytes) {
    var chunk = 0x8000;
    var binary = "";
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  var term = new Terminal({
    convertEol: false,
    cursorBlink: true,
    cursorStyle: "block",
    scrollback: 5000,
    fontSize: 13,
    fontFamily: "monospace",
    allowProposedApi: true,
    theme: {
      background: "#0b0e14",
      foreground: "#c8d3e0",
      cursor: "#7fd1b9",
      selectionBackground: "#2b3a4d",
      black: "#1b2130",
      red: "#ff6b6b",
      green: "#7fd1b9",
      yellow: "#f2c14e",
      blue: "#6ba8f5",
      magenta: "#c792ea",
      cyan: "#5ecfd6",
      white: "#c8d3e0",
      brightBlack: "#5a6478",
      brightRed: "#ff8787",
      brightGreen: "#9ae6c4",
      brightYellow: "#ffd479",
      brightBlue: "#8fc1ff",
      brightMagenta: "#dcb0ff",
      brightCyan: "#87e6ea",
      brightWhite: "#eef3fa"
    }
  });

  var fit = new FitAddon();
  term.loadAddon(fit);

  term.onData(function (data) {
    post({ type: "input", data: toB64(new TextEncoder().encode(data)) });
  });

  term.onResize(function (size) {
    post({ type: "resize", cols: size.cols, rows: size.rows });
  });

  term.onTitleChange(function (title) {
    post({ type: "title", title: title });
  });

  window.__sh = {
    writeBase64: function (b64) {
      term.write(fromB64(b64));
    },
    writeText: function (text) {
      term.write(text);
    },
    resize: function (cols, rows) {
      term.resize(cols, rows);
    },
    fit: function () {
      try {
        fit.fit();
      } catch (e) {
        return null;
      }
      return { cols: term.cols, rows: term.rows };
    },
    setFontSize: function (size) {
      term.options.fontSize = size;
      fit.fit();
      return { cols: term.cols, rows: term.rows };
    },
    focus: function () {
      term.focus();
    },
    clear: function () {
      term.clear();
    },
    destroy: function () {
      term.dispose();
    },
    snapshot: function () {
      return { cols: term.cols, rows: term.rows };
    }
  };

  term.open(document.getElementById("root"));

  if (window.ResizeObserver) {
    var observer = new ResizeObserver(function () {
      var result = window.__sh.fit();
      if (result) post({ type: "resize", cols: result.cols, rows: result.rows });
    });
    observer.observe(document.getElementById("root"));
  }

  setTimeout(function () {
    var result = window.__sh.fit();
    post({
      type: "ready",
      cols: result ? result.cols : term.cols,
      rows: result ? result.rows : term.rows
    });
  }, 0);
})();
`;

function injectStyle(b64: string): string {
  return `<style id="sh-xterm-css"></style><script>document.getElementById("sh-xterm-css").textContent=atob("${b64}")</script>`;
}

function injectScript(b64: string): string {
  return `<script>(function(){var s=document.createElement("script");s.textContent=atob("${b64}");document.head.appendChild(s);})()</script>`;
}

let cached: string | null = null;

export function buildTerminalHtml(): string {
  if (cached) return cached;
  cached = [
    "<!DOCTYPE html>",
    '<html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">',
    "<style>",
    STYLES,
    "</style>",
    injectStyle(XTERM_CSS_B64),
    "</head><body>",
    '<div id="root"></div>',
    injectScript(XTERM_JS_B64),
    injectScript(ADDON_FIT_JS_B64),
    "<script>",
    BRIDGE,
    "</script>",
    "</body></html>",
  ].join("\n");
  return cached;
}
