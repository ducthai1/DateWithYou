// Minimal Chrome DevTools Protocol harness — no puppeteer. Node 22 (global WebSocket).
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const DEFAULT_PORT = 9333;
const hostFor = (port) => `http://127.0.0.1:${port}`;

export async function launchChrome(profileDir, port = DEFAULT_PORT, { width = 1400, height = 900, extraArgs = [] } = {}) {
  mkdirSync(profileDir, { recursive: true });
  const child = spawn("google-chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars",
    `--window-size=${width},${height}`, "--force-color-profile=srgb", ...extraArgs, "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${hostFor(port)}/json/version`); if (r.ok) return child; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  throw new Error("Chrome did not open its debugging port");
}

export async function openPage(port = DEFAULT_PORT) {
  const res = await fetch(`${hostFor(port)}/json/new?about:blank`, { method: "PUT" });
  const { webSocketDebuggerUrl } = await res.json();
  const ws = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) for (const l of listeners) l(msg);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, 30000);
  });
  const waitForEvent = (method, timeout = 20000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`event timeout: ${method}`)), timeout);
    const l = (msg) => { if (msg.method === method) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); resolve(msg.params); } };
    listeners.push(l);
  });
  await send("Page.enable"); await send("Runtime.enable");
  const page = {
    send, waitForEvent,
    on(method, fn) { const l = (m) => { if (m.method === method) fn(m.params); }; listeners.push(l); return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; },
    close: () => ws.close(),
    async viewport(width, height, mobile, deviceScaleFactor = mobile ? 3 : 1) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile });
    },
    async goto(url) { const loaded = waitForEvent("Page.loadEventFired", 60000); await send("Page.navigate", { url }); await loaded.catch(() => {}); },
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) { const d = r.exceptionDetails; throw new Error(`${d.text}: ${d.exception?.description ?? d.exception?.value ?? ""}`); }
      return r.result?.value;
    },
    async until(expression, { timeout = 20000 } = {}) {
      const started = Date.now();
      while (Date.now() - started < timeout) { try { if (await page.eval(expression)) return true; } catch {} await new Promise((r) => setTimeout(r, 150)); }
      throw new Error(`timed out waiting for: ${expression.slice(0, 120)}`);
    },
    async shot(file, { fullPage = false } = {}) {
      let clip;
      if (fullPage) {
        const m = await page.eval(`JSON.stringify({w: document.documentElement.scrollWidth, h: Math.min(document.documentElement.scrollHeight, 6000)})`);
        const { w, h } = JSON.parse(m);
        clip = { x: 0, y: 0, width: w, height: h, scale: 1 };
      }
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: fullPage, ...(clip ? { clip } : {}) });
      writeFileSync(file, Buffer.from(data, "base64"));
    },
  };
  return page;
}
